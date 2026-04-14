import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileArchive,
  ImageUp,
  Link2,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import ToolPageLayout from '../components/layout/ToolPageLayout'
import BrandLogo from '../components/ui/BrandLogo'
import HelpAccordion from '../components/ui/HelpAccordion'
import { toolDefinitions } from '../config/tools'

const iconByPath = {
  '/arquivos': FileArchive,
  '/qr-secreto': QrCode,
  '/link-secreto': Link2,
  '/esteganografia': ImageUp,
} as const

const trustItems = [
  {
    title: '100% local',
    description: 'Seu conteúdo é processado no navegador durante o uso.',
  },
  {
    title: 'Sem fluxo confuso',
    description: 'Cada ferramenta abre em uma tela própria, com foco direto na tarefa.',
  },
  {
    title: 'Pronto para usar',
    description: 'Escolha a ferramenta, preencha os campos e gere o resultado na hora.',
  },
]

const useCases = [
  {
    title: 'Enviar um arquivo protegido por senha',
    description: 'Proteja documentos antes de compartilhar.',
  },
  {
    title: 'Criar um QR com mensagem protegida',
    description: 'Gere um QR e abra depois com a mesma senha.',
  },
  {
    title: 'Compartilhar um link temporário',
    description: 'Crie uma mensagem protegida para abrir no momento certo.',
  },
  {
    title: 'Ocultar uma mensagem em imagem',
    description: 'Esconda conteúdo sensível dentro de uma imagem.',
  },
  {
    title: 'Organizar tarefas sensíveis com mais cuidado',
    description: 'Separe tarefas para reduzir erro e exposição.',
  },
]

const localBenefits = [
  {
    title: 'Mais controle',
    description:
      'Arquivos, mensagens e imagens permanecem no seu dispositivo durante o uso da ferramenta.',
  },
  {
    title: 'Menos exposição',
    description: 'Você reduz a dependência de fluxos inseguros para tarefas sensíveis.',
  },
  {
    title: 'Mais simplicidade',
    description: 'Cada ferramenta resolve uma tarefa específica sem excesso de etapas visíveis.',
  },
]

const audienceItems = [
  {
    title: 'Profissionais autônomos',
    description: 'Para quem precisa proteger arquivos, mensagens ou imagens no dia a dia.',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Pequenos escritórios',
    description: 'Para equipes que lidam com conteúdo sensível e querem mais controle no envio.',
    icon: Users,
  },
  {
    title: 'Operações administrativas',
    description: 'Para tarefas que envolvem documentos, instruções ou dados reservados.',
    icon: LockKeyhole,
  },
  {
    title: 'Pessoas que priorizam privacidade',
    description: 'Para quem quer resolver tarefas sensíveis diretamente no navegador.',
    icon: ShieldCheck,
  },
]

const faqItems = [
  {
    title: 'Preciso criar conta para usar?',
    content: 'Não. O uso das ferramentas pode começar diretamente pelo navegador.',
  },
  {
    title: 'Meu conteúdo é enviado para um servidor?',
    content:
      'O processamento principal acontece localmente no navegador durante o uso da ferramenta.',
  },
  {
    title: 'Funciona no celular?',
    content: 'Sim. As telas foram organizadas para uso mobile com foco em fluxo direto.',
  },
  {
    title: 'Posso usar para arquivos, mensagens e imagens?',
    content: 'Sim. Cada ferramenta foi criada para uma tarefa específica.',
  },
  {
    title: 'Qual ferramenta devo usar primeiro?',
    content:
      'Se você quer proteger um documento, comece por arquivos. Para mensagens curtas, use QR protegido ou link protegido.',
  },
  {
    title: 'Esteganografia é a mesma coisa que criptografia?',
    content:
      'Não. Na esteganografia, a mensagem protegida é escondida dentro de uma imagem. Na criptografia, o conteúdo é protegido diretamente.',
  },
]

const transparencyLinks = [
  {
    to: '/privacidade',
    title: 'Privacidade',
    description: 'O que é processado localmente e quais são os limites do uso.',
    featured: true,
    badge: 'Destaque',
  },
  {
    to: '/seguranca',
    title: 'Segurança',
    description: 'Boas práticas, cuidados com senha e uso responsável.',
  },
  {
    to: '/detalhes-tecnicos',
    title: 'Detalhes técnicos',
    description: 'Visão geral das rotas, do fluxo e das decisões da interface.',
  },
  {
    to: '/sobre',
    title: 'Sobre o projeto',
    description: 'Objetivo do CriptoVéu, contexto do produto e direção da plataforma.',
  },
]

export default function HomePage() {
  return (
    <ToolPageLayout>
      <section className="space-y-5 sm:space-y-6">
        <section className="surface-primary rounded-[38px] p-5 sm:p-7">
          <div className="mb-5">
            <BrandLogo variant="hero" />
          </div>

          <div className="hero-badge">
            <ShieldCheck className="h-4 w-4" />
            Ferramentas locais
          </div>

          <div className="mt-4 space-y-3.5">
            <p className="text-xs uppercase tracking-[0.38em] text-zinc-500">Privacidade prática</p>
            <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-white sm:text-5xl sm:leading-[1.02]">
              Proteja arquivos, mensagens e imagens sem sair do navegador.
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">
              Use ferramentas locais para criptografar, compartilhar e ocultar conteúdo sensível com
              mais controle e menos exposição.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/arquivos" className="btn-primary">
              Começar por arquivos
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#ferramentas" className="btn-secondary">
              Ver ferramentas
            </a>
          </div>

          <p className="mt-3.5 text-sm text-zinc-400">Tudo processado localmente no seu dispositivo.</p>
        </section>

        <section className="surface-secondary rounded-[32px] p-4 sm:p-5">
          <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Feito para tarefas sensíveis</p>
          <h2 className="mt-2 text-xl font-semibold text-white sm:text-[1.9rem]">
            Clareza, foco e processamento local na mesma experiência.
          </h2>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {trustItems.map((item) => (
              <div key={item.title} className="surface-technical rounded-[22px] p-4">
                <p className="text-sm font-semibold text-white sm:text-base">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-secondary rounded-[32px] p-4 sm:p-5">
          <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Casos de uso</p>
          <h2 className="mt-2 text-xl font-semibold text-white sm:text-[1.9rem]">Onde o CriptoVéu ajuda</h2>
          <p className="mt-2.5 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
            Proteja conteúdo sensível antes de enviar, compartilhar ou armazenar.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {useCases.map((item) => (
              <div key={item.title} className="surface-technical rounded-[20px] p-4">
                <p className="text-sm font-semibold text-white sm:text-[15px]">{item.title}</p>
                <p className="mt-1.5 text-sm leading-6 text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="ferramentas" className="scroll-mt-36 space-y-3.5 sm:scroll-mt-32">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Ferramentas</p>
            <h2 className="mt-2 text-2xl font-semibold text-white sm:text-[2rem]">
              Escolha a tarefa e entre direto na ferramenta certa.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {toolDefinitions.map((tool) => {
              const Icon = iconByPath[tool.path]
              const cardTitle = tool.cardTitle ?? tool.title
              const isSteganographyCard = tool.path === '/esteganografia'

              return (
                <Link
                  key={tool.path}
                  to={tool.path}
                  className="surface-primary group rounded-[30px] p-4 transition duration-200 hover:-translate-y-1 sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="icon-chip transition group-hover:scale-105">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                      {tool.eyebrow}
                    </span>
                  </div>

                  <h3 className={`mt-4 font-semibold leading-tight text-white ${isSteganographyCard ? 'text-[1.18rem]' : 'text-[1.28rem]'}`}>
                    {cardTitle}
                  </h3>
                  <p className="mt-2.5 text-sm leading-6 text-zinc-400">{tool.description}</p>
                  {tool.technicalLabel ? (
                    <p className="mt-2.5 text-[10px] uppercase tracking-[0.32em] text-zinc-500/80">
                      {tool.technicalLabel}
                    </p>
                  ) : null}
                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-cyan-100">
                    Abrir ferramenta
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        <section className="surface-secondary rounded-[32px] p-4 sm:p-5">
          <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Processamento local</p>
          <h2 className="mt-2 text-xl font-semibold text-white sm:text-[1.9rem]">
            Por que usar processamento local
          </h2>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {localBenefits.map((item) => (
              <div key={item.title} className="surface-technical rounded-[22px] p-4">
                <p className="text-sm font-semibold text-white sm:text-base">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-secondary rounded-[32px] p-4 sm:p-5">
          <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Perfil de uso</p>
          <h2 className="mt-2 text-xl font-semibold text-white sm:text-[1.9rem]">
            Para quem o CriptoVéu foi feito
          </h2>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {audienceItems.map((item) => {
              const Icon = item.icon

              return (
                <div key={item.title} className="surface-technical rounded-[22px] p-4">
                  <div className="icon-chip">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-3.5 text-sm font-semibold text-white sm:text-base">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{item.description}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="surface-secondary rounded-[32px] p-4 sm:p-5">
          <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Perguntas frequentes</p>
          <h2 className="mt-2 text-xl font-semibold text-white sm:text-[1.9rem]">Perguntas frequentes</h2>
          <div className="mt-4">
            <HelpAccordion items={faqItems} defaultOpenIndex={0} />
          </div>
        </section>

        <section className="surface-secondary rounded-[32px] p-4 sm:p-5">
          <p className="text-xs uppercase tracking-[0.32em] text-zinc-500">Transparência</p>
          <h2 className="mt-2 text-xl font-semibold text-white sm:text-[1.9rem]">Transparência e segurança</h2>
          <p className="mt-2.5 max-w-3xl text-sm leading-6 text-zinc-400 sm:text-base">
            O CriptoVéu foi pensado para tarefas sensíveis com processamento local no navegador. Para
            entender melhor como cada ferramenta funciona, consulte as páginas de privacidade,
            segurança e detalhes técnicos.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {transparencyLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`${item.featured ? 'surface-primary border-cyan-500/25 shadow-[0_18px_42px_rgba(34,211,238,0.08)]' : 'surface-technical'} rounded-[22px] p-4 transition hover:-translate-y-0.5`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 text-cyan-100">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-semibold text-white">{item.title}</span>
                  </div>
                  {item.featured ? (
                    <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-cyan-100">
                      {item.badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-400">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </ToolPageLayout>
  )
}
