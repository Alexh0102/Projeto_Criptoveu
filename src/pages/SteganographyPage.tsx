import SteganographyPanel from '../components/SteganographyPanel'
import ToolPageLayout from '../components/layout/ToolPageLayout'
import HelpAccordion from '../components/ui/HelpAccordion'
import ToolHeroCompact from '../components/ui/ToolHeroCompact'

export default function SteganographyPage() {
  return (
    <ToolPageLayout>
      <div className="space-y-6">
        <ToolHeroCompact
          eyebrow="Mensagem oculta em imagem"
          title="Esconda uma mensagem protegida dentro de uma imagem."
          description="Crie uma imagem com mensagem protegida ou revele uma imagem recebida em uma tela mais simples."
        />

        <SteganographyPanel compact />

        <HelpAccordion
          items={[
            {
              title: 'Como funciona',
              content:
                'Escreva a mensagem, defina a senha e gere a nova imagem. Para revelar, envie a imagem e use a mesma senha.',
            },
            {
              title: 'Privacidade',
              content:
                'A imagem é processada localmente. Nada é enviado para o servidor.',
            },
          ]}
        />
      </div>
    </ToolPageLayout>
  )
}