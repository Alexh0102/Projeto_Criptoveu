import jsQR from 'jsqr'

import { parseEncryptedTextPayload } from './secret-text-payload'

export const MAX_QR_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
export const QR_SECRET_HASH_PREFIX = '#qr='
export const QR_SECRET_ROUTE_PATH = '/qr-secreto'

export class QRCodeSecretError extends Error {
  code:
    | 'INVALID_IMAGE'
    | 'IMAGE_TOO_LARGE'
    | 'QR_NOT_FOUND'
    | 'INVALID_QR_CONTENT'
    | 'CANVAS_UNAVAILABLE'

  constructor(
    code:
      | 'INVALID_IMAGE'
      | 'IMAGE_TOO_LARGE'
      | 'QR_NOT_FOUND'
      | 'INVALID_QR_CONTENT'
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

function assertSecretPayload(payload: string) {
  parseEncryptedTextPayload(payload)
  return payload
}

export function buildSecretQrUrl(
  secretPayload: string,
  origin = typeof window !== 'undefined' ? window.location.origin : '',
) {
  const normalizedOrigin = origin.replace(/\/$/, '')
  return `${normalizedOrigin}${QR_SECRET_ROUTE_PATH}${QR_SECRET_HASH_PREFIX}${encodeURIComponent(secretPayload)}`
}

export function readSecretPayloadFromQrHash(hash: string) {
  if (!hash || !hash.startsWith(QR_SECRET_HASH_PREFIX)) {
    return null
  }

  const rawValue = hash.slice(QR_SECRET_HASH_PREFIX.length)

  if (!rawValue) {
    throw new QRCodeSecretError(
      'INVALID_QR_CONTENT',
      'A URL aberta pelo QR não contém uma mensagem protegida válida.',
    )
  }

  return assertSecretPayload(decodeURIComponent(rawValue))
}

export function readSecretPayloadFromQrInput(value: string) {
  const normalizedValue = value.trim()

  if (!normalizedValue) {
    throw new QRCodeSecretError(
      'INVALID_QR_CONTENT',
      'O conteúdo do QR está vazio ou incompleto.',
    )
  }

  if (normalizedValue.startsWith(QR_SECRET_HASH_PREFIX)) {
    const payloadFromHash = readSecretPayloadFromQrHash(normalizedValue)

    if (!payloadFromHash) {
      throw new QRCodeSecretError(
        'INVALID_QR_CONTENT',
        'Esse QR Code não contém uma mensagem protegida válida.',
      )
    }

    return payloadFromHash
  }

  if (normalizedValue.startsWith('http://') || normalizedValue.startsWith('https://')) {
    let parsedUrl: URL

    try {
      parsedUrl = new URL(normalizedValue)
    } catch {
      throw new QRCodeSecretError(
        'INVALID_QR_CONTENT',
        'O conteúdo lido do QR não está em um formato de URL válido.',
      )
    }

    const payloadFromHash = readSecretPayloadFromQrHash(parsedUrl.hash)

    if (!payloadFromHash) {
      throw new QRCodeSecretError(
        'INVALID_QR_CONTENT',
        'Esse QR Code não aponta para uma mensagem protegida válida do CriptoVéu.',
      )
    }

    return payloadFromHash
  }

  return assertSecretPayload(normalizedValue)
}
