import { ArrowRight, FileArchive, ImageUp, Link2, QrCode, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'

import ToolPageLayout from '../components/layout/ToolPageLayout'
import { toolDefinitions } from '../config/tools'

const iconByPath = {
  '/arquivos': FileArchive,
  '/qr-secreto': QrCode,
  '/link-secreto': Link2,
  '/esteganografia': ImageUp,
} as const

export default function HomePage() {
  return (
    <ToolPageLayout>
      <section className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="surface-primary rounded-[36px] p-6 sm:p-7">
            <div className="hero-badge">
              <ShieldCheck className="h-4 w-4" />
              Ferramentas locais
            </div>

            <div className="mt-5 space-y-4">
              <p className="text-xs uppercase tracking-[0.38em] text-zinc-500">
                Privacidade local
              </p>
              <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-5xl sm:leading-[1.02]">
                Escolha uma ferramenta e resolva tudo em uma tela dedicada.
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">
                Cada recurso tem sua própria rota. Assim fica mais fácil encontrar o que você precisa,
                concluir a tarefa sem distrações e entender o fluxo de primeira.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/arquivos" className="btn-primary">
                Começar por arquivos
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/qr-secreto" className="btn-secondary">
                Abrir QR secreto
              </Link>
            </div>
          </div>

          <aside className="surface-secondary rounded-[36px] p-6 sm:p-7">
            <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">O que muda aqui</p>
            <div className="mt-4 grid gap-3">
              <div className="surface-technical rounded-[24px] p-4">
                <p className="text-sm font-medium text-white">Fluxo direto</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Menos etapas visíveis e mais foco no que você quer gerar ou abrir.
                </p>
              </div>
              <div className="surface-technical rounded-[24px] p-4">
                <p className="text-sm font-medium text-white">Tudo no navegador</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Arquivos, imagens e mensagens continuam no seu dispositivo durante o uso.
                </p>
              </div>
              <div className="surface-technical rounded-[24px] p-4">
                <p className="text-sm font-medium text-white">Ferramentas separadas</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Cada tela foi organizada para reduzir ruído e facilitar a navegação no celular.
                </p>
              </div>
            </div>
          </aside>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {toolDefinitions.map((tool) => {
            const Icon = iconByPath[tool.path]

            return (
              <Link
                key={tool.path}
                to={tool.path}
                className="surface-primary group rounded-[32px] p-5 transition duration-200 hover:-translate-y-1"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="icon-chip transition group-hover:scale-105">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="text-xs uppercase tracking-[0.3em] text-zinc-500">{tool.eyebrow}</span>
                </div>

                <h2 className="mt-5 text-[1.6rem] font-semibold leading-tight text-white">{tool.title}</h2>
                <p className="mt-3 text-sm leading-7 text-zinc-400">{tool.description}</p>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-cyan-100">
                  Abrir ferramenta
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </ToolPageLayout>
  )
}
