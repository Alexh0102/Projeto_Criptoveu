import { useCallback, useEffect, useRef, useState } from 'react'

import {
  VEU_NOTES_MIN_PASSWORD_LENGTH,
  VEU_NOTES_PBKDF2_ITERATIONS,
  VeuNotesCryptoError,
  decodeBase64ToBytes,
  decryptNoteWithKey,
  deriveSessionKey,
  encryptNoteWithKey,
  type VeuNotesBlobJson,
} from '../lib/veunotes-crypto'
import {
  VEU_NOTES_BACKUP_FILE,
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

function createDownload(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
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
  if (error instanceof VeuNotesCryptoError || error instanceof VeuNotesStorageError) {
    return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Ocorreu um erro inesperado ao processar o cofre local.'
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
  const [note, setNote] = useState('')
  const [storageBytes, setStorageBytes] = useState(0)
  const [vaultExists, setVaultExists] = useState(false)
  const [toast, setToast] = useState<VeuNotesToast>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [storageError, setStorageError] = useState<string | null>(null)

  const sessionKeyRef = useRef<CryptoKey | null>(null)
  const sessionSaltRef = useRef<Uint8Array | null>(null)
  const sessionIterationsRef = useRef<number>(VEU_NOTES_PBKDF2_ITERATIONS)
  const lastSavedNoteRef = useRef('')
  const idleTimerRef = useRef<number | null>(null)
  const hiddenTimerRef = useRef<number | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const isUnlocked = vaultState === 'unlocked'
  const isDirty = isUnlocked && note !== lastSavedNoteRef.current
  const storageWarning =
    storageBytes > VEU_NOTES_STORAGE_WARNING_BYTES
      ? 'O cofre está crescendo. Exporte um backup e evite usar o campo como arquivo de texto longo.'
      : null
  const usageLabel = formatStorageUsage(storageBytes)

  const clearSession = useCallback(() => {
    sessionKeyRef.current = null
    sessionSaltRef.current = null
    sessionIterationsRef.current = VEU_NOTES_PBKDF2_ITERATIONS
    setNote('')
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

  const saveNote = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!sessionKeyRef.current || !sessionSaltRef.current) {
        throw new Error('Não existe uma sessão ativa para salvar a nota.')
      }

      const blob = await encryptNoteWithKey(
        note,
        sessionKeyRef.current,
        sessionSaltRef.current,
        sessionIterationsRef.current,
      )

      persistBlob(blob)
      lastSavedNoteRef.current = note

      if (!options?.silent) {
        showToast('success', 'Nota salva localmente.')
      }

      return blob
    },
    [note, persistBlob, showToast],
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
      setVaultState((currentState) => (currentState === 'unlocked' ? currentState : 'locked'))
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

    const handleActivity = () => {
      resetIdleTimer()
    }

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
      void saveNote({ silent: true })
    }, autosaveDelayMs)

    return () => window.clearTimeout(autosaveTimer)
  }, [autosaveDelayMs, isBusy, isDirty, isUnlocked, saveNote])

  const createVault = useCallback(
    async (password: string, confirmation: string) => {
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
        const salt = crypto.getRandomValues(new Uint8Array(16))
        const sessionKey = await deriveSessionKey(
          normalizedPassword,
          salt,
          VEU_NOTES_PBKDF2_ITERATIONS,
        )
        const blob = await encryptNoteWithKey(
          '',
          sessionKey,
          salt,
          VEU_NOTES_PBKDF2_ITERATIONS,
        )

        persistBlob(blob)
        sessionKeyRef.current = sessionKey
        sessionSaltRef.current = salt
        sessionIterationsRef.current = VEU_NOTES_PBKDF2_ITERATIONS
        lastSavedNoteRef.current = ''
        setNote('')
        setVaultState('unlocked')
        showToast('success', 'Cofre criado localmente. Sua sessão segura está ativa.')
      } finally {
        setIsBusy(false)
      }
    },
    [persistBlob, showToast],
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

        const salt = decodeBase64ToBytes(blob.salt)
        const sessionKey = await deriveSessionKey(password, salt, blob.iterations)
        const decrypted = await decryptNoteWithKey(blob, sessionKey)

        sessionKeyRef.current = sessionKey
        sessionSaltRef.current = salt
        sessionIterationsRef.current = blob.iterations
        lastSavedNoteRef.current = decrypted
        setNote(decrypted)
        setVaultState('unlocked')
        setStorageBytes(measureVaultBlobBytes(blob))
        setStorageError(null)
        showToast('success', 'Cofre destrancado com sucesso.')
      } finally {
        setIsBusy(false)
      }
    },
    [showToast],
  )

  const exportVault = useCallback(async () => {
    const blob = isDirty ? await saveNote({ silent: true }) : loadVaultBlob()

    if (!blob) {
      throw new Error('Não existe cofre salvo para exportar.')
    }

    createDownload(
      VEU_NOTES_BACKUP_FILE,
      JSON.stringify(blob, null, 2),
      'application/json',
    )
    showToast('success', 'Backup exportado com sucesso. Guarde em local seguro.')
  }, [isDirty, saveNote, showToast])

  const importBackup = useCallback(
    async (file: File, password: string) => {
      setIsBusy(true)

      try {
        assertSupportedBackupFile(file)
        const rawContent = await file.text()
        const importedBlob = parseVaultBlob(rawContent)
        const salt = decodeBase64ToBytes(importedBlob.salt)
        const sessionKey = await deriveSessionKey(password, salt, importedBlob.iterations)
        const decrypted = await decryptNoteWithKey(importedBlob, sessionKey)

        persistBlob(importedBlob)
        sessionKeyRef.current = sessionKey
        sessionSaltRef.current = salt
        sessionIterationsRef.current = importedBlob.iterations
        lastSavedNoteRef.current = decrypted
        setNote(decrypted)
        setVaultState('unlocked')
        setStorageError(null)
        showToast('success', 'Backup importado com sucesso.')
      } finally {
        setIsBusy(false)
      }
    },
    [persistBlob, showToast],
  )

  const removeBrokenVault = useCallback(() => {
    clearVault()
    clearSession()
    setVaultExists(false)
    setStorageBytes(0)
    setVaultState('create')
    setStorageError(null)
    showToast('info', 'Cofre local removido. Agora você pode criar um novo cofre ou importar um backup.')
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
    note,
    setNote,
    vaultExists,
    isBusy,
    isDirty,
    isUnlocked,
    storageBytes,
    storageWarning,
    lastSavedAt,
    storageError,
    idleMinutes,
    toast,
    createVault: (password: string, confirmation: string) =>
      safeAction(() => createVault(password, confirmation)),
    unlockVault: (password: string) => safeAction(() => unlockVault(password)),
    saveNote: (options?: { silent?: boolean }) => safeAction(() => saveNote(options)),
    exportVault: () => safeAction(exportVault),
    importBackup: (file: File, password: string) => safeAction(() => importBackup(file, password)),
    lockVault: (reason?: string) => lockVault(reason),
    clearBrokenVault: removeBrokenVault,
    dismissToast: () => setToast(null),
    usageLabel,
  }
}
