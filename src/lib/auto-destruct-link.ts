import {
  decodeBase64ToBytes,
  encodeBytesToBase64,
  type TextDecryptionInput,
  type TextEncryptionResult,
} from './cryptify'

export const AUTO_DESTRUCT_APP_URL = 'https://projeto-criptify.vercel.app'
const AUTO_DESTRUCT_HASH_PREFIX = '#msg='
const AUTO_DESTRUCT_STORAGE_PREFIX = 'criptify:auto-destruct:'

export type AutoDestructExpiration = '24h' | '7d' | 'never'

export type AutoDestructPayload = {
  version: 1
  ciphertext: string
  iv: string
  salt: string
  createdAt: number
  expiresIn: AutoDestructExpiration
  maxViews: number | null
}

export type AutoDestructReadResult = {
  encodedPayload: string
  payload: AutoDestructPayload
}

export type AutoDestructViewState = {
  views: number
  lastOpenedAt: number | null
}

export class AutoDestructLinkError extends Error {
  code:
    | 'INVALID_LINK'
    | 'INVALID_PAYLOAD'
    | 'EXPIRED'
    | 'STORAGE_UNAVAILABLE'

  constructor(
    code:
      | 'INVALID_LINK'
      | 'INVALID_PAYLOAD'
      | 'EXPIRED'
      | 'STORAGE_UNAVAILABLE',
    message: string,
  ) {
    super(message)
    this.name = 'AutoDestructLinkError'
    this.code = code
  }
}

function encodeJsonToBase64(value: unknown) {
  const json = JSON.stringify(value)
  return encodeBytesToBase64(new TextEncoder().encode(json))
}

function decodeJsonFromBase64(value: string) {
  try {
    const bytes = decodeBase64ToBytes(value)
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown
  } catch {
    throw new AutoDestructLinkError(
      'INVALID_PAYLOAD',
      'O link da mensagem está corrompido ou incompleto.',
    )
  }
}

function isExpirationValue(value: unknown): value is AutoDestructExpiration {
  return value === '24h' || value === '7d' || value === 'never'
}

function getStorageKey(encodedPayload: string) {
  // Hash simples para não guardar o payload completo na chave do localStorage.
  let hash = 5381

  for (let index = 0; index < encodedPayload.length; index += 1) {
    hash = (hash * 33) ^ encodedPayload.charCodeAt(index)
  }

  const normalized = (hash >>> 0).toString(16).padStart(8, '0')
  return `${AUTO_DESTRUCT_STORAGE_PREFIX}${normalized}`
}

function getExpirationInMs(expiration: AutoDestructExpiration) {
  if (expiration === '24h') {
    return 24 * 60 * 60 * 1000
  }

  if (expiration === '7d') {
    return 7 * 24 * 60 * 60 * 1000
  }

  return null
}

export function getExpirationLabel(expiration: AutoDestructExpiration) {
  if (expiration === '24h') {
    return '24 horas'
  }

  if (expiration === '7d') {
    return '7 dias'
  }

  return 'Nunca'
}

export function serializeAutoDestructPayload(
  encrypted: TextEncryptionResult,
  options: {
    createdAt?: number
    expiresIn: AutoDestructExpiration
    maxViews: number | null
  },
) {
  const payload: AutoDestructPayload = {
    version: 1,
    ciphertext: encrypted.ciphertext,
    iv: encodeBytesToBase64(encrypted.iv),
    salt: encodeBytesToBase64(encrypted.salt),
    createdAt: options.createdAt ?? Date.now(),
    expiresIn: options.expiresIn,
    maxViews: options.maxViews,
  }

  return encodeJsonToBase64(payload)
}

export function parseAutoDestructPayload(encodedPayload: string): AutoDestructPayload {
  const parsed = decodeJsonFromBase64(encodedPayload) as Partial<AutoDestructPayload>

  if (
    parsed.version !== 1 ||
    typeof parsed.ciphertext !== 'string' ||
    typeof parsed.iv !== 'string' ||
    typeof parsed.salt !== 'string' ||
    typeof parsed.createdAt !== 'number' ||
    !isExpirationValue(parsed.expiresIn) ||
    !(parsed.maxViews === null || (typeof parsed.maxViews === 'number' && parsed.maxViews >= 1))
  ) {
    throw new AutoDestructLinkError(
      'INVALID_PAYLOAD',
      'Os dados da mensagem não estão no formato esperado.',
    )
  }

  return {
    version: 1,
    ciphertext: parsed.ciphertext,
    iv: parsed.iv,
    salt: parsed.salt,
    createdAt: parsed.createdAt,
    expiresIn: parsed.expiresIn,
    maxViews: parsed.maxViews,
  }
}

export function payloadToDecryptInput(payload: AutoDestructPayload): TextDecryptionInput {
  return {
    ciphertext: payload.ciphertext,
    iv: decodeBase64ToBytes(payload.iv),
    salt: decodeBase64ToBytes(payload.salt),
  }
}

export function buildAutoDestructLink(encodedPayload: string) {
  return `${AUTO_DESTRUCT_APP_URL}/${AUTO_DESTRUCT_HASH_PREFIX}${encodeURIComponent(encodedPayload)}`
}

export function readAutoDestructPayloadFromHash(hash: string) {
  if (!hash || !hash.startsWith(AUTO_DESTRUCT_HASH_PREFIX)) {
    return null
  }

  const rawValue = hash.slice(AUTO_DESTRUCT_HASH_PREFIX.length)

  if (!rawValue) {
    throw new AutoDestructLinkError(
      'INVALID_LINK',
      'O hash da URL não contém uma mensagem válida.',
    )
  }

  const encodedPayload = decodeURIComponent(rawValue)
  const payload = parseAutoDestructPayload(encodedPayload)

  return {
    encodedPayload,
    payload,
  }
}

export function readAutoDestructPayloadFromInput(value: string): AutoDestructReadResult {
  const normalizedValue = value.trim()

  if (!normalizedValue) {
    throw new AutoDestructLinkError(
      'INVALID_LINK',
      'Cole um link ou o trecho da mensagem antes de continuar.',
    )
  }

  if (normalizedValue.startsWith('#msg=')) {
    const fromHash = readAutoDestructPayloadFromHash(normalizedValue)

    if (!fromHash) {
      throw new AutoDestructLinkError(
        'INVALID_LINK',
        'Não foi possível encontrar uma mensagem válida nesse trecho.',
      )
    }

    return fromHash
  }

  if (normalizedValue.startsWith('http://') || normalizedValue.startsWith('https://')) {
    try {
      const parsedUrl = new URL(normalizedValue)
      const fromHash = readAutoDestructPayloadFromHash(parsedUrl.hash)

      if (!fromHash) {
        throw new AutoDestructLinkError(
          'INVALID_LINK',
          'Esse link não contém uma mensagem válida do Criptify.',
        )
      }

      return fromHash
    } catch (error) {
      if (error instanceof AutoDestructLinkError) {
        throw error
      }

      throw new AutoDestructLinkError(
        'INVALID_LINK',
        'O link informado não é válido.',
      )
    }
  }

  return {
    encodedPayload: normalizedValue,
    payload: parseAutoDestructPayload(normalizedValue),
  }
}

export function getAutoDestructViewState(encodedPayload: string): AutoDestructViewState {
  try {
    const rawValue = window.localStorage.getItem(getStorageKey(encodedPayload))

    if (!rawValue) {
      return {
        views: 0,
        lastOpenedAt: null,
      }
    }

    const parsed = JSON.parse(rawValue) as Partial<AutoDestructViewState>

    return {
      views: typeof parsed.views === 'number' ? parsed.views : 0,
      lastOpenedAt:
        typeof parsed.lastOpenedAt === 'number' ? parsed.lastOpenedAt : null,
    }
  } catch {
    return {
      views: 0,
      lastOpenedAt: null,
    }
  }
}

export function incrementAutoDestructViews(encodedPayload: string) {
  const currentState = getAutoDestructViewState(encodedPayload)
  const nextState: AutoDestructViewState = {
    views: currentState.views + 1,
    lastOpenedAt: Date.now(),
  }

  try {
    window.localStorage.setItem(getStorageKey(encodedPayload), JSON.stringify(nextState))
  } catch {
    throw new AutoDestructLinkError(
      'STORAGE_UNAVAILABLE',
      'Não foi possível registrar a visualização desta mensagem no navegador.',
    )
  }

  return nextState
}

export function hasAutoDestructExpired(
  payload: AutoDestructPayload,
  viewState: AutoDestructViewState,
  now = Date.now(),
) {
  const expirationInMs = getExpirationInMs(payload.expiresIn)

  if (expirationInMs !== null && payload.createdAt + expirationInMs < now) {
    return true
  }

  if (payload.maxViews !== null && viewState.views >= payload.maxViews) {
    return true
  }

  return false
}

export function assertAutoDestructAvailability(
  payload: AutoDestructPayload,
  encodedPayload: string,
) {
  const viewState = getAutoDestructViewState(encodedPayload)

  if (hasAutoDestructExpired(payload, viewState)) {
    throw new AutoDestructLinkError('EXPIRED', 'Esta mensagem expirou.')
  }

  return viewState
}






