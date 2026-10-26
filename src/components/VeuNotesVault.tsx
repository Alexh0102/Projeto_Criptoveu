import {
  AlertTriangle,
  Clock3,
  Download,
  FilePlus2,
  FileUp,
  KeyRound,
  Lock,
  LockKeyhole,
  Save,
  Search,
  ShieldCheck,
  Tags,
  Trash2,
  Unlock,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

import useVeuNotes from '../hooks/useVeuNotes'
import {
  PORTABLE_VAULT_MAX_CONTENT_LENGTH,
  PORTABLE_VAULT_MAX_TITLE_LENGTH,
} from '../lib/portable-vault'
import { VEU_NOTES_MIN_PASSWORD_LENGTH } from '../lib/veunotes-crypto'
import FieldBlock from './ui/FieldBlock'
import MobileStickyCTA from './ui/MobileStickyCTA'
import PasswordInput from './ui/PasswordInput'
import PasswordSecurityPanel from './ui/PasswordSecurityPanel'

type ToastTone = 'success' | 'error' | 'info'

const TOAST_STYLES: Record<ToastTone, string> = {
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-50',
  error: 'border-rose-500/25 bg-rose-500/10 text-rose-50',
  info: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-50',
}

function formatDateTime(value: number | null) {
  if (!value) {
    return 'Ainda não salvo'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value)
}

function getNotePreview(content: string) {
  const compact = content.replace(/\s+/g, ' ').trim()
  return compact || 'Nota vazia'
}

type NoteTagsInputProps = {
  tags: string[]
  onChange: (tags: string[]) => void
}

function NoteTagsInput({ tags, onChange }: NoteTagsInputProps) {
  const [draft, setDraft] = useState(() => tags.join(', '))

  return (
    <div className="relative">
      <Tags className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <input
        id="veunotes-note-tags"
        type="text"
        value={draft}
        onChange={(event) => {
          const nextDraft = event.target.value
          setDraft(nextDraft)
          onChange(nextDraft.split(','))
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
        }}
        placeholder="trabalho, pessoal, recuperação"
        className="tool-input pl-10"
      />
    </div>
  )
}

export default function VeuNotesVault() {
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const {
    vaultState,
    notes,
    visibleNotes,
    selectedNote,
    selectedNoteId,
    setSelectedNoteId,
    searchQuery,
    setSearchQuery,
    isBusy,
    isDirty,
    isUnlocked,
    storageWarning,
    recoveryMode,
    lastSavedAt,
    storageError,
    idleMinutes,
    toast,
    createVault,
    unlockVault,
    saveVault,
    exportVault,
    importBackup,
    changePassword,
    setRecoveryMode,
    createNote,
    updateNote,
    deleteNote,
    lockVault,
    clearBrokenVault,
    notifyError,
    dismissToast,
    usageLabel,
  } = useVeuNotes()

  const [createPassword, setCreatePassword] = useState('')
  const [createConfirmPassword, setCreateConfirmPassword] = useState('')
  const [unlockPassword, setUnlockPassword] = useState('')
  const [importPassword, setImportPassword] = useState('')
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null)
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('')
  const [createRecoveryMode, setCreateRecoveryMode] = useState(false)

  function triggerImportPicker() {
    importInputRef.current?.click()
  }

  function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null
    event.target.value = ''

    if (!selectedFile) {
      return
    }

    if (!selectedFile.name.toLowerCase().endsWith('.criptoveu-note')) {
      setPendingImportFile(null)
      setImportPassword('')
      notifyError(
        'Formato inválido. Selecione um ficheiro com a extensão .criptoveu-note.',
      )
      return
    }

    setPendingImportFile(selectedFile)
    setImportPassword('')
  }

  async function handleCreateVault() {
    const result = await createVault(
      createPassword,
      createConfirmPassword,
      createRecoveryMode ? 'recoverable' : 'standard',
    )

    if (result !== null) {
      setCreatePassword('')
      setCreateConfirmPassword('')
    }
  }

  async function handleUnlockVault() {
    const result = await unlockVault(unlockPassword)

    if (result !== null) {
      setUnlockPassword('')
    }
  }

  async function handleImportBackup() {
    if (!pendingImportFile) {
      return
    }

    const result = await importBackup(pendingImportFile, importPassword)

    if (result !== null) {
      setPendingImportFile(null)
      setImportPassword('')
    }
  }

  async function handleChangePassword() {
    const result = await changePassword(
      currentPassword,
      newPassword,
      newPasswordConfirmation,
    )

    if (result !== null) {
      setCurrentPassword('')
      setNewPassword('')
      setNewPasswordConfirmation('')
      setShowPasswordChange(false)
    }
  }

  function handleDeleteNote(noteId: string, title: string) {
    const label = title.trim() || 'esta nota'
    if (window.confirm(`Remover "${label}" do cofre?`)) {
      deleteNote(noteId)
    }
  }

  return (
    <>
      {toast ? (
        <div className="fixed right-4 top-24 z-50 w-[min(92vw,420px)]">
          <div
            role="status"
            aria-live="polite"
            className={`rounded-[24px] border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl ${TOAST_STYLES[toast.tone]}`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="leading-6">{toast.message}</p>
              <button
                type="button"
                onClick={dismissToast}
                className="shrink-0 text-xs uppercase tracking-[0.24em] opacity-70 transition hover:opacity-100"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <input
        id="veunotes-backup-file"
        ref={importInputRef}
        type="file"
        accept=".criptoveu-note,application/x-criptoveu-note,application/octet-stream,*/*"
        className="hidden"
        aria-label="Selecionar arquivo de backup do cofre"
        tabIndex={-1}
        onChange={handleImportFileChange}
      />

      <section className="panel-surface min-w-0 max-w-full rounded-[32px] p-4 pb-36 sm:p-6 lg:pb-6">
        <div className="space-y-6">
          {storageError ? (
            <div className="rounded-[28px] border border-rose-500/25 bg-rose-500/10 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-200" />
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      O cofre local não pôde ser lido
                    </p>
                    <p className="mt-2 text-sm leading-7 text-rose-50/90">
                      {storageError}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={triggerImportPicker}
                      className="btn-secondary"
                    >
                      <FileUp className="h-4 w-4" />
                      Importar backup
                    </button>
                    <button
                      type="button"
                      onClick={clearBrokenVault}
                      className="btn-secondary"
                    >
                      Limpar cofre local
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {pendingImportFile ? (
            <div className="surface-secondary rounded-[28px] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {isUnlocked
                      ? 'Importar e substituir o cofre atual'
                      : 'Abrir cofre portátil'}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-zinc-400">
                    Arquivo: <span className="text-white">{pendingImportFile.name}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingImportFile(null)}
                  className="rounded-full p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
                  aria-label="Cancelar importação"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {isUnlocked ? (
                <p className="mt-3 rounded-[20px] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50">
                  A importação substituirá o cofre salvo neste navegador. Exporte
                  o cofre atual antes de continuar.
                </p>
              ) : null}

              <div className="mt-4">
                <FieldBlock
                  label="Senha mestre do arquivo"
                  htmlFor="veunotes-import-password"
                  helper="O arquivo só será salvo localmente após a autenticação AES-GCM."
                >
                  <PasswordInput
                    id="veunotes-import-password"
                    value={importPassword}
                    onChange={(event) => setImportPassword(event.target.value)}
                    placeholder="Digite a senha do cofre"
                    className="tool-input"
                    autoComplete="off"
                  />
                </FieldBlock>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleImportBackup}
                  disabled={!importPassword || isBusy}
                  className="btn-primary"
                >
                  <FileUp className="h-4 w-4" />
                  Autenticar e importar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingImportFile(null)
                    setImportPassword('')
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : null}

          {vaultState === 'create' ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
              <div className="surface-primary rounded-[28px] p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="icon-chip p-3">
                    <LockKeyhole className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/80">
                      VéuNotes · Cofre portátil
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Crie seu cofre local de várias notas
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-zinc-300">
                      O cofre usa Argon2id e AES-256-GCM. Depois, você pode
                      exportá-lo como um arquivo <code>.criptoveu-note</code>.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-5">
                  <FieldBlock
                    label="Senha mestre"
                    htmlFor="veunotes-create-password"
                    helper={`Use pelo menos ${VEU_NOTES_MIN_PASSWORD_LENGTH} caracteres.`}
                  >
                    <PasswordInput
                      id="veunotes-create-password"
                      value={createPassword}
                      onChange={(event) => setCreatePassword(event.target.value)}
                      placeholder="Crie uma senha forte para o cofre"
                      className="tool-input"
                      autoComplete="new-password"
                    />
                  </FieldBlock>

                  <PasswordSecurityPanel
                    value={createPassword}
                    onChange={setCreatePassword}
                    context="note"
                    disabled={isBusy}
                  />

                  <FieldBlock
                    label="Confirmar senha"
                    htmlFor="veunotes-create-confirm-password"
                    helper="Confirme a mesma senha antes de criar o cofre."
                  >
                    <PasswordInput
                      id="veunotes-create-confirm-password"
                      value={createConfirmPassword}
                      onChange={(event) =>
                        setCreateConfirmPassword(event.target.value)
                      }
                      placeholder="Repita a senha mestre"
                      className="tool-input"
                      autoComplete="new-password"
                    />
                  </FieldBlock>

                  <div className="rounded-[24px] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm leading-7 text-amber-50">
                    Sem a senha não há recuperação. Depois de criar notas,
                    exporte um backup e guarde-o separadamente da senha.
                  </div>

                  <label className="flex cursor-pointer gap-3 rounded-[24px] border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm leading-6 text-cyan-50">
                    <input
                      type="checkbox"
                      checked={createRecoveryMode}
                      disabled={isBusy}
                      onChange={(event) => setCreateRecoveryMode(event.target.checked)}
                      className="mt-1 accent-cyan-400"
                    />
                    <span>
                      <span className="block font-semibold text-white">
                        Modo recuperável com paridade
                      </span>
                      <span className="mt-1 block text-cyan-100/80">
                        Mantém paridade entre duas cópias cifradas para recuperar
                        um backup se um dos ciphertexts sofrer dano. O arquivo fica
                        aproximadamente três vezes maior.
                      </span>
                    </span>
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleCreateVault}
                      disabled={isBusy}
                      className="btn-primary"
                    >
                      <Lock className="h-4 w-4" />
                      Criar cofre
                    </button>
                    <button
                      type="button"
                      onClick={triggerImportPicker}
                      className="btn-secondary"
                      disabled={isBusy}
                    >
                      <FileUp className="h-4 w-4" />
                      Importar cofre
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="surface-secondary rounded-[28px] p-5">
                  <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">
                    Portabilidade real
                  </p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    Um arquivo, várias notas
                  </p>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-zinc-400">
                    <p>Crie notas independentes e organize-as com etiquetas.</p>
                    <p>Pesquise apenas depois de desbloquear o cofre.</p>
                    <p>Leve o arquivo criptografado para outro dispositivo.</p>
                  </div>
                </div>

                <div className="surface-secondary rounded-[28px] p-5">
                  <p className="text-sm font-semibold text-white">
                    Compatível com seus backups
                  </p>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">
                    Backups em formato <code>.criptoveu-note</code> de versões
                    anteriores continuam aceitos. Após a senha correta, a nota
                    única é migrada para o novo cofre sem perder conteúdo.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {vaultState === 'locked' && !storageError ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
              <div className="surface-primary rounded-[28px] p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <div className="icon-chip p-3">
                    <Lock className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/80">
                      VéuNotes · Cofre portátil
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Cofre local trancado
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-zinc-300">
                      A lista, os títulos, as etiquetas e o conteúdo só existem
                      em memória depois da senha correta.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-5">
                  <FieldBlock
                    label="Senha mestre"
                    htmlFor="veunotes-unlock-password"
                    helper="Digite a senha para autenticar e descriptografar o cofre."
                  >
                    <PasswordInput
                      id="veunotes-unlock-password"
                      value={unlockPassword}
                      onChange={(event) => setUnlockPassword(event.target.value)}
                      placeholder="Digite sua senha mestre"
                      className="tool-input"
                      autoComplete="current-password"
                    />
                  </FieldBlock>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleUnlockVault}
                      disabled={isBusy}
                      className="btn-primary"
                    >
                      <Unlock className="h-4 w-4" />
                      Desbloquear
                    </button>
                    <button
                      type="button"
                      onClick={triggerImportPicker}
                      className="btn-secondary"
                      disabled={isBusy}
                    >
                      <FileUp className="h-4 w-4" />
                      Importar cofre
                    </button>
                  </div>
                </div>
              </div>

              <div className="surface-secondary rounded-[28px] p-5">
                <p className="text-sm font-semibold text-white">
                  Cofre criptografado detectado
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="surface-technical rounded-[22px] p-4">
                    <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                      Tamanho local
                    </p>
                    <p className="mt-2 text-sm text-white">{usageLabel}</p>
                  </div>
                  <div className="surface-technical rounded-[22px] p-4">
                    <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                      Auto-lock
                    </p>
                    <p className="mt-2 text-sm text-white">{idleMinutes} minutos</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {isUnlocked ? (
            <div className="space-y-5">
              <section className="surface-primary rounded-[28px] p-5 sm:p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/80">
                      PORTABLE_VAULT1 · sessão ativa
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Cofre portátil desbloqueado
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-zinc-300">
                      {notes.length} {notes.length === 1 ? 'nota' : 'notas'} em
                      memória. O arquivo salvo continua criptografado.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void exportVault()}
                      disabled={isBusy}
                      className="btn-secondary"
                    >
                      <Download className="h-4 w-4" />
                      Exportar .criptoveu-note
                    </button>
                    <button
                      type="button"
                      onClick={triggerImportPicker}
                      disabled={isBusy}
                      className="btn-secondary"
                    >
                      <FileUp className="h-4 w-4" />
                      Importar
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPasswordChange((current) => !current)}
                      disabled={isBusy}
                      className="btn-secondary"
                    >
                      <KeyRound className="h-4 w-4" />
                      Trocar senha
                    </button>
                    <button
                      type="button"
                      onClick={() => lockVault()}
                      className="btn-secondary"
                    >
                      <Lock className="h-4 w-4" />
                      Bloquear
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="surface-technical rounded-[22px] p-4">
                    <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">
                      Armazenamento
                    </p>
                    <p className="mt-2 text-sm text-white">{usageLabel}</p>
                  </div>
                  <div className="surface-technical rounded-[22px] p-4">
                    <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">
                      Último salvamento
                    </p>
                    <p className="mt-2 text-sm text-white">
                      {formatDateTime(lastSavedAt)}
                    </p>
                  </div>
                  <div className="surface-technical rounded-[22px] p-4">
                    <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">
                      Bloqueio automático
                    </p>
                    <p className="mt-2 text-sm text-white">{idleMinutes} minutos</p>
                  </div>
                </div>

                {storageWarning ? (
                  <div className="mt-4 rounded-[24px] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm leading-7 text-amber-50">
                    {storageWarning}
                  </div>
                ) : null}

                <div className="mt-4 rounded-[24px] border border-cyan-400/20 bg-cyan-400/10 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Modo recuperável com paridade
                      </p>
                      <p className="mt-1 text-sm leading-6 text-cyan-100/80">
                        {recoveryMode === 'recoverable'
                          ? 'Ativo: o backup usa duas cópias cifradas ligadas por paridade XOR.'
                          : 'Inativo: ative para criar um novo backup tolerante a dano em um ciphertext.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void setRecoveryMode(
                          recoveryMode === 'recoverable' ? 'standard' : 'recoverable',
                        )
                      }
                      disabled={isBusy}
                      className="btn-secondary shrink-0"
                    >
                      {recoveryMode === 'recoverable' ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </div>
              </section>

              {showPasswordChange ? (
                <section className="surface-secondary rounded-[28px] p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Trocar senha mestre
                      </p>
                      <p className="mt-2 text-sm leading-7 text-zinc-400">
                        O cofre será recriptografado com novo salt e nova chave.
                        Backups já exportados não são alterados.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPasswordChange(false)}
                      className="rounded-full p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
                      aria-label="Fechar troca de senha"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-5 grid gap-5 lg:grid-cols-3">
                    <FieldBlock
                      label="Senha atual"
                      htmlFor="veunotes-current-password"
                      helper="Confirma que você pode abrir o cofre atual."
                    >
                      <PasswordInput
                        id="veunotes-current-password"
                        value={currentPassword}
                        onChange={(event) => setCurrentPassword(event.target.value)}
                        className="tool-input"
                        autoComplete="current-password"
                      />
                    </FieldBlock>
                    <FieldBlock
                      label="Nova senha"
                      htmlFor="veunotes-new-password"
                      helper={`Mínimo de ${VEU_NOTES_MIN_PASSWORD_LENGTH} caracteres.`}
                    >
                      <PasswordInput
                        id="veunotes-new-password"
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        className="tool-input"
                        autoComplete="new-password"
                      />
                    </FieldBlock>
                    <FieldBlock
                      label="Confirmar nova senha"
                      htmlFor="veunotes-new-password-confirm"
                      helper="Repita exatamente a nova senha."
                    >
                      <PasswordInput
                        id="veunotes-new-password-confirm"
                        value={newPasswordConfirmation}
                        onChange={(event) =>
                          setNewPasswordConfirmation(event.target.value)
                        }
                        className="tool-input"
                        autoComplete="new-password"
                      />
                    </FieldBlock>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleChangePassword}
                      disabled={
                        isBusy ||
                        !currentPassword ||
                        !newPassword ||
                        !newPasswordConfirmation
                      }
                      className="btn-primary"
                    >
                      <KeyRound className="h-4 w-4" />
                      Recriptografar com nova senha
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPasswordChange(false)}
                      className="btn-secondary"
                    >
                      Cancelar
                    </button>
                  </div>
                </section>
              ) : null}

              <section className="grid min-w-0 max-w-full gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
                <aside className="surface-secondary min-w-0 max-w-full rounded-[28px] p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Notas</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Títulos e etiquetas também são criptografados.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={createNote}
                      className="icon-chip p-2"
                      aria-label="Criar nova nota"
                      title="Criar nova nota"
                    >
                      <FilePlus2 className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="relative mt-4">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Buscar título, texto ou etiqueta"
                      className="tool-input pl-10"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={createNote}
                    className="btn-primary mt-4 w-full"
                  >
                    <FilePlus2 className="h-4 w-4" />
                    Nova nota
                  </button>

                  <div className="mt-4 max-h-[560px] space-y-2 overflow-y-auto pr-1">
                    {visibleNotes.map((note) => {
                      const isSelected = note.id === selectedNoteId

                      return (
                        <div
                          key={note.id}
                          className={`rounded-[22px] border p-3 transition ${
                            isSelected
                              ? 'border-cyan-400/30 bg-cyan-400/10'
                              : 'border-white/8 bg-black/10 hover:border-white/15'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedNoteId(note.id)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <p className="truncate text-sm font-medium text-white">
                                {note.title.trim() || 'Sem título'}
                              </p>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">
                                {getNotePreview(note.content)}
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteNote(note.id, note.title)}
                              className="shrink-0 rounded-full p-1.5 text-zinc-600 transition hover:bg-rose-500/10 hover:text-rose-300"
                              aria-label={`Excluir ${note.title || 'nota sem título'}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          {note.tags.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {note.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}

                    {visibleNotes.length === 0 ? (
                      <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-8 text-center">
                        <p className="text-sm text-zinc-400">
                          {notes.length === 0
                            ? 'Seu cofre está vazio.'
                            : 'Nenhuma nota corresponde à busca.'}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </aside>

                <div className="surface-primary min-w-0 max-w-full rounded-[28px] p-5 sm:p-6">
                  {selectedNote ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/70">
                            Editor protegido
                          </p>
                          <p className="mt-2 text-xs text-zinc-500">
                            Autosave criptografado após alguns segundos.
                          </p>
                        </div>
                        <div className="icon-chip p-2">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                      </div>

                      <div className="mt-5 space-y-5">
                        <FieldBlock
                          label="Título"
                          htmlFor="veunotes-note-title"
                          helper={`${selectedNote.title.length}/${PORTABLE_VAULT_MAX_TITLE_LENGTH} caracteres`}
                        >
                          <input
                            id="veunotes-note-title"
                            type="text"
                            value={selectedNote.title}
                            maxLength={PORTABLE_VAULT_MAX_TITLE_LENGTH}
                            onChange={(event) =>
                              updateNote(selectedNote.id, {
                                title: event.target.value,
                              })
                            }
                            placeholder="Título da nota"
                            className="tool-input text-lg font-semibold"
                          />
                        </FieldBlock>

                        <FieldBlock
                          label="Etiquetas"
                          htmlFor="veunotes-note-tags"
                          helper="Separe por vírgulas. Elas ficam dentro do conteúdo criptografado."
                        >
                          <NoteTagsInput
                            key={selectedNote.id}
                            tags={selectedNote.tags}
                            onChange={(tags) =>
                              updateNote(selectedNote.id, { tags })
                            }
                          />
                        </FieldBlock>

                        <FieldBlock
                          label="Conteúdo"
                          htmlFor="veunotes-note-content"
                          helper={`${selectedNote.content.length.toLocaleString('pt-BR')}/${PORTABLE_VAULT_MAX_CONTENT_LENGTH.toLocaleString('pt-BR')} caracteres`}
                        >
                          <textarea
                            id="veunotes-note-content"
                            value={selectedNote.content}
                            maxLength={PORTABLE_VAULT_MAX_CONTENT_LENGTH}
                            onChange={(event) =>
                              updateNote(selectedNote.id, {
                                content: event.target.value,
                              })
                            }
                            placeholder="Escreva sua nota. Nada é enviado para servidor."
                            className="tool-textarea min-h-[360px] font-mono text-[15px] leading-7 shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_0_0_8px_rgba(34,211,238,0.04)]"
                            spellCheck={false}
                          />
                        </FieldBlock>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs leading-6 text-zinc-500">
                          Editada em {formatDateTime(selectedNote.updatedAt)}
                        </p>
                        <button
                          type="button"
                          onClick={() => void saveVault()}
                          disabled={isBusy || !isDirty}
                          className="btn-primary"
                        >
                          <Save className="h-4 w-4" />
                          {isDirty ? 'Salvar agora' : 'Cofre salvo'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex min-h-[460px] flex-col items-center justify-center text-center">
                      <div className="icon-chip p-4">
                        <FilePlus2 className="h-7 w-7" />
                      </div>
                      <h3 className="mt-4 text-xl font-semibold text-white">
                        Crie a primeira nota
                      </h3>
                      <p className="mt-2 max-w-md text-sm leading-7 text-zinc-400">
                        Cada nota pode ter título, conteúdo e etiquetas. Tudo é
                        criptografado junto dentro do cofre portátil.
                      </p>
                      <button
                        type="button"
                        onClick={createNote}
                        className="btn-primary mt-5"
                      >
                        <FilePlus2 className="h-4 w-4" />
                        Criar nota
                      </button>
                    </div>
                  )}
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="surface-secondary rounded-[28px] p-5">
                  <div className="flex items-center gap-2 text-zinc-200">
                    <Clock3 className="h-4 w-4" />
                    <p className="text-sm font-semibold">Bloqueio automático</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">
                    A sessão é encerrada após {idleMinutes} minutos sem atividade
                    ou após algum tempo com a aba oculta.
                  </p>
                </div>
                <div className="surface-secondary rounded-[28px] p-5">
                  <div className="flex items-center gap-2 text-zinc-200">
                    <Download className="h-4 w-4" />
                    <p className="text-sm font-semibold">Backup portátil</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">
                    O arquivo exportado contém apenas NOTE2 criptografado. Senha,
                    títulos, etiquetas e textos não aparecem em claro.
                  </p>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </section>

      {isUnlocked ? (
        <MobileStickyCTA
          label={isDirty ? 'Salvar cofre' : 'Cofre salvo'}
          icon={<Save className="h-5 w-5" />}
          onClick={() => void saveVault()}
          disabled={isBusy || !isDirty}
        />
      ) : vaultState === 'create' ? (
        <MobileStickyCTA
          label="Criar cofre"
          icon={<KeyRound className="h-5 w-5" />}
          onClick={() => void handleCreateVault()}
          disabled={isBusy || !createPassword || !createConfirmPassword}
        />
      ) : !storageError ? (
        <MobileStickyCTA
          label="Desbloquear"
          icon={<Unlock className="h-5 w-5" />}
          onClick={() => void handleUnlockVault()}
          disabled={isBusy || !unlockPassword}
        />
      ) : null}
    </>
  )
}
