import { useCallback, useState } from 'react'

import {
  decryptFile,
  encryptFile,
  MAX_FILE_SIZE,
  MAX_FILE_PACKAGE_OVERHEAD_BYTES,
  MAX_FILE_SIZE_EXCEEDED_MESSAGE,
  supportsOpfsCrypto,
  type FileEncryptionOptions,
  type ProcessResult,
} from '../lib/criptoveu'
import {
  formatMegabytes,
  getBatchCryptoConcurrency,
  isMobileOrTouchEnvironment,
  runBatchCryptoQueue,
  validateBatchFileSelection,
  type BatchCryptoQueueOptions,
  type BatchFileValidationResult,
  type TransientCryptoMemoryScope,
} from '../lib/file-crypto/batch-queue'

export {
  formatMegabytes,
  getBatchCryptoConcurrency,
  getMaxSingleFileBytes,
  getMaxTotalBytes,
  getPlatformType,
  isMobileOrTouchEnvironment,
  runBatchCryptoQueue,
  validateBatchFileSelection,
  type BatchCryptoQueueOptions,
  type BatchFileValidationResult,
  type PlatformType,
  type TransientCryptoMemoryScope,
}

type StreamingCryptoMode = 'encrypt' | 'decrypt'

type StreamingCryptoProgress = {
  value: number
  label: string
}

export function useStreamingCrypto() {
  const [progress, setProgress] = useState<StreamingCryptoProgress>({
    value: 0,
    label: 'Pronto para processar',
  })
  const [isProcessing, setIsProcessing] = useState(false)

  const processFile = useCallback(
    async (
      mode: StreamingCryptoMode,
      file: File,
      password: string,
      onProgress?: (value: number, label: string) => void,
      options?: FileEncryptionOptions,
    ): Promise<ProcessResult> => {
      const maxAllowedBytes = supportsOpfsCrypto()
        ? null
        : mode === 'decrypt'
          ? MAX_FILE_SIZE + MAX_FILE_PACKAGE_OVERHEAD_BYTES
          : MAX_FILE_SIZE

      if (maxAllowedBytes !== null && file.size > maxAllowedBytes) {
        throw new Error(MAX_FILE_SIZE_EXCEEDED_MESSAGE)
      }

      const operation = mode === 'encrypt' ? encryptFile : decryptFile

      setIsProcessing(true)

      try {
        return await operation(
          file,
          password,
          (value, label) => {
            setProgress({ value, label })
            onProgress?.(value, label)
          },
          options,
        )
      } finally {
        setIsProcessing(false)
      }
    },
    [],
  )

  const resetProgress = useCallback((label = 'Pronto para processar') => {
    setProgress({ value: 0, label })
  }, [])

  return {
    isProcessing,
    progress,
    processFile,
    resetProgress,
    setProgress,
  }
}
