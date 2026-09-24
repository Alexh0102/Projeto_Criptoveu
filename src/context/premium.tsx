/* eslint-disable react-refresh/only-export-components */
import {
  AlertCircle,
  CheckCircle2,
  Crown,
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldCheck,
  X,
} from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import {
  clearFreeUsageCounters,
  normalizeEmail,
  normalizeLicenseKey,
  validateLicenseEmail,
} from '../lib/premium'
import { buildApiUrl } from '../lib/platform'

type PremiumTier = 'premium' | 'admin'

type StoredPremiumLicense = {
  email: string
  licenseKey: string
  tier: PremiumTier
  verifiedAt: number
}

type PremiumModalOptions = {
  title?: string
  description?: string
  mode?: 'checkout' | 'activate'
}

type PremiumContextValue = {
  isPremium: boolean
  tier: PremiumTier | null
  licenseEmail: string
  isVerifyingLicense: boolean
  requestPremiumAccess: (options?: PremiumModalOptions) => void
  openLicenseActivation: () => void
  clearPremiumLicense: () => void
}

type VerifyLicenseResponse = {
  valid?: boolean
  tier?: PremiumTier
  error?: string
}

type CheckoutResponse = {
  url?: string
  error?: string
}

const LICENSE_STORAGE_KEY = 'criptoveu-premium-license-v1'
const DEFAULT_MODAL_TITLE = 'Apoie o CriptoVéu'
const DEFAULT_MODAL_DESCRIPTION =
  'Insira o e-mail onde você deseja receber a sua Chave de Ativação Vitalícia.'

const PremiumContext = createContext<PremiumContextValue | null>(null)

function safeReadStoredLicense(): StoredPremiumLicense | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.localStorage.getItem(LICENSE_STORAGE_KEY)

    if (!rawValue) {
      return null
    }

    const parsed = JSON.parse(rawValue) as StoredPremiumLicense

    if (
      !parsed?.licenseKey ||
      (parsed.tier !== 'premium' && parsed.tier !== 'admin')
    ) {
      return null
    }

    return {
      email: parsed.email ?? '',
      licenseKey: parsed.licenseKey,
      tier: parsed.tier,
      verifiedAt: parsed.verifiedAt ?? 0,
    }
  } catch {
    return null
  }
}

function safeWriteStoredLicense(license: StoredPremiumLicense) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(license))
  } catch {
    return
  }
}

function safeRemoveStoredLicense() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem(LICENSE_STORAGE_KEY)
  } catch {
    return
  }
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T
  } catch {
    return {} as T
  }
}

function getCheckoutErrorMessage(response: CheckoutResponse) {
  return response.error || 'Não foi possível iniciar o checkout agora. Tente novamente.'
}

function getVerifyErrorMessage(response: VerifyLicenseResponse) {
  return response.error || 'Chave não reconhecida. Confira o e-mail e a chave de ativação.'
}

export function PremiumProvider({ children }: { children: ReactNode }) {
  const [storedLicense, setStoredLicense] = useState<StoredPremiumLicense | null>(() =>
    safeReadStoredLicense(),
  )
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'checkout' | 'activate'>('checkout')
  const [modalTitle, setModalTitle] = useState(DEFAULT_MODAL_TITLE)
  const [modalDescription, setModalDescription] = useState(DEFAULT_MODAL_DESCRIPTION)
  const [checkoutEmail, setCheckoutEmail] = useState('')
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutMessage, setCheckoutMessage] = useState('')
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false)
  const [activationEmail, setActivationEmail] = useState('')
  const [activationKey, setActivationKey] = useState('')
  const [activationError, setActivationError] = useState('')
  const [activationMessage, setActivationMessage] = useState('')
  const [isActivatingLicense, setIsActivatingLicense] = useState(false)
  const [isVerifyingLicense, setIsVerifyingLicense] = useState(false)

  const saveActiveLicense = useCallback((license: StoredPremiumLicense) => {
    safeWriteStoredLicense(license)
    clearFreeUsageCounters()
    setStoredLicense(license)
  }, [])

  const clearPremiumLicense = useCallback(() => {
    safeRemoveStoredLicense()
    setStoredLicense(null)
    setActivationMessage('')
  }, [])

  const verifyStoredLicense = useCallback(
    async (license: StoredPremiumLicense) => {
      setIsVerifyingLicense(true)

      try {
        const response = await fetch(buildApiUrl('/api/verify-license'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: license.email,
            licenseKey: license.licenseKey,
          }),
        })
        const payload = await readJsonResponse<VerifyLicenseResponse>(response)

        if (!response.ok || !payload.valid || !payload.tier) {
          clearPremiumLicense()
          return
        }

        saveActiveLicense({
          email: license.email,
          licenseKey: license.licenseKey,
          tier: payload.tier,
          verifiedAt: Date.now(),
        })
      } catch {
        // Se a rede falhar, mantemos a experiência e tentamos novamente no próximo carregamento.
      } finally {
        setIsVerifyingLicense(false)
      }
    },
    [clearPremiumLicense, saveActiveLicense],
  )

  useEffect(() => {
    const license = safeReadStoredLicense()

    if (license) {
      void verifyStoredLicense(license)
    }
  }, [verifyStoredLicense])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const currentUrl = new URL(window.location.href)

    if (currentUrl.searchParams.get('success') !== 'true') {
      return
    }

    setIsModalOpen(true)
    setModalMode('activate')
    setModalTitle('Pagamento recebido')
    setModalDescription(
      'Quando o e-mail da chave chegar, cole a Chave de Ativação Vitalícia aqui para liberar o uso ilimitado neste navegador.',
    )
    setActivationMessage('Confira sua caixa de entrada. O envio pode levar alguns instantes.')
    currentUrl.searchParams.delete('success')
    window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`)
  }, [])

  const requestPremiumAccess = useCallback((options?: PremiumModalOptions) => {
    setModalTitle(options?.title ?? DEFAULT_MODAL_TITLE)
    setModalDescription(options?.description ?? DEFAULT_MODAL_DESCRIPTION)
    setModalMode(options?.mode ?? 'checkout')
    setCheckoutError('')
    setCheckoutMessage('')
    setActivationError('')
    setIsModalOpen(true)
  }, [])

  const openLicenseActivation = useCallback(() => {
    requestPremiumAccess({
      title: 'Ativar Chave de Apoiador',
      description: 'Cole a chave recebida por e-mail para remover os limites deste navegador.',
      mode: 'activate',
    })
  }, [requestPremiumAccess])

  async function handleCreateCheckout() {
    const validation = validateLicenseEmail(checkoutEmail)

    if (!validation.valid) {
      setCheckoutError(validation.message)
      return
    }

    setIsCreatingCheckout(true)
    setCheckoutError('')
    setCheckoutMessage('Preparando checkout seguro de apoio ao projeto...')

    try {
      const response = await fetch(buildApiUrl('/api/create-checkout-session'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: validation.normalizedEmail }),
      })
      const payload = await readJsonResponse<CheckoutResponse>(response)

      if (!response.ok || !payload.url) {
        setCheckoutError(getCheckoutErrorMessage(payload))
        setCheckoutMessage('')
        return
      }

      window.location.assign(payload.url)
    } catch {
      setCheckoutError('Não foi possível conectar ao checkout. Verifique sua conexão.')
      setCheckoutMessage('')
    } finally {
      setIsCreatingCheckout(false)
    }
  }

  async function handleActivateLicense() {
    const normalizedActivationEmail = normalizeEmail(activationEmail)
    const normalizedKey = normalizeLicenseKey(activationKey)

    if (!normalizedKey) {
      setActivationError('Cole sua Chave de Ativação Vitalícia antes de ativar.')
      return
    }

    setIsActivatingLicense(true)
    setActivationError('')
    setActivationMessage('Validando licença em ambiente seguro...')

    try {
      const response = await fetch(buildApiUrl('/api/verify-license'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: normalizedActivationEmail,
          licenseKey: normalizedKey,
        }),
      })
      const payload = await readJsonResponse<VerifyLicenseResponse>(response)

      if (!response.ok || !payload.valid || !payload.tier) {
        setActivationError(getVerifyErrorMessage(payload))
        setActivationMessage('')
        return
      }

      saveActiveLicense({
        email: normalizedActivationEmail,
        licenseKey: normalizedKey,
        tier: payload.tier,
        verifiedAt: Date.now(),
      })
      setActivationMessage(
        payload.tier === 'admin'
          ? 'Acesso Admin ativado. Todos os limites foram removidos.'
          : 'Chave de apoiador ativada. Todos os limites foram removidos.',
      )
      setActivationError('')
    } catch {
      setActivationError('Não foi possível validar a licença agora. Tente novamente.')
      setActivationMessage('')
    } finally {
      setIsActivatingLicense(false)
    }
  }

  const contextValue = useMemo<PremiumContextValue>(
    () => ({
      isPremium: Boolean(storedLicense),
      tier: storedLicense?.tier ?? null,
      licenseEmail: storedLicense?.email ?? '',
      isVerifyingLicense,
      requestPremiumAccess,
      openLicenseActivation,
      clearPremiumLicense,
    }),
    [
      clearPremiumLicense,
      isVerifyingLicense,
      openLicenseActivation,
      requestPremiumAccess,
      storedLicense,
    ],
  )

  return (
    <PremiumContext.Provider value={contextValue}>
      {children}

      {isModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Fechar modal de apoio"
            onClick={() => setIsModalOpen(false)}
          />

          <div className="panel-surface relative z-10 w-full max-w-2xl rounded-[32px] p-4 shadow-2xl shadow-black/40 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="hero-badge">
                  <Crown className="h-4 w-4" />
                  Apoio vitalício
                </div>
                <h2 className="mt-4 text-2xl font-semibold leading-tight text-white sm:text-3xl">
                  {modalTitle}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-300">{modalDescription}</p>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn-secondary h-10 w-10 shrink-0 rounded-full px-0 py-0"
                aria-label="Fechar modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setModalMode('checkout')}
                className={(modalMode === 'checkout' ? 'surface-primary' : 'surface-secondary') + ' rounded-[22px] px-4 py-3 text-left transition'}
              >
                <p className="text-sm font-semibold text-white">Apoiar o projeto</p>
                <p className="mt-1 text-xs leading-5 text-zinc-400">Doação única com e-mail travado na Stripe.</p>
              </button>
              <button
                type="button"
                onClick={() => setModalMode('activate')}
                className={(modalMode === 'activate' ? 'surface-primary' : 'surface-secondary') + ' rounded-[22px] px-4 py-3 text-left transition'}
              >
                <p className="text-sm font-semibold text-white">Ativar chave</p>
                <p className="mt-1 text-xs leading-5 text-zinc-400">Valide a chave recebida por e-mail.</p>
              </button>
            </div>

            {storedLicense ? (
              <div className="mt-5 rounded-[24px] border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-50">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      {storedLicense.tier === 'admin' ? 'Acesso Admin ativo' : 'Apoiador Vitalício ativo'}
                    </p>
                    <p className="mt-1 leading-6">Os limites comunitários estão desativados neste navegador.</p>
                    <button type="button" className="btn-secondary mt-3" onClick={clearPremiumLicense}>
                    Remover chave deste navegador
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {modalMode === 'checkout' ? (
              <div className="mt-5 surface-primary rounded-[26px] p-4 sm:p-5">
                <label className="text-sm font-medium text-white" htmlFor="premium-checkout-email">
                  Insira o e-mail onde você deseja receber a sua Chave de Ativação Vitalícia
                </label>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <div className="relative min-w-0 flex-1">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      id="premium-checkout-email"
                      type="email"
                      value={checkoutEmail}
                      onChange={(event) => setCheckoutEmail(event.target.value)}
                      placeholder="email@empresa.com"
                      className="tool-input pl-11"
                      autoComplete="email"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCreateCheckout()}
                    disabled={isCreatingCheckout}
                    className="btn-primary shrink-0"
                  >
                    {isCreatingCheckout ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
                    Apoiar com R$ 10
                  </button>
                </div>
                <p className="mt-3 text-xs leading-6 text-zinc-400">
                  Meios de pagamento aceitos: cartão de crédito, cartão de débito, Google Pay e boleto.
                </p>

                {checkoutError ? (
                  <div className="mt-4 rounded-[20px] border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-100">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>{checkoutError}</p>
                    </div>
                  </div>
                ) : null}

                {checkoutMessage ? (
                  <div className="mt-4 rounded-[20px] border border-cyan-500/25 bg-cyan-500/10 p-3 text-sm text-cyan-50">
                    {checkoutMessage}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-5 surface-primary rounded-[26px] p-4 sm:p-5">
                <div className="grid gap-3">
                  <label className="text-sm font-medium text-white" htmlFor="premium-activation-email">
                    E-mail do apoio
                  </label>
                  <input
                    id="premium-activation-email"
                    type="email"
                    value={activationEmail}
                    onChange={(event) => setActivationEmail(event.target.value)}
                    placeholder="email@empresa.com"
                    className="tool-input"
                    autoComplete="email"
                  />

                  <label className="text-sm font-medium text-white" htmlFor="premium-activation-key">
                    Chave de Ativação Vitalícia
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                    <input
                      id="premium-activation-key"
                      type="text"
                      value={activationKey}
                      onChange={(event) => setActivationKey(event.target.value)}
                      placeholder="CVEU-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                      className="tool-input pl-11 font-mono tracking-[0.08em]"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleActivateLicense()}
                    disabled={isActivatingLicense}
                    className="btn-primary w-full sm:w-auto"
                  >
                    {isActivatingLicense ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    Ativar chave
                  </button>
                </div>

                {activationError ? (
                  <div className="mt-4 rounded-[20px] border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-100">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>{activationError}</p>
                    </div>
                  </div>
                ) : null}

                {activationMessage ? (
                  <div className="mt-4 rounded-[20px] border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-50">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>{activationMessage}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </PremiumContext.Provider>
  )
}

export function usePremium() {
  const context = useContext(PremiumContext)

  if (!context) {
    throw new Error('usePremium must be used inside PremiumProvider')
  }

  return context
}
