import {
  Download,
  FileText,
  Image as ImageIcon,
  Maximize2,
  Pause,
  ShieldOff,
  Video,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { getUniversalPreviewMetadata } from './preview-metadata'

type UniversalPreviewProps = {
  url: string
  blob: Blob
  fileName: string
  expanded?: boolean
  isInactive?: boolean
  onOpen?: () => void
  onClose?: () => void
  onDownload?: () => void
}

export default function UniversalPreview({
  url,
  blob,
  fileName,
  expanded = false,
  isInactive = false,
  onOpen,
  onClose,
  onDownload,
}: UniversalPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [textContent, setTextContent] = useState('')
  const metadata = getUniversalPreviewMetadata(blob.type)
  const canExpand = !expanded && metadata.kind !== 'none'

  useEffect(() => {
    if (metadata.kind !== 'text') {
      return
    }

    let isMounted = true

    blob.text().then((content) => {
      if (isMounted) {
        setTextContent(content)
      }
    })

    return () => {
      isMounted = false
    }
  }, [blob, metadata.kind])

  useEffect(() => {
    if (!isInactive) {
      return
    }

    const mediaElements = containerRef.current?.querySelectorAll('video, audio') ?? []

    for (const mediaElement of mediaElements) {
      if (!(mediaElement instanceof HTMLMediaElement)) {
        continue
      }

      mediaElement.pause()
    }
  }, [isInactive])

  function renderPreview() {
    if (metadata.kind === 'image') {
      return (
        <img
          src={url}
          alt={`Prévia de ${fileName}`}
          className={`w-full rounded-2xl object-contain ${
            expanded ? 'max-h-[76vh]' : 'max-h-[420px]'
          }`}
        />
      )
    }

    if (metadata.kind === 'video') {
      return (
        <video
          src={url}
          controls
          playsInline
          className={`w-full rounded-2xl bg-black ${
            expanded ? 'max-h-[76vh]' : 'max-h-[420px]'
          }`}
          aria-label={`Prévia em vídeo de ${fileName}`}
        >
          <track kind="captions" label="Sem legendas embutidas" />
        </video>
      )
    }

    if (metadata.kind === 'audio') {
      return (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <audio
            src={url}
            controls
            className="w-full"
            aria-label={`Prévia em áudio de ${fileName}`}
          />
        </div>
      )
    }

    if (metadata.kind === 'pdf') {
      return (
        <iframe
          src={url}
          title={`Prévia PDF de ${fileName}`}
          sandbox=""
          className={`w-full rounded-2xl border border-white/10 bg-white ${
            expanded ? 'h-[76vh]' : 'h-[420px]'
          }`}
        />
      )
    }

    if (metadata.kind === 'text') {
      return (
        <pre
          className={`overflow-auto rounded-2xl border border-white/10 bg-black/50 p-4 text-left text-sm leading-7 text-zinc-100 ${
            expanded ? 'max-h-[76vh]' : 'max-h-[420px]'
          }`}
        >
          {textContent}
        </pre>
      )
    }

    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm leading-7 text-zinc-400">
        Este formato não tem pré-visualização segura no navegador. Baixe o arquivo para abrir no aplicativo adequado.
      </div>
    )
  }

  const PreviewIcon =
    metadata.kind === 'image'
      ? ImageIcon
      : metadata.kind === 'video' || metadata.kind === 'audio'
        ? Video
        : metadata.kind === 'text' || metadata.kind === 'pdf'
          ? FileText
          : ShieldOff

  return (
    <div ref={containerRef} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="icon-chip p-2">
            <PreviewIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-100/80">
              Prévia segura - {metadata.label}
            </p>
            <p className="mt-2 truncate text-sm font-semibold text-white">{fileName}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {canExpand ? (
            <button type="button" onClick={onOpen} className="btn-secondary">
              <Maximize2 className="h-4 w-4" />
              Ampliar
            </button>
          ) : null}

          {onDownload ? (
            <button type="button" onClick={onDownload} className="btn-secondary">
              <Download className="h-4 w-4" />
              Baixar
            </button>
          ) : null}

          {onClose ? (
            <button type="button" onClick={onClose} className="btn-secondary">
              <X className="h-4 w-4" />
              Fechar
            </button>
          ) : null}
        </div>
      </div>

      {isInactive ? (
        <div className="flex items-center gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-sm text-cyan-50">
          <Pause className="h-4 w-4" />
          Prévia ocultada por inatividade.
        </div>
      ) : null}

      <div
        className="surface-technical rounded-[24px] p-4 transition duration-300"
        style={{ filter: isInactive ? 'blur(15px)' : 'none' }}
        aria-hidden={isInactive}
      >
        {renderPreview()}
      </div>
    </div>
  )
}
