export type PreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'none'

export type PreviewMetadata = {
  kind: PreviewKind
  label: string
}

export function getUniversalPreviewMetadata(mimeType: string): PreviewMetadata {
  if (mimeType.startsWith('image/')) {
    return { kind: 'image', label: 'Imagem' }
  }

  if (mimeType.startsWith('video/')) {
    return { kind: 'video', label: 'Vídeo' }
  }

  if (mimeType.startsWith('audio/')) {
    return { kind: 'audio', label: 'Áudio' }
  }

  if (mimeType === 'application/pdf') {
    return { kind: 'pdf', label: 'PDF' }
  }

  if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
    return { kind: 'text', label: 'Texto' }
  }

  return { kind: 'none', label: 'Arquivo' }
}
