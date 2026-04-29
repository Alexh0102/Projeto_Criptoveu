import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

const TERMS_STORAGE_KEY = 'criptoveu_accepted_terms'

const TERMS_ITEMS = [
  'Privacidade Total: Seus arquivos e senhas nunca saem do seu navegador. Não possuímos servidores ou bancos de dados.',
  'Responsabilidade do Usuário: Você é o único responsável legal pelo conteúdo processado e pela guarda de sua senha.',
  'Sem Recuperação: Por ser um sistema Zero-Knowledge, a perda da senha resultará na perda irreversível dos dados.',
  'Conformidade Legal: Você se compromete a utilizar esta ferramenta apenas para fins lícitos.',
]

export default function TermsModal() {
  const location = useLocation()
  const [shouldShow, setShouldShow] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    try {
      return window.localStorage.getItem(TERMS_STORAGE_KEY) !== 'true'
    } catch {
      return true
    }
  })

  function acceptTerms() {
    try {
      window.localStorage.setItem(TERMS_STORAGE_KEY, 'true')
    } catch {
      // Se o navegador bloquear localStorage, o aceite ainda fecha o modal na sessão atual.
    }

    setShouldShow(false)
  }

  if (!shouldShow) {
    return null
  }

  if (location.pathname === '/termos' || location.pathname === '/termos-de-uso') {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-emerald-500/30 bg-[#121212] p-6 shadow-2xl shadow-emerald-900/20">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-200">
            <ShieldCheck className="h-6 w-6" />
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-200/80">
              CriptoVéu
            </p>
            <h2 id="terms-modal-title" className="mt-2 text-2xl font-bold text-white">
              Termos de Uso e Responsabilidade
            </h2>
          </div>
        </div>

        <p className="mt-5 text-sm leading-7 text-zinc-300">
          Ao utilizar o CriptoVéu, você declara estar ciente de que esta é uma ferramenta de processamento estritamente local.
        </p>

        <ul className="mt-5 space-y-3 text-sm leading-6 text-zinc-300">
          {TERMS_ITEMS.map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={acceptTerms}
          className="mt-6 w-full rounded-xl bg-emerald-600 py-3 font-bold text-white transition-all hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-[#121212]"
        >
          Li e aceito os termos
        </button>

        <Link
          to="/termos"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block text-center text-sm font-medium text-zinc-400 transition hover:text-emerald-200 hover:underline"
        >
          Ler mais sobre os termos
        </Link>
      </div>
    </div>
  )
}
