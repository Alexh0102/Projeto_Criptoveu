import InfoPage from '../components/content/InfoPage'

export default function SecurityPage() {
  return (
    <InfoPage
      eyebrow="Segurança"
      title="Boas práticas para usar o CriptoVéu com mais segurança"
      description="As ferramentas ajudam a reduzir exposição, mas o resultado depende também da forma como você define a senha, compartilha o conteúdo e organiza o uso."
      sections={[
        {
          title: 'Boas práticas essenciais',
          items: [
            {
              title: 'Use uma senha forte e específica',
              description:
                'Prefira senhas longas, únicas e difíceis de adivinhar para cada conteúdo protegido.',
            },
            {
              title: 'Separe o canal da senha',
              description:
                'Quando possível, envie a senha por um canal diferente daquele usado para compartilhar o arquivo, o link ou a imagem.',
            },
          ],
        },
        {
          title: 'Cuidados de uso',
          items: [
            {
              title: 'Revise antes de compartilhar',
              description:
                'Confirme o arquivo, o destino e o contexto antes de enviar qualquer conteúdo sensível.',
            },
            {
              title: 'Use dispositivos confiáveis',
              description:
                'Dê preferência a navegadores atualizados e a dispositivos sob seu controle direto.',
            },
          ],
        },
      ]}
    />
  )
}
