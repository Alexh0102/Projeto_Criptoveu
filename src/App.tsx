import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  FileArchive,
  KeyRound,
  LoaderCircle,
  Lock,
  Maximize2,
  MoonStar,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Unlock,
  Upload,
  X,
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
import SteganographyPanel from './components/SteganographyPanel'

type Mode = 'encrypt' | 'decrypt'
type ActiveView = 'files' | 'steganography'
type Theme = 'dark' | 'light'
type StatusTone = 'info' | 'success' | 'error'
type PreviewKind = 'image' | 'none'

type StatusState = {
  tone: StatusTone
  message: string
}

type PreviewState = {
  kind: PreviewKind
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
      'Monte um pacote .cryptify com cabeçalho CRIPTIFY1, salt aleatório, IV exclusivo e payload em AES-256-GCM.',
    hint: 'Aceita qualquer formato de arquivo para criptografar.',
  },
  decrypt: {
    action: 'Descriptografar arquivo',
    title: 'Recuperação segura do conteúdo',
    description:
      'Abra um arquivo .cryptify, derive a chave localmente via PBKDF2 e recupere o arquivo original sem enviar nada para um servidor.',
    hint: 'Selecione um arquivo com extensão .cryptify.',
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
  if (mimeType.startsWith('image/')) {
    return { kind: 'image' }
  }

  return { kind: 'none' }
}

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('files')
  const [mode, setMode] = useState<Mode>('encrypt')
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = window.localStorage.getItem('criptify-theme')

    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
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
  const [preview, setPreview] = useState<PreviewState>({ kind: 'none' })
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
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
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('criptify-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!canUseSecureProcessing) {
      setStatus({
        tone: 'error',
        message:
          'Este app precisa ser aberto em HTTPS ou localhost com Web Crypto API disponível para processar arquivos.',
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
    if (!isPreviewOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsPreviewOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isPreviewOpen])

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
    setPreview({ kind: 'none' })
    setIsPreviewOpen(false)
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
          ? 'Modo de criptografia ativo. O arquivo será convertido para .cryptify.'
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
        message: 'A API de clipboard não está disponível neste navegador ou contexto atual.',
      })
      return
    }

    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setStatus({
        tone: 'success',
        message: 'Senha ou chave copiada para a área de transferência.',
      })
    } catch {
      setStatus({
        tone: 'error',
        message: 'Não foi possível acessar a área de transferência neste navegador.',
      })
    }
  }

  function handleGenerateKey() {
    setPassword(generateWhatsappStyleKey())
    setCopied(false)
    setStatus({
      tone: 'info',
      message: 'Chave aleatória de 64 caracteres hex gerada no estilo WhatsApp.',
    })
  }

  function handleDownload() {
    if (!resultUrl || !resultName) {
      return
    }

    downloadBlobUrl(resultUrl, resultName)
  }

  function handleOpenPreview() {
    if (!resultUrl || preview.kind !== 'image') {
      return
    }

    setIsPreviewOpen(true)
  }

  function handleClosePreview() {
    setIsPreviewOpen(false)
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
        mode === 'decrypt' ? getPreviewState(blob.type) : { kind: 'none' }
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
            : nextPreview.kind === 'image'
              ? 'Arquivo descriptografado com sucesso. Se for uma imagem, use a prévia local antes de baixar.'
              : 'Arquivo descriptografado com sucesso. Este formato não tem prévia local. Use o download manual para abrir o conteúdo no app adequado.',
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
  const canExpandPreview = mode === 'decrypt' && Boolean(resultUrl) && preview.kind === 'image'
  const isToolsView = activeView === 'steganography'

  function renderPreviewImage(expanded: boolean) {
    if (!resultUrl) {
      return null
    }

    return (
      <img
        src={resultUrl}
        alt={`Previa de ${resultName}`}
        className={`w-full rounded-2xl object-contain ${
          expanded ? 'max-h-[76vh]' : 'max-h-[420px]'
        }`}
      />
    )
  }

  return (
    <div className="app-shell relative min-h-screen overflow-hidden bg-ink text-white">
      <div className="pointer-events-none absolute inset-0 bg-grid-fade bg-[size:36px_36px] opacity-20 [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.9),transparent)]" />
      <div className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-10 h-80 w-80 rounded-full bg-amber-400/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.38em] text-cyan-100/80">
              Criptify
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Segurança local para arquivos e ferramentas online.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">
              Escolha a operação principal ou abra a lateral de ferramentas online.
              A esteganografia já está disponível ali, e as próximas funções ficarão
              agrupadas no mesmo espaço.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          >
            {theme === 'dark' ? (
              <>
                <SunMedium className="h-4 w-4" />
                Tema claro
              </>
            ) : (
              <>
                <MoonStar className="h-4 w-4" />
                Tema escuro
              </>
            )}
          </button>
        </header>

        <div className="grid gap-8 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="panel-surface h-fit rounded-[32px] p-4 sm:p-5 xl:sticky xl:top-6">
            <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">
              Navegação
            </p>

            <div className="mt-4 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setActiveView('files')}
                aria-pressed={activeView === 'files'}
                className={`rounded-[24px] border px-4 py-4 text-left transition ${
                  activeView === 'files'
                    ? 'border-cyan-400/35 bg-cyan-400/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-cyan-100">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      Criptografia de arquivos
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">
                      Fluxo principal de criptografar e descriptografar arquivos.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-6 border-t border-white/10 pt-6">
              <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">
                Ferramentas online
              </p>

              <div className="mt-4 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setActiveView('steganography')}
                  aria-pressed={activeView === 'steganography'}
                  className={`rounded-[24px] border px-4 py-4 text-left transition ${
                    activeView === 'steganography'
                      ? 'border-cyan-400/35 bg-cyan-400/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-cyan-100">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Esteganografia</p>
                      <p className="mt-1 text-xs leading-5 text-zinc-400">
                        Esconda e revele texto criptografado em imagens.
                      </p>
                    </div>
                  </div>
                </button>

                <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-zinc-400">
                  As próximas funções ficarão nesta área lateral.
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
            {isToolsView ? (
              <section className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-cyan-100">
                      <Sparkles className="h-4 w-4" />
                      Ferramenta online
                    </div>

                    <div className="space-y-4">
                      <p className="text-sm uppercase tracking-[0.45em] text-zinc-400">
                        Esteganografia local
                      </p>
                      <h2 className="max-w-3xl text-4xl font-semibold leading-none tracking-tight text-white sm:text-5xl">
                        Esconda texto criptografado dentro de imagens.
                      </h2>
                      <p className="max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
                        Use LSB nos canais RGB com header de 32 bits para ocultar
                        mensagens criptografadas. Tudo acontece 100% no navegador,
                        sem servidor e sem bibliotecas pesadas.
                      </p>
                    </div>

                    <div className="panel-surface rounded-[28px] p-5 sm:p-6">
                      <div className="flex items-start gap-4">
                        <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-3 text-cyan-100">
                          <ShieldCheck className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.35em] text-cyan-100/80">
                            Fluxo local
                          </p>
                          <h3 className="mt-2 text-2xl font-semibold text-white">
                            A mensagem já sai criptografada antes de ser escondida.
                          </h3>
                          <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-300 sm:text-base">
                            Primeiro o texto é criptografado com senha. Depois o payload
                            cifrado é embutido na imagem e pode ser revelado mais tarde
                            com a mesma senha.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <SteganographyPanel />
                </div>
              </section>
            ) : (
              <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-cyan-100">
              <ShieldCheck className="h-4 w-4" />
              100% client-side
            </div>

            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.45em] text-zinc-400">
                Criptografia local para portfólio
              </p>
              <h1 className="max-w-3xl text-4xl font-semibold leading-none tracking-tight text-white sm:text-5xl lg:text-6xl">
                Criptografe e recupere arquivos sem enviar nada para a nuvem.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
                Criptify demonstra segurança real no navegador com React, TypeScript e
                Web Crypto API, em um fluxo inspirado pelo universo do WhatsApp
                .crypt15 e adaptado para um formato próprio.
              </p>
            </div>

            <div className="panel-surface rounded-[28px] p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-3 text-cyan-100">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-cyan-100/80">
                    Aviso de segurança
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Seus arquivos nunca saem do navegador
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-300 sm:text-base">
                    A senha nunca é armazenada. A chave é derivada localmente com
                    PBKDF2, cada arquivo recebe salt e IV aleatórios, e todo o
                    processamento acontece com a API nativa do navegador.
                  </p>
                </div>
              </div>
            </div>

            <div className="panel-surface rounded-[28px] p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-3 text-amber-50">
                  <Maximize2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-amber-100/80">
                    Prévia local
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Imagens podem ser conferidas antes do download
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-300 sm:text-base">
                    Quando o arquivo descriptografado for uma imagem, você pode
                    visualizá-la e ampliar o conteúdo diretamente no navegador antes
                    de baixar. Vídeos e outros formatos seguem com download manual.
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
                      A Web Crypto API exige HTTPS ou localhost. Sem isso, o app não
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
                  Derivação
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">600k PBKDF2</p>
                <p className="mt-2 text-sm text-zinc-400">SHA-256 em cada chave</p>
              </article>

              <article className="panel-surface rounded-3xl p-5">
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                  Compatibilidade
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">Browser nativo</p>
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
                      {mode === 'encrypt' ? 'Operação ativa' : 'Recuperação ativa'}
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
                    <span className="text-zinc-300">Força da senha</span>
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

              {mode === 'decrypt' && resultUrl && preview.kind === 'image' ? (
                <div className="rounded-[28px] border border-white/10 bg-black/25 p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-cyan-100">
                      <Unlock className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        Prévia local da imagem recuperada
                      </p>
                      <p className="mt-1 text-sm text-zinc-400">
                        A visualização acontece no próprio navegador. Baixe o arquivo
                        só depois de validar o conteúdo.
                      </p>
                    </div>
                  </div>

                  {canExpandPreview ? (
                    <div className="mt-4 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.24em] text-zinc-500">
                      <p>Clique na prévia para ampliar.</p>
                      <button
                        type="button"
                        onClick={handleOpenPreview}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-medium text-white transition hover:bg-white/10"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                        Abrir ampliado
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-[24px] border border-white/10 bg-black/20 p-4">
                    <button
                      type="button"
                      onClick={handleOpenPreview}
                        className="block w-full cursor-zoom-in rounded-2xl transition hover:opacity-95"
                        aria-label="Ampliar prévia da imagem"
                      >
                      {renderPreviewImage(false)}
                    </button>
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
            )}
          </div>
        </div>

        <footer className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <p>100% no navegador • Nada sai do dispositivo</p>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-zinc-500">
            Formato CRIPTIFY1 • Chrome, Edge, Firefox • Safari com limite prático
            de ~2 GB
          </p>
        </footer>
      </main>

      {isPreviewOpen && resultUrl && preview.kind === 'image' ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Visualização ampliada da imagem recuperada"
        >
          <button
            type="button"
            onClick={handleClosePreview}
            className="absolute inset-0"
            aria-label="Fechar visualização ampliada"
          />

          <div className="relative z-10 flex w-full max-w-6xl flex-col gap-4 rounded-[32px] border border-white/10 bg-zinc-950/95 p-4 shadow-2xl shadow-black/40 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/80">
                  Visualização ampliada
                </p>
                <p className="mt-2 text-lg font-semibold text-white">{resultName}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  <Download className="h-4 w-4" />
                  Baixar arquivo
                </button>

                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                  Fechar
                </button>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-black/40 p-3 sm:p-4">
              {renderPreviewImage(true)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
