export type ToolDefinition = {
  path: '/arquivos' | '/qr-secreto' | '/link-secreto' | '/esteganografia'
  title: string
  shortTitle: string
  description: string
  helper: string
  eyebrow: string
  technicalLabel?: string
  cardTitle?: string
}

export const toolDefinitions: ToolDefinition[] = [
  {
    path: '/arquivos',
    title: 'Criptografia de arquivos',
    shortTitle: 'Arquivos',
    description: 'Proteja ou recupere arquivos com senha diretamente no navegador.',
    helper: 'Escolha os arquivos, defina a senha e gere o resultado na hora.',
    eyebrow: 'Proteção local',
  },
  {
    path: '/qr-secreto',
    title: 'QR protegido',
    shortTitle: 'QR protegido',
    description: 'Crie ou leia um QR com mensagem protegida por senha.',
    helper: 'Escreva a mensagem, defina a senha e gere o QR em uma tela própria.',
    eyebrow: 'Mensagem protegida',
  },
  {
    path: '/link-secreto',
    title: 'Link protegido',
    shortTitle: 'Link protegido',
    description: 'Gere um link com mensagem protegida para abrir depois.',
    helper: 'Compartilhe uma mensagem protegida com validade e limite de leituras.',
    eyebrow: 'Link temporário',
  },
  {
    path: '/esteganografia',
    title: 'Mensagem oculta em imagem',
    shortTitle: 'Mensagem em imagem',
    cardTitle: 'Mensagem oculta',
    description: 'Esconda uma mensagem protegida dentro de uma imagem.',
    helper: 'Envie a imagem, defina a senha e gere o novo arquivo.',
    eyebrow: 'Imagem com segredo',
    technicalLabel: 'Esteganografia',
  },
]