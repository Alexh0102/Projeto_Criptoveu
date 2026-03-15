import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  LoaderCircle,
  Lock,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import {
  AutoDestructLinkError,
  type AutoDestructExpiration,
  type AutoDestructReadResult,
  assertAutoDestructAvailability,
  buildAutoDestructLink,
  getAutoDestructViewState,
  getExpirationLabel,
  incrementAutoDestructViews,
  payloadToDecryptInput,
  readAutoDestructPayloadFromInput,
  serializeAutoDestructPayload,
} from '../lib/auto-destruct-link'
import {
  CriptifyError,
  decryptText,
  encryptText,
  type TextEncryptionResult,
} from '../lib/cryptify'

type Tab = 'generate' | 'read'
type Tone = 'info' | 'success' | 'error'

type StatusState = {
  tone: Tone
  message: string
}

type Props = {
  incomingHashMessage: AutoDestructReadResult | null
  incomingHashError: string | null
  onClearIncomingHash: () => void
}

const STATUS_STYLES: Record<Tone, string> = {
  info: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-50',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-50',
  error: 'border-rose-500/25 bg-rose-500/10 text-rose-50',
}

const EXPIRATION_OPTIONS: Array<{
  value: AutoDestructExpiration
  label: string
  helper: string
}> = [
  {
    value: '24h',
    label: 'Expira em 24h',
    helper: 'Ideal para mensagens temporarias que somem no dia seguinte.',
  },
  {
    value: '7d',
    label: 'Expira em 7 dias',
    helper: 'Mantem o link valido por uma semana a partir da geracao.',
  },
  {
    value: 'never',
    label: 'Nunca expira',
    helper: 'O limite passa a ser apenas o numero maximo de visualizacoes.',
  },
]

const VIEW_LIMIT_OPTIONS: Array<{
  value: string
  label: string
  helper: string
}> = [
  {
    value: '1',
    label: '1 visualizacao',
    helper: 'A mensagem expira logo apos a primeira leitura bem-sucedida.',
  },
  {
    value: '3',
    label: '3 visualizacoes',
    helper: 'Permite ate tres leituras antes de expirar.',
  },
  {
    value: '5',
    label: '5 visualizacoes',
    helper: 'Boa opcao para compartilhar com um grupo pequeno.',
  },
  {
    value: 'unlimited',
    label: 'Sem limite',
    helper: 'Nao bloqueia pela contagem de leituras locais.',
  },
]

function getFriendlyErrorMessage(error: unknown) {
  if (error instanceof AutoDestructLinkError || error instanceof CriptifyError) {
    return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Ocorreu um erro inesperado ao processar o link auto-destrutivo.'
}

function resolveMaxViews(value: string) {
  return value === 'unlimited' ? null : Number.parseInt(value, 10)
}

function formatCreatedAt(timestamp: number) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(timestamp)
}

async function copyToClipboard(value: string) {
  await navigator.clipboard.writeText(value)
}

export default function AutoDestructLink({
  incomingHashMessage,
  incomingHashError,
  onClearIncomingHash,
}: Props) {
  const [tab, setTab] = useState<Tab>('generate')
  const [plainText, setPlainText] = useState('')
  const [generatePassword, setGeneratePassword] = useState('')
  const [encryptedPayload, setEncryptedPayload] = useState<TextEncryptionResult | null>(null)
  const [expiresIn, setExpiresIn] = useState<AutoDestructExpiration>('24h')
  const [maxViewsValue, setMaxViewsValue] = useState('1')
  const [generatedEncodedPayload, setGeneratedEncodedPayload] = useState('')
  const [generatedLink, setGeneratedLink] = useState('')
  const [isEncrypting, setIsEncrypting] = useState(false)
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [generateStatus, setGenerateStatus] = useState<StatusState>({
    tone: 'info',
    message:
      'Criptografe um texto primeiro. Depois gere um link auto-destrutivo com expiracao e limite de visualizacoes.',
  })
  const [readInput, setReadInput] = useState('')
  const [resolvedEncodedPayload, setResolvedEncodedPayload] = useState('')
  const [readPassword, setReadPassword] = useState('')
  const [revealedText, setRevealedText] = useState('')
  const [viewCount, setViewCount] = useState<number | null>(null)
  const [readStatus, setReadStatus] = useState<StatusState>({
    tone: 'info',
    message:
      'Abra o site com um hash #msg=... ou cole um link do Criptify para descriptografar a mensagem localmente.',
  })
  const [isDecrypting, setIsDecrypting] = useState(false)

  const selectedExpiration = useMemo(
    () => EXPIRATION_OPTIONS.find((option) => option.value === expiresIn) ?? EXPIRATION_OPTIONS[0],
    [expiresIn],
  )
  const selectedViewLimit = useMemo(
    () =>
      VIEW_LIMIT_OPTIONS.find((option) => option.value === maxViewsValue) ??
      VIEW_LIMIT_OPTIONS[0],
    [maxViewsValue],
  )
  const resolvedReadPayload = useMemo(() => {
    if (!resolvedEncodedPayload) {
      return null
    }

    try {
      return readAutoDestructPayloadFromInput(resolvedEncodedPayload).payload
    } catch {
      return null
    }
  }, [resolvedEncodedPayload])

  useEffect(() => {
    if (!incomingHashMessage) {
      return
    }

    setTab('read')
    setReadInput(buildAutoDestructLink(incomingHashMessage.encodedPayload))
    setResolvedEncodedPayload(incomingHashMessage.encodedPayload)
    setRevealedText('')
    setViewCount(getAutoDestructViewState(incomingHashMessage.encodedPayload).views)
    setReadStatus({
      tone: 'info',
      message:
        'Uma mensagem auto-destrutiva foi detectada na URL. Digite a senha para tentar descriptografar.',
    })
  }, [incomingHashMessage])

  useEffect(() => {
    if (!incomingHashError) {
      return
    }

    setTab('read')
    setResolvedEncodedPayload('')
    setRevealedText('')
    setViewCount(null)
    setReadStatus({
      tone: 'error',
      message: incomingHashError,
    })
  }, [incomingHashError])

  async function handleEncryptText() {
    if (!plainText.trim()) {
      setGenerateStatus({
        tone: 'error',
        message: 'Digite um texto antes de criptografar a mensagem do link.',
      })
      return
    }

    if (!generatePassword) {
      setGenerateStatus({
        tone: 'error',
        message: 'Digite uma senha antes de criptografar a mensagem do link.',
      })
      return
    }

    setIsEncrypting(true)
    setGeneratedEncodedPayload('')
    setGeneratedLink('')

    try {
      const encrypted = await encryptText(plainText, generatePassword)
      setEncryptedPayload(encrypted)
      setGenerateStatus({
        tone: 'success',
        message:
          'Texto criptografado com sucesso. Agora voce ja pode gerar o link auto-destrutivo.',
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

  async function handleGenerateLink() {
    if (!encryptedPayload) {
      setGenerateStatus({
        tone: 'error',
        message: 'Criptografe o texto antes de gerar o link auto-destrutivo.',
      })
      return
    }

    setIsGeneratingLink(true)

    try {
      const encodedPayload = serializeAutoDestructPayload(encryptedPayload, {
        createdAt: Date.now(),
        expiresIn,
        maxViews: resolveMaxViews(maxViewsValue),
      })
      const link = buildAutoDestructLink(encodedPayload)

      setGeneratedEncodedPayload(encodedPayload)
      setGeneratedLink(link)
      setGenerateStatus({
        tone: 'success',
        message:
          'Link auto-destrutivo gerado localmente. Copie ou abra o link para usar a mensagem secreta.',
      })
    } catch (error) {
      setGenerateStatus({
        tone: 'error',
        message: getFriendlyErrorMessage(error),
      })
    } finally {
      setIsGeneratingLink(false)
    }
  }

  async function handleCopyGeneratedLink() {
    if (!generatedLink) {
      return
    }

    try {
      await copyToClipboard(generatedLink)
      setGenerateStatus({
        tone: 'success',
        message: 'Link auto-destrutivo copiado para a area de transferencia.',
      })
    } catch {
      setGenerateStatus({
        tone: 'error',
        message: 'Nao foi possivel copiar o link neste navegador.',
      })
    }
  }

  function handleOpenGeneratedLink() {
    if (!generatedLink) {
      return
    }

    window.open(generatedLink, '_blank', 'noopener,noreferrer')
  }

  function handleLoadLink() {
    try {
      const resolved = readAutoDestructPayloadFromInput(readInput)
      setResolvedEncodedPayload(resolved.encodedPayload)
      setRevealedText('')
      setViewCount(getAutoDestructViewState(resolved.encodedPayload).views)
      setReadStatus({
        tone: 'info',
        message:
          'Link carregado com sucesso. Agora digite a senha e descriptografe a mensagem.',
      })
    } catch (error) {
      setResolvedEncodedPayload('')
      setRevealedText('')
      setViewCount(null)
      setReadStatus({
        tone: 'error',
        message: getFriendlyErrorMessage(error),
      })
    }
  }

  async function handleDecryptMessage() {
    if (!resolvedEncodedPayload) {
      setReadStatus({
        tone: 'error',
        message: 'Carregue um link ou hash valido antes de descriptografar.',
      })
      return
    }

    if (!readPassword) {
      setReadStatus({
        tone: 'error',
        message: 'Digite a senha correta antes de descriptografar a mensagem.',
      })
      return
    }

    setIsDecrypting(true)
    setRevealedText('')

    try {
      const resolved = readAutoDestructPayloadFromInput(resolvedEncodedPayload)
      const previousViews = assertAutoDestructAvailability(
        resolved.payload,
        resolved.encodedPayload,
      )
      const decrypted = await decryptText(
        payloadToDecryptInput(resolved.payload),
        readPassword,
      )

      let nextViews = previousViews.views

      try {
        nextViews = incrementAutoDestructViews(resolved.encodedPayload).views
      } catch {
        // O contador e opcional; se o storage falhar, ainda mostramos a mensagem.
      }

      setViewCount(nextViews)
      setRevealedText(decrypted)

      const viewCopy =
        resolved.payload.maxViews === null
          ? `Visualizacoes registradas localmente: ${nextViews}.`
          : `Visualizacao ${nextViews} de ${resolved.payload.maxViews}.`

      setReadStatus({
        tone: 'success',
        message: `Mensagem descriptografada com sucesso. ${viewCopy}`,
      })
    } catch (error) {
      setRevealedText('')
      setReadStatus({
        tone: 'error',
        message: getFriendlyErrorMessage(error),
      })
    } finally {
      setIsDecrypting(false)
    }
  }

  return (
    <section className="panel-surface rounded-[32px] p-4 sm:p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/80">
              Link auto-destrutivo
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              Gere um link secreto com expiracao local
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">
              Criptografe um texto, gere um link com hash local e abra o mesmo site
              para descriptografar a mensagem com senha, expiracao e contador de
              visualizacoes salvos no navegador.
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-3 text-cyan-100">
            <Link2 className="h-6 w-6" />
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
            Gerar link
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
            Ler link
          </button>
        </div>

        {tab === 'generate' ? (
          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
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
                    A mensagem e protegida localmente antes de virar link.
                  </p>
                </div>
              </div>

              <textarea
                value={plainText}
                onChange={(event) => setPlainText(event.target.value)}
                rows={8}
                placeholder="Digite aqui o texto secreto que sera protegido antes de gerar o link."
                className="mt-4 min-h-[200px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/50 focus:bg-white/10 focus:ring-2 focus:ring-cyan-400/20"
              />

              <input
                type="password"
                value={generatePassword}
                onChange={(event) => setGeneratePassword(event.target.value)}
                placeholder="Digite a senha da mensagem secreta"
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
            </div>

            <div className="rounded-[28px] border border-white/10 bg-black/25 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-cyan-100">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    2. Gere o link auto-destrutivo
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Defina expiracao, visualizacoes e gere o hash local.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                <label className="text-sm text-zinc-300">
                  Expiracao
                  <select
                    value={expiresIn}
                    onChange={(event) =>
                      setExpiresIn(event.target.value as AutoDestructExpiration)
                    }
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:bg-white/10 focus:ring-2 focus:ring-cyan-400/20"
                  >
                    {EXPIRATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-zinc-300">
                  Limite de visualizacoes
                  <select
                    value={maxViewsValue}
                    onChange={(event) => setMaxViewsValue(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition focus:border-cyan-400/50 focus:bg-white/10 focus:ring-2 focus:ring-cyan-400/20"
                  >
                    {VIEW_LIMIT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">
                  Configuracao selecionada
                </p>
                <p className="mt-2 text-sm leading-7 text-zinc-300">
                  {selectedExpiration.helper}
                </p>
                <p className="mt-1 text-sm leading-7 text-zinc-400">
                  {selectedViewLimit.helper}
                </p>
              </div>

              <button
                type="button"
                onClick={handleGenerateLink}
                disabled={!encryptedPayload || isGeneratingLink}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[24px] bg-white px-5 py-4 text-base font-semibold text-zinc-950 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGeneratingLink ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                  <Link2 className="h-5 w-5" />
                )}
                Gerar link auto-destrutivo
              </button>

              {generatedLink ? (
                <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.26em] text-emerald-100/90">
                    Link pronto
                  </p>
                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="break-all font-mono text-xs leading-6 text-emerald-50">
                      {generatedLink}
                    </p>
                  </div>

                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">
                      Payload do hash
                    </p>
                    <p className="mt-2 break-all font-mono text-[11px] leading-6 text-zinc-300">
                      {generatedEncodedPayload.slice(0, 240)}
                      {generatedEncodedPayload.length > 240 ? '...' : ''}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleCopyGeneratedLink}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                    >
                      <Copy className="h-4 w-4" />
                      Copiar link
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenGeneratedLink}
                      className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/15"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Abrir link
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-[28px] border border-white/10 bg-black/25 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-cyan-100">
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    1. Carregue o link ou use o hash atual
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Se o site abriu com #msg=..., a mensagem sera detectada
                    automaticamente.
                  </p>
                </div>
              </div>

              <textarea
                value={readInput}
                onChange={(event) => setReadInput(event.target.value)}
                rows={4}
                placeholder="Cole aqui um link do Criptify, um hash #msg=... ou o payload em base64."
                className="mt-4 min-h-[140px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/50 focus:bg-white/10 focus:ring-2 focus:ring-cyan-400/20"
              />

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleLoadLink}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-300/15"
                >
                  <Link2 className="h-4 w-4" />
                  Carregar link
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClearIncomingHash()
                    setReadInput('')
                    setResolvedEncodedPayload('')
                    setRevealedText('')
                    setViewCount(null)
                    setReadStatus({
                      tone: 'info',
                      message:
                        'Hash removido da URL. Agora voce pode colar outro link manualmente.',
                    })
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Limpar hash da URL
                </button>
              </div>

              <input
                type="password"
                value={readPassword}
                onChange={(event) => setReadPassword(event.target.value)}
                placeholder="Digite a senha da mensagem secreta"
                className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-400/50 focus:bg-white/10 focus:ring-2 focus:ring-cyan-400/20"
              />

              <button
                type="button"
                onClick={handleDecryptMessage}
                disabled={!resolvedEncodedPayload || !readPassword || isDecrypting}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[24px] bg-white px-5 py-4 text-base font-semibold text-zinc-950 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDecrypting ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
                Descriptografar mensagem
              </button>

              <div
                role="status"
                aria-live="polite"
                className={`mt-4 rounded-[24px] border p-4 text-sm ${STATUS_STYLES[readStatus.tone]}`}
              >
                <div className="flex items-start gap-3">
                  {isDecrypting ? (
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

            <div className="rounded-[28px] border border-white/10 bg-black/25 p-5">
              <p className="text-sm font-medium text-white">
                2. Estado da mensagem
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                O hash traz ciphertext, iv, salt e createdAt. A expiracao e o contador
                de visualizacoes sao avaliados localmente neste navegador.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">
                    Expiracao
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {resolvedReadPayload
                      ? getExpirationLabel(resolvedReadPayload.expiresIn)
                      : '-'}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">
                    Visualizacoes locais
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {viewCount ?? 0}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">
                    Criada em
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {resolvedReadPayload
                      ? formatCreatedAt(resolvedReadPayload.createdAt)
                      : '-'}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">
                    Limite de leituras
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {resolvedReadPayload
                      ? resolvedReadPayload.maxViews === null
                        ? 'Sem limite'
                        : `${resolvedReadPayload.maxViews} visualizacoes`
                      : '-'}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">
                  Texto descriptografado
                </p>
                <div className="mt-3 min-h-[220px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm leading-7 text-white">
                  {revealedText || 'Nenhuma mensagem foi descriptografada ainda.'}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'generate' ? (
          <div
            role="status"
            aria-live="polite"
            className={`rounded-[24px] border p-4 text-sm ${STATUS_STYLES[generateStatus.tone]}`}
          >
            <div className="flex items-start gap-3">
              {isEncrypting || isGeneratingLink ? (
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
        ) : null}
      </div>
    </section>
  )
}
