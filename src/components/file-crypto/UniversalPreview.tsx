import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FastForward,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Maximize2,
  Pause,
  Play,
  Rewind,
  Share2,
  ShieldOff,
  Video,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, MouseEvent, RefObject, SyntheticEvent } from 'react'
import { useTranslation } from 'react-i18next'

import {
  getUniversalPreviewMetadata,
  isMobilePreviewEnvironment,
} from './preview-metadata'

type UniversalPreviewProps = {
  url: string
  blob: Blob
  fileName: string
  expanded?: boolean
  isInactive?: boolean
  onOpen?: () => void
  onClose?: () => void
  onDownload?: (event: MouseEvent<HTMLButtonElement>) => void
  onShare?: (event: MouseEvent<HTMLButtonElement>) => void
  onOpenExternal?: (event: MouseEvent<HTMLButtonElement>) => void
  fullscreenTargetRef?: RefObject<HTMLDivElement>
  previewUrlRevoked?: boolean
  hasPrevious?: boolean
  hasNext?: boolean
  onPrevious?: () => void
  onNext?: () => void
  galleryIndex?: number
  galleryTotal?: number
}

const VIDEO_PLAYBACK_RATES = [0.5, 1, 1.25, 1.5, 2] as const

function formatMediaTime(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return '00:00'
  }

  const totalSeconds = Math.floor(value)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    return `${hours.toString().padStart(2, '0')}:${(minutes % 60)
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`
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
  onShare,
  onOpenExternal,
  fullscreenTargetRef,
  previewUrlRevoked = false,
  hasPrevious = false,
  hasNext = false,
  onPrevious,
  onNext,
  galleryIndex,
  galleryTotal,
}: UniversalPreviewProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [textContent, setTextContent] = useState('')
  const [imageFailed, setImageFailed] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [videoCurrentTime, setVideoCurrentTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const metadata = getUniversalPreviewMetadata(blob.type, fileName, blob.size)
  const canExpand = !expanded && metadata.kind !== 'none'
  const previewKindLabel = t(`files.previewKinds.${metadata.kind}`)

  useEffect(() => {
    setImageFailed(false)
  }, [blob, url])

  useEffect(() => {
    setVideoReady(false)
    setVideoError(false)
    setVideoPlaying(false)
    setVideoCurrentTime(0)
    setVideoDuration(0)
    setPlaybackRate(1)
  }, [blob, url, metadata.kind])

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  useEffect(() => {
    if (
      metadata.kind !== 'video' ||
      isInactive ||
      isMobilePreviewEnvironment()
    ) {
      return
    }

    function handleKeyboardShortcut(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      const video = videoRef.current
      if (!video) {
        return
      }

      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault()
        if (video.paused) {
          void video.play().catch(() => setVideoError(true))
        } else {
          video.pause()
        }
        return
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        const direction = event.key === 'ArrowLeft' ? -1 : 1
        const duration = Number.isFinite(video.duration) ? video.duration : 0
        video.currentTime = Math.min(
          duration,
          Math.max(0, video.currentTime + direction * 10),
        )
        setVideoCurrentTime(video.currentTime)
        return
      }

      if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        if (document.fullscreenElement) {
          void document.exitFullscreen()
        } else {
          const fullscreenTarget = fullscreenTargetRef?.current ?? containerRef.current

          if (fullscreenTarget && typeof fullscreenTarget.requestFullscreen === 'function') {
            void fullscreenTarget.requestFullscreen()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyboardShortcut)

    return () => window.removeEventListener('keydown', handleKeyboardShortcut)
  }, [isInactive, metadata.kind, fullscreenTargetRef])

  useEffect(() => {
    if (metadata.kind !== 'image' || isInactive || (!hasPrevious && !hasNext)) {
      return
    }

    function handleImageKeyboard(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      if (event.key === 'ArrowLeft' && hasPrevious) {
        event.preventDefault()
        onPrevious?.()
      } else if (event.key === 'ArrowRight' && hasNext) {
        event.preventDefault()
        onNext?.()
      }
    }

    window.addEventListener('keydown', handleImageKeyboard)

    return () => window.removeEventListener('keydown', handleImageKeyboard)
  }, [metadata.kind, isInactive, hasPrevious, hasNext, onPrevious, onNext])

  useEffect(() => {
    if (metadata.kind !== 'text') {
      return
    }

    let isMounted = true

    blob.text().then((content) => {
      if (isMounted) {
        setTextContent(
          content.length > 100_000
            ? `${content.slice(0, 100_000)}\n\n[Preview truncated for safety]`
            : content,
        )
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

  useEffect(() => {
    const container = containerRef.current

    return () => {
      const mediaElements = container?.querySelectorAll('video, audio') ?? []

      for (const mediaElement of mediaElements) {
        if (!(mediaElement instanceof HTMLMediaElement)) {
          continue
        }

        mediaElement.pause()
        mediaElement.removeAttribute('src')
        mediaElement.load()
      }
    }
  }, [url])

  function renderPreview() {
    if (metadata.kind === 'image') {
      if (imageFailed) {
        return (
          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-5 text-sm leading-7 text-amber-50">
            {t('files.preview.imageRenderFailed')}
          </div>
        )
      }

      if (!url || blob.size === 0) {
        return (
          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-5 text-sm leading-7 text-amber-50">
            {t('files.preview.imageRenderFailed')}
          </div>
        )
      }

      return (
        <div className="relative flex w-full items-center justify-center">
          <img
            src={url}
            alt={t('files.preview.imageAlt', { fileName })}
            onLoad={(event) => {
              if (import.meta.env.DEV) {
                console.debug('[CriptoVéu][preview-loaded]', {
                  fileName,
                  previewUrl: url,
                  naturalWidth: event.currentTarget.naturalWidth,
                  naturalHeight: event.currentTarget.naturalHeight,
                })
              }
            }}
            onError={(event) => {
              if (import.meta.env.DEV) {
                console.error('[CriptoVéu][preview-error]', {
                  fileName,
                  currentSrc: event.currentTarget.currentSrc,
                  previewBlobSize: blob.size,
                  previewBlobType: blob.type,
                  previewUrlIsBlob: url.startsWith('blob:'),
                  previewUrlRevoked,
                  cause: event.nativeEvent.type,
                })
              }
              setImageFailed(true)
            }}
            className={`block h-auto w-auto max-w-full rounded-2xl object-contain ${
              expanded ? 'max-h-[76vh]' : 'max-h-[65dvh]'
            }`}
          />

          {hasPrevious && onPrevious ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onPrevious()
              }}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-white/20 bg-zinc-950/70 text-white shadow-2xl backdrop-blur transition hover:scale-105 hover:bg-zinc-900 active:scale-95 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              aria-label={t('files.preview.previousImage')}
              title={t('files.preview.previousImage')}
            >
              <ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7" />
            </button>
          ) : null}

          {hasNext && onNext ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onNext()
              }}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-white/20 bg-zinc-950/70 text-white shadow-2xl backdrop-blur transition hover:scale-105 hover:bg-zinc-900 active:scale-95 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              aria-label={t('files.preview.nextImage')}
              title={t('files.preview.nextImage')}
            >
              <ChevronRight className="h-6 w-6 sm:h-7 sm:w-7" />
            </button>
          ) : null}
        </div>
      )
    }

    if (metadata.kind === 'video') {
      function handleVideoLoaded(event: SyntheticEvent<HTMLVideoElement>) {
        const duration = event.currentTarget.duration
        setVideoDuration(Number.isFinite(duration) ? duration : 0)
        setVideoReady(true)
      }

      function handleVideoTimeUpdate(
        event: SyntheticEvent<HTMLVideoElement>,
      ) {
        setVideoCurrentTime(event.currentTarget.currentTime)
      }

      function handleVideoSeek(event: ChangeEvent<HTMLInputElement>) {
        const nextTime = Number(event.target.value)
        const video = videoRef.current

        if (!video || !Number.isFinite(nextTime)) {
          return
        }

        video.currentTime = Math.min(
          Number.isFinite(video.duration) ? video.duration : nextTime,
          Math.max(0, nextTime),
        )
        setVideoCurrentTime(video.currentTime)
      }

      function handleVideoSkip(seconds: number) {
        const video = videoRef.current

        if (!video) {
          return
        }

        const duration = Number.isFinite(video.duration) ? video.duration : 0
        video.currentTime = Math.min(
          duration,
          Math.max(0, video.currentTime + seconds),
        )
        setVideoCurrentTime(video.currentTime)
      }

      function handleVideoPlayPause() {
        const video = videoRef.current

        if (!video) {
          return
        }

        if (video.paused) {
          void video.play().catch(() => setVideoError(true))
        } else {
          video.pause()
        }
      }

      function handleVideoFullscreen() {
        if (document.fullscreenElement) {
          void document.exitFullscreen()
          return
        }

        const fullscreenTarget = fullscreenTargetRef?.current ?? containerRef.current

        if (fullscreenTarget && typeof fullscreenTarget.requestFullscreen === 'function') {
          void fullscreenTarget.requestFullscreen()
        }
      }

      return (
        <div className="space-y-3">
          {videoError ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-5 text-sm leading-7 text-amber-50"
            >
              <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />
              <p>{t('files.preview.unsupportedCodec')}</p>
            </div>
          ) : (
            <>
              <div className="relative overflow-hidden rounded-2xl bg-black">
                <video
                  ref={videoRef}
                  src={url}
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={handleVideoLoaded}
                  onCanPlay={() => setVideoReady(true)}
                  onTimeUpdate={handleVideoTimeUpdate}
                  onPlay={() => setVideoPlaying(true)}
                  onPause={() => setVideoPlaying(false)}
                  onError={() => {
                    setVideoReady(false)
                    setVideoError(true)
                  }}
                  className={`w-full ${
                    expanded ? 'max-h-[min(62dvh,640px)]' : 'max-h-[60vh]'
                  }`}
                  aria-label={t('files.preview.videoAria', { fileName })}
                >
                  <track kind="captions" label={t('files.preview.noCaptions')} />
                </video>
                {!videoReady ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="flex items-center gap-3 rounded-full border border-white/10 bg-zinc-950/85 px-4 py-3 text-sm text-zinc-100">
                      <LoaderCircle className="h-5 w-5 animate-spin text-cyan-300" />
                      {t('files.preview.loading')}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/30 p-2 pb-[max(16px,env(safe-area-inset-bottom,28px))] sm:p-3 sm:pb-[max(16px,env(safe-area-inset-bottom,28px))]">
                <label htmlFor="preview-video-timeline" className="sr-only">
                  {t('files.preview.timeline')}
                </label>
                <input
                  id="preview-video-timeline"
                  type="range"
                  min="0"
                  max={videoDuration || 1}
                  step="0.1"
                  value={Math.min(videoCurrentTime, videoDuration || 1)}
                  disabled={!videoReady || videoDuration <= 0}
                  onChange={handleVideoSeek}
                  className="w-full accent-cyan-400"
                  aria-label={t('files.preview.timeline')}
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                  <span>
                    {formatMediaTime(videoCurrentTime)} /{' '}
                    {formatMediaTime(videoDuration)}
                  </span>
                  <label className="flex items-center gap-2">
                    <span>{t('files.preview.speed')}</span>
                    <select
                      value={playbackRate}
                      onChange={(event) =>
                        setPlaybackRate(Number(event.target.value))
                      }
                      className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-white"
                      aria-label={t('files.preview.speed')}
                    >
                      {VIDEO_PLAYBACK_RATES.map((rate) => (
                        <option key={rate} value={rate}>
                          {rate === 1 ? '1.0' : rate}x
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 sm:mt-3 sm:flex">
                  <button
                    type="button"
                    onClick={handleVideoPlayPause}
                    disabled={!videoReady}
                    className="btn-secondary min-h-10 min-w-0 justify-center px-2 sm:flex-1"
                    aria-label={
                      videoPlaying
                        ? t('files.preview.pause')
                        : t('files.preview.play')
                    }
                    title={
                      videoPlaying
                        ? t('files.preview.pause')
                        : t('files.preview.play')
                    }
                  >
                    {videoPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVideoSkip(-10)}
                    disabled={!videoReady}
                    className="btn-secondary min-h-10 min-w-0 justify-center px-2 sm:flex-1"
                    aria-label={t('files.preview.rewind10')}
                    title={t('files.preview.rewind10')}
                  >
                    <Rewind className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVideoSkip(10)}
                    disabled={!videoReady}
                    className="btn-secondary min-h-10 min-w-0 justify-center px-2 sm:flex-1"
                    aria-label={t('files.preview.forward10')}
                    title={t('files.preview.forward10')}
                  >
                    <FastForward className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleVideoFullscreen}
                    disabled={!videoReady}
                    className="btn-secondary min-h-10 min-w-0 justify-center px-2 sm:flex-1"
                    aria-label={t('files.preview.fullscreen')}
                    title={t('files.preview.fullscreen')}
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {!videoReady ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-sm leading-6 text-cyan-50"
                >
                  {t('files.preview.largeFileNotice')}
                </div>
              ) : null}
            </>
          )}
        </div>
      )
    }

    if (metadata.kind === 'audio') {
      return (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <audio
            src={url}
            controls
            className="w-full"
            aria-label={t('files.preview.audioAria', { fileName })}
          />
        </div>
      )
    }

    if (metadata.kind === 'pdf') {
      return (
        <iframe
          src={url}
          title={t('files.preview.pdfTitle', { fileName })}
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
        {t('files.preview.unsupported')}
      </div>
    )
  }

  function handleDownloadClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    onDownload?.(event)
  }

  function handleShareClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    onShare?.(event)
  }

  function handleOpenExternalClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    onOpenExternal?.(event)
  }

  const PreviewIcon =
    metadata.kind === 'image'
      ? ImageIcon
      : metadata.kind === 'video' || metadata.kind === 'audio'
        ? Video
        : metadata.kind === 'text' || metadata.kind === 'pdf'
          ? FileText
          : ShieldOff
  const previewContainerClassName = `surface-technical min-w-0 rounded-[24px] transition duration-300 ${
    expanded ? 'overflow-visible p-2 sm:p-4' : 'overflow-hidden p-3 sm:p-4'
  } ${
    isInactive ? 'cv-privacy-blur' : ''
  }`

  return (
    <div
      ref={containerRef}
      className={
        expanded
          ? 'flex min-w-0 flex-1 flex-col gap-3'
          : 'min-w-0 space-y-4 overflow-hidden'
      }
    >
      {expanded ? (
        <header className="sticky top-0 z-20 flex w-full min-w-0 shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-zinc-950/90 px-4 pt-[env(safe-area-inset-top,16px)] pb-3 backdrop-blur">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary h-8 shrink-0 gap-1 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] sm:h-10 sm:gap-2 sm:px-3 sm:text-xs sm:tracking-[0.12em]"
              aria-label={t('files.preview.closeExpandedAria')}
              title={t('layout.header.back')}
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>{t('layout.header.back')}</span>
            </button>
          ) : null}
          <div className="min-w-0 flex-1 px-1 text-center">
            <p className="truncate text-sm font-semibold text-white" title={fileName}>
              {fileName}
            </p>
            <p className="truncate text-[11px] uppercase tracking-[0.16em] text-cyan-100/70">
              {galleryTotal && galleryTotal > 1
                ? t('files.preview.galleryCounter', { current: galleryIndex ?? 1, total: galleryTotal })
                : previewKindLabel}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onDownload ? (
              <button
                type="button"
                onClick={handleDownloadClick}
                className="btn-secondary h-8 w-8 justify-center p-0 sm:h-10 sm:w-10"
                aria-label={t('common.download')}
                title={t('common.download')}
              >
                <Download className="h-4 w-4" />
              </button>
            ) : null}
            {onShare ? (
              <button
                type="button"
                onClick={handleShareClick}
                className="btn-secondary h-8 w-8 justify-center p-0 sm:h-10 sm:w-10"
                aria-label={t('files.workspace.results.share')}
                title={t('files.workspace.results.share')}
              >
                <Share2 className="h-4 w-4" />
              </button>
            ) : null}
            {onOpenExternal ? (
              <button
                type="button"
                onClick={handleOpenExternalClick}
                className="btn-secondary h-8 w-8 justify-center p-0 sm:h-10 sm:w-10"
                aria-label={t('files.workspace.results.openExternal')}
                title={t('files.workspace.results.openExternal')}
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </header>
      ) : (
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="icon-chip p-2">
              <PreviewIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="break-words text-xs uppercase tracking-[0.18em] text-cyan-100/80 sm:tracking-[0.28em]">
                {galleryTotal && galleryTotal > 1
                  ? t('files.preview.galleryCounter', { current: galleryIndex ?? 1, total: galleryTotal })
                  : t('files.preview.safePreview', { label: previewKindLabel })}
              </p>
              <p className="mt-2 break-words text-sm font-semibold text-white">{fileName}</p>
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-flow-col sm:auto-cols-max">
            {canExpand ? (
              <button type="button" onClick={onOpen} className="btn-secondary w-full">
                <Maximize2 className="h-4 w-4" />
                {t('common.expand')}
              </button>
            ) : null}
            {onDownload ? (
              <button type="button" onClick={handleDownloadClick} className="btn-secondary w-full">
                <Download className="h-4 w-4" />
                {t('common.download')}
              </button>
            ) : null}
            {onShare ? (
              <button type="button" onClick={handleShareClick} className="btn-secondary w-full">
                <Share2 className="h-4 w-4" />
                {t('files.workspace.results.share')}
              </button>
            ) : null}
            {onOpenExternal ? (
              <button type="button" onClick={handleOpenExternalClick} className="btn-secondary w-full">
                <ExternalLink className="h-4 w-4" />
                {t('files.workspace.results.openExternal')}
              </button>
            ) : null}
            {onClose ? (
              <button type="button" onClick={onClose} className="btn-secondary w-full">
                <X className="h-4 w-4" />
                {t('common.close')}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {!expanded && isInactive ? (
        <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-sm text-cyan-50">
          <Pause className="h-4 w-4" />
          {t('files.preview.hiddenByInactivity')}
        </div>
      ) : null}

      {!expanded ? (
        <p className="text-xs leading-6 text-zinc-500">{t('files.preview.localPreviewNote')}</p>
      ) : null}

      {isInactive ? (
        <div className={previewContainerClassName} aria-hidden="true">
          {renderPreview()}
        </div>
      ) : (
        <div className={previewContainerClassName}>{renderPreview()}</div>
      )}

      {expanded ? (
        <>
          {isInactive ? (
            <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-sm text-cyan-50">
              <Pause className="h-4 w-4" />
              {t('files.preview.hiddenByInactivity')}
            </div>
          ) : null}
          <p className="pb-2 text-xs leading-6 text-zinc-500">
            {t('files.preview.localPreviewNote')}
          </p>
        </>
      ) : null}
    </div>
  )
}
