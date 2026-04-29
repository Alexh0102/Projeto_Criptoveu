import {
  AlertCircle,
  CheckCircle2,
  Download,
  ImageUp,
  Lock,
  Search,
  Sparkles,
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, ClipboardEvent } from 'react'

import { CriptoveuError, decryptText, encryptText, formatFileSize } from '../lib/criptoveu'
import {
  MAX_QR_IMAGE_SIZE_BYTES,
  QRCodeSecretError,
  buildSecretQrUrl,
  extractSecretPayloadFromQrImage,
  readSecretPayloadFromQrInput,
} from '../lib/qr-secret'
import {
  SecretTextPayloadError,
  parseEncryptedTextPayload,
  serializeEncryptedTextPayload,
} from '../lib/secret-text-payload'
import { useSecretQrCode } from '../hooks/useSecretQrCode'
import MobileStickyCTA from './ui/MobileStickyCTA'
import ResultPanel from './ui/ResultPanel'
import SegmentedMode from './ui/SegmentedMode'

type Props = {
  compact?: boolean
  incomingHashPayload?: string | null
  incomingHashError?: string | null
  onClearIncomingHash?: () => void
}

type Tab = 'generate' | 'read'
type Tone = 'info' | 'success' | 'error'

type StatusState = {
  tone: Tone
  message: string
}

const STATUS_STYLES: Record<Tone, string> = {
  info: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-50',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-50',
  error: 'border-rose-500/25 bg-rose-500/10 text-rose-50',
}

function getFriendlyErrorMessage(error: unknown) {
  if (
    error instanceof QRCodeSecretError ||
    error instanceof SecretTextPayloadError ||
    error instanceof CriptoveuError
  ) {
    return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Ocorreu um erro inesperado ao processar o QR Code.'
}

function getClipboardImageFile(clipboardData: DataTransfer | null) {
  if (!clipboardData) {
    return null
  }

  for (const item of clipboardData.items) {
    if (item.type.startsWith('image/')) {
      return item.getAsFile()
    }
  }

  return null
}

export default function QRCodeGenerator({
  compact = false,
  incomingHashPayload = null,
  incomingHashError = null,
  onClearIncomingHash,
}: Props) {
  const [tab, setTab] = useState<Tab>('generate')
  const [plainText, setPlainText] = useState('')
  const [generatePassword, setGeneratePassword] = useState('')
  const [isSubmittingGenerate, setIsSubmittingGenerate] = useState(false)
  const [qrImage, setQrImage] = useState<File | null>(null)
  const [readPassword, setReadPassword] = useState('')
  const [resolvedPayload, setResolvedPayload] = useState('')
  const [revealedText, setRevealedText] = useState('')
  const [isReading, setIsReading] = useState(false)
  const [generateStatus, setGenerateStatus] = useState<StatusState>({
    tone: 'info',
    message: 'Escreva a mensagem, defina a senha e gere o QR.',
  })
  const [readStatus, setReadStatus] = useState<StatusState>({
    tone: 'info',
    message: 'Envie a imagem com QR ou escaneie o código e use a senha para abrir a mensagem.',
  })
  const fileInputId = useId()
  const generateResultRef = useRef<HTMLDivElement | null>(null)
  const {
    qrCodeDataUrl,
    isGenerating,
    generateQrCode,
    clearQrCode,
    downloadQrCode,
  } = useSecretQrCode({
    size: 300,
    margin: 1,
    downloadFileName: 'qr-protegido.png',
  })

  useEffect(() => {
    if (!qrCodeDataUrl) {
      return
    }

    generateResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [qrCodeDataUrl])

  useEffect(() => {
    if (!incomingHashPayload) {
      return
    }

    setTab('read')
    setQrImage(null)
    setResolvedPayload(incomingHashPayload)
    setRevealedText('')
    setReadStatus({
      tone: 'info',
      message: 'Mensagem carregada automaticamente do QR. Agora digite a senha para abrir.',
    })
  }, [incomingHashPayload])

  useEffect(() => {
    if (!incomingHashError) {
      return
    }

    setTab('read')
    setResolvedPayload('')
    setRevealedText('')
    setReadStatus({
      tone: 'error',
      message: incomingHashError,
    })
  }, [incomingHashError])

  async function handleGenerateQr() {
    if (!plainText.trim()) {
      setGenerateStatus({
        tone: 'error',
        message: 'Preencha a mensagem antes de gerar o QR protegido.',
      })
      return
    }

    if (!generatePassword) {
      setGenerateStatus({
        tone: 'error',
        message: 'Digite uma senha para proteger a mensagem do QR.',
      })
      return
    }

    setIsSubmittingGenerate(true)
    clearQrCode()

    try {
      const encrypted = await encryptText(plainText, generatePassword)
      const serialized = serializeEncryptedTextPayload(encrypted)
      const qrUrl = buildSecretQrUrl(serialized)
      setReadPassword((currentPassword) => currentPassword || generatePassword)

      const generated = await generateQrCode(qrUrl)

      setGenerateStatus({
        tone: generated ? 'success' : 'error',
        message: generated
          ? 'QR protegido gerado localmente. Ao escanear, o site abre com a mensagem pronta para pedir a senha.'
          : 'Não foi possível gerar o QR protegido com a mensagem informada.',
      })
    } catch (error) {
      setGenerateStatus({
        tone: 'error',
        message: getFriendlyErrorMessage(error),
      })
    } finally {
      setIsSubmittingGenerate(false)
    }
  }

  function handleQrImageChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null
    event.target.value = ''

    if (!selected) {
      return
    }

    setQrImage(selected)
    setResolvedPayload('')
    setRevealedText('')
    setReadStatus({
      tone: 'info',
      message: `${selected.name} carregada. Agora informe a senha e leia o QR.`,
    })
  }

  function handlePasteImage(event: ClipboardEvent<HTMLDivElement>) {
    const pastedImage = getClipboardImageFile(event.clipboardData)

    if (!pastedImage) {
      setReadStatus({
        tone: 'error',
        message: 'Nenhuma imagem foi encontrada. Cole uma captura do QR Code.',
      })
      return
    }

    event.preventDefault()
    const normalizedFile = new File([pastedImage], pastedImage.name || 'qr-colado.png', {
      type: pastedImage.type || 'image/png',
    })

    setQrImage(normalizedFile)
    setResolvedPayload('')
    setRevealedText('')
    setReadStatus({
      tone: 'info',
      message: 'Imagem colada com sucesso. Agora informe a senha para ler o QR.',
    })
  }

  async function handleReadQrCode() {
    if (!resolvedPayload && !qrImage) {
      setReadStatus({
        tone: 'error',
        message: 'Envie uma imagem com QR ou abra o link vindo do QR antes de continuar.',
      })
      return
    }

    if (!readPassword) {
      setReadStatus({
        tone: 'error',
        message: 'Digite a senha correta para abrir a mensagem do QR.',
      })
      return
    }

    setIsReading(true)
    setRevealedText('')

    try {
      const extractedPayload =
        resolvedPayload ||
        readSecretPayloadFromQrInput(await extractSecretPayloadFromQrImage(qrImage as File))
      const encrypted = parseEncryptedTextPayload(extractedPayload)
      const decrypted = await decryptText(encrypted, readPassword)

      setResolvedPayload(extractedPayload)
      setRevealedText(decrypted)
      setReadStatus({
        tone: 'success',
        message: 'QR lido com sucesso. O texto original foi recuperado localmente.',
      })
    } catch (error) {
      setReadStatus({
        tone: 'error',
        message: getFriendlyErrorMessage(error),
      })
    } finally {
      setIsReading(false)
    }
  }

  return (
    <section className="panel-surface rounded-[32px] p-4 pb-28 sm:p-6 lg:pb-6">
      <div className="flex flex-col gap-6">
        <div className={compact ? 'hidden' : 'flex items-start justify-between gap-4'}>
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/80">QR protegido</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              Crie ou leia um QR com mensagem protegida por senha
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">
              Crie um QR para compartilhar uma mensagem protegida ou leia um QR recebido.
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-3 text-cyan-100">
            <Sparkles className="h-6 w-6" />
          </div>
        </div>

        <SegmentedMode
          label="Modo"
          value={tab}
          onChange={(nextValue) => setTab(nextValue as Tab)}
          sticky
          options={[
            { value: 'generate', label: 'Gerar QR', icon: <Lock className="h-4 w-4" /> },
            { value: 'read', label: 'Ler QR', icon: <Search className="h-4 w-4" /> },
          ]}
        />

        {tab === 'generate' ? (
          <>
            <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="surface-primary rounded-[24px] p-4 sm:p-5">
                <p className="text-sm font-medium text-white">Criar QR protegido</p>
                <p className="mt-2 text-sm leading-7 text-zinc-400">
                  Escreva a mensagem, defina a senha e gere o QR em um clique.
                </p>

                <textarea
                  value={plainText}
                  onChange={(event) => setPlainText(event.target.value)}
                  rows={6}
                  placeholder="Digite aqui a mensagem que será protegida antes de virar QR Code."
                  className="tool-textarea mt-4 min-h-[140px] sm:min-h-[180px]"
                />

                <input
                  type="password"
                  value={generatePassword}
                  onChange={(event) => setGeneratePassword(event.target.value)}
                  placeholder="Digite a senha da mensagem"
                  className="tool-input mt-4"
                />

                <button
                  type="button"
                  onClick={handleGenerateQr}
                  disabled={isSubmittingGenerate || isGenerating}
                  className="btn-primary mt-4 hidden w-full lg:inline-flex"
                >
                  {isSubmittingGenerate || isGenerating ? <Sparkles className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                  Gerar QR protegido
                </button>

                <div
                  role="status"
                  aria-live="polite"
                  className={`mt-4 rounded-[24px] border p-4 text-sm ${STATUS_STYLES[generateStatus.tone]}`}
                >
                  <div className="flex items-start gap-3">
                    {isSubmittingGenerate || isGenerating ? (
                      <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
                    ) : generateStatus.tone === 'success' ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                    ) : generateStatus.tone === 'error' ? (
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    ) : (
                      <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
                    )}
                    <p className="leading-6">{generateStatus.message}</p>
                  </div>
                </div>
              </div>

              <div className="surface-secondary rounded-[24px] p-4 text-sm text-zinc-400 sm:p-5">
                <p className="font-medium text-white">Como funciona</p>
                <ol className="mt-3 space-y-3 leading-7">
                  <li>1. Escreva a mensagem e defina a senha.</li>
                  <li>2. O navegador protege o conteúdo.</li>
                  <li>3. O QR fica pronto para baixar e compartilhar.</li>
                  <li>4. Quem receber usa a mesma senha para abrir.</li>
                </ol>
              </div>
            </div>

            <div ref={generateResultRef}>
              {isGenerating || qrCodeDataUrl ? (
                <ResultPanel
                  title="QR protegido pronto"
                  description="Baixe o PNG ou escaneie a imagem para abrir o site com a mensagem já carregada."
                  actions={
                    <button
                      type="button"
                      onClick={() => downloadQrCode('qr-protegido.png')}
                      disabled={!qrCodeDataUrl}
                      className="btn-secondary"
                    >
                      <Download className="h-4 w-4" />
                      Baixar PNG
                    </button>
                  }
                >
                  <div className="surface-technical flex min-h-[260px] items-center justify-center rounded-[28px] p-5">
                    {isGenerating ? (
                      <div className="flex flex-col items-center gap-3 text-zinc-300">
                        <Sparkles className="h-8 w-8 text-cyan-100" />
                        <p className="text-sm">Gerando QR protegido localmente...</p>
                      </div>
                    ) : qrCodeDataUrl ? (
                      <img
                        src={qrCodeDataUrl}
                        alt="QR com mensagem protegida por senha"
                        className="h-[260px] w-[260px] rounded-2xl bg-white p-3 sm:h-[300px] sm:w-[300px]"
                      />
                    ) : null}
                  </div>
                </ResultPanel>
              ) : null}
            </div>
          </>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="surface-primary rounded-[24px] p-4 sm:p-5">
              <p className="text-sm font-medium text-white">Abrir QR protegido</p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                Envie a imagem com QR, cole uma captura com Ctrl+V ou abra o link depois de escanear.
              </p>

              <label
                htmlFor={fileInputId}
                className="mt-4 flex cursor-pointer flex-col gap-3 surface-upload rounded-[24px] p-5 transition"
              >
                <input
                  id={fileInputId}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={handleQrImageChange}
                />

                <div className="flex items-center gap-3">
                  <div className="icon-chip p-3">
                    <ImageUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Selecionar imagem com QR Code</p>
                    <p className="text-xs text-zinc-500">Limite de {formatFileSize(MAX_QR_IMAGE_SIZE_BYTES)}.</p>
                  </div>
                </div>

                {qrImage ? (
                  <p className="text-sm text-emerald-300">{qrImage.name} - {formatFileSize(qrImage.size)}</p>
                ) : (
                  <p className="text-sm text-zinc-400">Nenhuma imagem com QR foi enviada ainda.</p>
                )}
              </label>

              <div
                tabIndex={0}
                onPaste={handlePasteImage}
                className="mt-4 surface-upload rounded-[24px] p-5 text-sm leading-7 text-zinc-400 outline-none transition"
              >
                Cole aqui uma captura do QR Code com Ctrl+V. O navegador processa a imagem localmente.
              </div>

              <input
                type="password"
                value={readPassword}
                onChange={(event) => setReadPassword(event.target.value)}
                placeholder="Digite a senha da mensagem"
                className="tool-input mt-4"
              />

              {incomingHashPayload && onClearIncomingHash ? (
                <button
                  type="button"
                  onClick={onClearIncomingHash}
                  className="btn-secondary mt-4"
                >
                  Limpar mensagem da URL
                </button>
              ) : null}

              <button
                type="button"
                onClick={handleReadQrCode}
                disabled={(!resolvedPayload && !qrImage) || !readPassword || isReading}
                className="btn-primary mt-4 hidden w-full lg:inline-flex"
              >
                <Search className="h-5 w-5" />
                Abrir mensagem do QR
              </button>

              <div
                role="status"
                aria-live="polite"
                className={`mt-4 rounded-[24px] border p-4 text-sm ${STATUS_STYLES[readStatus.tone]}`}
              >
                <div className="flex items-start gap-3">
                  {readStatus.tone === 'success' ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : readStatus.tone === 'error' ? (
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <p className="leading-6">{readStatus.message}</p>
                </div>
              </div>
            </div>

            <div className="surface-secondary rounded-[24px] p-4 sm:p-5">
              <p className="text-sm font-medium text-white">Texto recuperado</p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                A mensagem aparece aqui depois da leitura.
              </p>

              <div className="mt-4 surface-secondary rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">Texto revelado</p>
                <div className="surface-technical mt-3 min-h-[140px] rounded-2xl px-4 py-3.5 text-sm leading-7 text-white sm:min-h-[180px]">
                  {revealedText || 'Nenhuma mensagem foi aberta ainda.'}
                </div>
              </div>

              {resolvedPayload ? (
                <div className="mt-4 surface-technical rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">Dados protegidos do QR</p>
                  <p className="mt-2 break-all font-mono text-xs text-zinc-300">
                    {resolvedPayload.slice(0, 220)}
                    {resolvedPayload.length > 220 ? '...' : ''}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <MobileStickyCTA
        label={tab === 'generate' ? 'Gerar QR protegido' : 'Abrir mensagem do QR'}
        icon={tab === 'generate' ? <Sparkles className="h-5 w-5" /> : <Search className="h-5 w-5" />}
        onClick={tab === 'generate' ? handleGenerateQr : handleReadQrCode}
        disabled={
          tab === 'generate'
            ? !plainText.trim() || !generatePassword || isSubmittingGenerate || isGenerating
            : (!resolvedPayload && !qrImage) || !readPassword || isReading
        }
        loading={tab === 'generate' ? isSubmittingGenerate || isGenerating : isReading}
      />
    </section>
  )
}








