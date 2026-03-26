import FileCryptoWorkspace from '../components/file-crypto/FileCryptoWorkspace'
import ToolPageLayout from '../components/layout/ToolPageLayout'
import HelpAccordion from '../components/ui/HelpAccordion'
import ToolHeroCompact from '../components/ui/ToolHeroCompact'

export default function FilesPage() {
  return (
    <ToolPageLayout>
      <div className="space-y-6">
        <ToolHeroCompact
          eyebrow="Criptografia de arquivos"
          title="Proteja ou recupere arquivos sem sair do navegador."
          description="Escolha os arquivos, defina a senha e gere o resultado na hora, em uma tela feita só para isso."
        />

        <FileCryptoWorkspace />

        <HelpAccordion
          items={[
            {
              title: 'Como funciona',
              content:
                'Você escolhe os arquivos, define a senha e o processamento acontece no navegador.',
            },
            {
              title: 'Privacidade',
              content:
                'Seus arquivos não saem do dispositivo. O resultado é gerado localmente para download.',
            },
          ]}
        />
      </div>
    </ToolPageLayout>
  )
}
