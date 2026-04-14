import InfoPage from '../components/content/InfoPage'

export default function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="Privacidade"
      title="O que é processado localmente no CriptoVéu"
      description="O CriptoVéu foi pensado para tarefas sensíveis com processamento principal no navegador, mantendo o fluxo mais direto e com menos exposição desnecessária."
      sections={[
        {
          title: 'O que acontece localmente',
          items: [
            {
              title: 'Arquivos, mensagens e imagens durante o uso',
              description:
                'As ferramentas processam o conteúdo no navegador enquanto você usa a interface para gerar ou recuperar o resultado.',
            },
            {
              title: 'Mais controle em tarefas sensíveis',
              description:
                'Você reduz a necessidade de depender de fluxos externos só para concluir uma ação pontual.',
            },
          ],
        },
        {
          title: 'O que não deve ir para o servidor',
          items: [
            {
              title: 'Conteúdo principal',
              description:
                'Arquivos, mensagens, QR Codes e imagens são tratados localmente dentro do fluxo da ferramenta.',
            },
            {
              title: 'Senha e material protegido',
              description:
                'A proposta é manter senha e conteúdo sensível dentro do dispositivo durante o uso da ferramenta.',
            },
          ],
        },
        {
          title: 'Limites do uso',
          items: [
            {
              title: 'O dispositivo continua sendo importante',
              description:
                'Se o dispositivo ou o navegador estiver comprometido, o processamento local não elimina esse risco por si só.',
            },
            {
              title: 'O compartilhamento ainda exige cuidado',
              description:
                'Mesmo com proteção local, a forma como você envia links, arquivos e senhas continua sendo relevante.',
            },
          ],
        },
      ]}
    />
  )
}
