import HelpAccordion from '../components/ui/HelpAccordion'
import ToolHeroCompact from '../components/ui/ToolHeroCompact'
import ToolPageLayout from '../components/layout/ToolPageLayout'
import QRCodeGenerator from '../components/QRCodeGenerator'

export default function QrSecretPage() {
  return (
    <ToolPageLayout>
      <div className="space-y-6">
        <ToolHeroCompact
          eyebrow="QR secreto"
          title="Crie um QR com mensagem protegida por senha."
          description="Escreva a mensagem, defina a senha e gere o QR em uma tela simples e direta."
        />

        <QRCodeGenerator compact />

        <HelpAccordion
          items={[
            {
              title: 'Como funciona',
              content:
                'Escreva a mensagem, defina a senha e gere o QR. Para ler, envie a imagem e use a mesma senha.',
            },
            {
              title: 'Privacidade',
              content:
                'Tudo acontece no navegador. Nenhum texto ou imagem sai do seu dispositivo.',
            },
          ]}
        />
      </div>
    </ToolPageLayout>
  )
}
