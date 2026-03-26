export type ToolDefinition = {
  path: '/arquivos' | '/qr-secreto' | '/link-secreto' | '/esteganografia'
  title: string
  shortTitle: string
  description: string
  helper: string
  eyebrow: string
}

export const toolDefinitions: ToolDefinition[] = [
  {
    path: '/arquivos',
    title: 'Criptografia de arquivos',
    shortTitle: 'Arquivos',
    description: 'Proteja ou recupere arquivos sem sair do navegador.',
    helper: 'Envie seus arquivos, escolha a senha e baixe o resultado.',
    eyebrow: 'Proteção local',
  },
  {
    path: '/qr-secreto',
    title: 'QR secreto',
    shortTitle: 'QR secreto',
    description: 'Crie ou leia um QR com mensagem protegida por senha.',
    helper: 'Escreva a mensagem, defina a senha e gere o QR.',
    eyebrow: 'Mensagem em QR',
  },
  {
    path: '/link-secreto',
    title: 'Link secreto',
    shortTitle: 'Link secreto',
    description: 'Crie um link com mensagem protegida para abrir depois.',
    helper: 'Compartilhe uma mensagem protegida por senha na URL.',
    eyebrow: 'Link temporário',
  },
  {
    path: '/esteganografia',
    title: 'Esteganografia',
    shortTitle: 'Esteganografia',
    description: 'Esconda uma mensagem protegida dentro de uma imagem.',
    helper: 'Envie a imagem, defina a senha e gere o novo arquivo.',
    eyebrow: 'Imagem com segredo',
  },
]
