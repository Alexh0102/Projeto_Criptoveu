import { useState } from 'react'
import QRCode from 'qrcode'

type UseSecretQrCodeOptions = {
  size?: number
  margin?: number
  downloadFileName?: string
}

export function useSecretQrCode(options: UseSecretQrCodeOptions = {}) {
  const {
    size = 300,
    margin = 1,
    downloadFileName = 'qr-protegido.png',
  } = options
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generateQrCode(secretPayload: string) {
    if (!secretPayload.trim()) {
      const nextError = 'Digite um texto antes de gerar o QR protegido.'
      setError(nextError)
      setQrCodeDataUrl(null)
      return null
    }

    setIsGenerating(true)
    setError(null)

    try {
      const nextDataUrl = await QRCode.toDataURL(secretPayload, {
        errorCorrectionLevel: 'M',
        margin,
        width: size,
        color: {
          dark: '#0B1220',
          light: '#F8FAFC',
        },
      })

      setQrCodeDataUrl(nextDataUrl)
      return nextDataUrl
    } catch {
      const nextError =
        'Não foi possível gerar o QR desta mensagem. Tente novamente.'
      setError(nextError)
      setQrCodeDataUrl(null)
      return null
    } finally {
      setIsGenerating(false)
    }
  }

  function clearQrCode() {
    setQrCodeDataUrl(null)
    setError(null)
  }

  function downloadQrCode(fileName = downloadFileName) {
    if (!qrCodeDataUrl) {
      return
    }

    const anchor = document.createElement('a')
    anchor.href = qrCodeDataUrl
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  }

  return {
    qrCodeDataUrl,
    isGenerating,
    error,
    generateQrCode,
    clearQrCode,
    downloadQrCode,
  }
}




