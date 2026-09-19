import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Crown,
  Download,
  FileArchive,
  FileSearch,
  LoaderCircle,
  Lock,
  Maximize2,
  ShieldCheck,
  Sparkles,
  Unlock,
  Upload,
  X,
} from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { FileOpener } from '@capawesome-team/capacitor-file-opener'
import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent, MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import FieldBlock from '../ui/FieldBlock'
import AdvancedOptions from '../ui/AdvancedOptions'
import MobileStickyCTA from '../ui/MobileStickyCTA'
import PasswordInput from '../ui/PasswordInput'
import ResultPanel from '../ui/ResultPanel'
import SegmentedMode from '../ui/SegmentedMode'
import PasswordSecurityPanel from '../ui/PasswordSecurityPanel'
import UniversalPreview from './UniversalPreview'
import KeyFileProtectionPanel from './KeyFileProtectionPanel'
import { usePremium } from '../../context/premium'
import {
  getUniversalPreviewMetadata,
  type PreviewMetadata,
} from './preview-metadata'
import { resolvePreviewMimeType } from '../../lib/file-preview'
import { useInactivity } from '../../hooks/useInactivity'
import { useStreamingCrypto } from '../../hooks/useStreamingCrypto'
import {
  ARGON2_FILE_ITERATIONS,
  FILE_SECURITY_PROFILES,
  MAX_FILE_PACKAGE_OVERHEAD_BYTES,
  MAX_FILE_SIZE,
  STREAMING_CHUNK_SIZE_BYTES,
  formatFileSize,
  inspectCriptoveuPackage,
  supportsOpfsCrypto,
  type FilePackageInspection,
  type FileSecurityReport,
  type FileSecurityProfileId,
} from '../../lib/criptoveu'
import { MAX_KEY_FILE_SIZE_BYTES } from '../../lib/key-file-protection'
import {
  exportFileToNativeDownloads,
  type NativeExportContext,
  sanitizeNativeFileName,
  saveBlobInBrowser,
  supportsNativeFileExport,
} from '../../lib/native-file-export'
import {
  getSecurityProfileIdFromPreferences,
  incrementStats,
  updatePreferences,
} from '../../lib/storage/preferences-storage'

type Mode = 'encrypt' | 'decrypt'
type StatusTone = 'info' | 'success' | 'error'

type StatusState = {
  tone: StatusTone
  message: string
}

type ResultItem = {
  id: string
  name: string
  blob: Blob
  size: number
  sourceName: string
  preview: PreviewMetadata
  securityReport: FileSecurityReport
  savedWithSuccess: boolean
  savedToDocuments: boolean
  nativePath: string | null
  dispose?: () => void | Promise<void>
}

const MODE_COPY: Record<
  Mode,
  {
    action: string
    title: string
    description: string
    hint: string
  }
> = {
  encrypt: {
    action: 'files.workspace.modes.encrypt.action',
    title: 'files.workspace.modes.encrypt.title',
    description: 'files.workspace.modes.encrypt.description',
    hint: 'files.workspace.modes.encrypt.hint',
  },
  decrypt: {
    action: 'files.workspace.modes.decrypt.action',
    title: 'files.workspace.modes.decrypt.title',
    description: 'files.workspace.modes.decrypt.description',
    hint: 'files.workspace.modes.decrypt.hint',
  },
}

const STATUS_STYLES: Record<StatusTone, string> = {
  info: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-50',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-50',
  error: 'border-rose-500/25 bg-rose-500/10 text-rose-50',
}

const FILE_SECURITY_PROFILE_STORAGE_KEY = 'criptoveu-file-security-profile-v3'
const STORAGE_RESERVE_MULTIPLIER = 2.5
const SUPPORTED_RECOVERY_EXTENSIONS = ['.criptoveu', '.cryptify'] as const

async function hasInsufficientStorage(fileSize: number) {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return false
  }

  try {
    const estimate = await navigator.storage.estimate()
    const quota = estimate.quota
    const usage = estimate.usage ?? 0

    if (
      typeof quota !== 'number' ||
      !Number.isFinite(quota) ||
      typeof usage !== 'number' ||
      !Number.isFinite(usage)
    ) {
      return false
    }

    return Math.max(0, quota - usage) < fileSize * STORAGE_RESERVE_MULTIPLIER
  } catch {
    return false
  }
}

function hasSupportedRecoveryExtension(fileName: string) {
  const normalizedName = fileName.toLowerCase()
  return SUPPORTED_RECOVERY_EXTENSIONS.some((extension) =>
    normalizedName.endsWith(extension),
  )
}

function getFileIdentity(file: File, index: number) {
  return `${index}-${file.name}-${file.size}-${file.lastModified}`
}

export default function FileCryptoWorkspace() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('encrypt')
  const [files, setFiles] = useState<File[]>([])
  const [password, setPassword] = useState('')
  const [useKeyFile, setUseKeyFile] = useState(false)
  const [useRecoverableParity, setUseRecoverableParity] = useState(false)
  const [keyFile, setKeyFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState(() => t('files.workspace.status.ready'))
  const [status, setStatus] = useState<StatusState>({
    tone: 'info',
    message: t('files.workspace.status.initial'),
  })
  const [results, setResults] = useState<ResultItem[]>([])
  const [packageInspections, setPackageInspections] = useState<
    Record<string, FilePackageInspection>
  >({})
  const [isInspectingPackages, setIsInspectingPackages] = useState(false)
  const [previewItem, setPreviewItem] = useState<ResultItem | null>(null)
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasStorageWarning, setHasStorageWarning] = useState(false)
  const [exportNotice, setExportNotice] = useState<string | null>(null)
  const [isFileLimitDialogOpen, setIsFileLimitDialogOpen] = useState(false)
  const [securityProfileId, setSecurityProfileId] =
    useState<FileSecurityProfileId>(getSecurityProfileIdFromPreferences)
  const fileInputId = useId()
  const keyFileInputId = useId()
  const passwordInputId = useId()
  const previewUrlRef = useRef<string | null>(null)
  const previewModalRef = useRef<HTMLDivElement | null>(null)
  const resultCleanupRef = useRef<(() => void)[]>([])
  const abortControllerRef = useRef<AbortController | null>(null)
  const resultPanelRef = useRef<HTMLDivElement | null>(null)
  const isInactive = useInactivity({ disabled: results.length === 0 && !isPreviewOpen })
  const streamingCrypto = useStreamingCrypto()
  const { isPremium, tier } = usePremium()
  const opfsAvailable = supportsOpfsCrypto()
  const canUseSecureProcessing =
    window.isSecureContext && typeof window.crypto?.subtle !== 'undefined'
  const securityProfile =
    FILE_SECURITY_PROFILES.find((profile) => profile.id === securityProfileId) ??
    FILE_SECURITY_PROFILES[1]
  const packageRequiresKeyFile =
    mode === 'decrypt' &&
    Object.values(packageInspections).some(
      (inspection) => inspection.keyFileRequired === true,
    )
  const keyFileIsRequired =
    (mode === 'encrypt' && useKeyFile) || packageRequiresKeyFile

  useEffect(() => {
    let cancelled = false

    if (mode !== 'decrypt' || files.length === 0) {
      setPackageInspections({})
      setIsInspectingPackages(false)
      return
    }

    setIsInspectingPackages(true)

    void Promise.all(
      files.map(async (file, index) => [
        getFileIdentity(file, index),
        await inspectCriptoveuPackage(file),
      ] as const),
    )
      .then((entries) => {
        if (!cancelled) {
          setPackageInspections(Object.fromEntries(entries))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsInspectingPackages(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [files, mode])

  const currentMode = MODE_COPY[mode]
  const totalSelectedSize = files.reduce((sum, currentFile) => sum + currentFile.size, 0)
  const activeFileLimit = opfsAvailable
    ? null
    : MAX_FILE_SIZE + (mode === 'decrypt' ? MAX_FILE_PACKAGE_OVERHEAD_BYTES : 0)
  const resultName = previewItem?.name ?? results[0]?.name ?? ''
  const activePreviewItem = previewItem ?? results[0] ?? null
  const preview = activePreviewItem?.preview ?? { kind: 'none', label: t('common.file') }
  const imageResults = results.filter((result) => result.preview.kind === 'image')
  const currentImageGalleryIndex =
    activePreviewItem && activePreviewItem.preview.kind === 'image'
      ? imageResults.findIndex((result) => result.id === activePreviewItem.id)
      : -1
  const isImageGallery = currentImageGalleryIndex !== -1 && imageResults.length > 1
  const quickFacts = [
    {
      label: t('files.workspace.quickFacts.formats'),
      value:
        mode === 'encrypt'
          ? t('files.workspace.quickFacts.anyFile')
          : t('files.workspace.quickFacts.criptoveuFiles'),
    },
    {
      label: t('files.workspace.quickFacts.activeTier'),
      value: isPremium
        ? tier === 'admin'
          ? t('files.workspace.plan.admin')
          : t('files.workspace.plan.supporter')
        : t('files.workspace.plan.community'),
    },
    {
      label: t('files.workspace.quickFacts.processing'),
      value: t('files.workspace.quickFacts.blocksOf', {
        size: formatFileSize(STREAMING_CHUNK_SIZE_BYTES),
      }),
    },
    {
      label: t('files.workspace.quickFacts.derivation'),
      value:
        mode === 'encrypt'
          ? t('files.workspace.quickFacts.argon2', { memory: securityProfile.memoryMb })
          : t('files.workspace.quickFacts.packageParams'),
    },
    {
      label: t('files.workspace.quickFacts.transfer'),
      value: t('files.workspace.quickFacts.noUpload'),
    },
  ]

  useEffect(() => {
    if (!canUseSecureProcessing) {
      setStatus({
        tone: 'error',
        message: t('files.workspace.status.secureContextRequired'),
      })
    }
  }, [canUseSecureProcessing, t])

  useEffect(() => {
    try {
      window.localStorage.setItem(FILE_SECURITY_PROFILE_STORAGE_KEY, securityProfileId)
      const selectedProfile = FILE_SECURITY_PROFILES.find((profile) => profile.id === securityProfileId)

      if (selectedProfile) {
        void updatePreferences({
          crypto: { defaultArgon2MemoryMb: selectedProfile.memoryMb },
        })
      }
    } catch {
      // A seleção em memória continua válida quando o armazenamento é bloqueado.
    }
  }, [securityProfileId])

  useEffect(() => {
    if (results.length === 0) {
      return
    }

    resultPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [results.length])

  useEffect(() => {
    if (!isPreviewOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsPreviewOpen(false)
        setPreviewItem(null)
        setPreviewBlob(null)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isPreviewOpen])

  useEffect(() => {
    if (!isFileLimitDialogOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsFileLimitDialogOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFileLimitDialogOpen])

  useEffect(() => {
    if (!exportNotice) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setExportNotice(null)
    }, 5000)

    return () => window.clearTimeout(timeoutId)
  }, [exportNotice])

  useEffect(() => {
    if (isPreviewOpen || !previewUrlRef.current) {
      return
    }

    const url = previewUrlRef.current
    previewUrlRef.current = null
    setPreviewUrl(null)
    URL.revokeObjectURL(url)
  }, [isPreviewOpen])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
      for (const cleanup of resultCleanupRef.current) {
        cleanup()
      }
    }
  }, [])

  function clearResults() {
    for (const cleanup of resultCleanupRef.current) {
      cleanup()
    }

    resultCleanupRef.current = []
    releasePreviewUrl()
    setResults([])
    setPreviewItem(null)
    setPreviewBlob(null)
    setPreviewUrl(null)
    setIsPreviewOpen(false)
    setExportNotice(null)
    streamingCrypto.resetProgress()
  }

  function handleModeChange(nextMode: string) {
    const resolvedMode = nextMode as Mode

    if (resolvedMode === mode) {
      return
    }

    setMode(resolvedMode)
    setIsFileLimitDialogOpen(false)
    setUseKeyFile(false)
    setUseRecoverableParity(false)
    setKeyFile(null)
    setProgress(0)
    setProgressLabel(t('files.workspace.status.ready'))
    setStatus({
      tone: 'info',
      message: t(`files.workspace.status.mode.${resolvedMode}`),
    })
    setFiles([])
    setHasStorageWarning(false)
    clearResults()
  }

  async function handleSelectedFiles(selectedFiles: FileList | File[] | null | undefined): Promise<boolean> {
    const nextFiles = Array.from(selectedFiles ?? [])

    if (nextFiles.length === 0) {
      return false
    }

    if (
      mode === 'decrypt' &&
      nextFiles.some(
        (selectedFile) => !hasSupportedRecoveryExtension(selectedFile.name),
      )
    ) {
      setFiles([])
      setHasStorageWarning(false)
      clearResults()
      setStatus({
        tone: 'error',
        message: t('files.workspace.status.unsupportedRecoveryFormat'),
      })
      return false
    }

    const maxAllowedBytes = opfsAvailable
  ? null
  : mode === 'decrypt'
        ? MAX_FILE_SIZE + MAX_FILE_PACKAGE_OVERHEAD_BYTES
        : MAX_FILE_SIZE

    const oversizedFiles = nextFiles.filter(
      (selectedFile) =>
        maxAllowedBytes !== null && selectedFile.size > maxAllowedBytes,
    )

    if (oversizedFiles.length > 0) {
      setFiles([])
      clearResults()
      setStatus({
        tone: 'error',
        message: t('files.workspace.status.fileExceedsLimit', {
          defaultValue:
            'O arquivo selecionado excede o limite de 1 GB para processamento 100% local e seguro na memória do dispositivo.',
        }),
      })
      if (mode === 'encrypt') {
        setIsFileLimitDialogOpen(true)
      }
      return false
    }

    if (mode === 'decrypt') {
      setKeyFile(null)
    }

    const selectedSize = nextFiles.reduce(
      (sum, selectedFile) => sum + selectedFile.size,
      0,
    )
    const storageWarning = await hasInsufficientStorage(selectedSize)
    setHasStorageWarning(storageWarning)

    setFiles(nextFiles)
    setProgress(0)
    setProgressLabel(
      nextFiles.length === 1
        ? t('files.workspace.status.filesReady_one')
        : t('files.workspace.status.filesReady_other'),
    )
    setStatus({
      tone: 'info',
      message: storageWarning
        ? t('files.workspace.status.storageSpaceWarning', {
            size: formatFileSize(
              Math.ceil(selectedSize * STORAGE_RESERVE_MULTIPLIER),
            ),
          })
        : t('files.workspace.status.filesLoaded', { count: nextFiles.length }),
    })
    clearResults()
    return true
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    void handleSelectedFiles(event.target.files)
    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsDragging(false)
    void handleSelectedFiles(event.dataTransfer.files)
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsDragging(true)
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return
    }

    setIsDragging(false)
  }

  async function handleDownloadResult(
    result: ResultItem,
    onExportProgress?: (value: number) => void,
    exportContext?: NativeExportContext,
  ): Promise<string | null> {
    if (result.savedWithSuccess) {
      setExportNotice(
        supportsNativeFileExport()
          ? t('files.workspace.results.savedNativeNotice')
          : t('files.workspace.results.savedWebNotice'),
      )
      return result.nativePath
    }

    setStatus({
      tone: 'info',
      message: t('files.workspace.status.savingPackage'),
    })

    if (supportsNativeFileExport()) {
      await exportFileToNativeDownloads(result.blob, result.name, (value) => {
        const exportProgress = 90 + Math.round(value * 0.09)
        setProgress(exportProgress)
        onExportProgress?.(exportProgress)
        setProgressLabel(t('files.workspace.status.savingDocuments', {
          written: formatFileSize(Math.round((result.size * value) / 100)),
          total: formatFileSize(result.size),
        }))
      }, exportContext)
      const safeFileName = sanitizeNativeFileName(result.name)
      const storedFile = await Filesystem.stat({
        directory: Directory.Documents,
        path: safeFileName,
      })
      if (storedFile.size !== result.size) {
        throw new Error(`Gravação incompleta: tamanho esperado ${result.size} bytes, mas apenas ${storedFile.size} bytes foram confirmados em Documents.`)
      }
      result.nativePath = safeFileName
    } else {
      await saveBlobInBrowser(result.blob, result.name)
    }

    // Keep the OPFS-backed File alive while the result card and its preview
    // remain mounted. Cleanup is centralized in clearResults/unmount so a
    // successful export cannot invalidate a preview that is opened afterward.

    result.savedWithSuccess = true
    result.savedToDocuments = supportsNativeFileExport()
    setResults((currentResults) =>
      currentResults.map((currentResult) =>
        currentResult.id === result.id
          ? {
              ...currentResult,
              savedWithSuccess: true,
              savedToDocuments: result.savedToDocuments,
              nativePath: result.nativePath,
            }
          : currentResult,
      ),
    )
    setExportNotice(
      supportsNativeFileExport()
        ? t('files.workspace.results.savedNativeNotice')
        : t('files.workspace.results.savedWebNotice'),
    )
    setStatus({
      tone: 'success',
      message: t('files.workspace.status.packageSaved'),
    })
    return result.nativePath
  }

  function handleDownloadFailure(error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      setExportNotice(t('files.workspace.status.saveCancelled'))
      setStatus({
        tone: 'info',
        message: t('files.workspace.status.saveCancelled'),
      })
      return
    }
    setStatus({
      tone: 'error',
      message: error instanceof Error
        ? `${t('files.workspace.status.saveFailed')}: ${error.message}`
        : t('files.workspace.status.unexpectedDownloadFailure'),
    })
  }

  async function getSavedNativeFileUri(result: ResultItem) {
    if (!supportsNativeFileExport()) {
      throw new Error(t('files.workspace.results.nativeActionUnavailable'))
    }

    if (!result.savedWithSuccess || !result.nativePath) {
      throw new Error(t('files.workspace.results.saveBeforeNativeAction'))
    }

    const { uri } = await Filesystem.getUri({
      directory: Directory.Documents,
      path: result.nativePath,
    })

    if (!uri) {
      throw new Error(t('files.workspace.results.nativeActionUnavailable'))
    }

    return uri
  }

  async function handleShareResult(result: ResultItem) {
    const uri = await getSavedNativeFileUri(result)
    const canShare = await Share.canShare()
    if (!canShare.value) {
      throw new Error(t('files.workspace.results.shareUnavailable'))
    }

    await Share.share({
      title: result.name,
      files: [uri],
      dialogTitle: t('files.workspace.results.share'),
    })
  }

  async function handleOpenExternalResult(result: ResultItem) {
    const uri = await getSavedNativeFileUri(result)
    await FileOpener.openFile({
      path: uri,
      mimeType: resolvePreviewMimeType(result.name, result.blob.type),
    })
  }

  function handleNativeActionFailure(error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return
    }

    setStatus({
      tone: 'error',
      message: error instanceof Error
        ? error.message
        : t('files.workspace.status.unexpectedDownloadFailure'),
    })
  }

  function handleKeyFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedKeyFile = event.target.files?.[0] ?? null
    event.target.value = ''

    if (!selectedKeyFile) {
      return
    }

    if (
      selectedKeyFile.size === 0 ||
      selectedKeyFile.size > MAX_KEY_FILE_SIZE_BYTES
    ) {
      setKeyFile(null)
      setStatus({
        tone: 'error',
        message:
          selectedKeyFile.size === 0
            ? t('files.workspace.keyFile.emptyError')
            : t('files.workspace.keyFile.tooLargeError', {
                size: formatFileSize(MAX_KEY_FILE_SIZE_BYTES),
              }),
      })
      return
    }

    setKeyFile(selectedKeyFile)
    setStatus({
      tone: 'info',
      message: t('files.workspace.keyFile.selected'),
    })
  }

  async function downloadSecurityReport(result: ResultItem) {
    if (import.meta.env.DEV) {
      console.debug('[CriptoVéu][click]', {
        handler: 'downloadSecurityReport',
        fileName: result.name,
      })
    }

    const reportBlob = new Blob(
      [JSON.stringify(result.securityReport, null, 2)],
      { type: 'application/json' },
    )

    try {
      await exportFileToNativeDownloads(
        reportBlob,
        `${result.name}.relatorio-seguranca.json`,
        undefined,
        {
          action: 'downloadSecurityReport',
          trigger: 'downloadSecurityReport-button',
          userInitiated: true,
          previewMode: false,
        },
      )
    } catch (error) {
      handleDownloadFailure(error)
    }
  }

  async function saveRecoveredFile(
    result: ResultItem,
    exportContext: NativeExportContext = {
      action: 'saveRecoveredFile',
      trigger: 'saveRecoveredFile-button',
      userInitiated: true,
      previewMode: isPreviewOpen,
    },
  ) {
    if (import.meta.env.DEV) {
      console.debug('[CriptoVéu][click]', {
        handler: 'saveRecoveredFile',
        fileName: result.name,
      })
    }

    await handleDownloadResult(result, undefined, exportContext)
    setStatus({
      tone: 'success',
      message: mode === 'decrypt'
        ? t('files.workspace.status.recoveredFileSaved')
        : t('files.workspace.status.packageSaved'),
    })
  }

  function handleSaveRecoveredFromPreview(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()

    const targetResult = previewItem ?? results[0] ?? null

    if (!targetResult) {
      return
    }

    void saveRecoveredFile(targetResult).catch(handleDownloadFailure)
  }

  function handleDownloadAll() {
    if (results.length === 0) {
      return
    }

    if (import.meta.env.DEV) {
      console.debug('[CriptoVéu][click]', {
        handler: 'downloadAll',
        count: results.length,
      })
    }

    results.forEach((result, index) => {
      window.setTimeout(() => {
        void saveRecoveredFile(result, {
          action: 'saveAll',
          trigger: 'downloadAll-button',
          userInitiated: true,
          previewMode: false,
        }).catch(handleDownloadFailure)
      }, index * 120)
    })
  }

  function releasePreviewUrl() {
    const url = previewUrlRef.current
    previewUrlRef.current = null

    if (url) {
      URL.revokeObjectURL(url)
    }

    setPreviewUrl(null)
  }

  function handleOpenPreview(result: ResultItem | null = results[0] ?? null) {
    if (!result || result.preview.kind === 'none') {
      return
    }

    if (result.preview.kind === 'video' || result.preview.kind === 'audio') {
      setStatus({
        tone: 'info',
        message: t('files.preview.largeFileNotice'),
      })
    }

    const resolvedMimeType = resolvePreviewMimeType(result.name, result.blob.type)
    const nextPreviewBlob = result.blob

    if (nextPreviewBlob.size === 0) {
      setStatus({
        tone: 'error',
        message: t('files.preview.temporaryUnavailable'),
      })
      return
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }

    const nextPreviewUrl = URL.createObjectURL(nextPreviewBlob)
    previewUrlRef.current = nextPreviewUrl

    if (import.meta.env.DEV) {
      console.debug('[CriptoVéu][preview-open]', {
        originalFileName: result.name,
        resolvedMimeType,
        previewBlobSize: nextPreviewBlob.size,
        previewBlobType: nextPreviewBlob.type,
        previewUrl: nextPreviewUrl,
        userAgent: navigator.userAgent,
        capacitorNative: Capacitor.isNativePlatform(),
      })
    }

    setPreviewItem(result)
    setPreviewBlob(nextPreviewBlob)
    setPreviewUrl(nextPreviewUrl)
    setIsPreviewOpen(true)
  }

  function handleClosePreview() {
    const closedUnsavedPreview = previewItem !== null && !previewItem.savedWithSuccess
    releasePreviewUrl()
    setIsPreviewOpen(false)
    setPreviewItem(null)
    setPreviewBlob(null)
    if (closedUnsavedPreview && mode === 'decrypt') {
      setStatus({
        tone: 'info',
        message: t('files.preview.previewClosedWithoutSave'),
      })
    }
  }

  function handlePreviewBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      handleClosePreview()
    }
  }

  function handlePreviousImage() {
    if (currentImageGalleryIndex > 0) {
      handleOpenPreview(imageResults[currentImageGalleryIndex - 1])
    }
  }

  function handleNextImage() {
    if (
      currentImageGalleryIndex >= 0 &&
      currentImageGalleryIndex < imageResults.length - 1
    ) {
      handleOpenPreview(imageResults[currentImageGalleryIndex + 1])
    }
  }

  async function handleProcess() {
    if (!canUseSecureProcessing) {
      setStatus({
        tone: 'error',
        message: t('files.workspace.status.secureContextRequired'),
      })
      return
    }

    if (files.length === 0 || !password) {
      setStatus({
        tone: 'error',
        message: t('files.workspace.status.missingFilesOrPassword'),
      })
      return
    }

    if (keyFileIsRequired && !keyFile) {
      setStatus({
        tone: 'error',
        message: t('files.workspace.keyFile.requiredError'),
      })
      return
    }

    const insufficientStorage = await hasInsufficientStorage(totalSelectedSize)
    setHasStorageWarning(insufficientStorage)
    if (insufficientStorage) {
      setStatus({
        tone: 'error',
        message: t('files.workspace.status.storageSpaceWarning', {
          size: formatFileSize(Math.ceil(totalSelectedSize * STORAGE_RESERVE_MULTIPLIER)),
        }),
      })
      return
    }

    const oversizedFiles =
      activeFileLimit === null
        ? []
        : files.filter((selectedFile) => selectedFile.size > activeFileLimit)

    if (oversizedFiles.length > 0) {
      setStatus({
        tone: 'error',
        message: t('files.workspace.status.fileExceedsLimit', {
          defaultValue:
            'O arquivo selecionado excede o limite de 1 GB para processamento 100% local e seguro na memória do dispositivo.',
        }),
      })
      if (mode === 'encrypt') {
        setIsFileLimitDialogOpen(true)
      }
      return
    }

    setIsProcessing(true)
    abortControllerRef.current = new AbortController()
    setProgress(4)
    setProgressLabel(t('files.workspace.status.preparingSecureEnvironment'))
    setStatus({
      tone: 'info',
      message: t(`files.workspace.status.processing.${mode}`),
    })
    clearResults()

    try {
      const processedResults: ResultItem[] = []
      const failures: string[] = []
      let saveCancelled = false
      let savePending = false

      for (const [index, currentFile] of files.entries()) {
        const currentStep = index + 1
        let processedResult: ResultItem | null = null

        try {
          const { blob, downloadName, manifestMimeType, securityReport, dispose } =
            await streamingCrypto.processFile(
              mode,
              currentFile,
              password,
              (value, label) => {
                const startProgress = (index / files.length) * 100
                const endProgress = ((index + 1) / files.length) * 100
                const aggregateProgress =
                  startProgress +
                  ((endProgress - startProgress) * value) / 100

                const cryptoProgress = Math.min(85, Math.round(aggregateProgress * 0.85))
                setProgress(cryptoProgress)
                setProgressLabel(
                  files.length === 1
                    ? label
                    : t('files.workspace.status.fileStep', {
                        current: currentStep,
                        total: files.length,
                        label,
                      }),
                )
              },
              {
                maxFileSizeBytes: opfsAvailable ? undefined : MAX_FILE_SIZE,
                argon2MemoryMb:
                  mode === 'encrypt' ? securityProfile.memoryMb : undefined,
                argon2Iterations:
                  mode === 'encrypt' ? ARGON2_FILE_ITERATIONS : undefined,
                keyFile:
                  mode === 'encrypt'
                    ? useKeyFile
                      ? keyFile
                      : null
                    : keyFile,
                recoverable:
                  mode === 'encrypt' ? useRecoverableParity : undefined,
                signal: abortControllerRef.current.signal,
              },
            )

          const nextPreview =
            mode === 'decrypt'
              ? getUniversalPreviewMetadata(blob.type, downloadName, blob.size)
              : ({ kind: 'none', label: t('common.file') } as PreviewMetadata)

          if (mode === 'decrypt' && import.meta.env.DEV) {
            console.debug('[CriptoVéu][preview]', {
              originalFileName: downloadName,
              manifestMimeType: manifestMimeType ?? blob.type,
              recoveredBlobType: blob.type,
              fileSize: blob.size,
              previewKind: nextPreview.kind,
              reason: nextPreview.reason ?? null,
            })
          }

          processedResult = {
            id: `${downloadName}-${index}-${blob.size}`,
            name: downloadName,
            blob,
            size: blob.size,
            sourceName: currentFile.name,
            preview: nextPreview,
            securityReport,
            savedWithSuccess: false,
            savedToDocuments: false,
            nativePath: null,
            dispose,
          }
          if (mode === 'encrypt') {
            setStatus({
              tone: 'info',
              message: t('files.workspace.status.packageReady'),
            })
            if (supportsNativeFileExport()) {
              await handleDownloadResult(processedResult, setProgress, {
                action: 'saveEncryptedFile',
                trigger: 'process-success',
                userInitiated: false,
                previewMode: false,
              })
            } else {
              savePending = true
            }
          }

          await incrementStats(1, currentFile.size, mode)

          processedResults.push(processedResult)
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            if (processedResult) {
              saveCancelled = true
              processedResults.push(processedResult)
              setStatus({
                tone: 'info',
                message: t('files.workspace.status.saveCancelled'),
              })
              continue
            }
            throw error
          }
          if (processedResult) {
            await processedResult.dispose?.()
          }
          failures.push(
            `${currentFile.name}: ${
              error instanceof Error
                ? error.message
              : t('files.workspace.status.unexpectedFileFailure')
            }`,
          )
          setProgressLabel(
            t('files.workspace.status.processingFailedAt', {
              defaultValue: 'Falha durante processamento local em {{progress}}% — {{stage}}',
              progress,
              stage: progressLabel,
            }),
          )
        }
      }

      resultCleanupRef.current = processedResults.flatMap((result) =>
        result.dispose ? [result.dispose] : [],
      )
      setResults(processedResults)
      setPreviewItem(null)

      if (processedResults.length === 0) {
        setProgressLabel(
          t('files.workspace.status.processingFailedAt', {
            defaultValue: 'Falha durante processamento local em {{progress}}% — {{stage}}',
            progress,
            stage: progressLabel,
          }),
        )
        setStatus({
          tone: 'error',
          message: failures[0] ?? t('files.workspace.status.noSuccessfulFiles'),
        })
        return
      }

      const previewableResults = processedResults.filter(
        (result) => result.preview.kind !== 'none',
      )

      setProgress(100)
      setProgressLabel(
        processedResults.length === 1
          ? t('files.workspace.status.processCompleted_one')
          : t('files.workspace.status.processCompleted_other', {
              count: processedResults.length,
            }),
      )
      setStatus({
        tone: saveCancelled || savePending ? 'info' : failures.length > 0 ? 'error' : 'success',
        message:
          saveCancelled
            ? t('files.workspace.status.saveCancelled')
            : savePending
              ? t('files.workspace.status.packageReady')
            : mode === 'encrypt'
            ? failures.length > 0
              ? `${t('files.workspace.status.encryptedWithFailures', {
                  processed: processedResults.length,
                  failures: failures.length,
                })} ${t('files.workspace.status.failureDetail', {
                  detail: failures[0],
                })}`
              : t('files.workspace.status.encryptedSuccess', {
                  count: processedResults.length,
                })
            : failures.length > 0
              ? `${t('files.workspace.status.decryptedWithFailures', {
                  processed: processedResults.length,
                  failures: failures.length,
                })} ${t('files.workspace.status.failureDetail', {
                  detail: failures[0],
                })}`
              : previewableResults.length > 0
                ? t('files.workspace.status.decryptedWithPreviews', {
                    processed: processedResults.length,
                    previews: previewableResults.length,
                  })
                : t('files.workspace.status.decryptedSuccess', {
                    count: processedResults.length,
                  }),
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('files.workspace.status.unexpectedProcessingError')
      if (import.meta.env.DEV) {
        console.error('[CriptoVéu][ui]', {
          stage: progressLabel,
          file: files[0]?.name ?? null,
          size: totalSelectedSize,
          progress,
          chunkIndex: null,
          error,
        })
      }
      setProgressLabel(
        t('files.workspace.status.processingFailedAt', {
          defaultValue: 'Falha durante processamento local em {{progress}}% — {{stage}}',
          progress,
          stage: progressLabel,
        }),
      )
      setStatus({
        tone: 'error',
        message: errorMessage,
      })
    } finally {
      abortControllerRef.current = null
      setIsProcessing(false)
    }
  }

  function handleCancel() {
    abortControllerRef.current?.abort()
    setIsProcessing(false)
    setProgressLabel(t('files.workspace.status.cancelled'))
    setStatus({ tone: 'info', message: t('files.workspace.status.cancelled') })
  }

  const StatusIcon = isProcessing
    ? LoaderCircle
    : status.tone === 'success'
      ? CheckCircle2
      : status.tone === 'error'
        ? AlertCircle
        : Sparkles

  return (
    <>
      {exportNotice ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-xl items-start gap-3 rounded-[24px] border border-cyan-300/30 bg-zinc-950/95 p-4 text-sm text-cyan-50 shadow-2xl shadow-black/30 backdrop-blur"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          <p className="min-w-0 flex-1 leading-6">{exportNotice}</p>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            className="shrink-0 rounded-full p-1 text-cyan-100/70 transition hover:bg-white/10 hover:text-white"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      <div className="grid min-w-0 gap-5 overflow-hidden pb-28 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:pb-0">
        <section className="panel-surface min-w-0 rounded-[32px] p-5 sm:p-6">
          <div className="space-y-5">
            <SegmentedMode
              label={t('common.mode')}
              value={mode}
              onChange={handleModeChange}
              options={[
                {
                  value: 'encrypt',
                  label: t('files.workspace.tabs.encrypt'),
                  icon: <Lock className="h-4 w-4" />,
                },
                {
                  value: 'decrypt',
                  label: t('files.workspace.tabs.decrypt'),
                  icon: <Unlock className="h-4 w-4" />,
                },
              ]}
            />

            <div className="surface-primary rounded-[28px] p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-100/80">
                    {t(`files.workspace.activeEyebrow.${mode}`)}
                  </p>
                  <h2 className="mt-2 break-words text-2xl font-semibold text-white">
                    {t(currentMode.title)}
                  </h2>
                  <p className="mt-3 break-words text-sm leading-7 text-zinc-300">
                    {t(currentMode.description)}
                  </p>
                </div>
                <div className="icon-chip shrink-0 p-3">
                  {mode === 'encrypt' ? <Lock className="h-6 w-6" /> : <Unlock className="h-6 w-6" />}
                </div>
              </div>
            </div>

            <div className="surface-technical rounded-[24px] p-4 text-sm leading-7 text-zinc-300">
              <p>{t('files.workspace.localCopy.primary')}</p>
              <p className="mt-2 text-zinc-400">{t('files.workspace.localCopy.secondary')}</p>
            </div>

            <label
              htmlFor={fileInputId}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`group relative flex cursor-pointer flex-col gap-4 rounded-[28px] border border-dashed p-5 transition sm:p-6 ${
                isDragging
                  ? 'border-cyan-300 bg-cyan-300/10'
                  : 'border-white/15 bg-white/[0.035] hover:border-cyan-400/40 hover:bg-white/[0.06]'
              }`}
            >
              <input
                id={fileInputId}
                type="file"
                className="hidden"
                multiple
                accept={mode === 'decrypt' ? '*/*' : undefined}
                onChange={handleFileInputChange}
              />

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="icon-chip p-3 transition group-hover:scale-105">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-medium text-white">
                      {t('files.workspace.upload.dropTitle')}
                    </p>
                    <p className="mt-1 text-sm text-zinc-400">{t(currentMode.hint)}</p>
                  </div>
                </div>

                <span className="btn-secondary">
                  {t('files.workspace.upload.choose')}
                </span>
              </div>

              <div className="surface-technical rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-zinc-100">
                      <FileArchive className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
                        {t('files.workspace.upload.selectedTitle')}
                      </p>
                      <p className="mt-2 text-sm font-medium text-white">
                        {files.length > 0
                          ? files.length === 1
                            ? t('files.workspace.upload.filesReady_one')
                            : t('files.workspace.upload.filesReady_other')
                          : t('files.workspace.upload.noFiles')}
                      </p>
                      {files.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {files.slice(0, 4).map((selectedFile) => (
                            <div
                              key={`${selectedFile.name}-${selectedFile.size}-${selectedFile.lastModified}`}
                              className="flex items-center justify-between gap-3 text-xs text-zinc-400"
                            >
                              <span className="truncate">{selectedFile.name}</span>
                              <span className="shrink-0 font-mono uppercase tracking-[0.2em] text-zinc-500">
                                {formatFileSize(selectedFile.size)}
                              </span>
                            </div>
                          ))}

                          {files.length > 4 ? (
                            <p className="text-xs text-zinc-500">
                              {t('files.workspace.upload.additionalFiles', {
                                count: files.length - 4,
                              })}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <p className="shrink-0 font-mono text-xs uppercase tracking-[0.2em] text-zinc-400">
                    {files.length > 0 ? formatFileSize(totalSelectedSize) : '0 B'}
                  </p>
                </div>
              </div>
            </label>

            {files.length > 0 && hasStorageWarning ? (
              <div className="flex items-start gap-3 rounded-[24px] border border-amber-400/25 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  {t('files.workspace.status.storageSpaceWarning', {
                    size: formatFileSize(
                      Math.ceil(totalSelectedSize * STORAGE_RESERVE_MULTIPLIER),
                    ),
                  })}
                </p>
              </div>
            ) : null}

            {mode === 'decrypt' && files.length > 0 ? (
              <section className="surface-primary rounded-[28px] p-5">
                <div className="flex items-start gap-3">
                  <div className="icon-chip p-2.5">
                    <FileSearch className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {t('files.workspace.inspector.title')}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-zinc-400">
                      {t('files.workspace.inspector.helper')}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {files.slice(0, 4).map((selectedFile, fileIndex) => {
                    const inspection =
                      packageInspections[
                        getFileIdentity(selectedFile, fileIndex)
                      ]
                    const statusClass =
                      !inspection
                        ? 'border-cyan-400/20 bg-cyan-400/[0.06]'
                        : inspection.status === 'plausible'
                        ? 'border-emerald-400/20 bg-emerald-400/[0.06]'
                        : inspection.status === 'legacy'
                          ? 'border-amber-400/20 bg-amber-400/[0.06]'
                          : 'border-rose-400/20 bg-rose-400/[0.06]'

                    return (
                      <div
                        key={getFileIdentity(selectedFile, fileIndex)}
                        className={`rounded-[20px] border p-4 ${statusClass}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="break-all text-sm font-medium text-white">
                            {selectedFile.name}
                          </p>
                          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-zinc-300">
                            {inspection
                              ? t(
                                  `files.workspace.inspector.status.${inspection.status}`,
                                )
                              : t('files.workspace.inspector.checking')}
                          </span>
                        </div>

                        {inspection ? (
                          <>
                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-500">
                              <span>
                                {t('files.workspace.inspector.format', {
                                  format: inspection.format,
                                })}
                              </span>
                              {inspection.memoryMb !== null ? (
                                <span>
                                  {t('files.workspace.inspector.memory', {
                                    memory: inspection.memoryMb,
                                  })}
                                </span>
                              ) : null}
                              {inspection.observedChunkCount !== null ? (
                                <span>
                                  {t('files.workspace.inspector.blocks', {
                                    count: inspection.observedChunkCount,
                                  })}
                                </span>
                              ) : null}
                              {inspection.manifestPresent !== null ? (
                                <span>
                                  {inspection.manifestPresent
                                    ? t(
                                        'files.workspace.inspector.manifestPresent',
                                      )
                                    : t(
                                        'files.workspace.inspector.manifestAbsent',
                                      )}
                                </span>
                              ) : null}
                              {inspection.keyFileRequired ? (
                                <span className="font-medium text-amber-200">
                                  {t(
                                    'files.workspace.inspector.keyFileRequired',
                                  )}
                                </span>
                              ) : null}
                            </div>
                          </>
                        ) : (
                          <p className="mt-2 text-xs text-zinc-500">
                            {isInspectingPackages
                              ? t('files.workspace.inspector.reading')
                              : t('files.workspace.inspector.unavailable')}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            ) : null}

            <div className="surface-primary rounded-[28px] p-5">
              <FieldBlock
                label={t('files.workspace.password.label')}
                htmlFor={passwordInputId}
                helper={t('files.workspace.password.helper')}
              >
                <div className="space-y-3">
                  <PasswordInput
                    id={passwordInputId}
                    value={password}
                    autoComplete="new-password"
                    spellCheck={false}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={
                      mode === 'encrypt'
                        ? t('files.workspace.password.encryptPlaceholder')
                        : t('files.workspace.password.decryptPlaceholder')
                    }
                    className="tool-input w-full"
                  />

                  <p className="text-xs leading-6 text-zinc-500">
                    {t('files.workspace.password.reuseHint')}
                  </p>
                </div>
              </FieldBlock>

              {mode === 'encrypt' ? (
                <PasswordSecurityPanel
                  value={password}
                  onChange={setPassword}
                  context="file"
                  disabled={isProcessing}
                />
              ) : null}
            </div>

            <KeyFileProtectionPanel
              mode={mode}
              enabled={useKeyFile}
              required={packageRequiresKeyFile}
              keyFile={keyFile}
              inputId={keyFileInputId}
              disabled={isProcessing}
              onEnabledChange={(enabled) => {
                setUseKeyFile(enabled)

                if (enabled) {
                  setUseRecoverableParity(false)
                }

                if (!enabled) {
                  setKeyFile(null)
                }
              }}
              onFileChange={handleKeyFileInputChange}
              onClear={() => setKeyFile(null)}
            />

            {mode === 'encrypt' ? (
              <label
                className={`flex gap-3 rounded-[24px] border p-4 text-sm leading-6 transition ${
                  useKeyFile
                    ? 'cursor-not-allowed border-white/10 bg-white/[0.025] text-zinc-500'
                    : 'cursor-pointer border-cyan-400/20 bg-cyan-400/10 text-cyan-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={useRecoverableParity}
                  disabled={isProcessing || useKeyFile}
                  onChange={(event) => setUseRecoverableParity(event.target.checked)}
                  className="mt-1 accent-cyan-400"
                />
                <span>
                  <span className="block font-semibold text-white">
                    {t('files.workspace.recoverableParity.title')}
                  </span>
                  <span className="mt-1 block text-cyan-100/80">
                    {t('files.workspace.recoverableParity.description', {
                      count: 4,
                    })}
                  </span>
                  {useKeyFile ? (
                    <span className="mt-1 block text-xs text-zinc-500">
                      {t('files.workspace.recoverableParity.keyFileUnavailable')}
                    </span>
                  ) : null}
                </span>
              </label>
            ) : null}

            {mode === 'encrypt' ? (
              <AdvancedOptions
                title={t('files.workspace.advanced.title')}
                helper={t('files.workspace.advanced.helper', {
                  memory: securityProfile.memoryMb,
                  iterations: ARGON2_FILE_ITERATIONS,
                })}
              >
                <fieldset className="space-y-3">
                  <legend className="sr-only">{t('files.workspace.advanced.legend')}</legend>

                  {FILE_SECURITY_PROFILES.map((profile) => (
                    <label
                      key={profile.id}
                      className={`block cursor-pointer rounded-2xl border p-4 transition ${
                        securityProfileId === profile.id
                          ? 'border-cyan-400/45 bg-cyan-400/10'
                          : 'border-white/10 bg-white/[0.025] hover:border-white/20'
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="file-security-profile"
                          value={profile.id}
                          checked={securityProfileId === profile.id}
                          disabled={isProcessing}
                          onChange={() => setSecurityProfileId(profile.id)}
                          className="mt-1 accent-cyan-400"
                        />

                        <span>
                          <span className="block text-sm font-medium text-white">
                            {t(`files.workspace.securityProfiles.${profile.id}.label`)}
                          </span>
                          <span className="mt-1 block font-mono text-xs uppercase tracking-[0.2em] text-cyan-200/80">
                            {profile.memoryMb} MB RAM
                          </span>
                          <span className="mt-2 block text-xs leading-6 text-zinc-400">
                            {t(`files.workspace.securityProfiles.${profile.id}.description`)}
                          </span>
                        </span>
                      </span>
                    </label>
                  ))}

                  <p className="pt-2 text-xs leading-6 text-zinc-500">
                    {t('files.workspace.advanced.note')}
                  </p>
                </fieldset>
              </AdvancedOptions>
            ) : null}

            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <button
                  type="button"
                  onClick={isProcessing ? handleCancel : handleProcess}
                  disabled={
                    files.length === 0 ||
                    !password ||
                    (keyFileIsRequired && !keyFile) ||
                    isProcessing ||
                    !canUseSecureProcessing
                  }
                  className="btn-primary hidden lg:inline-flex"
                >
                  {isProcessing ? (
                    <X className="h-4 w-4" />
                  ) : mode === 'encrypt' ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <Unlock className="h-4 w-4" />
                  )}
                  {isProcessing ? t('common.cancel') : t(currentMode.action)}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadAll}
                  disabled={results.length === 0}
                  className="btn-secondary"
                >
                  <Download className="h-4 w-4" />
                  {t('common.downloadAll')}
                </button>
              </div>

              <div className="flex flex-col gap-2 text-xs leading-6 text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
                <p>{t('files.workspace.password.keepPassword')}</p>
                <p>
                  {results.length === 0
                    ? t('files.workspace.results.downloadAllDisabledHint')
                    : t('files.workspace.results.downloadAllHint')}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="min-w-0 space-y-5 overflow-hidden">
          <section className="surface-secondary min-w-0 rounded-[28px] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">
                  {t('files.workspace.quickGuide.eyebrow')}
                </p>
                <p className="mt-2 text-sm font-medium text-white">
                  {t('files.workspace.quickGuide.title')}
                </p>
              </div>
              <div className="icon-chip p-2">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {quickFacts.map((item) => (
                <div key={item.label} className="surface-technical rounded-[20px] p-3.5">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">{item.label}</p>
                  <p className="mt-2 text-sm font-medium text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="surface-primary min-w-0 overflow-hidden rounded-[28px] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-zinc-300">{t('files.workspace.progress.title')}</span>
              <span className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-400">
                {progress}%
              </span>
            </div>

            <progress
              className="criptoveu-progress mt-3"
              value={progress}
              max={100}
              aria-label={t('files.workspace.progress.aria')}
            />

            <p className="mt-3 text-xs uppercase tracking-[0.28em] text-zinc-500">{progressLabel}</p>

            <div
              role="status"
              aria-live="polite"
              className={`mt-5 rounded-[24px] border p-4 text-sm ${STATUS_STYLES[status.tone]}`}
            >
              <div className="flex items-start gap-3">
                <StatusIcon className={`mt-0.5 h-5 w-5 shrink-0 ${isProcessing ? 'animate-spin' : ''}`} />
                <p className="leading-6">{status.message}</p>
              </div>
            </div>

            {!canUseSecureProcessing ? (
              <div className="mt-4 rounded-[24px] border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-100">
                {t('files.workspace.status.secureContextShort')}
              </div>
            ) : null}
          </section>
          <div ref={resultPanelRef} className="min-w-0 overflow-hidden">
            <ResultPanel
            title={t('files.workspace.results.title')}
            description={t('files.workspace.results.description')}
            actions={
              results.length > 1 ? (
                <button
                  type="button"
                  onClick={handleDownloadAll}
                  className="btn-secondary w-full sm:w-auto"
                >
                  <Download className="h-4 w-4" />
                  {t('common.downloadAll')}
                </button>
              ) : null
            }
          >
            {results.length === 0 ? (
              <div className="surface-secondary rounded-[24px] p-5 text-sm leading-7 text-zinc-400">
                {t('files.workspace.results.empty')}
              </div>
            ) : null}

            {results.length > 0 ? (
              <div
                className={`min-w-0 space-y-4 overflow-hidden transition duration-300 ${
                  isInactive ? 'cv-privacy-blur' : ''
                }`}
              >
                {results.map((result) => (
                  <article
                    key={result.id}
                    className="surface-technical min-w-0 overflow-hidden rounded-[24px] p-4"
                  >
                    <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="break-words text-xs uppercase tracking-[0.2em] text-zinc-500 sm:tracking-[0.28em]">
                          {mode === 'encrypt'
                            ? t('files.workspace.results.packageGenerated')
                            : result.preview.kind !== 'none'
                              ? t('files.workspace.results.readyToReview', {
                                  label: t(`files.previewKinds.${result.preview.kind}`),
                                })
                              : t('files.workspace.results.fileReady')}
                        </p>
                        <p className="mt-2 break-words text-sm font-semibold text-white">{result.name}</p>
                        <p className="mt-1 break-words text-xs text-zinc-400">
                          {t('files.workspace.results.source', { name: result.sourceName })}
                        </p>
                      </div>

                      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-none lg:auto-cols-max lg:grid-flow-col">
                        {mode === 'decrypt' && result.preview.kind !== 'none' ? (
                          <button
                            type="button"
                            onClick={() => handleOpenPreview(result)}
                            className="btn-secondary w-full"
                          >
                            <Maximize2 className="h-4 w-4" />
                            {t('common.preview')}
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            void saveRecoveredFile(result).catch(handleDownloadFailure)
                          }}
                          className={`btn-secondary w-full ${
                            result.savedWithSuccess
                              ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-100 hover:border-emerald-300/50 hover:bg-emerald-400/15'
                              : ''
                          }`}
                        >
                          {result.savedWithSuccess ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          {result.savedWithSuccess
                            ? supportsNativeFileExport()
                              ? t('files.workspace.results.savedNative')
                              : t('files.workspace.results.saved')
                              : mode === 'encrypt'
                                ? t('files.workspace.status.saveEncryptedFile')
                                : t('files.workspace.status.saveRecoveredFile')}
                        </button>

                        {supportsNativeFileExport() && mode === 'decrypt' ? (
                          <>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                void handleShareResult(result).catch(handleNativeActionFailure)
                              }}
                              className="btn-secondary w-full"
                            >
                              {t('files.workspace.results.share')}
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                void handleOpenExternalResult(result).catch(handleNativeActionFailure)
                              }}
                              className="btn-secondary w-full"
                            >
                              {t('files.workspace.results.openExternal')}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 flex min-w-0 flex-col gap-2 text-xs text-zinc-500 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                      <span>{t('files.workspace.results.fileType', { type: result.blob.type || t('common.file') })}</span>
                      <span>{formatFileSize(result.size)}</span>
                      {mode === 'decrypt' ? (
                        <span>
                          {result.preview.kind !== 'none'
                            ? t('files.workspace.status.previewAvailable')
                            : result.preview.reason === 'too-large'
                              ? t('files.workspace.status.previewTooLarge')
                              : t('files.workspace.status.previewUnavailable')}
                        </span>
                      ) : null}
                      {supportsNativeFileExport() && result.savedWithSuccess ? (
                        <span className="text-emerald-200">
                          {t('files.workspace.results.savedNativeNotice')}
                        </span>
                      ) : null}
                    </div>

                    {mode === 'decrypt' &&
                    result.preview.reason === 'too-large' &&
                    result.preview.limit ? (
                      <div
                        role="alert"
                        className="mt-4 rounded-[20px] border border-amber-400/25 bg-amber-400/10 p-4 text-sm leading-7 text-amber-50"
                      >
                        {t(
                          result.preview.limit === 'mobile'
                            ? 'files.preview.limitExceededAndroid'
                            : 'files.preview.limitExceededDesktop',
                        )}
                      </div>
                    ) : null}

                    <div
                      className={`mt-4 rounded-[20px] border p-4 ${
                        result.securityReport.integrity.status !== 'aead-only'
                          ? 'border-emerald-400/20 bg-emerald-400/[0.06]'
                          : 'border-amber-400/20 bg-amber-400/[0.06]'
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white">
                              {result.securityReport.integrity.status ===
                              'prepared'
                                ? t(
                                    'files.workspace.securityReport.preparedTitle',
                                  )
                                : result.securityReport.integrity.status ===
                                    'verified'
                                ? t(
                                    'files.workspace.securityReport.verifiedTitle',
                                  )
                                : t(
                                    'files.workspace.securityReport.legacyTitle',
                                  )}
                            </p>
                            <p className="mt-1 text-xs leading-6 text-zinc-400">
                              {result.securityReport.integrity.status ===
                              'prepared'
                                ? t(
                                    'files.workspace.securityReport.preparedNote',
                                  )
                                : result.securityReport.integrity.status ===
                                    'verified'
                                  ? t(
                                      'files.workspace.securityReport.verifiedNote',
                                    )
                                  : t(
                                      'files.workspace.securityReport.legacyNote',
                                    )}
                            </p>
                            {result.securityReport.keyFileProtection.required ? (
                              <p className="mt-1 text-xs leading-6 text-amber-100">
                                {t(
                                  'files.workspace.securityReport.keyFileProtection',
                                )}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            void downloadSecurityReport(result)
                          }}
                          className="btn-secondary shrink-0"
                        >
                          <Download className="h-4 w-4" />
                          {t('files.workspace.securityReport.download')}
                        </button>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-zinc-500 sm:grid-cols-2">
                        <span>
                          {t('files.workspace.securityReport.format', {
                            format: result.securityReport.format,
                          })}
                        </span>
                        <span>
                          {t('files.workspace.securityReport.kdf', {
                            kdf: result.securityReport.kdf,
                          })}
                        </span>
                        {result.securityReport.chunkCount !== null ? (
                          <span>
                            {t('files.workspace.securityReport.blocks', {
                              count: result.securityReport.chunkCount,
                            })}
                          </span>
                        ) : null}
                        <span>
                          {t('files.workspace.securityReport.upload')}
                        </span>
                        {result.securityReport.keyFileProtection.required ? (
                          <span>
                            {t(
                              'files.workspace.securityReport.keyFileNotEmbedded',
                            )}
                          </span>
                        ) : null}
                      </div>

                      {result.securityReport.fileHashSha256 ? (
                        <p className="mt-3 break-all font-mono text-[11px] leading-5 text-zinc-500">
                          SHA-256: {result.securityReport.fileHashSha256}
                        </p>
                      ) : null}
                    </div>

                  </article>
                ))}
              </div>
            ) : null}
            </ResultPanel>
          </div>
        </div>
      </div>

      <MobileStickyCTA
        label={isProcessing ? t('common.cancel') : t(currentMode.action)}
        icon={isProcessing ? <X className="h-5 w-5" /> : mode === 'encrypt' ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
        onClick={isProcessing ? handleCancel : handleProcess}
        disabled={
          !isProcessing && (files.length === 0 || !password || (keyFileIsRequired && !keyFile) || !canUseSecureProcessing)
        }
        loading={isProcessing}
      />

      {isPreviewOpen && activePreviewItem && previewUrl && preview.kind !== 'none' ? (
        <div
          ref={previewModalRef}
          className="fixed inset-0 z-[10000] flex min-h-[100dvh] flex-col overflow-y-auto bg-black/95 px-2 backdrop-blur-sm sm:px-4 [&:fullscreen]:h-screen [&:fullscreen]:w-screen [&:fullscreen]:justify-between [&:fullscreen]:bg-black"
          role="dialog"
          aria-modal="true"
          aria-labelledby="recovered-file-preview-title"
          onClick={handlePreviewBackdropClick}
        >
          <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-1 flex-col py-2 sm:py-4">
            <h2 id="recovered-file-preview-title" className="sr-only">
              {t('files.workspace.preview.expandedAria')}
            </h2>
            <UniversalPreview
              url={previewUrl}
              blob={previewBlob ?? activePreviewItem.blob}
              fileName={resultName}
              expanded
              isInactive={isInactive}
              onClose={handleClosePreview}
              onDownload={handleSaveRecoveredFromPreview}
              onShare={
                supportsNativeFileExport()
                  ? () => {
                      if (activePreviewItem) {
                        void handleShareResult(activePreviewItem).catch(handleNativeActionFailure)
                      }
                    }
                  : undefined
              }
              onOpenExternal={
                supportsNativeFileExport()
                  ? () => {
                      if (activePreviewItem) {
                        void handleOpenExternalResult(activePreviewItem).catch(handleNativeActionFailure)
                      }
                    }
                  : undefined
              }
              fullscreenTargetRef={previewModalRef}
              hasPrevious={isImageGallery && currentImageGalleryIndex > 0}
              hasNext={isImageGallery && currentImageGalleryIndex < imageResults.length - 1}
              onPrevious={handlePreviousImage}
              onNext={handleNextImage}
              galleryIndex={isImageGallery ? currentImageGalleryIndex + 1 : undefined}
              galleryTotal={isImageGallery ? imageResults.length : undefined}
            />
          </div>
        </div>
      ) : null}

      {isFileLimitDialogOpen ? (
        <div
          className="fixed inset-0 z-[65] flex items-center justify-center overflow-y-auto bg-black/75 px-4 py-6 backdrop-blur-sm sm:px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="file-limit-dialog-title"
          aria-describedby="file-limit-dialog-description"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label={t('files.workspace.limitDialog.close')}
            onClick={() => setIsFileLimitDialogOpen(false)}
          />

          <div className="panel-surface relative z-10 max-h-[calc(100dvh-3rem)] w-full max-w-xl overflow-y-auto rounded-[30px] p-5 shadow-2xl shadow-black/50 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="hero-badge">
                  <AlertCircle className="h-4 w-4" />
                  {formatFileSize(MAX_FILE_SIZE)}
                </div>
                <h2
                  id="file-limit-dialog-title"
                  className="mt-4 text-2xl font-semibold leading-tight text-white sm:text-3xl"
                >
                  {t('files.workspace.limitDialog.title')}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsFileLimitDialogOpen(false)}
                className="btn-secondary h-10 w-10 shrink-0 rounded-full px-0 py-0"
                aria-label={t('files.workspace.limitDialog.close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p
              id="file-limit-dialog-description"
              className="mt-4 text-sm leading-7 text-zinc-200 sm:text-base"
            >
              {t('files.workspace.limitDialog.description')}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                to="/apoiar"
                onClick={() => setIsFileLimitDialogOpen(false)}
                className="btn-primary w-full"
              >
                <Crown className="h-4 w-4" />
                {t('files.workspace.limitDialog.support')}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => setIsFileLimitDialogOpen(false)}
                className="btn-secondary w-full"
              >
                {t('files.workspace.limitDialog.back')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}








