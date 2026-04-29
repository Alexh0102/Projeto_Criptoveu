import ToolPageLayout from '../components/layout/ToolPageLayout'
import ToolHeroCompact from '../components/ui/ToolHeroCompact'

const sections = [
  {
    title: '1. Natureza da ferramenta',
    paragraphs: [
      'O CriptoVéu é uma ferramenta de criptografia, descriptografia e processamento de arquivos executada no próprio navegador do usuário.',
      'O projeto adota uma abordagem Zero-Knowledge: o conteúdo processado, as senhas, chaves e arquivos selecionados não são enviados para servidores do CriptoVéu.',
    ],
  },
  {
    title: '2. Privacidade e processamento local',
    paragraphs: [
      'Arquivos, mensagens, QR Codes e imagens são processados localmente no dispositivo utilizado para acessar a aplicação.',
      'O CriptoVéu não possui banco de dados para armazenar arquivos do usuário, senhas ou conteúdo descriptografado.',
      'Ainda assim, a segurança final depende do dispositivo, navegador, extensões instaladas e ambiente de rede usados pelo próprio usuário.',
    ],
  },
  {
    title: '3. Responsabilidade do usuário',
    paragraphs: [
      'O usuário é o único responsável pelo conteúdo processado, pela finalidade de uso da ferramenta e pela guarda segura de suas senhas e chaves.',
      'O usuário se compromete a não utilizar o CriptoVéu para fins ilegais, abusivos, fraudulentos ou que violem direitos de terceiros.',
    ],
  },
  {
    title: '4. Senhas, chaves e impossibilidade de recuperação',
    paragraphs: [
      'Por não armazenar senhas nem manter cópias das chaves criptográficas, o CriptoVéu não consegue recuperar arquivos ou mensagens caso a senha seja perdida.',
      'A perda da senha ou chave poderá resultar na perda irreversível do acesso ao conteúdo protegido.',
    ],
  },
  {
    title: '5. Limitações e disponibilidade',
    paragraphs: [
      'O CriptoVéu é fornecido como ferramenta client-side e pode depender de APIs do navegador, como Web Crypto API, Streams API, Canvas e recursos de armazenamento local.',
      'Falhas do navegador, limitações de memória, arquivos corrompidos, senhas incorretas ou dispositivos comprometidos podem impedir o funcionamento esperado.',
    ],
  },
  {
    title: '6. Política de privacidade',
    paragraphs: [
      'O CriptoVéu não coleta o conteúdo dos arquivos, mensagens ou senhas processados nas ferramentas principais.',
      'O aceite dos termos pode ser salvo no localStorage do navegador apenas para evitar que o aviso seja exibido novamente no mesmo dispositivo e perfil de navegador.',
      'Limpar os dados do navegador ou usar outro dispositivo poderá fazer com que o aviso de termos seja exibido novamente.',
    ],
  },
  {
    title: '7. Alterações nos termos',
    paragraphs: [
      'Estes termos podem ser atualizados para refletir mudanças no produto, melhorias de segurança ou ajustes legais.',
      'Quando houver alteração relevante, o CriptoVéu poderá solicitar novo aceite ao usuário.',
    ],
  },
]

export default function TermsPage() {
  return (
    <ToolPageLayout>
      <div className="space-y-6">
        <ToolHeroCompact
          eyebrow="Termos"
          title="TERMOS DE USO E POLÍTICA DE PRIVACIDADE - CRIPTOVÉU"
          description="Leia as condições completas de uso, responsabilidade e privacidade aplicáveis às ferramentas locais do CriptoVéu."
        />

        <section className="surface-secondary rounded-[32px] p-5 sm:p-6">
          <p className="max-w-3xl text-sm leading-7 text-zinc-400 sm:text-base">
            Ao utilizar o CriptoVéu, você declara estar ciente de que esta é uma ferramenta de processamento estritamente local, voltada para tarefas de privacidade e criptografia executadas no navegador.
          </p>
        </section>

        {sections.map((section) => (
          <section key={section.title} className="surface-secondary rounded-[32px] p-5 sm:p-6">
            <h2 className="text-xl font-semibold text-white sm:text-2xl">{section.title}</h2>
            <div className="mt-4 space-y-3">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="max-w-4xl text-sm leading-7 text-zinc-400 sm:text-base">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </ToolPageLayout>
  )
}
