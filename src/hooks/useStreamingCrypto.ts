import { useCallback, useState } from 'react'

import {
  decryptFile,
  encryptFile,
  type ProcessResult,
} from '../lib/criptoveu'

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
    ): Promise<ProcessResult> => {
      const operation = mode === 'encrypt' ? encryptFile : decryptFile

      setIsProcessing(true)

      try {
        return await operation(file, password, (value, label) => {
          setProgress({ value, label })
          onProgress?.(value, label)
        })
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
