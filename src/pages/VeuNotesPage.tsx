import VeuNotesVault from '../components/VeuNotesVault'
import ToolPageLayout from '../components/layout/ToolPageLayout'
import HelpAccordion from '../components/ui/HelpAccordion'
import ToolHeroCompact from '../components/ui/ToolHeroCompact'

export default function VeuNotesPage() {
  return (
    <ToolPageLayout>
      <div className="space-y-6">
        <ToolHeroCompact
          eyebrow="VéuNotes"
          title="Guarde uma nota protegida por senha mestre, só neste navegador."
          description="Crie um cofre local de texto com AES-256-GCM, backup criptografado e bloqueio automático sem depender de servidor."
          badge="100% client-side"
        />

        <VeuNotesVault />

        <HelpAccordion
          items={[
            {
              title: 'Como funciona',
              content:
                'No primeiro uso, você cria uma senha mestre. Depois disso, a nota é descriptografada apenas em memória quando o cofre é destrancado.',
            },
            {
              title: 'O que fica salvo no navegador',
              content:
                'Apenas um JSON criptografado com version, salt, iterations, iv e ciphertext. Texto puro, senha e chave não são persistidos.',
            },
            {
              title: 'Backup e recuperação',
              content:
                'Você pode exportar um arquivo JSON criptografado e importar depois no mesmo ou em outro dispositivo, desde que use a mesma senha mestre.',
            },
            {
              title: 'Se eu esquecer a senha',
              content:
                'Não há recuperação. Por isso, use uma senha forte e guarde um backup do cofre em local seguro.',
            },
          ]}
        />
      </div>
    </ToolPageLayout>
  )
}
