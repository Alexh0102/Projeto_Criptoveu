import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  FileArchive,
  KeyRound,
  LoaderCircle,
  Lock,
  ShieldCheck,
  Sparkles,
  Unlock,
  Upload,
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

import {
  MAX_FILE_SIZE_BYTES,
  CriptifyError,
  decryptFile,
  encryptFile,
  formatFileSize,
  generateWhatsappStyleKey,
  getPasswordStrength,
} from './lib/cryptify'

type Mode = 'encrypt' | 'decrypt'
type StatusTone = 'info' | 'success' | 'error'
type PreviewKind = 'audio' | 'video' | 'image' | 'pdf' | 'none'

type StatusState = {
  tone: StatusTone
  message: string
}

type PreviewState = {
  kind: PreviewKind
  mimeType: string
}

const MODE_COPY: Record<
  Mode,
  {
    action: string
    title: string
    description: string
    hint: string
  }
> = {
  encrypt: {
    action: 'Criptografar arquivo',
    title: 'Blindagem local do arquivo',
    description:
      'Monte um pacote .cryptify com cabecalho CRIPTIFY1, salt aleatorio, IV exclusivo e payload em AES-256-GCM.',
    hint: 'Aceita qualquer formato de arquivo para criptografar.',
  },
  decrypt: {
    action: 'Descriptografar arquivo',
    title: 'Recuperacao segura do conteudo',
    description:
      'Abra um arquivo .cryptify, derive a chave localmente via PBKDF2 e recupere o arquivo original sem enviar nada para um servidor.',
    hint: 'Selecione um arquivo com extensao .cryptify.',
  },
}

const STRENGTH_SLOTS = [1, 2, 3, 4, 5]

const STATUS_STYLES: Record<StatusTone, string> = {
  info: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-50',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-50',
  error: 'border-rose-500/25 bg-rose-500/10 text-rose-50',
}

function downloadBlobUrl(url: string, fileName: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

function getPreviewState(mimeType: string): PreviewState {
  if (mimeType.startsWith('audio/')) {
    return { kind: 'audio', mimeType }
  }

  if (mimeType.startsWith('video/')) {
    return { kind: 'video', mimeType }
  }

  if (mimeType.startsWith('image/')) {
    return { kind: 'image', mimeType }
  }

  if (mimeType === 'application/pdf') {
    return { kind: 'pdf', mimeType }
  }

  return { kind: 'none', mimeType }
}

export default function App() {
  const [mode, setMode] = useState<Mode>('encrypt')
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('Pronto para processar')
  const [status, setStatus] = useState<StatusState>({
    tone: 'info',
    message: 'Selecione um arquivo, informe a senha e processe tudo localmente.',
  })
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultName, setResultName] = useState('')
  const [preview, setPreview] = useState<PreviewState>({ kind: 'none', mimeType: '' })
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileInputId = useId()
  const passwordInputId = useId()
  const resultUrlRef = useRef<string | null>(null)
  const canUseSecureProcessing =
    window.isSecureContext && typeof window.crypto?.subtle !== 'undefined'
  const hasClipboardSupport = typeof navigator.clipboard?.writeText === 'function'

  const strength = getPasswordStrength(password)
  const currentMode = MODE_COPY[mode]

  useEffect(() => {
    if (!canUseSecureProcessing) {
      setStatus({
        tone: 'error',
        message:
          'Este app precisa ser aberto em HTTPS ou localhost com Web Crypto API disponivel para processar arquivos.',
      })
    }
  }, [canUseSecureProcessing])

  useEffect(() => {
    if (!copied) {
      return
    }

    const timeoutId = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timeoutId)
  }, [copied])

  useEffect(() => {
    return () => {
      if (resultUrlRef.current) {
        URL.revokeObjectURL(resultUrlRef.current)
      }
    }
  }, [])

  function clearResult() {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current)
      resultUrlRef.current = null
    }

    setResultUrl(null)
    setResultName('')
    setPreview({ kind: 'none', mimeType: '' })
  }

  function handleModeChange(nextMode: Mode) {
    if (nextMode === mode) {
      return
    }

    setMode(nextMode)
    setProgress(0)
    setProgressLabel('Pronto para processar')
    setStatus({
      tone: 'info',
      message:
        nextMode === 'encrypt'
          ? 'Modo de criptografia ativo. O arquivo sera convertido para .cryptify.'
          : 'Modo de descriptografia ativo. Selecione o arquivo .cryptify e use a mesma senha.',
    })
    clearResult()
  }

  function handleSelectedFile(selectedFile: File | null | undefined) {
    if (!selectedFile) {
      return
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setFile(null)
      clearResult()
      setStatus({
        tone: 'error',
        message: `Arquivo acima do limite de ${formatFileSize(MAX_FILE_SIZE_BYTES)}. Use um arquivo menor.`,
      })
      return
    }

    setFile(selectedFile)
    setProgress(0)
    setProgressLabel('Arquivo pronto para processamento')
    setStatus({
      tone: 'info',
      message: `${selectedFile.name} carregado com sucesso. Tudo continua 100% no navegador.`,
    })
    clearResult()
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleSelectedFile(event.target.files?.[0])
    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragging(false)
    handleSelectedFile(event.dataTransfer.files?.[0])
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDragging(true)
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return
    }

    setIsDragging(false)
  }

  async function handleCopyKey() {
    if (!password) {
      setStatus({
        tone: 'error',
        message: 'Digite ou gere uma chave antes de tentar copiar.',
      })
      return
    }

    if (!hasClipboardSupport) {
      setStatus({
        tone: 'error',
        message: 'A API de clipboard nao esta disponivel neste navegador ou contexto atual.',
      })
      return
    }

    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setStatus({
        tone: 'success',
        message: 'Senha ou chave copiada para a area de transferencia.',
      })
    } catch {
      setStatus({
        tone: 'error',
        message: 'Nao foi possivel acessar a area de transferencia neste navegador.',
      })
    }
  }

  function handleGenerateKey() {
    setPassword(generateWhatsappStyleKey())
    setCopied(false)
    setStatus({
      tone: 'info',
      message: 'Chave aleatoria de 64 caracteres hex gerada no estilo WhatsApp.',
    })
  }

  function handleDownload() {
    if (!resultUrl || !resultName) {
      return
    }

    downloadBlobUrl(resultUrl, resultName)
  }

  async function handleProcess() {
    if (!canUseSecureProcessing) {
      setStatus({
        tone: 'error',
        message:
          'Processamento bloqueado: abra o site em HTTPS ou localhost para habilitar a Web Crypto API.',
      })
      return
    }

    if (!file || !password) {
      setStatus({
        tone: 'error',
        message: 'Selecione um arquivo e informe uma senha ou chave para continuar.',
      })
      return
    }

    setIsProcessing(true)
    setProgress(4)
    setProgressLabel('Preparando ambiente seguro')
    setStatus({
      tone: 'info',
      message:
        mode === 'encrypt'
          ? 'Criptografando arquivo localmente com Web Crypto API...'
          : 'Descriptografando arquivo localmente com Web Crypto API...',
    })
    clearResult()

    try {
      const operation = mode === 'encrypt' ? encryptFile : decryptFile
      const { blob, downloadName } = await operation(file, password, (value, label) => {
        setProgress(value)
        setProgressLabel(label)
      })

      const nextPreview: PreviewState =
        mode === 'decrypt' ? getPreviewState(blob.type) : { kind: 'none', mimeType: '' }
      const nextUrl = URL.createObjectURL(blob)
      resultUrlRef.current = nextUrl
      setResultUrl(nextUrl)
      setResultName(downloadName)
      setPreview(nextPreview)
      setProgress(100)
      setProgressLabel('Processo concluido')
      setStatus({
        tone: 'success',
        message:
          mode === 'encrypt'
            ? 'Arquivo criptografado com sucesso. O download do .cryptify foi iniciado.'
            : nextPreview.kind === 'none'
              ? 'Arquivo descriptografado com sucesso. Use o download manual para salvar o conteudo recuperado.'
              : 'Arquivo descriptografado com sucesso. Use a previa local abaixo e baixe o conteudo quando quiser.',
      })

      if (mode === 'encrypt') {
        downloadBlobUrl(nextUrl, downloadName)
      }
    } catch (error) {
      setProgress(0)
      setProgressLabel('Falha no processamento')
      setStatus({
        tone: 'error',
        message:
          error instanceof CriptifyError
            ? error.message
            : 'Ocorreu um erro inesperado ao processar o arquivo.',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const StatusIcon = isProcessing
    ? LoaderCircle
    : status.tone === 'success'
      ? CheckCircle2
      : status.tone === 'error'
        ? AlertCircle
        : Sparkles

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink text-white">
      <div className="pointer-events-none absolute inset-0 bg-grid-fade bg-[size:36px_36px] opacity-20 [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.9),transparent)]" />
      <div className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-10 h-80 w-80 rounded-full bg-amber-400/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-cyan-100">
              <ShieldCheck className="h-4 w-4" />
              100% client-side
            </div>

            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.45em] text-zinc-400">
                Criptografia local para portfolio
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold leading-none tracking-tight text-white sm:text-5xl lg:text-6xl">
                Criptografe e recupere arquivos sem enviar nada para a nuvem.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
                Criptify demonstra seguranca real no navegador com React, TypeScript e
                Web Crypto API, em um fluxo inspirado pelo universo do WhatsApp
                .crypt15 e adaptado para um formato proprio.
              </p>
            </div>

            <div className="panel-surface rounded-[28px] p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-3 text-cyan-100">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-cyan-100/80">
                    Aviso de seguranca
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Seus arquivos nunca saem do navegador
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-300 sm:text-base">
                    A senha nunca e armazenada. A chave e derivada localmente com
                    PBKDF2, cada arquivo recebe salt e IV aleatorios, e todo o
                    processamento acontece com a API nativa do navegador.
                  </p>
                </div>
              </div>
            </div>

            {!canUseSecureProcessing ? (
              <div className="rounded-[28px] border border-rose-500/25 bg-rose-500/10 p-5 text-rose-50">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em]">
                      Contexto inseguro
                    </p>
                    <p className="mt-2 text-sm leading-7 text-rose-100">
                      A Web Crypto API exige HTTPS ou localhost. Sem isso, o app nao
                      deve processar chaves nem arquivos.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <article className="panel-surface rounded-3xl p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                  Algoritmo
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">AES-256-GCM</p>
                <p className="mt-2 text-sm text-zinc-400">Criptografia autenticada</p>
              </article>

              <article className="panel-surface rounded-3xl p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                  Derivacao
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">600k PBKDF2</p>
                <p className="mt-2 text-sm text-zinc-400">SHA-256 em cada chave</p>
              </article>

              <article className="panel-surface rounded-3xl p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                  Compatibilidade
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">Browser native</p>
                <p className="mt-2 text-sm text-zinc-400">Chrome, Edge e Firefox</p>
              </article>
            </div>
          </div>

          <section className="panel-surface rounded-[32px] p-4 sm:p-6">
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2 rounded-3xl border border-white/10 bg-black/20 p-1.5">
                <button
                  type="button"
                  aria-pressed={mode === 'encrypt'}
                  onClick={() => handleModeChange('encrypt')}
                  className={`flex items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-sm font-medium transition ${
                    mode === 'encrypt'
                      ? 'bg-white text-zinc-950 shadow-lg shadow-cyan-500/10'
                      : 'text-zinc-300 hover:bg-white/5'
                  }`}
                >
                  <Lock className="h-4 w-4" />
                  <span>Criptografar</span>
                </button>

                <button
                  type="button"
                  aria-pressed={mode === 'decrypt'}
                  onClick={() => handleModeChange('decrypt')}
                  className={`flex items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-sm font-medium transition ${
                    mode === 'decrypt'
                      ? 'bg-white text-zinc-950 shadow-lg shadow-cyan-500/10'
                      : 'text-zinc-300 hover:bg-white/5'
                  }`}
                >
                  <Unlock className="h-4 w-4" />
                  <span>Descriptografar</span>
                </button>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/25 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/80">
                      {mode === 'encrypt' ? 'Operacao ativa' : 'Recuperacao ativa'}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      {currentMode.title}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-zinc-300">
                      {currentMode.description}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-cyan-100">
                    {mode === 'encrypt' ? (
                      <Lock className="h-6 w-6" />
                    ) : (
                      <Unlock className="h-6 w-6" />
                    )}
                  </div>
                </div>
              </div>

              <label
                htmlFor={fileInputId}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`group relative flex cursor-pointer flex-col gap-4 rounded-[28px] border border-dashed p-5 transition sm:p-6 ${
                  isDragging
                    ? 'border-cyan-300 bg-cyan-300/10'
                    : 'border-white/15 bg-white/[0.035] hover:border-cyan-400/40 hover:bg-white/[0.06]'
                }`}
              >
                <input
                  id={fileInputId}
                  type="file"
                  className="hidden"
                  accept={mode === 'decrypt' ? '.cryptify' : undefined}
                  onChange={handleFileInputChange}
                />

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-cyan-100 transition group-hover:scale-105">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-base font-medium text-white">
                        Arraste e solte um arquivo aqui
                      </p>
                      <p className="mt-1 text-sm text-zinc-400">
                        {currentMode.hint}
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition group-hover:border-cyan-400/30 group-hover:bg-cyan-400/10">
                    Escolher arquivo
                  </span>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-100">
                        <FileArchive className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                          Arquivo selecionado
                        </p>
                        <p className="mt-2 truncate text-sm font-medium text-white">
                          {file ? file.name : 'Nenhum arquivo carregado'}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Limite recomendado: {formatFileSize(MAX_FILE_SIZE_BYTES)}
                        </p>
                      </div>
                    </div>

                    <p className="shrink-0 font-mono text-xs uppercase tracking-[0.2em] text-zinc-400">
                      {file ? formatFileSize(file.size) : '0 B'}
                    </p>
                  </div>
                </div>
              </label>

              <div className="rounded-[28px] border border-white/10 bg-black/25 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-cyan-100">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <label
                      htmlFor={passwordInputId}
                      className="text-sm font-medium text-white"
                    >
                      Senha ou chave
                    </label>
                    <p className="mt-1 text-sm text-zinc-400">
                      Use uma senha forte ou gere uma chave hex de 64 caracteres.
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  <div className="relative">
                    <input
                      id={passwordInputId}
                      type="password"
                      value={password}
                      autoComplete="new-password"
                      spellCheck={false}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={
                        mode === 'encrypt'
                          ? 'Digite uma senha forte para proteger o arquivo'
                          : 'Digite a mesma senha usada na criptografia'
                      }
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/50 focus:bg-white/10 focus:ring-2 focus:ring-cyan-400/20"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleGenerateKey}
                      disabled={isProcessing}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm font-medium text-amber-50 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Sparkles className="h-4 w-4" />
                      Modo WhatsApp
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyKey}
                      disabled={!password || isProcessing || !hasClipboardSupport}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Copy className="h-4 w-4" />
                      {copied ? 'Copiado' : 'Copiar chave'}
                    </button>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-zinc-300">Forca da senha</span>
                    <span className={strength.textClass}>{strength.label}</span>
                  </div>

                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {STRENGTH_SLOTS.map((slot) => (
                      <span
                        key={slot}
                        className={`h-2 rounded-full transition ${
                          slot <= strength.level ? strength.barClass : 'bg-zinc-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-black/25 p-5">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-zinc-300">Processamento local</span>
                  <span className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-400">
                    {progress}%
                  </span>
                </div>

                <progress
                  className="cryptify-progress mt-3"
                  value={progress}
                  max={100}
                  aria-label="Progresso do processamento"
                />

                <p className="mt-3 text-xs uppercase tracking-[0.28em] text-zinc-500">
                  {progressLabel}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <button
                  type="button"
                  onClick={handleProcess}
                  disabled={!file || !password || isProcessing || !canUseSecureProcessing}
                  className="inline-flex items-center justify-center gap-2 rounded-[22px] bg-white px-5 py-3.5 text-sm font-semibold text-zinc-950 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isProcessing ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : mode === 'encrypt' ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <Unlock className="h-4 w-4" />
                  )}
                  {currentMode.action}
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={!resultUrl}
                  className="inline-flex items-center justify-center gap-2 rounded-[22px] border border-white/10 bg-white/5 px-5 py-3.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download className="h-4 w-4" />
                  {mode === 'decrypt' ? 'Baixar descriptografado' : 'Download'}
                </button>
              </div>

              {resultName ? (
                <p className="text-sm text-emerald-300">
                  Arquivo pronto: <span className="font-mono text-xs">{resultName}</span>
                </p>
              ) : null}

              {mode === 'decrypt' && resultUrl ? (
                <div className="rounded-[28px] border border-white/10 bg-black/25 p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-cyan-100">
                      <Unlock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        Previa local do arquivo recuperado
                      </p>
                      <p className="mt-1 text-sm text-zinc-400">
                        A reproducao acontece no proprio navegador. Baixe o arquivo so
                        depois de validar o conteudo.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[24px] border border-white/10 bg-black/20 p-4">
                    {preview.kind === 'audio' ? (
                      <audio controls preload="metadata" className="w-full">
                        <source src={resultUrl} type={preview.mimeType || undefined} />
                        Seu navegador nao conseguiu carregar o player de audio.
                      </audio>
                    ) : null}

                    {preview.kind === 'video' ? (
                      <video
                        controls
                        preload="metadata"
                        className="max-h-[420px] w-full rounded-2xl bg-black"
                      >
                        <source src={resultUrl} type={preview.mimeType || undefined} />
                        Seu navegador nao conseguiu carregar o player de video.
                      </video>
                    ) : null}

                    {preview.kind === 'image' ? (
                      <img
                        src={resultUrl}
                        alt={`Previa de ${resultName}`}
                        className="max-h-[420px] w-full rounded-2xl object-contain"
                      />
                    ) : null}

                    {preview.kind === 'pdf' ? (
                      <iframe
                        src={resultUrl}
                        title={`Previa de ${resultName}`}
                        className="h-[420px] w-full rounded-2xl bg-white"
                      />
                    ) : null}

                    {preview.kind === 'none' ? (
                      <p className="text-sm leading-7 text-zinc-300">
                        O arquivo foi recuperado com sucesso, mas este formato nao tem
                        preview nativo disponivel no navegador. Use o botao de download
                        para abrir o conteudo no app adequado.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div
                role="status"
                aria-live="polite"
                className={`rounded-[24px] border p-4 text-sm ${STATUS_STYLES[status.tone]}`}
              >
                <div className="flex items-start gap-3">
                  <StatusIcon
                    className={`mt-0.5 h-5 w-5 shrink-0 ${
                      isProcessing ? 'animate-spin' : ''
                    }`}
                  />
                  <p className="leading-6">{status.message}</p>
                </div>
              </div>
            </div>
          </section>
        </section>

        <footer className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <p>100% no navegador - Nada sai do dispositivo</p>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-zinc-500">
            Formato CRIPTIFY1 - Chrome, Edge, Firefox - Safari com limite pratico
            de ~2 GB
          </p>
        </footer>
      </main>
    </div>
  )
}
