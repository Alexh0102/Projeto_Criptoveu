import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Link2,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

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
import { CriptifyError, decryptText, encryptText } from '../lib/cryptify'
import AdvancedOptions from './ui/AdvancedOptions'
import MobileStickyCTA from './ui/MobileStickyCTA'
import ResultPanel from './ui/ResultPanel'
import SegmentedMode from './ui/SegmentedMode'

type Tab = 'generate' | 'read'
type Tone = 'info' | 'success' | 'error'

type StatusState = {
  tone: Tone
  message: string
}

type Props = {
  compact?: boolean
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
    helper: 'A mensagem fica disponível por 24 horas.',
  },
  {
    value: '7d',
    label: 'Expira em 7 dias',
    helper: 'A mensagem fica disponível por 7 dias.',
  },
  {
    value: 'never',
    label: 'Nunca expira',
    helper: 'Só o limite de visualizações continua valendo.',
  },
]

const VIEW_LIMIT_OPTIONS: Array<{
  value: string
  label: string
  helper: string
}> = [
  {
    value: '1',
    label: '1 visualização',
    helper: 'Some após a primeira leitura.',
  },
  {
    value: '3',
    label: '3 visualizações',
    helper: 'Permite até três leituras.',
  },
  {
    value: '5',
    label: '5 visualizações',
    helper: 'Boa opção para um grupo pequeno.',
  },
  {
    value: 'unlimited',
    label: 'Sem limite',
    helper: 'Não bloqueia pela contagem de leituras locais.',
  },
]

function OptionCard({
  label,
  helper,
  selected,
  onClick,
}: {
  label: string
  helper: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={(selected ? 'surface-primary' : 'surface-secondary') + ' rounded-[24px] px-4 py-4 text-left transition'}
    >
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{helper}</p>
    </button>
  )
}

function getFriendlyErrorMessage(error: unknown) {
  if (error instanceof AutoDestructLinkError || error instanceof CriptifyError) {
    return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Ocorreu um erro inesperado ao processar o link secreto.'
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
  compact = false,
  incomingHashMessage,
  incomingHashError,
  onClearIncomingHash,
}: Props) {
  const [tab, setTab] = useState<Tab>('generate')
  const [plainText, setPlainText] = useState('')
  const [generatePassword, setGeneratePassword] = useState('')
  const [expiresIn, setExpiresIn] = useState<AutoDestructExpiration>('24h')
  const [maxViewsValue, setMaxViewsValue] = useState('1')
  const [generatedLink, setGeneratedLink] = useState('')
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [generateStatus, setGenerateStatus] = useState<StatusState>({
    tone: 'info',
    message: 'Escreva a mensagem, defina a senha e gere o link.',
  })
  const [readInput, setReadInput] = useState('')
  const [resolvedEncodedPayload, setResolvedEncodedPayload] = useState('')
  const [readPassword, setReadPassword] = useState('')
  const [revealedText, setRevealedText] = useState('')
  const [viewCount, setViewCount] = useState<number | null>(null)
  const [readStatus, setReadStatus] = useState<StatusState>({
    tone: 'info',
    message: 'Cole o link e use a senha para abrir a mensagem.',
  })
  const [isDecrypting, setIsDecrypting] = useState(false)
  const generateResultRef = useRef<HTMLDivElement | null>(null)

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
      message: 'Uma mensagem foi detectada na URL. Digite a senha para tentar abrir.',
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

  useEffect(() => {
    if (!generatedLink) {
      return
    }

    generateResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [generatedLink])

  async function handleGenerateLink() {
    if (!plainText.trim()) {
      setGenerateStatus({
        tone: 'error',
        message: 'Digite uma mensagem antes de gerar o link secreto.',
      })
      return
    }

    if (!generatePassword) {
      setGenerateStatus({
        tone: 'error',
        message: 'Digite uma senha para proteger a mensagem do link.',
      })
      return
    }

    setIsGeneratingLink(true)
    setGeneratedLink('')

    try {
      const encryptedPayload = await encryptText(plainText, generatePassword)
      const encodedPayload = serializeAutoDestructPayload(encryptedPayload, {
        createdAt: Date.now(),
        expiresIn,
        maxViews: resolveMaxViews(maxViewsValue),
      })
      const link = buildAutoDestructLink(encodedPayload)

      setGeneratedLink(link)
      setGenerateStatus({
        tone: 'success',
        message: 'Link secreto gerado localmente. Agora você pode copiar ou abrir a mensagem protegida.',
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
        message: 'Link secreto copiado para a área de transferência.',
      })
    } catch {
      setGenerateStatus({
        tone: 'error',
        message: 'Não foi possível copiar o link neste navegador.',
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
        message: 'Link carregado com sucesso. Agora digite a senha para abrir a mensagem.',
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
        message: 'Carregue um link válido antes de abrir a mensagem.',
      })
      return
    }

    if (!readPassword) {
      setReadStatus({
        tone: 'error',
        message: 'Digite a senha correta antes de abrir a mensagem.',
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
        // Contador local opcional.
      }

      setViewCount(nextViews)
      setRevealedText(decrypted)

      const viewCopy =
        resolved.payload.maxViews === null
          ? `Aberturas registradas neste navegador: ${nextViews}.`
          : `Abertura ${nextViews} de ${resolved.payload.maxViews}.`

      setReadStatus({
        tone: 'success',
        message: `Mensagem aberta com sucesso. ${viewCopy}`,
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
    <section className="panel-surface rounded-[32px] p-4 pb-28 sm:p-6 lg:pb-6">
      <div className="flex flex-col gap-6">
        <div className={compact ? 'hidden' : 'flex items-start justify-between gap-4'}>
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-100/80">Link secreto</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              Crie ou abra uma mensagem protegida por senha
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">
              Crie um link para compartilhar uma mensagem protegida ou abra um link recebido.
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-3 text-cyan-100">
            <Link2 className="h-6 w-6" />
          </div>
        </div>

        <SegmentedMode
          label="Modo"
          value={tab}
          onChange={(nextValue) => setTab(nextValue as Tab)}
          sticky
          options={[
            { value: 'generate', label: 'Gerar link', icon: <Link2 className="h-4 w-4" /> },
            { value: 'read', label: 'Ler link', icon: <Search className="h-4 w-4" /> },
          ]}
        />

        {tab === 'generate' ? (
          <>
            <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="surface-primary rounded-[28px] p-5">
                <div className="flex items-start gap-3">
                  <div className="icon-chip p-2">
                    <Link2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Criar link secreto</p>
                    <p className="mt-1 text-sm text-zinc-400">
                      Escreva a mensagem, defina a senha e gere o link em um clique.
                    </p>
                  </div>
                </div>

                <textarea
                  value={plainText}
                  onChange={(event) => setPlainText(event.target.value)}
                  rows={6}
                  placeholder="Digite aqui a mensagem secreta que será protegida antes de gerar o link."
                  className="tool-textarea mt-4 min-h-[140px] sm:min-h-[180px]"
                />

                <input
                  type="password"
                  value={generatePassword}
                  onChange={(event) => setGeneratePassword(event.target.value)}
                  placeholder="Digite a senha da mensagem secreta"
                  className="tool-input mt-4"
                />

                <button
                  type="button"
                  onClick={handleGenerateLink}
                  disabled={isGeneratingLink}
                  className="btn-primary mt-4 hidden w-full lg:inline-flex"
                >
                  <Link2 className="h-5 w-5" />
                  Gerar link secreto
                </button>

                <div
                  role="status"
                  aria-live="polite"
                  className={`mt-4 rounded-[24px] border p-4 text-sm ${STATUS_STYLES[generateStatus.tone]}`}
                >
                  <div className="flex items-start gap-3">
                    {generateStatus.tone === 'success' ? (
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

              <div className="space-y-4">
                <AdvancedOptions
                  title="Ajustes do link"
                  helper="Defina validade e limite de visualizações."
                >
                  <div className="grid gap-4">
                    <div>
                      <p className="text-sm font-medium text-white">Expiração</p>
                      <div className="mt-3 grid gap-3">
                        {EXPIRATION_OPTIONS.map((option) => (
                          <OptionCard
                            key={option.value}
                            label={option.label}
                            helper={option.helper}
                            selected={expiresIn === option.value}
                            onClick={() => setExpiresIn(option.value)}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-white">Limite de visualizações</p>
                      <div className="mt-3 grid gap-3">
                        {VIEW_LIMIT_OPTIONS.map((option) => (
                          <OptionCard
                            key={option.value}
                            label={option.label}
                            helper={option.helper}
                            selected={maxViewsValue === option.value}
                            onClick={() => setMaxViewsValue(option.value)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </AdvancedOptions>

                <div ref={generateResultRef}>
                  {generatedLink ? (
                    <ResultPanel
                      title="Link secreto pronto"
                      description="Copie o link e compartilhe quando quiser."
                      actions={
                        <button
                          type="button"
                          onClick={handleOpenGeneratedLink}
                          className="btn-accent"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Abrir link
                        </button>
                      }
                    >
                      <div className="surface-technical rounded-2xl p-3">
                        <p className="break-all font-mono text-xs leading-6 text-emerald-50">
                          {generatedLink}
                        </p>
                      </div>

                      <p className="mt-4 text-sm leading-7 text-zinc-300">
                        {selectedExpiration.label}. {selectedViewLimit.label}.
                      </p>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={handleCopyGeneratedLink}
                          className="btn-secondary"
                        >
                          <Copy className="h-4 w-4" />
                          Copiar link
                        </button>
                      </div>
                    </ResultPanel>
                  ) : (
                    <div className="surface-secondary rounded-[24px] p-5 text-sm leading-7 text-zinc-400">
                      O link vai aparecer aqui assim que estiver pronto.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="surface-primary rounded-[28px] p-5">
              <div className="flex items-start gap-3">
                <div className="icon-chip p-2">
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Abrir link secreto</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Se a página abriu com #msg=..., a mensagem será carregada automaticamente.
                  </p>
                </div>
              </div>

              <textarea
                value={readInput}
                onChange={(event) => setReadInput(event.target.value)}
                rows={4}
                placeholder="Cole aqui um link do Criptify ou o trecho que começa com #msg=..."
                className="tool-textarea mt-4 min-h-[140px]"
              />

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleLoadLink}
                  className="btn-accent"
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
                      message: 'Hash removido da URL. Agora você pode colar outro link manualmente.',
                    })
                  }}
                  className="btn-secondary"
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
                className="tool-input mt-4"
              />

              <button
                type="button"
                onClick={handleDecryptMessage}
                disabled={!resolvedEncodedPayload || !readPassword || isDecrypting}
                className="btn-primary mt-4 hidden w-full lg:inline-flex"
              >
                <Search className="h-5 w-5" />
                Abrir mensagem
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

            <div className="surface-secondary rounded-[28px] p-5">
              <p className="text-sm font-medium text-white">Status da mensagem</p>
              <p className="mt-2 text-sm leading-7 text-zinc-400">
                Validade e leituras são verificadas neste navegador.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="surface-secondary rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">Expiração</p>
                  <p className="mt-2 text-sm text-white">
                    {resolvedReadPayload ? getExpirationLabel(resolvedReadPayload.expiresIn) : '-'}
                  </p>
                </div>

                <div className="surface-secondary rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">Visualizações locais</p>
                  <p className="mt-2 text-sm text-white">{viewCount ?? 0}</p>
                </div>

                <div className="surface-secondary rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">Criada em</p>
                  <p className="mt-2 text-sm text-white">
                    {resolvedReadPayload ? formatCreatedAt(resolvedReadPayload.createdAt) : '-'}
                  </p>
                </div>

                <div className="surface-secondary rounded-2xl p-4">
                  <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">Limite de leituras</p>
                  <p className="mt-2 text-sm text-white">
                    {resolvedReadPayload
                      ? resolvedReadPayload.maxViews === null
                        ? 'Sem limite'
                        : `${resolvedReadPayload.maxViews} visualizações`
                      : '-'}
                  </p>
                </div>
              </div>

              <div className="mt-4 surface-technical rounded-2xl p-4">
                <p className="text-xs uppercase tracking-[0.26em] text-zinc-500">Mensagem revelada</p>
                <div className="surface-secondary mt-3 min-h-[140px] rounded-2xl px-4 py-3.5 text-sm leading-7 text-white sm:min-h-[220px]">
                  {revealedText || 'Nenhuma mensagem foi aberta ainda.'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <MobileStickyCTA
        label={tab === 'generate' ? 'Gerar link secreto' : 'Abrir mensagem'}
        icon={tab === 'generate' ? <Link2 className="h-5 w-5" /> : <Search className="h-5 w-5" />}
        onClick={tab === 'generate' ? handleGenerateLink : handleDecryptMessage}
        disabled={
          tab === 'generate'
            ? !plainText.trim() || !generatePassword || isGeneratingLink
            : !resolvedEncodedPayload || !readPassword || isDecrypting
        }
        loading={tab === 'generate' ? isGeneratingLink : isDecrypting}
      />
    </section>
  )
}













