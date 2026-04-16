import {
  AlertTriangle,
  Clock3,
  Download,
  Eye,
  FileUp,
  HardDriveDownload,
  KeyRound,
  Lock,
  LockKeyhole,
  Save,
  ShieldCheck,
  Unlock,
} from 'lucide-react'
import { useId, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

import useVeuNotes from '../hooks/useVeuNotes'
import { VEU_NOTES_MIN_PASSWORD_LENGTH } from '../lib/veunotes-crypto'
import { getPasswordStrength } from '../lib/cryptify'
import FieldBlock from './ui/FieldBlock'
import MobileStickyCTA from './ui/MobileStickyCTA'

type ToastTone = 'success' | 'error' | 'info'

const TOAST_STYLES: Record<ToastTone, string> = {
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-50',
  error: 'border-rose-500/25 bg-rose-500/10 text-rose-50',
  info: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-50',
}

const STRENGTH_SLOTS = [1, 2, 3, 4, 5]

function formatDateTime(value: number | null) {
  if (!value) {
    return 'Ainda não salvo'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value)
}

export default function VeuNotesVault() {
  const fileInputId = useId()
  const noteInputId = useId()
  const createPasswordId = useId()
  const createConfirmId = useId()
  const unlockPasswordId = useId()
  const importPasswordId = useId()
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const {
    vaultState,
    note,
    setNote,
    isBusy,
    isDirty,
    isUnlocked,
    storageWarning,
    lastSavedAt,
    storageError,
    idleMinutes,
    toast,
    createVault,
    unlockVault,
    saveNote,
    exportVault,
    importBackup,
    lockVault,
    clearBrokenVault,
    dismissToast,
    usageLabel,
  } = useVeuNotes()

  const [createPassword, setCreatePassword] = useState('')
  const [createConfirmPassword, setCreateConfirmPassword] = useState('')
  const [unlockPassword, setUnlockPassword] = useState('')
  const [importPassword, setImportPassword] = useState('')
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null)

  const strength = getPasswordStrength(createPassword)

  function triggerImportPicker() {
    importInputRef.current?.click()
  }

  function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null
    setPendingImportFile(selectedFile)
    setImportPassword('')
    event.target.value = ''
  }

  async function handleCreateVault() {
    const result = await createVault(createPassword, createConfirmPassword)

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

  async function handleSaveNote() {
    await saveNote()
  }

  async function handleExportVault() {
    await exportVault()
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

  const createActions = (
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

      <button type="button" onClick={triggerImportPicker} className="btn-secondary" disabled={isBusy}>
        <FileUp className="h-4 w-4" />
        Importar cofre
      </button>
    </div>
  )

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
        id={fileInputId}
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportFileChange}
      />

      <section className="panel-surface rounded-[32px] p-4 pb-28 sm:p-6 lg:pb-6">
        <div className="space-y-6">
          {storageError ? (
            <div className="rounded-[28px] border border-rose-500/25 bg-rose-500/10 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-200" />
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-white">O cofre local não pôde ser lido</p>
                    <p className="mt-2 text-sm leading-7 text-rose-50/90">{storageError}</p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={triggerImportPicker} className="btn-secondary">
                      <FileUp className="h-4 w-4" />
                      Importar backup
                    </button>

                    <button type="button" onClick={clearBrokenVault} className="btn-secondary">
                      Limpar cofre local
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {pendingImportFile ? (
            <div className="surface-secondary rounded-[28px] p-5">
              <p className="text-sm font-semibold text-white">
                {isUnlocked ? 'Importar e substituir o cofre atual' : 'Restaurar backup local'}
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                Arquivo selecionado:{' '}
                <span className="font-medium text-white">{pendingImportFile.name}</span>
              </p>

              <FieldBlock
                label="Senha mestre do backup"
                htmlFor={importPasswordId}
                helper="A importação só continua se a descriptografia do arquivo funcionar."
              >
                <input
                  id={importPasswordId}
                  type="password"
                  value={importPassword}
                  onChange={(event) => setImportPassword(event.target.value)}
                  placeholder="Digite a senha do backup"
                  className="tool-input"
                  autoComplete="off"
                />
              </FieldBlock>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleImportBackup}
                  disabled={!importPassword || isBusy}
                  className="btn-primary"
                >
                  <HardDriveDownload className="h-4 w-4" />
                  Importar cofre
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
                      VéuNotes – Cofre de notas
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Defina a senha mestre do seu cofre local
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-zinc-300">
                      Suas notas ficam guardadas apenas neste navegador, protegidas por uma senha
                      mestre.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-5">
                  <FieldBlock
                    label="Senha mestre"
                    htmlFor={createPasswordId}
                    helper={`Use pelo menos ${VEU_NOTES_MIN_PASSWORD_LENGTH} caracteres.`}
                  >
                    <input
                      id={createPasswordId}
                      type="password"
                      value={createPassword}
                      onChange={(event) => setCreatePassword(event.target.value)}
                      placeholder="Crie uma senha forte para o cofre"
                      className="tool-input"
                      autoComplete="new-password"
                    />
                  </FieldBlock>

                  <div className="surface-technical rounded-[22px] p-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-zinc-300">Força da senha</span>
                      <span className={strength.textClass}>{strength.label}</span>
                    </div>

                    <div className="mt-3 grid grid-cols-5 gap-2">
                      {STRENGTH_SLOTS.map((slot) => (
                        <span
                          key={slot}
                          className={`h-2 rounded-full transition ${slot <= strength.level ? strength.barClass : 'bg-zinc-800'}`}
                        />
                      ))}
                    </div>
                  </div>

                  <FieldBlock
                    label="Confirmar senha"
                    htmlFor={createConfirmId}
                    helper="Confirme a mesma senha antes de criar o cofre."
                  >
                    <input
                      id={createConfirmId}
                      type="password"
                      value={createConfirmPassword}
                      onChange={(event) => setCreateConfirmPassword(event.target.value)}
                      placeholder="Repita a senha mestre"
                      className="tool-input"
                      autoComplete="new-password"
                    />
                  </FieldBlock>

                  <div className="cv-note-warning rounded-[24px] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm leading-7 text-amber-50">
                    Use uma senha forte. Se você esquecer, não há como recuperar o conteúdo deste cofre.
                  </div>

                  {createActions}
                </div>
              </div>

              <div className="space-y-4">
                <div className="surface-secondary rounded-[28px] p-5">
                  <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Primeiro uso</p>
                  <p className="mt-2 text-lg font-semibold text-white">
                    O VéuNotes começa vazio e totalmente local
                  </p>
                  <div className="mt-4 space-y-3 text-sm leading-7 text-zinc-400">
                    <p>1. Você define uma senha mestre.</p>
                    <p>2. O cofre é criado com AES-256-GCM e salvo só no navegador.</p>
                    <p>3. A nota fica destrancada apenas em memória durante a sessão.</p>
                  </div>
                </div>

                <div className="surface-secondary rounded-[28px] p-5">
                  <p className="text-sm font-semibold text-white">Cuidados importantes</p>
                  <div className="mt-3 space-y-3 text-sm leading-7 text-zinc-400">
                    <p>Exportar cofre gera um arquivo criptografado. Guarde em local seguro.</p>
                    <p>Limpar os dados do navegador apaga o cofre. Exporte um backup antes de trocar de dispositivo.</p>
                  </div>
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
                      VéuNotes – Cofre de notas
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Estado trancado</h2>
                    <p className="mt-3 text-sm leading-7 text-zinc-300">
                      Suas notas são guardadas apenas neste navegador, protegidas por uma senha mestre.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-5">
                  <FieldBlock
                    label="Senha mestre"
                    htmlFor={unlockPasswordId}
                    helper="Digite a senha correta para descriptografar a nota em memória."
                  >
                    <input
                      id={unlockPasswordId}
                      type="password"
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

                    <button type="button" onClick={triggerImportPicker} className="btn-secondary" disabled={isBusy}>
                      <FileUp className="h-4 w-4" />
                      Importar cofre
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="surface-secondary rounded-[28px] p-5">
                  <p className="text-sm font-semibold text-white">Cofre local detectado</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="surface-technical rounded-[22px] p-4">
                      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Uso aproximado</p>
                      <p className="mt-2 text-sm text-white">{usageLabel}</p>
                    </div>
                    <div className="surface-technical rounded-[22px] p-4">
                      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Auto-lock</p>
                      <p className="mt-2 text-sm text-white">{idleMinutes} minutos</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ) : null}

          {isUnlocked ? (
            <div className="space-y-5">
              <section className="surface-primary rounded-[28px] p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/80">
                      VéuNotes – sessão segura ativa
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Cofre destrancado – lembre de bloquear ao sair
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-zinc-300">
                      A nota fica em texto puro apenas na memória desta aba. O cofre salvo continua
                      criptografado localmente.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[340px]">
                    <div className="surface-technical rounded-[22px] p-4">
                      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Uso aproximado</p>
                      <p className="mt-2 text-sm text-white">{usageLabel}</p>
                    </div>
                    <div className="surface-technical rounded-[22px] p-4">
                      <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Último salvamento</p>
                      <p className="mt-2 text-sm text-white">{formatDateTime(lastSavedAt)}</p>
                    </div>
                  </div>
                </div>

                {storageWarning ? (
                  <div className="cv-note-warning mt-4 rounded-[24px] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm leading-7 text-amber-50">
                    {storageWarning}
                  </div>
                ) : null}
              </section>

              <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="surface-primary rounded-[28px] p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Nota protegida</p>
                      <p className="mt-1 text-sm text-zinc-400">
                        Sessão segura ativa com bloqueio automático em {idleMinutes} minutos.
                      </p>
                    </div>
                    <div className="icon-chip p-2">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                  </div>

                  <textarea
                    id={noteInputId}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Escreva sua nota protegida aqui. Nada é enviado para servidor."
                    className="tool-textarea mt-5 min-h-[340px] font-mono text-[15px] leading-7 shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_0_0_8px_rgba(34,211,238,0.04)]"
                    spellCheck={false}
                  />

                  <p className="mt-3 text-xs leading-6 text-zinc-500">
                    Autosave local após alguns segundos sem digitação. Salvar manualmente atualiza o backup de forma imediata.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="surface-secondary rounded-[28px] p-5">
                    <p className="text-sm font-semibold text-white">Ações do cofre</p>
                    <div className="mt-4 grid gap-3">
                      <button
                        type="button"
                        onClick={handleSaveNote}
                        disabled={isBusy || !isDirty}
                        className="btn-primary w-full"
                      >
                        <Save className="h-4 w-4" />
                        Salvar nota localmente
                      </button>

                      <button type="button" onClick={handleExportVault} disabled={isBusy} className="btn-secondary w-full">
                        <Download className="h-4 w-4" />
                        Exportar cofre
                      </button>

                      <button type="button" onClick={triggerImportPicker} disabled={isBusy} className="btn-secondary w-full">
                        <FileUp className="h-4 w-4" />
                        Importar cofre
                      </button>

                      <button type="button" onClick={() => lockVault()} className="btn-secondary w-full">
                        <Lock className="h-4 w-4" />
                        Bloquear cofre
                      </button>
                    </div>
                  </div>

                  <div className="surface-secondary rounded-[28px] p-5">
                    <p className="text-sm font-semibold text-white">Estado do cofre</p>
                    <div className="mt-4 grid gap-3">
                      <div className="surface-technical rounded-[22px] p-4">
                        <div className="flex items-center gap-2 text-zinc-300">
                          <Clock3 className="h-4 w-4" />
                          <span className="text-sm">Bloqueio automático</span>
                        </div>
                        <p className="mt-2 text-sm leading-7 text-zinc-400">
                          A sessão é encerrada após {idleMinutes} minutos de inatividade ou após algum tempo com a aba oculta.
                        </p>
                      </div>

                      <div className="surface-technical rounded-[22px] p-4">
                        <div className="flex items-center gap-2 text-zinc-300">
                          <Eye className="h-4 w-4" />
                          <span className="text-sm">Armazenamento local</span>
                        </div>
                        <p className="mt-2 text-sm leading-7 text-zinc-400">
                          Apenas o blob criptografado é salvo. Texto puro, senha e chave não são persistidos.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </section>

      {isUnlocked ? (
        <MobileStickyCTA
          label={isDirty ? 'Salvar nota localmente' : 'Nota salva localmente'}
          icon={<Save className="h-5 w-5" />}
          onClick={() => {
            void handleSaveNote()
          }}
          disabled={isBusy || !isDirty}
        />
      ) : vaultState === 'create' ? (
        <MobileStickyCTA
          label="Criar cofre"
          icon={<KeyRound className="h-5 w-5" />}
          onClick={() => {
            void handleCreateVault()
          }}
          disabled={isBusy || !createPassword || !createConfirmPassword}
        />
      ) : !storageError ? (
        <MobileStickyCTA
          label="Desbloquear"
          icon={<Unlock className="h-5 w-5" />}
          onClick={() => {
            void handleUnlockVault()
          }}
          disabled={isBusy || !unlockPassword}
        />
      ) : null}
    </>
  )
}
