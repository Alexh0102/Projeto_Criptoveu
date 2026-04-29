import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  FileArchive,
  LoaderCircle,
  Lock,
  Maximize2,
  Sparkles,
  Unlock,
  Upload,
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

import FieldBlock from '../ui/FieldBlock'
import MobileStickyCTA from '../ui/MobileStickyCTA'
import ResultPanel from '../ui/ResultPanel'
import SegmentedMode from '../ui/SegmentedMode'
import UniversalPreview from './UniversalPreview'
import {
  getUniversalPreviewMetadata,
  type PreviewMetadata,
} from './preview-metadata'
import { useInactivity } from '../../hooks/useInactivity'
import { useStreamingCrypto } from '../../hooks/useStreamingCrypto'
import {
  MAX_FILE_SIZE_BYTES,
  STREAMING_CHUNK_SIZE_BYTES,
  CriptoveuError,
  formatFileSize,
  generateWhatsappStyleKey,
  getPasswordStrength,
} from '../../lib/criptoveu'

type Mode = 'encrypt' | 'decrypt'
type StatusTone = 'info' | 'success' | 'error'

type StatusState = {
  tone: StatusTone
  message: string
}

type ResultItem = {
  id: string
  name: string
  blob: Blob
  url: string
  size: number
  sourceName: string
  preview: PreviewMetadata
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
    action: 'Proteger arquivos',
    title: 'Proteja seus arquivos localmente',
    description:
      'Escolha os arquivos, defina a senha e gere os pacotes protegidos no navegador.',
    hint: 'Aceita qualquer formato de arquivo.',
  },
  decrypt: {
    action: 'Recuperar arquivos',
    title: 'Recupere o conteúdo original',
    description:
      'Envie um arquivo .criptoveu e use a mesma senha para recuperar o conteúdo.',
    hint: 'Também aceita pacotes antigos .cryptify.',
  },
}

const STATUS_STYLES: Record<StatusTone, string> = {
  info: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-50',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-50',
  error: 'border-rose-500/25 bg-rose-500/10 text-rose-50',
}

const STRENGTH_SLOTS = [1, 2, 3, 4, 5]

function downloadBlobUrl(url: string, fileName: string) {
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export default function FileCryptoWorkspace() {
  const [mode, setMode] = useState<Mode>('encrypt')
  const [files, setFiles] = useState<File[]>([])
  const [password, setPassword] = useState('')
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('Pronto para processar')
  const [status, setStatus] = useState<StatusState>({
    tone: 'info',
    message: 'Selecione os arquivos, defina a senha e comece.',
  })
  const [results, setResults] = useState<ResultItem[]>([])
  const [previewItem, setPreviewItem] = useState<ResultItem | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileInputId = useId()
  const passwordInputId = useId()
  const resultUrlRef = useRef<string[]>([])
  const resultPanelRef = useRef<HTMLDivElement | null>(null)
  const isInactive = useInactivity({ disabled: results.length === 0 && !isPreviewOpen })
  const streamingCrypto = useStreamingCrypto()
  const canUseSecureProcessing =
    window.isSecureContext && typeof window.crypto?.subtle !== 'undefined'
  const hasClipboardSupport = typeof navigator.clipboard?.writeText === 'function'

  const strength = getPasswordStrength(password)
  const currentMode = MODE_COPY[mode]
  const totalSelectedSize = files.reduce((sum, currentFile) => sum + currentFile.size, 0)
  const resultUrl = previewItem?.url ?? results[0]?.url ?? null
  const resultName = previewItem?.name ?? results[0]?.name ?? ''
  const activePreviewItem = previewItem ?? results[0] ?? null
  const preview = activePreviewItem?.preview ?? { kind: 'none', label: 'Arquivo' }
  const quickFacts = [
    {
      label: 'Formatos suportados',
      value: mode === 'encrypt' ? 'Qualquer arquivo' : 'Arquivos .criptoveu',
    },
    {
      label: 'Limite recomendado',
      value: formatFileSize(MAX_FILE_SIZE_BYTES),
    },
    {
      label: 'Processamento',
      value: `Blocos de ${formatFileSize(STREAMING_CHUNK_SIZE_BYTES)}`,
    },
    {
      label: 'Envio',
      value: 'Sem envio ao servidor',
    },
  ]

  useEffect(() => {
    if (!canUseSecureProcessing) {
      setStatus({
        tone: 'error',
        message:
          'Abra o site em HTTPS ou localhost para usar esta ferramenta.',
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
    if (results.length === 0) {
      return
    }

    resultPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [results.length])

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
      for (const url of resultUrlRef.current) {
        URL.revokeObjectURL(url)
      }
    }
  }, [])

  function clearResults() {
    for (const url of resultUrlRef.current) {
      URL.revokeObjectURL(url)
    }

    resultUrlRef.current = []
    setResults([])
    setPreviewItem(null)
    setIsPreviewOpen(false)
    streamingCrypto.resetProgress()
  }

  function handleModeChange(nextMode: string) {
    const resolvedMode = nextMode as Mode

    if (resolvedMode === mode) {
      return
    }

    setMode(resolvedMode)
    setProgress(0)
    setProgressLabel('Pronto para processar')
    setStatus({
      tone: 'info',
      message:
        resolvedMode === 'encrypt'
          ? 'Modo de proteção ativo. O arquivo será convertido para .criptoveu.'
          : 'Modo de recuperação ativo. Selecione o arquivo .criptoveu e use a mesma senha.',
    })
    setFiles([])
    clearResults()
  }

  function handleSelectedFiles(selectedFiles: FileList | File[] | null | undefined) {
    const nextFiles = Array.from(selectedFiles ?? [])

    if (nextFiles.length === 0) {
      return
    }

    const validFiles = nextFiles.filter((selectedFile) => selectedFile.size <= MAX_FILE_SIZE_BYTES)
    const rejectedFiles = nextFiles.filter((selectedFile) => selectedFile.size > MAX_FILE_SIZE_BYTES)

    if (validFiles.length === 0) {
      setFiles([])
      clearResults()
      setStatus({
        tone: 'error',
        message: `Todos os arquivos estão acima do limite de ${formatFileSize(MAX_FILE_SIZE_BYTES)}.`,
      })
      return
    }

    setFiles(validFiles)
    setProgress(0)
    setProgressLabel(
      validFiles.length === 1 ? 'Arquivo pronto para processamento' : 'Arquivos prontos para processamento',
    )
    setStatus({
      tone: rejectedFiles.length > 0 ? 'error' : 'info',
      message:
        rejectedFiles.length > 0
          ? `${validFiles.length} arquivo(s) carregado(s). ${rejectedFiles.length} foram ignorado(s) por exceder o limite.`
          : `${validFiles.length} arquivo(s) carregado(s) com sucesso. Tudo continua 100% no navegador.`,
    })
    clearResults()
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleSelectedFiles(event.target.files)
    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragging(false)
    handleSelectedFiles(event.dataTransfer.files)
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
        message: 'A API de clipboard não está disponível neste navegador.',
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
        message: 'Não foi possível acessar a área de transferência.',
      })
    }
  }

  function handleGenerateKey() {
    setPassword(generateWhatsappStyleKey())
    setCopied(false)
    setStatus({
      tone: 'info',
      message: 'Chave longa gerada localmente.',
    })
  }

  function handleDownloadResult(result: ResultItem) {
    downloadBlobUrl(result.url, result.name)
  }

  function handleDownload() {
    const targetResult = previewItem ?? results[0] ?? null

    if (!targetResult) {
      return
    }

    handleDownloadResult(targetResult)
  }

  function handleDownloadAll() {
    if (results.length === 0) {
      return
    }

    results.forEach((result, index) => {
      window.setTimeout(() => {
        downloadBlobUrl(result.url, result.name)
      }, index * 120)
    })
  }

  function handleOpenPreview(result: ResultItem | null = results[0] ?? null) {
    if (!result || result.preview.kind === 'none') {
      return
    }

    setPreviewItem(result)
    setIsPreviewOpen(true)
  }

  function handleClosePreview() {
    setIsPreviewOpen(false)
    setPreviewItem(null)
  }

  async function handleProcess() {
    if (!canUseSecureProcessing) {
      setStatus({
        tone: 'error',
        message: 'Abra o site em HTTPS ou localhost para usar esta ferramenta.',
      })
      return
    }

    if (files.length === 0 || !password) {
      setStatus({
        tone: 'error',
        message: 'Selecione um ou mais arquivos e informe uma senha para continuar.',
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
          ? 'Protegendo arquivos localmente...'
          : 'Recuperando arquivos localmente...',
    })
    clearResults()

    try {
      const processedResults: ResultItem[] = []
      const failures: string[] = []

      for (const [index, currentFile] of files.entries()) {
        const currentStep = index + 1

        try {
          const { blob, downloadName } = await streamingCrypto.processFile(
            mode,
            currentFile,
            password,
            (value, label) => {
              const startProgress = (index / files.length) * 100
              const endProgress = ((index + 1) / files.length) * 100
              const aggregateProgress = startProgress + ((endProgress - startProgress) * value) / 100

              setProgress(Math.round(aggregateProgress))
              setProgressLabel(
                files.length === 1 ? label : `Arquivo ${currentStep}/${files.length} - ${label}`,
              )
            },
          )

          const nextUrl = URL.createObjectURL(blob)
          const nextPreview =
            mode === 'decrypt'
              ? getUniversalPreviewMetadata(blob.type)
              : ({ kind: 'none', label: 'Arquivo' } as PreviewMetadata)

          processedResults.push({
            id: `${downloadName}-${index}-${blob.size}`,
            name: downloadName,
            blob,
            url: nextUrl,
            size: blob.size,
            sourceName: currentFile.name,
            preview: nextPreview,
          })

          if (mode === 'encrypt') {
            downloadBlobUrl(nextUrl, downloadName)
          }
        } catch (error) {
          failures.push(
            `${currentFile.name}: ${
              error instanceof CriptoveuError
                ? error.message
                : 'Falha inesperada ao processar este arquivo.'
            }`,
          )
          setProgress(Math.round(((index + 1) / files.length) * 100))
        }
      }

      resultUrlRef.current = processedResults.map((result) => result.url)
      setResults(processedResults)
      setPreviewItem(null)

      if (processedResults.length === 0) {
        setProgress(0)
        setProgressLabel('Falha no processamento')
        setStatus({
          tone: 'error',
          message: failures[0] ?? 'Nenhum arquivo foi processado com sucesso.',
        })
        return
      }

      const previewableResults = processedResults.filter(
        (result) => result.preview.kind !== 'none',
      )

      setProgress(100)
      setProgressLabel(
        processedResults.length === 1 ? 'Processo concluído' : `${processedResults.length} arquivos concluídos`,
      )
      setStatus({
        tone: failures.length > 0 ? 'error' : 'success',
        message:
          mode === 'encrypt'
            ? failures.length > 0
              ? `${processedResults.length} arquivo(s) protegido(s) com sucesso. ${failures.length} falhou(ram).`
              : `${processedResults.length} arquivo(s) protegido(s) com sucesso. Os downloads foram iniciados.`
            : failures.length > 0
              ? `${processedResults.length} arquivo(s) recuperado(s) com sucesso. ${failures.length} falhou(ram).`
              : previewableResults.length > 0
                ? `${processedResults.length} arquivo(s) recuperado(s) com sucesso. ${previewableResults.length} prévia(s) segura(s) disponível(is).`
                : `${processedResults.length} arquivo(s) recuperado(s) com sucesso. Baixe os arquivos para abrir no aplicativo correspondente.`,
      })
    } catch (error) {
      setProgress(0)
      setProgressLabel('Falha no processamento')
      setStatus({
        tone: 'error',
        message:
          error instanceof CriptoveuError
            ? error.message
            : 'Ocorreu um erro inesperado ao processar os arquivos.',
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
    <>
      <div className="grid min-w-0 gap-5 overflow-hidden pb-28 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:pb-0">
        <section className="panel-surface min-w-0 rounded-[32px] p-5 sm:p-6">
          <div className="space-y-5">
            <SegmentedMode
              label="Modo"
              value={mode}
              onChange={handleModeChange}
              sticky
              options={[
                {
                  value: 'encrypt',
                  label: 'Proteger',
                  icon: <Lock className="h-4 w-4" />,
                },
                {
                  value: 'decrypt',
                  label: 'Recuperar',
                  icon: <Unlock className="h-4 w-4" />,
                },
              ]}
            />

            <div className="surface-primary rounded-[28px] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/80">
                    {mode === 'encrypt' ? 'Operação ativa' : 'Recuperação ativa'}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">{currentMode.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">{currentMode.description}</p>
                </div>
                <div className="icon-chip p-3">
                  {mode === 'encrypt' ? <Lock className="h-6 w-6" /> : <Unlock className="h-6 w-6" />}
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
                multiple
                accept={mode === 'decrypt' ? '.criptoveu,.cryptify' : undefined}
                onChange={handleFileInputChange}
              />

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="icon-chip p-3 transition group-hover:scale-105">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-medium text-white">
                      Arraste e solte um ou mais arquivos aqui
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">{currentMode.hint}</p>
                  </div>
                </div>

                <span className="btn-secondary">
                  Escolher arquivos
                </span>
              </div>

              <div className="surface-technical rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-100">
                      <FileArchive className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                        Arquivos selecionados
                      </p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {files.length > 0
                          ? `${files.length} arquivo(s) pronto(s) para processamento`
                          : 'Nenhum arquivo carregado'}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Limite recomendado: {formatFileSize(MAX_FILE_SIZE_BYTES)}
                      </p>

                      {files.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {files.slice(0, 4).map((selectedFile) => (
                            <div
                              key={`${selectedFile.name}-${selectedFile.size}-${selectedFile.lastModified}`}
                              className="flex items-center justify-between gap-3 text-xs text-zinc-400"
                            >
                              <span className="truncate">{selectedFile.name}</span>
                              <span className="shrink-0 font-mono uppercase tracking-[0.2em] text-zinc-500">
                                {formatFileSize(selectedFile.size)}
                              </span>
                            </div>
                          ))}

                          {files.length > 4 ? (
                            <p className="text-xs text-zinc-500">+ {files.length - 4} arquivo(s) adicional(is)</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <p className="shrink-0 font-mono text-xs uppercase tracking-[0.2em] text-zinc-400">
                    {files.length > 0 ? formatFileSize(totalSelectedSize) : '0 B'}
                  </p>
                </div>
              </div>
            </label>

            <div className="surface-primary rounded-[28px] p-5">
              <FieldBlock
                label="Senha de proteção"
                htmlFor={passwordInputId}
                helper="Você também pode gerar uma chave longa."
              >
                <div className="space-y-3">
                  <input
                    id={passwordInputId}
                    type="password"
                    value={password}
                    autoComplete="new-password"
                    spellCheck={false}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={
                      mode === 'encrypt'
                        ? 'Digite uma senha para proteger os arquivos'
                        : 'Digite a senha usada para proteger os arquivos'
                    }
                    className="tool-input w-full"
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleGenerateKey}
                      disabled={isProcessing}
                      className="btn-accent"
                    >
                      <Sparkles className="h-4 w-4" />
                      Gerar chave longa
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyKey}
                      disabled={!password || isProcessing || !hasClipboardSupport}
                      className="btn-secondary"
                    >
                      <Copy className="h-4 w-4" />
                      {copied ? 'Copiado' : 'Copiar valor'}
                    </button>
                  </div>

                  <p className="text-xs leading-6 text-zinc-500">
                    Use a mesma senha ou chave para recuperar os arquivos depois.
                  </p>
                </div>
              </FieldBlock>

              <div className="mt-5 surface-technical rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-300">Segurança da senha</span>
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

            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <button
                  type="button"
                  onClick={handleProcess}
                  disabled={files.length === 0 || !password || isProcessing || !canUseSecureProcessing}
                  className="btn-primary hidden lg:inline-flex"
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
                  onClick={handleDownloadAll}
                  disabled={results.length === 0}
                  className="btn-secondary"
                >
                  <Download className="h-4 w-4" />
                  Baixar todos
                </button>
              </div>

              <div className="flex flex-col gap-2 text-xs leading-6 text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
                <p>Guarde a senha: você vai precisar dela para recuperar o conteúdo.</p>
                <p>
                  {results.length === 0
                    ? 'Baixar todos fica disponível após o processamento.'
                    : 'Use Baixar todos para salvar tudo de uma vez.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="min-w-0 space-y-5 overflow-hidden">
          <section className="surface-secondary min-w-0 rounded-[28px] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Guia rápido</p>
                <p className="mt-2 text-sm font-medium text-white">Antes de processar</p>
              </div>
              <div className="icon-chip p-2">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {quickFacts.map((item) => (
                <div key={item.label} className="surface-technical rounded-[20px] p-3.5">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{item.label}</p>
                  <p className="mt-2 text-sm font-medium text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-primary min-w-0 overflow-hidden rounded-[28px] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-zinc-300">Processamento local</span>
              <span className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-400">
                {progress}%
              </span>
            </div>

            <progress
              className="criptoveu-progress mt-3"
              value={progress}
              max={100}
              aria-label="Progresso do processamento"
            />

            <p className="mt-3 text-xs uppercase tracking-[0.28em] text-zinc-500">{progressLabel}</p>

            <div
              role="status"
              aria-live="polite"
              className={`mt-5 rounded-[24px] border p-4 text-sm ${STATUS_STYLES[status.tone]}`}
            >
              <div className="flex items-start gap-3">
                <StatusIcon className={`mt-0.5 h-5 w-5 shrink-0 ${isProcessing ? 'animate-spin' : ''}`} />
                <p className="leading-6">{status.message}</p>
              </div>
            </div>

            {!canUseSecureProcessing ? (
              <div className="mt-4 rounded-[24px] border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-100">
                Este recurso só funciona em HTTPS ou localhost.
              </div>
            ) : null}
          </section>
          <div ref={resultPanelRef} className="min-w-0 overflow-hidden">
            <ResultPanel
            title="Resultados"
            description="Seus arquivos processados aparecem aqui para baixar ou revisar."
            actions={
              results.length > 1 ? (
                <button
                  type="button"
                  onClick={handleDownloadAll}
                  className="btn-secondary w-full sm:w-auto"
                >
                  <Download className="h-4 w-4" />
                  Baixar todos
                </button>
              ) : null
            }
          >
            {results.length === 0 ? (
              <div className="surface-secondary rounded-[24px] p-5 text-sm leading-7 text-zinc-400">
                Os arquivos processados vão aparecer aqui.
              </div>
            ) : null}

            {results.length > 0 ? (
              <div
                className="min-w-0 space-y-4 overflow-hidden transition duration-300"
                style={{ filter: isInactive ? 'blur(15px)' : 'none' }}
              >
                {results.map((result) => (
                  <article
                    key={result.id}
                    className="surface-technical min-w-0 overflow-hidden rounded-[24px] p-4"
                  >
                    <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="break-words text-xs uppercase tracking-[0.2em] text-zinc-500 sm:tracking-[0.28em]">
                          {mode === 'encrypt'
                            ? 'Pacote gerado'
                            : result.preview.kind !== 'none'
                              ? `${result.preview.label} pronto para revisar`
                              : 'Arquivo pronto'}
                        </p>
                        <p className="mt-2 break-words text-sm font-semibold text-white">{result.name}</p>
                        <p className="mt-1 break-words text-xs text-zinc-400">Origem: {result.sourceName}</p>
                      </div>

                      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-none lg:auto-cols-max lg:grid-flow-col">
                        {mode === 'decrypt' && result.preview.kind !== 'none' ? (
                          <button
                            type="button"
                            onClick={() => handleOpenPreview(result)}
                            className="btn-secondary w-full"
                          >
                            <Maximize2 className="h-4 w-4" />
                            Visualizar
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => handleDownloadResult(result)}
                          className="btn-secondary w-full"
                        >
                          <Download className="h-4 w-4" />
                          Baixar
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex min-w-0 flex-col gap-2 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
                      <span>{formatFileSize(result.size)}</span>
                      {mode === 'decrypt' && result.preview.kind !== 'none' ? (
                        <span>Prévia local sem envio para servidores</span>
                      ) : null}
                    </div>

                    {mode === 'decrypt' && result.preview.kind !== 'none' ? (
                      <div className="mt-4 surface-primary min-w-0 overflow-hidden rounded-[24px] p-3 sm:p-4">
                        <UniversalPreview
                          url={result.url}
                          blob={result.blob}
                          fileName={result.name}
                          isInactive={isInactive}
                          onOpen={() => handleOpenPreview(result)}
                          onDownload={() => handleDownloadResult(result)}
                        />
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
            </ResultPanel>
          </div>
        </div>
      </div>

      <MobileStickyCTA
        label={currentMode.action}
        icon={mode === 'encrypt' ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
        onClick={handleProcess}
        disabled={files.length === 0 || !password || isProcessing || !canUseSecureProcessing}
        loading={isProcessing}
      />

      {isPreviewOpen && activePreviewItem && resultUrl && preview.kind !== 'none' ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Visualização ampliada do arquivo recuperado"
        >
          <button
            type="button"
            onClick={handleClosePreview}
            className="absolute inset-0"
            aria-label="Fechar visualização ampliada"
          />

          <div className="relative z-10 w-full max-w-6xl rounded-[32px] border border-white/10 bg-zinc-950/95 p-4 shadow-2xl shadow-black/40 sm:p-6">
            <UniversalPreview
              url={activePreviewItem.url}
              blob={activePreviewItem.blob}
              fileName={resultName}
              expanded
              isInactive={isInactive}
              onClose={handleClosePreview}
              onDownload={handleDownload}
            />
          </div>
        </div>
      ) : null}
    </>
  )
}












