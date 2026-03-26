import jsQR from 'jsqr'

export const MAX_QR_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

export class QRCodeSecretError extends Error {
  code:
    | 'INVALID_IMAGE'
    | 'IMAGE_TOO_LARGE'
    | 'QR_NOT_FOUND'
    | 'CANVAS_UNAVAILABLE'

  constructor(
    code:
      | 'INVALID_IMAGE'
      | 'IMAGE_TOO_LARGE'
      | 'QR_NOT_FOUND'
      | 'CANVAS_UNAVAILABLE',
    message: string,
  ) {
    super(message)
    this.name = 'QRCodeSecretError'
    this.code = code
  }
}

function assertSupportedQrImage(file: File | Blob) {
  if (file.size > MAX_QR_IMAGE_SIZE_BYTES) {
    throw new QRCodeSecretError(
      'IMAGE_TOO_LARGE',
      `A imagem do QR excede o limite de ${Math.round(
        MAX_QR_IMAGE_SIZE_BYTES / (1024 * 1024),
      )} MB.`,
    )
  }

  if ('type' in file && file.type && !file.type.startsWith('image/')) {
    throw new QRCodeSecretError(
      'INVALID_IMAGE',
      'Envie uma imagem válida para ler o QR Code.',
    )
  }
}

async function loadImageElement(file: File | Blob) {
  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()

      element.onload = () => resolve(element)
      element.onerror = () => {
        reject(
          new QRCodeSecretError(
            'INVALID_IMAGE',
            'Não foi possível abrir a imagem do QR Code.',
          ),
        )
      }
      element.src = objectUrl
    })

    return image
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function readQrImageData(file: File | Blob) {
  assertSupportedQrImage(file)
  const image = await loadImageElement(file)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })

  if (!context) {
    throw new QRCodeSecretError(
      'CANVAS_UNAVAILABLE',
      'O navegador não conseguiu preparar o canvas para ler o QR Code.',
    )
  }

  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  context.drawImage(image, 0, 0)

  return context.getImageData(0, 0, canvas.width, canvas.height)
}

export async function extractSecretPayloadFromQrImage(file: File | Blob) {
  const imageData = await readQrImageData(file)
  const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  })

  if (!decoded?.data?.trim()) {
    throw new QRCodeSecretError(
      'QR_NOT_FOUND',
      'Nenhum QR Code válido foi encontrado na imagem enviada.',
    )
  }

  return decoded.data.trim()
}


