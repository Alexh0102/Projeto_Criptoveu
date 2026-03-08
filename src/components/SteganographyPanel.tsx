import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileImage,
  ImageUp,
  LoaderCircle,
  Lock,
  Search,
  Sparkles,
} from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

import {
  CriptifyError,
  decodeBase64ToBytes,
  decryptText,
  encodeBytesToBase64,
  encryptText,
  formatFileSize,
} from '../lib/cryptify'
import {
  MAX_STEG_IMAGE_SIZE_BYTES,
  STEGANOGRAPHY_PAYLOAD_PREFIX,
  SteganographyError,
  extractMessageFromImage,
  hideMessageInImage,
} from '../lib/steganography'

type Tab = 'hide' | 'reveal'
type Tone = 'info' | 'success' | 'error'

type StatusState = {
  tone: Tone
  message: string
}

type SerializedPayload = {
  version: 1
  ciphertext: string
  iv: string
  salt: string
}

const STATUS_STYLES: Record<Tone, string> = {
  info: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-50',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-50',
  error: 'border-rose-500/25 bg-rose-500/10 text-rose-50',
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function serializeEncryptedPayload(payload: Awaited<ReturnType<typeof encryptText>>) {
  const serialized: SerializedPayload = {
    version: 1,
    ciphertext: payload.ciphertext,
    iv: encodeBytesToBase64(payload.iv),
    salt: encodeBytesToBase64(payload.salt),
  }

  return `${STEGANOGRAPHY_PAYLOAD_PREFIX}${JSON.stringify(serialized)}`
}

function parseSerializedPayload(payload: string) {
  if (!payload.startsWith(STEGANOGRAPHY_PAYLOAD_PREFIX)) {
    throw new SteganographyError(
      'INVALID_PAYLOAD',
      'A imagem não contém uma mensagem do Criptify reconhecível.',
    )
  }

  const rawJson = payload.slice(STEGANOGRAPHY_PAYLOAD_PREFIX.length)
  const parsed = JSON.parse(rawJson) as Partial<SerializedPayload>

  if (
    parsed.version !== 1 ||
    typeof parsed.ciphertext !== 'string' ||
    typeof parsed.iv !== 'string' ||
    typeof parsed.salt !== 'string'
  ) {
    throw new SteganographyError(
      'INVALID_PAYLOAD',
      'A mensagem escondida esta corrompida ou incompleta.',
    )
  }

  return {
    ciphertext: parsed.ciphertext,
    iv: decodeBase64ToBytes(parsed.iv),
    salt: decodeBase64ToBytes(parsed.salt),
  }
}

function getFriendlyErrorMessage(error: unknown) {
  if (error instanceof SteganographyError || error instanceof CriptifyError) {
    return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Ocorreu um erro inesperado. Tente novamente.'
}

export default function SteganographyPanel() {
  const [tab, setTab] = useState<Tab>('hide')
  const [plainText, setPlainText] = useState('')
  const [hidePassword, setHidePassword] = useState('')
  const [revealPassword, setRevealPassword] = useState('')
  const [encryptedPayload, setEncryptedPayload] = useState('')
  const [coverImage, setCoverImage] = useState<File | null>(null)
  const [revealImage, setRevealImage] = useState<File | null>(null)
  const [secretImageBlob, setSecretImageBlob] = useState<Blob | null>(null)
  const [secretImageUrl, setSecretImageUrl] = useState<string | null>(null)
  const [revealedText, setRevealedText] = useState('')
  const [revealedCiphertext, setRevealedCiphertext] = useState('')
  const [hideStatus, setHideStatus] = useState<StatusState>({
    tone: 'info',
    message:
      'Criptografe um texto, envie uma imagem e esconda a mensagem localmente com LSB.',
  })
  const [revealStatus, setRevealStatus] = useState<StatusState>({
    tone: 'info',
    message:
      'Envie a imagem secreta e informe a senha correta para revelar a mensagem original.',
  })
  const [isEncrypting, setIsEncrypting] = useState(false)
  const [isEmbedding, setIsEmbedding] = useState(false)
  const [isRevealing, setIsRevealing] = useState(false)
  const hideFileInputId = useId()
  const revealFileInputId = useId()
  const secretImageUrlRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (secretImageUrlRef.current) {
        URL.revokeObjectURL(secretImageUrlRef.current)
      }
    }
  }, [])

  function updateSecretImagePreview(blob: Blob | null) {
    if (secretImageUrlRef.current) {
      URL.revokeObjectURL(secretImageUrlRef.current)
      secretImageUrlRef.current = null
    }

    if (!blob) {
      setSecretImageUrl(null)
      return
    }

    const nextUrl = URL.createObjectURL(blob)
    secretImageUrlRef.current = nextUrl
    setSecretImageUrl(nextUrl)
  }

  function handleCoverImageChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null
    event.target.value = ''

    if (!selected) {
      return
    }

    setCoverImage(selected)
    setSecretImageBlob(null)
    updateSecretImagePreview(null)
    setHideStatus({
      tone: 'info',
      message: `${selected.name} carregada. Agora clique em "Esconder mensagem em imagem".`,
    })
  }

  function handleRevealImageChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null
    event.target.value = ''

    if (!selected) {
      return
    }

    setRevealImage(selected)
    setRevealedText('')
    setRevealedCiphertext('')
    setRevealStatus({
      tone: 'info',
      message: `${selected.name} carregada. Informe a senha e revele a mensagem.`,
    })
  }

  async function handleEncryptText() {
    if (!plainText.trim()) {
      setHideStatus({
        tone: 'error',
        message: 'Digite uma mensagem antes de criptografar.',
      })
      return
    }

    if (!hidePassword) {
      setHideStatus({
        tone: 'error',
        message: 'Digite uma senha para criptografar a mensagem.',
      })
      return
    }

    setIsEncrypting(true)
    setSecretImageBlob(null)
    updateSecretImagePreview(null)

    try {
      const encrypted = await encryptText(plainText, hidePassword)
      const serialized = serializeEncryptedPayload(encrypted)

      setEncryptedPayload(serialized)
      setHideStatus({
        tone: 'success',
        message:
          'Texto criptografado com sucesso. Agora envie uma imagem e esconda a mensagem nela.',
      })
    } catch (error) {
      setHideStatus({
        tone: 'error',
        message: getFriendlyErrorMessage(error),
      })
    } finally {
      setIsEncrypting(false)
    }
  }

  async function handleHideMessage() {
    if (!encryptedPayload) {
      setHideStatus({
        tone: 'error',
        message: 'Criptografe o texto antes de tentar escondê-lo em uma imagem.',
      })
      return
    }

    if (!coverImage) {
      setHideStatus({
        tone: 'error',
        message: 'Envie uma imagem PNG ou JPG antes de esconder a mensagem.',
      })
      return
    }

    setIsEmbedding(true)

    try {
      const secretBlob = await hideMessageInImage(coverImage, encryptedPayload)
      setSecretImageBlob(secretBlob)
      updateSecretImagePreview(secretBlob)
      setHideStatus({
        tone: 'success',
        message:
          'Mensagem escondida com sucesso. Baixe agora a imagem-secreta.png gerada no navegador.',
      })
    } catch (error) {
      setHideStatus({
        tone: 'error',
        message: getFriendlyErrorMessage(error),
      })
    } finally {
      setIsEmbedding(false)
    }
  }

  async function handleRevealMessage() {
    if (!revealImage) {
      setRevealStatus({
        tone: 'error',
        message: 'Envie uma imagem para tentar revelar a mensagem escondida.',
      })
      return
    }

    if (!revealPassword) {
      setRevealStatus({
        tone: 'error',
        message: 'Digite a senha correta para descriptografar a mensagem extraída.',
      })
      return
    }

    setIsRevealing(true)
    setRevealedText('')

    try {
      const extractedPayload = await extractMessageFromImage(revealImage)
      const encrypted = parseSerializedPayload(extractedPayload)
      const decrypted = await decryptText(encrypted, revealPassword)

      setRevealedCiphertext(extractedPayload)
      setRevealedText(decrypted)
      setRevealStatus({
        tone: 'success',
        message: 'Mensagem revelada e descriptografada com sucesso.',
      })
    } catch (error) {
      setRevealStatus({
        tone: 'error',
        message: getFriendlyErrorMessage(error),
      })
    } finally {
      setIsRevealing(false)
    }
  }

  return (
    <section className="panel-surface rounded-[32px] p-4 sm:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/80">
              Esteganografia local
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              Esconda texto criptografado dentro de imagens
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">
              O painel abaixo usa LSB nos canais RGB com header de 32 bits para
              esconder mensagens criptografadas em imagens. Tudo acontece 100% no
              navegador, sem servidor, usando apenas canvas nativo.
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-3 text-cyan-100">
            <Sparkles className="h-6 w-6" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-3xl border border-white/10 bg-black/20 p-1.5">
          <button
            type="button"
            aria-pressed={tab === 'hide'}
            onClick={() => setTab('hide')}
            className={`flex items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-sm font-medium transition ${
              tab === 'hide'
                ? 'bg-white text-zinc-950 shadow-lg shadow-cyan-500/10'
                : 'text-zinc-300 hover:bg-white/5'
            }`}
          >
            <EyeOff className="h-4 w-4" />
            Esconder
          </button>

          <button
            type="button"
            aria-pressed={tab === 'reveal'}
            onClick={() => setTab('reveal')}
            className={`flex items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-sm font-medium transition ${
              tab === 'reveal'
                ? 'bg-white text-zinc-950 shadow-lg shadow-cyan-500/10'
                : 'text-zinc-300 hover:bg-white/5'
            }`}
          >
            <Eye className="h-4 w-4" />
            Revelar
          </button>
        </div>

        {tab === 'hide' ? (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[28px] border border-white/10 bg-black/25 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-cyan-100">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    1. Criptografe o texto
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    A mensagem é criptografada antes de ser escondida na imagem.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <textarea
                  value={plainText}
                  onChange={(event) => setPlainText(event.target.value)}
                  rows={7}
                  placeholder="Digite aqui a mensagem secreta que será criptografada e escondida."
                  className="min-h-[180px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/50 focus:bg-white/10 focus:ring-2 focus:ring-cyan-400/20"
                />

                <input
                  type="password"
                  value={hidePassword}
                  onChange={(event) => setHidePassword(event.target.value)}
                  placeholder="Digite a senha da mensagem secreta"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/50 focus:bg-white/10 focus:ring-2 focus:ring-cyan-400/20"
                />

                <button
                  type="button"
                  onClick={handleEncryptText}
                  disabled={isEncrypting}
                  className="inline-flex items-center justify-center gap-2 rounded-[22px] border border-cyan-300/25 bg-cyan-300/10 px-5 py-3.5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isEncrypting ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  Criptografar texto
                </button>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-black/25 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-cyan-100">
                  <ImageUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    2. Esconda a mensagem em uma imagem
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Use PNG ou JPG de até {formatFileSize(MAX_STEG_IMAGE_SIZE_BYTES)}.
                  </p>
                </div>
              </div>

              <label
                htmlFor={hideFileInputId}
                className="mt-4 flex cursor-pointer flex-col gap-3 rounded-[24px] border border-dashed border-white/15 bg-white/[0.035] p-5 transition hover:border-cyan-400/40 hover:bg-white/[0.06]"
              >
                <input
                  id={hideFileInputId}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="hidden"
                  onChange={handleCoverImageChange}
                />

                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-cyan-100">
                    <FileImage className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      Selecionar imagem base
                    </p>
                    <p className="text-xs text-zinc-500">
                      PNG ou JPG. O download final será sempre em PNG.
                      PNG ou JPG. O download final será sempre em PNG.
                    </p>
                  </div>
                </div>

                {coverImage ? (
                  <p className="text-sm text-emerald-300">
                    {coverImage.name} • {formatFileSize(coverImage.size)}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-400">
                    Nenhuma imagem selecionada ainda.
                  </p>
                )}
              </label>

              {encryptedPayload ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">
                    Payload criptografado pronto
                  </p>
                  <p className="mt-2 break-all font-mono text-xs text-zinc-300">
                    {encryptedPayload.slice(0, 180)}
                    {encryptedPayload.length > 180 ? '...' : ''}
                  </p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleHideMessage}
                disabled={!encryptedPayload || !coverImage || isEmbedding}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[24px] bg-white px-5 py-4 text-base font-semibold text-zinc-950 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isEmbedding ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                  <ImageUp className="h-5 w-5" />
                )}
                Esconder mensagem em imagem
              </button>

              {secretImageBlob ? (
                <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
                    <p className="text-sm text-emerald-50">
                      A imagem secreta foi gerada. Baixe como
                      {' '}
                      <span className="font-semibold">imagem-secreta.png</span>.
                    </p>
                  </div>

                  {secretImageUrl ? (
                    <img
                      src={secretImageUrl}
                      alt="Previa da imagem secreta"
                      className="max-h-[280px] w-full rounded-2xl object-contain"
                    />
                  ) : null}

                  <button
                    type="button"
                    onClick={() => downloadBlob(secretImageBlob, 'imagem-secreta.png')}
                    className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    <Download className="h-4 w-4" />
                    Baixar imagem-secreta.png
                  </button>
                </div>
              ) : null}

              <div
                role="status"
                aria-live="polite"
                className={`mt-4 rounded-[24px] border p-4 text-sm ${STATUS_STYLES[hideStatus.tone]}`}
              >
                <div className="flex items-start gap-3">
                  {isEncrypting || isEmbedding ? (
                    <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
                  ) : hideStatus.tone === 'success' ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : hideStatus.tone === 'error' ? (
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <p className="leading-6">{hideStatus.message}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[28px] border border-white/10 bg-black/25 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-cyan-100">
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    1. Envie a imagem secreta
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    O painel extrai o payload LSB e tenta descriptografar o texto.
                  </p>
                </div>
              </div>

              <label
                htmlFor={revealFileInputId}
                className="mt-4 flex cursor-pointer flex-col gap-3 rounded-[24px] border border-dashed border-white/15 bg-white/[0.035] p-5 transition hover:border-cyan-400/40 hover:bg-white/[0.06]"
              >
                <input
                  id={revealFileInputId}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="hidden"
                  onChange={handleRevealImageChange}
                />

                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-cyan-100">
                    <FileImage className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      Selecionar imagem secreta
                    </p>
                    <p className="text-xs text-zinc-500">
                      PNG ou JPG de até {formatFileSize(MAX_STEG_IMAGE_SIZE_BYTES)}.
                    </p>
                  </div>
                </div>

                {revealImage ? (
                  <p className="text-sm text-emerald-300">
                    {revealImage.name} • {formatFileSize(revealImage.size)}
                  </p>
                ) : (
                  <p className="text-sm text-zinc-400">
                    Nenhuma imagem enviada ainda.
                  </p>
                )}
              </label>

              <input
                type="password"
                value={revealPassword}
                onChange={(event) => setRevealPassword(event.target.value)}
                placeholder="Digite a senha da mensagem escondida"
                className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/50 focus:bg-white/10 focus:ring-2 focus:ring-cyan-400/20"
              />

              <button
                type="button"
                onClick={handleRevealMessage}
                disabled={!revealImage || !revealPassword || isRevealing}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[24px] bg-white px-5 py-4 text-base font-semibold text-zinc-950 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRevealing ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
                Revelar mensagem da imagem
              </button>

              <div
                role="status"
                aria-live="polite"
                className={`mt-4 rounded-[24px] border p-4 text-sm ${STATUS_STYLES[revealStatus.tone]}`}
              >
                <div className="flex items-start gap-3">
                  {isRevealing ? (
                    <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
                  ) : revealStatus.tone === 'success' ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : revealStatus.tone === 'error' ? (
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <p className="leading-6">{revealStatus.message}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-black/25 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-cyan-100">
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    2. Texto original recuperado
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Depois da extração, o payload é descriptografado localmente e o texto aparece aqui.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">
                  Texto revelado
                </p>
                <div className="mt-3 min-h-[180px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm leading-7 text-white">
                  {revealedText || 'Nenhuma mensagem revelada ainda.'}
                </div>
              </div>

              {revealedCiphertext ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">
                    Payload extraído
                  </p>
                  <p className="mt-2 break-all font-mono text-xs text-zinc-300">
                    {revealedCiphertext.slice(0, 220)}
                    {revealedCiphertext.length > 220 ? '...' : ''}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
