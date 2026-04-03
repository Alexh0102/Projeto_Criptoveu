import InfoPage from '../components/content/InfoPage'

export default function AboutPage() {
  return (
    <InfoPage
      eyebrow="Sobre o projeto"
      title="O CriptoVéu reúne ferramentas locais para tarefas sensíveis"
      description="O projeto foi pensado para proteger arquivos, mensagens, links e imagens com uma interface direta, foco em clareza e processamento local no navegador."
      sections={[
        {
          title: 'Objetivo do CriptoVéu',
          items: [
            {
              title: 'Resolver tarefas sensíveis com menos atrito',
              description:
                'A proposta é oferecer fluxos diretos para proteger e recuperar conteúdo sem depender de uma interface carregada demais.',
            },
            {
              title: 'Manter a experiência prática',
              description:
                'Cada ferramenta foi organizada para abrir, preencher e gerar resultado com menos etapas visíveis.',
            },
          ],
        },
        {
          title: 'Direção da plataforma',
          items: [
            {
              title: 'Privacidade local como base',
              description:
                'O processamento local é parte central do posicionamento e da utilidade do produto.',
            },
            {
              title: 'Produto com foco em clareza',
              description:
                'A direção visual e textual busca parecer ferramenta real de uso diário, não experimento técnico.',
            },
          ],
        },
      ]}
    />
  )
}