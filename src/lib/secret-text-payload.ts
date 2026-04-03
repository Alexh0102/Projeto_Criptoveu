import {
  decodeBase64ToBytes,
  encodeBytesToBase64,
  type TextDecryptionInput,
  type TextEncryptionResult,
} from './cryptify'

export const SECRET_TEXT_PAYLOAD_PREFIX = 'CRIPTIFY_SECRET_V1:'
const LEGACY_SECRET_TEXT_PAYLOAD_PREFIXES = ['CRIPTIFY_STEG_V1:']

type SerializedSecretTextPayload = {
  version: 1
  ciphertext: string
  iv: string
  salt: string
}

export class SecretTextPayloadError extends Error {
  code: 'INVALID_PAYLOAD'

  constructor(message: string) {
    super(message)
    this.name = 'SecretTextPayloadError'
    this.code = 'INVALID_PAYLOAD'
  }
}

function resolvePayloadPrefix(payload: string) {
  const allPrefixes = [
    SECRET_TEXT_PAYLOAD_PREFIX,
    ...LEGACY_SECRET_TEXT_PAYLOAD_PREFIXES,
  ]

  return allPrefixes.find((prefix) => payload.startsWith(prefix)) ?? null
}

export function serializeEncryptedTextPayload(payload: TextEncryptionResult) {
  const serialized: SerializedSecretTextPayload = {
    version: 1,
    ciphertext: payload.ciphertext,
    iv: encodeBytesToBase64(payload.iv),
    salt: encodeBytesToBase64(payload.salt),
  }

  return `${SECRET_TEXT_PAYLOAD_PREFIX}${JSON.stringify(serialized)}`
}

export function parseEncryptedTextPayload(payload: string): TextDecryptionInput {
  const prefix = resolvePayloadPrefix(payload)

  if (!prefix) {
    throw new SecretTextPayloadError(
      'Os dados lidos não pertencem a uma mensagem reconhecida pelo CriptoVéu.',
    )
  }

  let parsed: Partial<SerializedSecretTextPayload>

  try {
    parsed = JSON.parse(payload.slice(prefix.length)) as Partial<SerializedSecretTextPayload>
  } catch {
    throw new SecretTextPayloadError(
      'Os dados da mensagem estão corrompidos ou incompletos.',
    )
  }

  if (
    parsed.version !== 1 ||
    typeof parsed.ciphertext !== 'string' ||
    typeof parsed.iv !== 'string' ||
    typeof parsed.salt !== 'string'
  ) {
    throw new SecretTextPayloadError(
      'Os dados da mensagem não estão no formato esperado.',
    )
  }

  return {
    ciphertext: parsed.ciphertext,
    iv: decodeBase64ToBytes(parsed.iv),
    salt: decodeBase64ToBytes(parsed.salt),
  }
}



