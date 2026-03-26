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
  decryptText,
  encryptText,
  formatFileSize,
} from '../lib/cryptify'
import {
  SecretTextPayloadError,
  parseEncryptedTextPayload,
  serializeEncryptedTextPayload,
} from '../lib/secret-text-payload'
import {
  MAX_STEG_IMAGE_SIZE_BYTES,
  SteganographyError,
  extractMessageFromImage,
  hideMessageInImage,
} from '../lib/steganography'
import MobileStickyCTA from './ui/MobileStickyCTA'
import ResultPanel from './ui/ResultPanel'
import SegmentedMode from './ui/SegmentedMode'

type Tab = 'hide' | 'reveal'
type Tone = 'info' | 'success' | 'error'

type StatusState = {
  tone: Tone
  message: string
}

type Props = {
  compact?: boolean
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

function getFriendlyErrorMessage(error: unknown) {
  if (
    error instanceof SteganographyError ||
    error instanceof CriptifyError ||
    error instanceof SecretTextPayloadError
  ) {
    return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Ocorreu um erro inesperado. Tente novamente.'
}

export default function SteganographyPanel({ compact = false }: Props) {
  const [tab, setTab] = useState<Tab>('hide')
  const [plainText, setPlainText] = useState('')
  const [hidePassword, setHidePassword] = useState('')
  const [revealPassword, setRevealPassword] = useState('')
  const [coverImage, setCoverImage] = useState<File | null>(null)
  const [revealImage, setRevealImage] = useState<File | null>(null)
  const [secretImageBlob, setSecretImageBlob] = useState<Blob | null>(null)
  const [secretImageUrl, setSecretImageUrl] = useState<string | null>(null)
  const [revealedText, setRevealedText] = useState('')
  const [revealedCiphertext, setRevealedCiphertext] = useState('')
  const [hideStatus, setHideStatus] = useState<StatusState>({
    tone: 'info',
    message: 'Escreva a mensagem, escolha a senha e envie a imagem.',
  })
  const [revealStatus, setRevealStatus] = useState<StatusState>({
    tone: 'info',
    message:
      'Envie a imagem e use a senha para revelar a mensagem.',
  })
  const [isEmbedding, setIsEmbedding] = useState(false)
  const [isRevealing, setIsRevealing] = useState(false)
  const hideFileInputId = useId()
  const revealFileInputId = useId()
  const secretImageUrlRef = useRef<string | null>(null)
  const hideResultRef = useRef<HTMLDivElement | null>(null)
  const revealResultRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    return () => {
      if (secretImageUrlRef.current) {
        URL.revokeObjectURL(secretImageUrlRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!secretImageUrl) {
      return
    }

    hideResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [secretImageUrl])

  useEffect(() => {
    if (!revealedText) {
      return
    }

    revealResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [revealedText])

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
      message: `${selected.name} carregada. Agora clique em "Gerar imagem secreta".`,
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

  async function handleHideMessage() {
    if (!plainText.trim()) {
      setHideStatus({
        tone: 'error',
        message: 'Digite uma mensagem antes de gerar a imagem secreta.',
      })
      return
    }

    if (!hidePassword) {
      setHideStatus({
        tone: 'error',
        message: 'Digite uma senha para proteger a mensagem escondida.',
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
    setSecretImageBlob(null)
    updateSecretImagePreview(null)

    try {
      const encrypted = await encryptText(plainText, hidePassword)
      const serialized = serializeEncryptedTextPayload(encrypted)
      const secretBlob = await hideMessageInImage(coverImage, serialized)

      setSecretImageBlob(secretBlob)
      updateSecretImagePreview(secretBlob)
      setHideStatus({
        tone: 'success',
        message: 'Imagem secreta gerada com sucesso. Agora você pode baixar o PNG protegido.',
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
        message: 'Digite a senha correta para abrir a mensagem.',
      })
      return
    }

    setIsRevealing(true)
    setRevealedText('')

    try {
      const extractedPayload = await extractMessageFromImage(revealImage)
      const encrypted = parseEncryptedTextPayload(extractedPayload)
      const decrypted = await decryptText(encrypted, revealPassword)

      setRevealedCiphertext(extractedPayload)
      setRevealedText(decrypted)
      setRevealStatus({
        tone: 'success',
        message: 'Mensagem revelada com sucesso.',
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
    <section className="panel-surface rounded-[32px] p-4 pb-28 sm:p-6 lg:pb-6">
      <div className="flex flex-col gap-6">
        <div className={compact ? 'hidden' : 'flex items-start justify-between gap-4'}>
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/80">
              Esteganografia local
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              Esconda uma mensagem protegida dentro de uma imagem
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">
              Escreva a mensagem, escolha a senha e gere uma nova imagem para compartilhar.
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
            { value: 'hide', label: 'Esconder', icon: <EyeOff className="h-4 w-4" /> },
            { value: 'reveal', label: 'Revelar', icon: <Eye className="h-4 w-4" /> },
          ]}
        />

        {tab === 'hide' ? (
          <>
            <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="surface-primary rounded-[24px] p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="icon-chip p-2">
                    <Lock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Mensagem secreta</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      Escreva o texto e a senha. O navegador faz o resto.
                    </p>
                  </div>
                </div>

                <textarea
                  value={plainText}
                  onChange={(event) => setPlainText(event.target.value)}
                  rows={6}
                  placeholder="Digite aqui a mensagem que será protegida e escondida na imagem."
                  className="tool-textarea mt-4 min-h-[140px] sm:min-h-[180px]"
                />

                <input
                  type="password"
                  value={hidePassword}
                  onChange={(event) => setHidePassword(event.target.value)}
                  placeholder="Digite a senha da mensagem secreta"
                  className="tool-input mt-4"
                />

                <button
                  type="button"
                  onClick={handleHideMessage}
                  disabled={!plainText.trim() || !hidePassword || !coverImage || isEmbedding}
                  className="btn-primary mt-4 hidden w-full lg:inline-flex"
                >
                  {isEmbedding ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  ) : (
                    <ImageUp className="h-5 w-5" />
                  )}
                  Gerar imagem secreta
                </button>

                <div
                  role="status"
                  aria-live="polite"
                  className={`mt-4 rounded-[24px] border p-4 text-sm ${STATUS_STYLES[hideStatus.tone]}`}
                >
                  <div className="flex items-start gap-3">
                    {isEmbedding ? (
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

              <div className="surface-secondary rounded-[24px] p-4 sm:p-5">
                <p className="text-sm font-medium text-white">Imagem base</p>
                <p className="mt-2 text-sm leading-7 text-zinc-400">
                  Envie a imagem que vai receber a mensagem. Aceita PNG ou JPG de até {formatFileSize(MAX_STEG_IMAGE_SIZE_BYTES)}. O download final sai em PNG.
                </p>

                <label
                  htmlFor={hideFileInputId}
                  className="mt-4 flex cursor-pointer flex-col gap-3 surface-upload rounded-[24px] p-5 transition"
                >
                  <input
                    id={hideFileInputId}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={handleCoverImageChange}
                  />

                  <div className="flex items-center gap-3">
                    <div className="icon-chip p-3">
                      <FileImage className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Selecionar imagem base</p>
                      <p className="text-xs text-zinc-500">Escolha uma imagem para receber a mensagem protegida.</p>
                    </div>
                  </div>

                  {coverImage ? (
                    <p className="text-sm text-emerald-300">
                      {coverImage.name} - {formatFileSize(coverImage.size)}
                    </p>
                  ) : (
                    <p className="text-sm text-zinc-400">Nenhuma imagem selecionada ainda.</p>
                  )}
                </label>

                <div className="mt-4 surface-technical rounded-[24px] p-4 text-sm leading-7 text-zinc-400">
                  A imagem gerada vai aparecer logo abaixo, pronta para baixar.
                </div>
              </div>
            </div>

            <div ref={hideResultRef}>
              {isEmbedding || secretImageBlob ? (
                <ResultPanel
                  title="Imagem secreta pronta"
                  description="Confira a imagem e baixe o PNG quando quiser."
                  actions={
                    <button
                      type="button"
                      onClick={() => secretImageBlob && downloadBlob(secretImageBlob, 'imagem-secreta.png')}
                      disabled={!secretImageBlob}
                      className="btn-secondary"
                    >
                      <Download className="h-4 w-4" />
                      Baixar PNG
                    </button>
                  }
                >
                  <div className="surface-technical flex min-h-[260px] items-center justify-center rounded-[28px] p-5">
                    {isEmbedding ? (
                      <div className="flex flex-col items-center gap-3 text-zinc-300">
                        <LoaderCircle className="h-8 w-8 animate-spin text-cyan-100" />
                        <p className="text-sm">Gerando imagem secreta localmente...</p>
                      </div>
                    ) : secretImageUrl ? (
                      <img
                        src={secretImageUrl}
                        alt="Prévia da imagem secreta"
                        className="max-h-[320px] w-full rounded-2xl object-contain"
                      />
                    ) : null}
                  </div>
                </ResultPanel>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="surface-primary rounded-[24px] p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="icon-chip p-2">
                    <Search className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Revelar mensagem</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      Envie a imagem secreta e use a mesma senha para recuperar o texto.
                    </p>
                  </div>
                </div>

                <label
                  htmlFor={revealFileInputId}
                  className="mt-4 flex cursor-pointer flex-col gap-3 surface-upload rounded-[24px] p-5 transition"
                >
                  <input
                    id={revealFileInputId}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={handleRevealImageChange}
                  />

                  <div className="flex items-center gap-3">
                    <div className="icon-chip p-3">
                      <FileImage className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Selecionar imagem secreta</p>
                      <p className="text-xs text-zinc-500">PNG ou JPG de até {formatFileSize(MAX_STEG_IMAGE_SIZE_BYTES)}.</p>
                    </div>
                  </div>

                  {revealImage ? (
                    <p className="text-sm text-emerald-300">
                      {revealImage.name} - {formatFileSize(revealImage.size)}
                    </p>
                  ) : (
                    <p className="text-sm text-zinc-400">Nenhuma imagem enviada ainda.</p>
                  )}
                </label>

                <input
                  type="password"
                  value={revealPassword}
                  onChange={(event) => setRevealPassword(event.target.value)}
                  placeholder="Digite a senha da mensagem escondida"
                  className="tool-input mt-4"
                />

                <button
                  type="button"
                  onClick={handleRevealMessage}
                  disabled={!revealImage || !revealPassword || isRevealing}
                  className="btn-primary mt-4 hidden w-full lg:inline-flex"
                >
                  {isRevealing ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                  Revelar mensagem
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

              <div className="surface-secondary rounded-[24px] p-4 text-sm leading-7 text-zinc-400 sm:p-5">
                <p className="font-medium text-white">Como funciona</p>
                <ol className="mt-3 space-y-3">
                  <li>1. A imagem é lida localmente no navegador.</li>
                  <li>2. A mensagem escondida é extraída da imagem.</li>
                  <li>3. A senha correta revela o texto original.</li>
                </ol>
              </div>
            </div>

            <div ref={revealResultRef}>
              {(isRevealing || revealedText || revealedCiphertext) ? (
                <ResultPanel
                  title="Mensagem recuperada"
                  description="A mensagem aparece abaixo sem sair do seu dispositivo."
                >
                  <div className="surface-technical rounded-2xl p-4">
                    <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">Texto revelado</p>
                    <div className="surface-secondary mt-3 min-h-[140px] rounded-2xl px-4 py-3.5 text-sm leading-7 text-white sm:min-h-[180px]">
                      {isRevealing ? 'Revelando mensagem...' : revealedText || 'Nenhuma mensagem revelada ainda.'}
                    </div>
                  </div>

                  {revealedCiphertext ? (
                    <div className="mt-4 surface-technical rounded-2xl p-4">
                      <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">Payload extraído</p>
                      <p className="mt-2 break-all font-mono text-xs text-zinc-300">
                        {revealedCiphertext.slice(0, 220)}
                        {revealedCiphertext.length > 220 ? '...' : ''}
                      </p>
                    </div>
                  ) : null}
                </ResultPanel>
              ) : null}
            </div>
          </>
        )}
      </div>

      <MobileStickyCTA
        label={tab === 'hide' ? 'Gerar imagem secreta' : 'Revelar mensagem'}
        icon={tab === 'hide' ? <ImageUp className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        onClick={tab === 'hide' ? handleHideMessage : handleRevealMessage}
        disabled={
          tab === 'hide'
            ? !plainText.trim() || !hidePassword || !coverImage || isEmbedding
            : !revealImage || !revealPassword || isRevealing
        }
        loading={tab === 'hide' ? isEmbedding : isRevealing}
      />
    </section>
  )
}










