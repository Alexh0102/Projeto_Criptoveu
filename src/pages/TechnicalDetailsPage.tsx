import InfoPage from '../components/content/InfoPage'

export default function TechnicalDetailsPage() {
  return (
    <InfoPage
      eyebrow="Detalhes técnicos"
      title="Visão geral das rotas, do fluxo e das decisões de interface"
      description="A estrutura do CriptoVéu foi desenhada para separar tarefas por rota, reduzir ruído e manter o uso claro no desktop e no mobile."
      sections={[
        {
          title: 'Rotas e organização da experiência',
          items: [
            {
              title: 'Uma rota por ferramenta',
              description:
                'Cada ferramenta abre em uma tela própria para evitar mistura de fluxo e reduzir distrações desnecessárias.',
            },
            {
              title: 'Home como ponto de entrada',
              description:
                'A home funciona como hub de navegação, com contexto, casos de uso e acesso rápido às ferramentas.',
            },
          ],
        },
        {
          title: 'Decisões da interface',
          items: [
            {
              title: 'Ação principal mais visível',
              description:
                'As telas priorizam um CTA principal, campos essenciais e um resultado claro logo após o processamento.',
            },
            {
              title: 'Componentes reutilizáveis',
              description:
                'Layouts, accordions, painéis de resultado e blocos de campo ajudam a manter consistência entre as páginas.',
            },
          ],
        },
      ]}
    />
  )
}