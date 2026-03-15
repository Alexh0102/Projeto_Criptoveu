import {
  AlertCircle,
  CheckCircle2,
  Download,
  ImageUp,
  LoaderCircle,
  Lock,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import type { ChangeEvent, ClipboardEvent } from 'react'

import {
  CriptifyError,
  decryptText,
  encryptText,
  formatFileSize,
} from '../lib/cryptify'
import {
  MAX_QR_IMAGE_SIZE_BYTES,
  QRCodeSecretError,
  extractSecretPayloadFromQrImage,
} from '../lib/qr-secret'
import {
  SecretTextPayloadError,
  parseEncryptedTextPayload,
  serializeEncryptedTextPayload,
} from '../lib/secret-text-payload'
import { useSecretQrCode } from '../hooks/useSecretQrCode'

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
    error instanceof CriptifyError
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

export default function QRCodeGenerator() {
  const [tab, setTab] = useState<Tab>('generate')
  const [plainText, setPlainText] = useState('')
  const [generatePassword, setGeneratePassword] = useState('')
  const [encryptedPayload, setEncryptedPayload] = useState('')
  const [isEncrypting, setIsEncrypting] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [qrImage, setQrImage] = useState<File | null>(null)
  const [readPassword, setReadPassword] = useState('')
  const [decodedPayload, setDecodedPayload] = useState('')
  const [revealedText, setRevealedText] = useState('')
  const [isReading, setIsReading] = useState(false)
  const [generateStatus, setGenerateStatus] = useState<StatusState>({
    tone: 'info',
    message:
      'Digite um texto, informe uma senha e criptografe localmente antes de gerar o QR Code.',
  })
  const [readStatus, setReadStatus] = useState<StatusState>({
    tone: 'info',
    message:
      'Envie ou cole uma imagem com QR Code e informe a senha para recuperar o texto.',
  })
  const fileInputId = useId()
  const {
    qrCodeDataUrl,
    isGenerating,
    generateQrCode,
    clearQrCode,
    downloadQrCode,
  } = useSecretQrCode({
    size: 300,
    margin: 1,
    downloadFileName: 'qr-code-secreto.png',
  })

  useEffect(() => {
    if (!isModalOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsModalOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isModalOpen])

  async function handleEncryptText() {
    if (!plainText.trim()) {
      setGenerateStatus({
        tone: 'error',
        message: 'Digite um texto antes de criptografar para gerar o QR Code.',
      })
      return
    }

    if (!generatePassword) {
      setGenerateStatus({
        tone: 'error',
        message: 'Digite uma senha antes de criptografar o texto do QR Code.',
      })
      return
    }

    setIsEncrypting(true)
    clearQrCode()

    try {
      const encrypted = await encryptText(plainText, generatePassword)
      const serialized = serializeEncryptedTextPayload(encrypted)

      setEncryptedPayload(serialized)
      setReadPassword((currentPassword) => currentPassword || generatePassword)
      setGenerateStatus({
        tone: 'success',
        message:
          'Texto criptografado com sucesso. Agora voce pode gerar o QR Code secreto.',
      })
    } catch (error) {
      setGenerateStatus({
        tone: 'error',
        message: getFriendlyErrorMessage(error),
      })
    } finally {
      setIsEncrypting(false)
    }
  }

  async function handleGenerateModalOpen() {
    setTab('generate')

    if (!encryptedPayload) {
      setGenerateStatus({
        tone: 'error',
        message: 'Criptografe o texto antes de gerar o QR Code secreto.',
      })
      return
    }

    setIsModalOpen(true)
    const generated = await generateQrCode(encryptedPayload)

    setGenerateStatus({
      tone: generated ? 'success' : 'error',
      message: generated
        ? 'QR Code secreto gerado localmente. Baixe o PNG ou escaneie com o celular.'
        : 'Nao foi possivel gerar o QR Code secreto com o payload atual.',
    })
  }

  function handleQrImageChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null
    event.target.value = ''

    if (!selected) {
      return
    }

    setQrImage(selected)
    setDecodedPayload('')
    setRevealedText('')
    setReadStatus({
      tone: 'info',
      message: `${selected.name} carregada. Agora informe a senha e leia o QR Code.`,
    })
  }

  function handlePasteImage(event: ClipboardEvent<HTMLDivElement>) {
    const pastedImage = getClipboardImageFile(event.clipboardData)

    if (!pastedImage) {
      setReadStatus({
        tone: 'error',
        message:
          'Nenhuma imagem foi encontrada na area de transferencia. Cole uma captura do QR Code.',
      })
      return
    }

    event.preventDefault()
    const normalizedFile = new File([pastedImage], pastedImage.name || 'qr-colado.png', {
      type: pastedImage.type || 'image/png',
    })

    setQrImage(normalizedFile)
    setDecodedPayload('')
    setRevealedText('')
    setReadStatus({
      tone: 'info',
      message:
        'Imagem colada com sucesso. Informe a senha e leia o QR Code secreto.',
    })
  }

  async function handleReadQrCode() {
    if (!qrImage) {
      setReadStatus({
        tone: 'error',
        message: 'Envie ou cole uma imagem antes de tentar ler o QR Code.',
      })
      return
    }

    if (!readPassword) {
      setReadStatus({
        tone: 'error',
        message: 'Digite a senha correta para descriptografar o texto do QR Code.',
      })
      return
    }

    setIsReading(true)
    setDecodedPayload('')
    setRevealedText('')

    try {
      const extractedPayload = await extractSecretPayloadFromQrImage(qrImage)
      const encrypted = parseEncryptedTextPayload(extractedPayload)
      const decrypted = await decryptText(encrypted, readPassword)

      setDecodedPayload(extractedPayload)
      setRevealedText(decrypted)
      setReadStatus({
        tone: 'success',
        message:
          'QR Code lido com sucesso. O texto original foi descriptografado localmente.',
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
    <section className="panel-surface rounded-[32px] p-4 sm:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/80">
              QR Code secreto
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              Gere ou leia um QR Code com texto criptografado
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">
              Criptografe um texto localmente, gere um QR Code com o payload
              completo e depois leia esse QR em qualquer dispositivo usando a mesma
              senha.
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-3 text-cyan-100">
            <Sparkles className="h-6 w-6" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-3xl border border-white/10 bg-black/20 p-1.5">
          <button
            type="button"
            aria-pressed={tab === 'generate'}
            onClick={() => setTab('generate')}
            className={`flex items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-sm font-medium transition ${
              tab === 'generate'
                ? 'bg-white text-zinc-950 shadow-lg shadow-cyan-500/10'
                : 'text-zinc-300 hover:bg-white/5'
            }`}
          >
            <Lock className="h-4 w-4" />
            Gerar QR
          </button>

          <button
            type="button"
            aria-pressed={tab === 'read'}
            onClick={() => setTab('read')}
            className={`flex items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-sm font-medium transition ${
              tab === 'read'
                ? 'bg-white text-zinc-950 shadow-lg shadow-cyan-500/10'
                : 'text-zinc-300 hover:bg-white/5'
            }`}
          >
            <Search className="h-4 w-4" />
            Ler QR
          </button>
        </div>

        {tab === 'generate' ? (
          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-medium text-white">
                1. Criptografe o texto
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                Digite a mensagem e a senha. O payload criptografado sera usado para
                montar o QR Code secreto.
              </p>

              <textarea
                value={plainText}
                onChange={(event) => setPlainText(event.target.value)}
                rows={8}
                placeholder="Digite aqui o texto que sera protegido antes de virar QR Code."
                className="mt-4 min-h-[200px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/50 focus:bg-white/10 focus:ring-2 focus:ring-cyan-400/20"
              />

              <input
                type="password"
                value={generatePassword}
                onChange={(event) => setGeneratePassword(event.target.value)}
                placeholder="Digite a senha do texto secreto"
                className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/50 focus:bg-white/10 focus:ring-2 focus:ring-cyan-400/20"
              />

              <button
                type="button"
                onClick={handleEncryptText}
                disabled={isEncrypting}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[24px] border border-cyan-300/25 bg-cyan-300/10 px-5 py-4 text-base font-semibold text-cyan-50 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isEncrypting ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                  <Lock className="h-5 w-5" />
                )}
                Criptografar texto
              </button>

              {encryptedPayload ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">
                    Payload pronto para QR
                  </p>
                  <p className="mt-2 break-all font-mono text-xs text-zinc-300">
                    {encryptedPayload.slice(0, 220)}
                    {encryptedPayload.length > 220 ? '...' : ''}
                  </p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleGenerateModalOpen}
                disabled={!encryptedPayload || isGenerating}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[24px] bg-white px-5 py-4 text-base font-semibold text-zinc-950 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
                Gerar QR Code secreto
              </button>

              <div
                role="status"
                aria-live="polite"
                className={`mt-4 rounded-[24px] border p-4 text-sm ${STATUS_STYLES[generateStatus.tone]}`}
              >
                <div className="flex items-start gap-3">
                  {isEncrypting || isGenerating ? (
                    <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
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

            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-medium text-white">
                Como usar no celular
              </p>
              <ol className="mt-3 space-y-3 text-sm leading-7 text-zinc-400">
                <li>1. Criptografe o texto e gere o QR Code secreto.</li>
                <li>2. Escaneie a imagem com o celular ou baixe o PNG.</li>
                <li>3. Abra o Criptify e use a aba de leitura de QR Code.</li>
                <li>4. Digite a mesma senha para revelar o texto original.</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-medium text-white">
                1. Envie o QR Code
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                Envie um PNG/JPG com QR Code ou cole uma captura usando Ctrl+V.
              </p>

              <label
                htmlFor={fileInputId}
                className="mt-4 flex cursor-pointer flex-col gap-3 rounded-[24px] border border-dashed border-white/15 bg-white/[0.035] p-5 transition hover:border-cyan-400/40 hover:bg-white/[0.06]"
              >
                <input
                  id={fileInputId}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                  onChange={handleQrImageChange}
                />

                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-cyan-100">
                    <ImageUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      Selecionar imagem com QR Code
                    </p>
                    <p className="text-xs text-zinc-500">
                      Limite de {formatFileSize(MAX_QR_IMAGE_SIZE_BYTES)}.
                    </p>
                  </div>
                </div>

                {qrImage ? (
                  <p className="text-sm text-emerald-300">
                    {qrImage.name} - {formatFileSize(qrImage.size)}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-400">
                    Nenhuma imagem com QR foi enviada ainda.
                  </p>
                )}
              </label>

              <div
                tabIndex={0}
                onPaste={handlePasteImage}
                className="mt-4 rounded-[24px] border border-dashed border-white/15 bg-white/[0.035] p-5 text-sm leading-7 text-zinc-400 outline-none transition focus:border-cyan-400/40 focus:bg-white/[0.06]"
              >
                Cole aqui uma captura do QR Code com Ctrl+V. O navegador processa a
                imagem localmente pelo canvas.
              </div>

              <input
                type="password"
                value={readPassword}
                onChange={(event) => setReadPassword(event.target.value)}
                placeholder="Digite a senha usada na criptografia"
                className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/50 focus:bg-white/10 focus:ring-2 focus:ring-cyan-400/20"
              />

              <button
                type="button"
                onClick={handleReadQrCode}
                disabled={!qrImage || !readPassword || isReading}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[24px] bg-white px-5 py-4 text-base font-semibold text-zinc-950 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isReading ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
                Ler QR e descriptografar
              </button>

              <div
                role="status"
                aria-live="polite"
                className={`mt-4 rounded-[24px] border p-4 text-sm ${STATUS_STYLES[readStatus.tone]}`}
              >
                <div className="flex items-start gap-3">
                  {isReading ? (
                    <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
                  ) : readStatus.tone === 'success' ? (
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

            <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-medium text-white">
                2. Texto recuperado do QR
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                Depois da leitura, o payload e descriptografado localmente e o texto
                aparece abaixo.
              </p>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">
                  Texto revelado
                </p>
                <div className="mt-3 min-h-[180px] rounded-2xl border border-white/10 bg-black/20 px-4 py-3.5 text-sm leading-7 text-white">
                  {revealedText || 'Nenhum texto foi revelado ainda a partir de QR Code.'}
                </div>
              </div>

              {decodedPayload ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">
                    Payload lido do QR
                  </p>
                  <p className="mt-2 break-all font-mono text-xs text-zinc-300">
                    {decodedPayload.slice(0, 220)}
                    {decodedPayload.length > 220 ? '...' : ''}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {isModalOpen ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/80 px-4 py-4 backdrop-blur-sm sm:px-6 sm:py-6"
          role="dialog"
          aria-modal="true"
          aria-label="QR Code secreto"
        >
          <button
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0"
            aria-label="Fechar modal do QR Code"
          />

          <div className="relative z-10 mx-auto flex min-h-full w-full items-start justify-center py-2 sm:items-center">
            <div className="relative flex w-full max-w-xl flex-col gap-5 rounded-[32px] border border-white/10 bg-zinc-950/95 p-5 shadow-2xl shadow-black/40 sm:p-6 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/80">
                  QR Code secreto
                </p>
                <h4 className="mt-2 text-2xl font-semibold text-white">
                  Payload criptografado pronto para escanear
                </h4>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false)
                  clearQrCode()
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10"
              >
                <X className="h-4 w-4" />
                Fechar
              </button>
            </div>

            <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-white/10 bg-white/5 p-5">
              {isGenerating ? (
                <div className="flex flex-col items-center gap-3 text-zinc-300">
                  <LoaderCircle className="h-8 w-8 animate-spin text-cyan-100" />
                  <p className="text-sm">Gerando QR Code secreto localmente...</p>
                </div>
              ) : qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="QR Code secreto do payload criptografado"
                  className="h-[300px] w-[300px] rounded-2xl bg-white p-3"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-zinc-300">
                  <AlertCircle className="h-8 w-8 text-rose-300" />
                  <p className="text-sm">
                    Nao foi possivel montar a imagem do QR Code.
                  </p>
                </div>
              )}
            </div>

            <p className="text-center text-sm leading-7 text-zinc-300">
              Escaneie com o celular e digite a senha no Criptify para ler.
            </p>

            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => downloadQrCode('qr-code-secreto.png')}
                disabled={!qrCodeDataUrl}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                Baixar PNG
              </button>
            </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
