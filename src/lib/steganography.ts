export const MAX_STEG_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
export const STEGANOGRAPHY_PAYLOAD_PREFIX = 'CRIPTIFY_STEG_V1:'

const HEADER_SIZE_BYTES = 4
const HEADER_SIZE_BITS = HEADER_SIZE_BYTES * 8

export class SteganographyError extends Error {
  code:
    | 'INVALID_IMAGE'
    | 'IMAGE_TOO_LARGE'
    | 'IMAGE_TOO_SMALL'
    | 'INVALID_MESSAGE'
    | 'INVALID_PAYLOAD'
    | 'CANVAS_UNAVAILABLE'

  constructor(
    code:
      | 'INVALID_IMAGE'
      | 'IMAGE_TOO_LARGE'
      | 'IMAGE_TOO_SMALL'
      | 'INVALID_MESSAGE'
      | 'INVALID_PAYLOAD'
      | 'CANVAS_UNAVAILABLE',
    message: string,
  ) {
    super(message)
    this.name = 'SteganographyError'
    this.code = code
  }
}

function assertSupportedImage(file: File | Blob) {
  if (file.size > MAX_STEG_IMAGE_SIZE_BYTES) {
    throw new SteganographyError(
      'IMAGE_TOO_LARGE',
      `A imagem excede o limite de ${Math.round(
        MAX_STEG_IMAGE_SIZE_BYTES / (1024 * 1024),
      )} MB para esteganografia.`,
    )
  }

  if ('type' in file && file.type && !/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
    throw new SteganographyError(
      'INVALID_IMAGE',
      'Use uma imagem PNG ou JPG para esconder ou revelar a mensagem.',
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
          new SteganographyError(
            'INVALID_IMAGE',
            'Não foi possível ler a imagem enviada. Tente outro arquivo.',
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

async function readImageData(file: File | Blob) {
  assertSupportedImage(file)
  const image = await loadImageElement(file)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')

  if (!context) {
    throw new SteganographyError(
      'CANVAS_UNAVAILABLE',
      'O navegador não conseguiu inicializar o canvas para processar a imagem.',
    )
  }

  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  context.drawImage(image, 0, 0)

  return {
    canvas,
    context,
    imageData: context.getImageData(0, 0, canvas.width, canvas.height),
  }
}

function buildPayloadBytes(message: string) {
  const messageBytes = new TextEncoder().encode(message)

  if (!messageBytes.length) {
    throw new SteganographyError(
      'INVALID_MESSAGE',
      'Não existe mensagem para esconder na imagem.',
    )
  }

  const payload = new Uint8Array(HEADER_SIZE_BYTES + messageBytes.length)
  const view = new DataView(payload.buffer)

  // Header de 32 bits com o tamanho da mensagem em bytes.
  view.setUint32(0, messageBytes.length, false)
  payload.set(messageBytes, HEADER_SIZE_BYTES)

  return payload
}

function getBitFromByteArray(bytes: Uint8Array, bitIndex: number) {
  const byteIndex = Math.floor(bitIndex / 8)
  const bitOffset = 7 - (bitIndex % 8)

  return (bytes[byteIndex] >> bitOffset) & 1
}

function setByteBit(target: Uint8Array, bitIndex: number, bitValue: number) {
  const byteIndex = Math.floor(bitIndex / 8)
  const bitOffset = 7 - (bitIndex % 8)

  if (bitValue === 1) {
    target[byteIndex] |= 1 << bitOffset
    return
  }

  target[byteIndex] &= ~(1 << bitOffset)
}

function forEachRgbChannel(
  data: Uint8ClampedArray,
  callback: (channelIndex: number) => boolean | void,
) {
  for (let offset = 0; offset < data.length; offset += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const shouldStop = callback(offset + channel)

      if (shouldStop === true) {
        return
      }
    }
  }
}

async function canvasToPngBlob(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), 'image/png')
  })

  if (!blob) {
    throw new SteganographyError(
      'CANVAS_UNAVAILABLE',
      'Não foi possível gerar a imagem secreta. Tente novamente.',
    )
  }

  return blob
}

export async function hideMessageInImage(
  sourceImage: File,
  message: string,
): Promise<Blob> {
  const { canvas, context, imageData } = await readImageData(sourceImage)
  const payload = buildPayloadBytes(message)
  const capacityBits = (imageData.data.length / 4) * 3
  const requiredBits = payload.length * 8

  if (requiredBits > capacityBits) {
    throw new SteganographyError(
      'IMAGE_TOO_SMALL',
      'Imagem pequena demais para essa mensagem. Tente uma imagem maior ou um texto menor.',
    )
  }

  let bitIndex = 0

  forEachRgbChannel(imageData.data, (channelIndex) => {
    if (bitIndex >= requiredBits) {
      return true
    }

    const bit = getBitFromByteArray(payload, bitIndex)
    imageData.data[channelIndex] = (imageData.data[channelIndex] & 0b11111110) | bit
    bitIndex += 1
    return false
  })

  context.putImageData(imageData, 0, 0)
  return canvasToPngBlob(canvas)
}

export async function extractMessageFromImage(sourceImage: File): Promise<string> {
  const { imageData } = await readImageData(sourceImage)
  const capacityBits = (imageData.data.length / 4) * 3

  if (capacityBits < HEADER_SIZE_BITS) {
    throw new SteganographyError(
      'INVALID_PAYLOAD',
      'A imagem é pequena demais para conter uma mensagem oculta válida.',
    )
  }

  const headerBytes = new Uint8Array(HEADER_SIZE_BYTES)
  let bitIndex = 0

  forEachRgbChannel(imageData.data, (channelIndex) => {
    if (bitIndex >= HEADER_SIZE_BITS) {
      return true
    }

    const bit = imageData.data[channelIndex] & 1
    setByteBit(headerBytes, bitIndex, bit)
    bitIndex += 1
    return false
  })

  const payloadLength = new DataView(headerBytes.buffer).getUint32(0, false)
  const payloadBits = payloadLength * 8

  if (!payloadLength || HEADER_SIZE_BITS + payloadBits > capacityBits) {
    throw new SteganographyError(
      'INVALID_PAYLOAD',
      'Nenhuma mensagem válida foi encontrada nesta imagem.',
    )
  }

  const payloadBytes = new Uint8Array(payloadLength)
  let currentPayloadBitIndex = 0
  let consumedBits = 0

  forEachRgbChannel(imageData.data, (channelIndex) => {
    if (consumedBits < HEADER_SIZE_BITS) {
      consumedBits += 1
      return false
    }

    if (currentPayloadBitIndex >= payloadBits) {
      return true
    }

    const bit = imageData.data[channelIndex] & 1
    setByteBit(payloadBytes, currentPayloadBitIndex, bit)
    currentPayloadBitIndex += 1
    return false
  })

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(payloadBytes)
  } catch {
    throw new SteganographyError(
      'INVALID_PAYLOAD',
      'A imagem não contém uma mensagem compatível com o Arcasilo.',
    )
  }
}





