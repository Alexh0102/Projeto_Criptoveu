import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  VEU_NOTES_MIN_PASSWORD_LENGTH,
  VeuNotesCryptoError,
  createVeuNotesVault,
  encryptNoteWithSession,
  unlockVeuNotesBlob,
  type VeuNotesBlobJson,
  type VeuNotesRecoveryMode,
  type VeuNotesSession,
} from '../lib/veunotes-crypto'
import {
  PORTABLE_VAULT_MAX_NOTES,
  PortableVaultError,
  addPortableVaultNote,
  createPortableVault,
  createPortableVaultNote,
  decodePortableVaultPlaintext,
  removePortableVaultNote,
  searchPortableVaultNotes,
  serializePortableVault,
  updatePortableVaultNote,
  type PortableVaultDocument,
  type PortableVaultNote,
} from '../lib/portable-vault'
import {
  VEU_NOTES_BACKUP_FILE,
  VEU_NOTES_BACKUP_MIME_TYPE,
  VEU_NOTES_STORAGE_WARNING_BYTES,
  VeuNotesStorageError,
  assertSupportedBackupFile,
  clearVault,
  loadVaultBlob,
  measureVaultBlobBytes,
  parseVaultBlob,
  saveVaultBlob,
} from '../lib/veunotes-storage'

export type VeuNotesVaultState = 'create' | 'locked' | 'unlocked'
export type VeuNotesToastTone = 'success' | 'error' | 'info'

export type VeuNotesToast = {
  id: number
  tone: VeuNotesToastTone
  message: string
} | null

type UseVeuNotesOptions = {
  idleMinutes?: 5 | 10 | 15
  hiddenGraceMs?: number
  autosaveDelayMs?: number
}

const DEFAULT_IDLE_MINUTES = 10
const DEFAULT_HIDDEN_GRACE_MS = 60_000
const DEFAULT_AUTOSAVE_DELAY_MS = 2_500

function createDownload(
  fileName: string,
  dadosCifrados: string,
  mimeType: string = VEU_NOTES_BACKUP_MIME_TYPE,
) {
  const blob = new Blob([dadosCifrados], {
    type: mimeType || 'application/octet-stream',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function getFriendlyErrorMessage(error: unknown) {
  if (
    error instanceof VeuNotesCryptoError ||
    error instanceof VeuNotesStorageError ||
    error instanceof PortableVaultError
  ) {
    return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Ocorreu um erro inesperado ao processar o cofre portátil.'
}

export function formatStorageUsage(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function useVeuNotes(options: UseVeuNotesOptions = {}) {
  const idleMinutes = options.idleMinutes ?? DEFAULT_IDLE_MINUTES
  const hiddenGraceMs = options.hiddenGraceMs ?? DEFAULT_HIDDEN_GRACE_MS
  const autosaveDelayMs = options.autosaveDelayMs ?? DEFAULT_AUTOSAVE_DELAY_MS
  const idleMs = idleMinutes * 60_000

  const [vaultState, setVaultState] = useState<VeuNotesVaultState>('locked')
  const [vault, setVault] = useState<PortableVaultDocument | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [storageBytes, setStorageBytes] = useState(0)
  const [vaultExists, setVaultExists] = useState(false)
  const [toast, setToast] = useState<VeuNotesToast>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [storageError, setStorageError] = useState<string | null>(null)

  const sessionRef = useRef<VeuNotesSession | null>(null)
  const lastSavedVaultRef = useRef('')
  const idleTimerRef = useRef<number | null>(null)
  const hiddenTimerRef = useRef<number | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const isUnlocked = vaultState === 'unlocked' && vault !== null
  const serializedVault = vault ? serializePortableVault(vault) : ''
  const isDirty =
    isUnlocked && serializedVault !== lastSavedVaultRef.current
  const storageWarning =
    storageBytes > VEU_NOTES_STORAGE_WARNING_BYTES
      ? 'O cofre está crescendo. Exporte um backup e mantenha uma cópia segura.'
      : null
  const usageLabel = formatStorageUsage(storageBytes)
  const recoveryMode = sessionRef.current?.recoveryMode ?? 'standard'
  const selectedNote =
    vault?.notes.find((note) => note.id === selectedNoteId) ?? null
  const visibleNotes = useMemo(
    () => searchPortableVaultNotes(vault?.notes ?? [], searchQuery),
    [searchQuery, vault?.notes],
  )

  const clearSession = useCallback(() => {
    sessionRef.current = null
    lastSavedVaultRef.current = ''
    setVault(null)
    setSelectedNoteId(null)
    setSearchQuery('')
  }, [])

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }

    if (hiddenTimerRef.current) {
      window.clearTimeout(hiddenTimerRef.current)
      hiddenTimerRef.current = null
    }
  }, [])

  const showToast = useCallback((tone: VeuNotesToastTone, message: string) => {
    setToast((currentToast) => ({
      id: (currentToast?.id ?? 0) + 1,
      tone,
      message,
    }))
  }, [])

  const lockVault = useCallback(
    (reason?: string) => {
      clearTimers()
      clearSession()
      setVaultState(vaultExists ? 'locked' : 'create')

      if (reason) {
        showToast('info', reason)
      }
    },
    [clearSession, clearTimers, showToast, vaultExists],
  )

  const persistBlob = useCallback((blob: VeuNotesBlobJson) => {
    const nextBytes = saveVaultBlob(blob)
    setVaultExists(true)
    setStorageBytes(nextBytes)
    setStorageError(null)
    setLastSavedAt(Date.now())
    return nextBytes
  }, [])

  const saveVault = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!sessionRef.current || !vault) {
        throw new Error('Não existe uma sessão ativa para salvar o cofre.')
      }

      const plaintext = serializePortableVault(vault)
      const blob = await encryptNoteWithSession(plaintext, sessionRef.current)

      persistBlob(blob)
      lastSavedVaultRef.current = plaintext

      if (!options?.silent) {
        showToast('success', 'Cofre portátil salvo localmente.')
      }

      return blob
    },
    [persistBlob, showToast, vault],
  )

  const refreshStorageState = useCallback(() => {
    try {
      const blob = loadVaultBlob()

      if (!blob) {
        setVaultExists(false)
        setStorageBytes(0)
        setVaultState('create')
        setStorageError(null)
        return
      }

      setVaultExists(true)
      setStorageBytes(measureVaultBlobBytes(blob))
      setVaultState((currentState) =>
        currentState === 'unlocked' ? currentState : 'locked',
      )
      setStorageError(null)
    } catch (error) {
      setVaultExists(true)
      setStorageBytes(0)
      setVaultState('locked')
      setStorageError(getFriendlyErrorMessage(error))
    }
  }, [])

  useEffect(() => {
    refreshStorageState()
  }, [refreshStorageState])

  useEffect(() => {
    if (!toast) {
      return
    }

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, 4200)

    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
        toastTimerRef.current = null
      }
    }
  }, [toast])

  const resetIdleTimer = useCallback(() => {
    if (!isUnlocked) {
      return
    }

    if (idleTimerRef.current) {
      window.clearTimeout(idleTimerRef.current)
    }

    idleTimerRef.current = window.setTimeout(() => {
      lockVault('Sessão segura encerrada. Digite a senha para continuar.')
    }, idleMs)
  }, [idleMs, isUnlocked, lockVault])

  useEffect(() => {
    if (!isUnlocked) {
      clearTimers()
      return
    }

    const handleActivity = () => resetIdleTimer()
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenTimerRef.current = window.setTimeout(() => {
          lockVault('Sessão segura encerrada. Digite a senha para continuar.')
        }, hiddenGraceMs)
        return
      }

      if (hiddenTimerRef.current) {
        window.clearTimeout(hiddenTimerRef.current)
        hiddenTimerRef.current = null
      }

      resetIdleTimer()
    }

    resetIdleTimer()
    window.addEventListener('pointerdown', handleActivity)
    window.addEventListener('keydown', handleActivity)
    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('touchstart', handleActivity)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearTimers()
      window.removeEventListener('pointerdown', handleActivity)
      window.removeEventListener('keydown', handleActivity)
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('touchstart', handleActivity)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [clearTimers, hiddenGraceMs, isUnlocked, lockVault, resetIdleTimer])

  useEffect(() => {
    if (!isUnlocked || !isDirty || isBusy) {
      return
    }

    const autosaveTimer = window.setTimeout(() => {
      void saveVault({ silent: true }).catch((error) => {
        showToast(
          'error',
          `O salvamento automático falhou: ${getFriendlyErrorMessage(error)}`,
        )
      })
    }, autosaveDelayMs)

    return () => window.clearTimeout(autosaveTimer)
  }, [autosaveDelayMs, isBusy, isDirty, isUnlocked, saveVault, showToast])

  const activateVault = useCallback(
    (
      nextVault: PortableVaultDocument,
      session: VeuNotesSession,
      savedPlaintext: string,
    ) => {
      sessionRef.current = session
      lastSavedVaultRef.current = savedPlaintext
      setVault(nextVault)
      setSelectedNoteId(nextVault.notes[0]?.id ?? null)
      setSearchQuery('')
      setVaultState('unlocked')
      setStorageError(null)
    },
    [],
  )

  const createVault = useCallback(
    async (
      password: string,
      confirmation: string,
      recoveryMode: VeuNotesRecoveryMode = 'standard',
    ) => {
      const normalizedPassword = password.trim()

      if (normalizedPassword.length < VEU_NOTES_MIN_PASSWORD_LENGTH) {
        throw new Error(
          `Use uma senha com pelo menos ${VEU_NOTES_MIN_PASSWORD_LENGTH} caracteres.`,
        )
      }

      if (normalizedPassword !== confirmation) {
        throw new Error('A confirmação da senha não confere.')
      }

      setIsBusy(true)

      try {
        const nextVault = createPortableVault()
        const plaintext = serializePortableVault(nextVault)
        const { blob, session } = await createVeuNotesVault(
          plaintext,
          normalizedPassword,
          recoveryMode,
        )

        persistBlob(blob)
        activateVault(nextVault, session, plaintext)
        showToast(
          'success',
          'Cofre portátil criado. Exporte um backup após adicionar suas notas.',
        )
      } finally {
        setIsBusy(false)
      }
    },
    [activateVault, persistBlob, showToast],
  )

  const unlockVault = useCallback(
    async (password: string) => {
      setIsBusy(true)

      try {
        const blob = loadVaultBlob()

        if (!blob) {
          setVaultState('create')
          throw new Error('Nenhum cofre local foi encontrado neste navegador.')
        }

        const unlocked = await unlockVeuNotesBlob(blob, password)
        const decoded = decodePortableVaultPlaintext(unlocked.plaintext)
        const plaintext = serializePortableVault(decoded.vault)
        const requiresMigration =
          decoded.migratedFromLegacyNote || unlocked.migratedBlob !== null

        if (requiresMigration) {
          const migratedBlob = await encryptNoteWithSession(
            plaintext,
            unlocked.session,
          )
          persistBlob(migratedBlob)
        } else {
          setStorageBytes(measureVaultBlobBytes(blob))
        }

        activateVault(decoded.vault, unlocked.session, plaintext)
        showToast(
          'success',
          requiresMigration
            ? 'Cofre destrancado e migrado com segurança para o formato portátil.'
            : 'Cofre portátil destrancado com sucesso.',
        )
      } finally {
        setIsBusy(false)
      }
    },
    [activateVault, persistBlob, showToast],
  )

  const exportVault = useCallback(async () => {
    const blob = isDirty ? await saveVault({ silent: true }) : loadVaultBlob()

    if (!blob) {
      throw new Error('Não existe cofre salvo para exportar.')
    }

    createDownload(
      VEU_NOTES_BACKUP_FILE,
      JSON.stringify(blob, null, 2),
      'application/octet-stream',
    )
    showToast(
      'success',
      'Cofre .criptoveu-note exportado. Guarde o arquivo e a senha separadamente.',
    )
  }, [isDirty, saveVault, showToast])

  const importBackup = useCallback(
    async (file: File, password: string) => {
      setIsBusy(true)

      try {
        assertSupportedBackupFile(file)
        const importedBlob = parseVaultBlob(await file.text())
        const unlocked = await unlockVeuNotesBlob(importedBlob, password)
        const decoded = decodePortableVaultPlaintext(unlocked.plaintext)
        const plaintext = serializePortableVault(decoded.vault)
        const requiresMigration =
          decoded.migratedFromLegacyNote || unlocked.migratedBlob !== null
        const blobToPersist = requiresMigration
          ? await encryptNoteWithSession(plaintext, unlocked.session)
          : importedBlob

        persistBlob(blobToPersist)
        activateVault(decoded.vault, unlocked.session, plaintext)
        showToast(
          'success',
          requiresMigration
            ? 'Backup antigo importado e migrado para o cofre portátil.'
            : 'Cofre portátil importado com sucesso.',
        )
      } finally {
        setIsBusy(false)
      }
    },
    [activateVault, persistBlob, showToast],
  )

  const changePassword = useCallback(
    async (
      currentPassword: string,
      newPassword: string,
      confirmation: string,
    ) => {
      if (!vault) {
        throw new Error('Desbloqueie o cofre antes de trocar a senha.')
      }

      const normalizedPassword = newPassword.trim()
      if (normalizedPassword.length < VEU_NOTES_MIN_PASSWORD_LENGTH) {
        throw new Error(
          `Use uma nova senha com pelo menos ${VEU_NOTES_MIN_PASSWORD_LENGTH} caracteres.`,
        )
      }
      if (normalizedPassword !== confirmation) {
        throw new Error('A confirmação da nova senha não confere.')
      }
      if (currentPassword === normalizedPassword) {
        throw new Error('A nova senha deve ser diferente da senha atual.')
      }

      setIsBusy(true)

      try {
        const currentBlob = loadVaultBlob()
        if (!currentBlob) {
          throw new Error('O cofre local não está disponível.')
        }

        await unlockVeuNotesBlob(currentBlob, currentPassword)
        const plaintext = serializePortableVault(vault)
        const { blob, session } = await createVeuNotesVault(
          plaintext,
          normalizedPassword,
          sessionRef.current?.recoveryMode ?? 'standard',
        )

        persistBlob(blob)
        sessionRef.current = session
        lastSavedVaultRef.current = plaintext
        showToast(
          'success',
          'Senha alterada. Exporte um novo backup; arquivos antigos continuam usando a senha anterior.',
        )
      } finally {
        setIsBusy(false)
      }
    },
    [persistBlob, showToast, vault],
  )

  const setRecoveryMode = useCallback(
    async (nextMode: VeuNotesRecoveryMode) => {
      if (
        !vault ||
        !sessionRef.current ||
        sessionRef.current.recoveryMode === nextMode
      ) {
        return
      }

      setIsBusy(true)

      try {
        const plaintext = serializePortableVault(vault)
        const nextSession: VeuNotesSession = {
          ...sessionRef.current,
          recoveryMode: nextMode,
        }
        const blob = await encryptNoteWithSession(plaintext, nextSession)

        persistBlob(blob)
        sessionRef.current = nextSession
        lastSavedVaultRef.current = plaintext
        showToast(
          'success',
          nextMode === 'recoverable'
            ? 'Modo recuperável com paridade ativado. Exporte um novo backup.'
            : 'Modo recuperável desativado. O cofre foi salvo no formato padrão.',
        )
      } finally {
        setIsBusy(false)
      }
    },
    [persistBlob, showToast, vault],
  )

  const createNote = useCallback(() => {
    if (!vault) {
      return
    }

    if (vault.notes.length >= PORTABLE_VAULT_MAX_NOTES) {
      showToast(
        'error',
        `O cofre atingiu o limite de ${PORTABLE_VAULT_MAX_NOTES} notas.`,
      )
      return
    }

    const note = createPortableVaultNote()
    setVault(addPortableVaultNote(vault, note))
    setSelectedNoteId(note.id)
    setSearchQuery('')
  }, [showToast, vault])

  const updateNote = useCallback(
    (
      noteId: string,
      patch: Partial<Pick<PortableVaultNote, 'title' | 'content' | 'tags'>>,
    ) => {
      setVault((currentVault) =>
        currentVault
          ? updatePortableVaultNote(currentVault, noteId, patch)
          : currentVault,
      )
    },
    [],
  )

  const deleteNote = useCallback(
    (noteId: string) => {
      if (!vault) {
        return
      }

      const nextVault = removePortableVaultNote(vault, noteId)
      setVault(nextVault)
      setSelectedNoteId((currentId) =>
        currentId === noteId ? (nextVault.notes[0]?.id ?? null) : currentId,
      )
      showToast('info', 'Nota removida do cofre. O autosave registrará a alteração.')
    },
    [showToast, vault],
  )

  const removeBrokenVault = useCallback(() => {
    clearVault()
    clearSession()
    setVaultExists(false)
    setStorageBytes(0)
    setVaultState('create')
    setStorageError(null)
    showToast(
      'info',
      'Cofre local removido. Agora você pode criar um novo ou importar um backup.',
    )
  }, [clearSession, showToast])

  const safeAction = useCallback(
    async <T,>(action: () => Promise<T>) => {
      try {
        return await action()
      } catch (error) {
        showToast('error', getFriendlyErrorMessage(error))
        return null
      }
    },
    [showToast],
  )

  return {
    vaultState,
    vault,
    notes: vault?.notes ?? [],
    visibleNotes,
    selectedNote,
    selectedNoteId,
    setSelectedNoteId,
    searchQuery,
    setSearchQuery,
    vaultExists,
    isBusy,
    isDirty,
    isUnlocked,
    storageBytes,
    storageWarning,
    lastSavedAt,
    storageError,
    recoveryMode,
    idleMinutes,
    toast,
    createVault: (
      password: string,
      confirmation: string,
      recoveryMode: VeuNotesRecoveryMode = 'standard',
    ) => safeAction(() => createVault(password, confirmation, recoveryMode)),
    unlockVault: (password: string) => safeAction(() => unlockVault(password)),
    saveVault: (options?: { silent?: boolean }) =>
      safeAction(() => saveVault(options)),
    exportVault: () => safeAction(exportVault),
    importBackup: (file: File, password: string) =>
      safeAction(() => importBackup(file, password)),
    changePassword: (
      currentPassword: string,
      newPassword: string,
      confirmation: string,
    ) =>
      safeAction(() =>
        changePassword(currentPassword, newPassword, confirmation),
      ),
    setRecoveryMode: (nextMode: VeuNotesRecoveryMode) =>
      safeAction(() => setRecoveryMode(nextMode)),
    createNote,
    updateNote,
    deleteNote,
    lockVault: (reason?: string) => lockVault(reason),
    clearBrokenVault: removeBrokenVault,
    notifyError: (message: string) => showToast('error', message),
    dismissToast: () => setToast(null),
    usageLabel,
  }
}
