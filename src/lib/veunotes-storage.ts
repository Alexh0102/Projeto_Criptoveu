import {
  assertVeuNotesBlobJson,
  type VeuNotesBlobJson,
  VeuNotesCryptoError,
} from './veunotes-crypto'

export const VEU_NOTES_STORAGE_KEY = 'veunotes-v1'
export const VEU_NOTES_BACKUP_FILE = 'veunotes-backup.json'
export const VEU_NOTES_STORAGE_WARNING_BYTES = 500 * 1024

export class VeuNotesStorageError extends Error {
  code: 'INVALID_JSON' | 'INVALID_SHAPE' | 'WRITE_FAILED'

  constructor(code: 'INVALID_JSON' | 'INVALID_SHAPE' | 'WRITE_FAILED', message: string) {
    super(message)
    this.name = 'VeuNotesStorageError'
    this.code = code
  }
}

export function measureSerializedBytes(serialized: string) {
  return new TextEncoder().encode(serialized).byteLength
}

export function serializeVaultBlob(blob: VeuNotesBlobJson) {
  return JSON.stringify(blob)
}

export function measureVaultBlobBytes(blob: VeuNotesBlobJson) {
  return measureSerializedBytes(serializeVaultBlob(blob))
}

export function parseVaultBlob(rawValue: string) {
  try {
    return assertVeuNotesBlobJson(JSON.parse(rawValue))
  } catch (error) {
    if (error instanceof VeuNotesCryptoError) {
      throw new VeuNotesStorageError('INVALID_SHAPE', error.message)
    }

    throw new VeuNotesStorageError(
      'INVALID_JSON',
      'O cofre salvo localmente está corrompido ou não pode ser lido.',
    )
  }
}

export function loadVaultBlob(): VeuNotesBlobJson | null {
  const rawValue = window.localStorage.getItem(VEU_NOTES_STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  return parseVaultBlob(rawValue)
}

export function saveVaultBlob(blob: VeuNotesBlobJson) {
  try {
    const serialized = serializeVaultBlob(blob)
    window.localStorage.setItem(VEU_NOTES_STORAGE_KEY, serialized)
    return measureSerializedBytes(serialized)
  } catch {
    throw new VeuNotesStorageError(
      'WRITE_FAILED',
      'Não foi possível salvar o cofre localmente neste navegador.',
    )
  }
}

export function clearVault() {
  window.localStorage.removeItem(VEU_NOTES_STORAGE_KEY)
}
