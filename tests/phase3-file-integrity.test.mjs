import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'

import { argon2id, createSHA256, sha256 } from 'hash-wasm'
import { createServer } from 'vite'

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto
}

if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (callback) => {
    callback(performance.now())
    return 0
  }
}

class CryptoTestWorker {
  onmessage = null
  onerror = null

  postMessage(request) {
    Promise.resolve()
      .then(async () => {
        if ('blob' in request) {
          const fullHasher = await createSHA256()
          const chunkHashesSha256 = []
          const chunkCount = Math.max(
            1,
            Math.ceil(request.blob.size / request.chunkSize),
          )

          for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
            const start = chunkIndex * request.chunkSize
            const end = Math.min(
              request.blob.size,
              start + request.chunkSize,
            )
            const chunk = new Uint8Array(
              await request.blob.slice(start, end).arrayBuffer(),
            )
            fullHasher.update(chunk)
            chunkHashesSha256.push(await sha256(chunk))
            this.onmessage?.({
              data: {
                id: request.id,
                progress: Math.round(((chunkIndex + 1) / chunkCount) * 100),
              },
            })
          }

          this.onmessage?.({
            data: {
              id: request.id,
              fileHashSha256: fullHasher.digest('hex'),
              chunkHashesSha256,
            },
          })
          return
        }

        const derivedBytes = await argon2id({
          password: request.password,
          salt: new Uint8Array(request.salt),
          iterations: request.iterations,
          parallelism: 1,
          memorySize: request.memorySizeKiB,
          hashLength: 32,
          outputType: 'binary',
        })
        this.onmessage?.({
          data: {
            id: request.id,
            keyBytes: derivedBytes.slice().buffer,
          },
        })
      })
      .catch((error) => this.onerror?.(error))
  }

  terminate() {}
}

globalThis.Worker = CryptoTestWorker

const V4_HEADER_LENGTH = 54
const RECORD_HEADER_LENGTH = 5

let vite
let criptoveu
let fileIntegrity
let encryptedFixture
let sourceFixture

before(async () => {
  vite = await createServer({
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })
  ;[criptoveu, fileIntegrity] = await Promise.all([
    vite.ssrLoadModule('/src/lib/criptoveu.ts'),
    vite.ssrLoadModule('/src/lib/file-integrity.ts'),
  ])

  const bytes = new Uint8Array(2 * 1024 * 1024 + 37)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = index % 251
  }
  sourceFixture = new File([bytes], 'integridade.bin', {
    type: 'application/octet-stream',
  })
  encryptedFixture = await criptoveu.encryptFile(
    sourceFixture,
    'senha-fase-3-de-teste',
    undefined,
    {
      argon2MemoryMb: 8,
      argon2Iterations: 1,
    },
  )
})

after(async () => {
  await vite?.close()
})

function readUint32(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
    offset,
    false,
  )
}

function getRecordRanges(bytes) {
  const ranges = []
  let offset = V4_HEADER_LENGTH

  while (offset < bytes.length) {
    const length = readUint32(bytes, offset + 1)
    const end = offset + RECORD_HEADER_LENGTH + length
    ranges.push({ start: offset, end, type: bytes[offset] })
    offset = end
  }

  return ranges
}

function fileFromBytes(bytes, name = 'adulterado.criptoveu') {
  return new File([bytes], name, { type: 'application/octet-stream' })
}

function includesBytes(source, expected) {
  return (
    source.findIndex((_, start) =>
      expected.every((byte, index) => source[start + index] === byte),
    ) !== -1
  )
}

test('CRIPTOVEU4 recupera múltiplos blocos e verifica o manifesto', async () => {
  assert.equal(
    await encryptedFixture.blob.slice(0, 10).text(),
    'CRIPTOVEU4',
  )

  const inspection = await criptoveu.inspectCriptoveuPackage(
    encryptedFixture.blob,
  )
  assert.equal(inspection.status, 'plausible')
  assert.equal(inspection.format, 'CRIPTOVEU4')
  assert.equal(inspection.declaredChunkCount, 2)
  assert.equal(inspection.observedChunkCount, 2)
  assert.equal(inspection.manifestPresent, true)
  assert.equal(encryptedFixture.securityReport.integrity.status, 'prepared')

  const recovered = await criptoveu.decryptFile(
    fileFromBytes(
      new Uint8Array(await encryptedFixture.blob.arrayBuffer()),
      'integridade.bin.criptoveu',
    ),
    'senha-fase-3-de-teste',
    undefined,
    { maxFileSizeBytes: sourceFixture.size },
  )
  assert.equal(recovered.downloadName, sourceFixture.name)
  assert.equal(recovered.blob.size, sourceFixture.size)
  assert.deepEqual(
    new Uint8Array(await recovered.blob.arrayBuffer()),
    new Uint8Array(await sourceFixture.arrayBuffer()),
  )
  assert.equal(recovered.securityReport.integrity.status, 'verified')
  assert.equal(recovered.securityReport.integrity.manifestVerified, true)
  assert.equal(recovered.securityReport.integrity.sha256Verified, true)
  assert.match(recovered.securityReport.fileHashSha256, /^[a-f0-9]{64}$/)
})

test('CRIPTOVEU6 recupera um bloco cifrado danificado com paridade', async () => {
  const recoverable = await criptoveu.encryptFile(
    sourceFixture,
    'senha-fase-3-de-teste',
    undefined,
    {
      argon2MemoryMb: 8,
      argon2Iterations: 1,
      recoverable: true,
    },
  )
  const bytes = new Uint8Array(await recoverable.blob.arrayBuffer())
  const ranges = getRecordRanges(bytes)

  assert.equal(await recoverable.blob.slice(0, 10).text(), 'CRIPTOVEU6')
  assert.equal(ranges.length, 4)
  assert.equal(ranges[2].type, 3)

  bytes[ranges[1].start + RECORD_HEADER_LENGTH + 8] ^= 0x01
  const recovered = await criptoveu.decryptFile(
    fileFromBytes(bytes, 'integridade-recuperavel.bin.criptoveu'),
    'senha-fase-3-de-teste',
  )

  assert.deepEqual(
    new Uint8Array(await recovered.blob.arrayBuffer()),
    new Uint8Array(await sourceFixture.arrayBuffer()),
  )
  assert.equal(recovered.securityReport.format, 'CRIPTOVEU6')
  assert.equal(recovered.securityReport.recoverableParity.enabled, true)
  assert.equal(recovered.securityReport.recoverableParity.recoveredBlocks, 1)
})

test('inspetor rejeita truncamento e tamanho de registro adulterado', async () => {
  const original = new Uint8Array(await encryptedFixture.blob.arrayBuffer())
  const truncated = original.slice(0, -1)
  const extended = new Uint8Array(original.length + 1)
  extended.set(original)
  extended[extended.length - 1] = 0x01
  const changedLength = original.slice()
  const firstLength = readUint32(changedLength, V4_HEADER_LENGTH + 1)
  new DataView(changedLength.buffer).setUint32(
    V4_HEADER_LENGTH + 1,
    firstLength + 1,
    false,
  )

  for (const bytes of [truncated, extended, changedLength]) {
    const inspection = await criptoveu.inspectCriptoveuPackage(
      fileFromBytes(bytes),
    )
    assert.equal(inspection.status, 'invalid')
    await assert.rejects(() =>
      criptoveu.decryptFile(
        fileFromBytes(bytes),
        'senha-fase-3-de-teste',
      ),
    )
  }
})

test('AAD rejeita reordenação de blocos e adulteração do conteúdo', async () => {
  const original = new Uint8Array(await encryptedFixture.blob.arrayBuffer())
  const ranges = getRecordRanges(original)
  assert.equal(ranges.length, 3)
  assert.equal(ranges[0].type, 1)
  assert.equal(ranges[1].type, 1)
  assert.equal(ranges[2].type, 2)

  const reordered = new Uint8Array(original.length)
  reordered.set(original.slice(0, V4_HEADER_LENGTH))
  let offset = V4_HEADER_LENGTH
  for (const range of [ranges[1], ranges[0], ranges[2]]) {
    const record = original.slice(range.start, range.end)
    reordered.set(record, offset)
    offset += record.length
  }

  const changedCiphertext = original.slice()
  changedCiphertext[V4_HEADER_LENGTH + RECORD_HEADER_LENGTH + 8] ^= 0x01
  const changedRecordType = original.slice()
  changedRecordType[V4_HEADER_LENGTH] = 2
  const changedManifest = original.slice()
  changedManifest[ranges[2].start + RECORD_HEADER_LENGTH + 8] ^= 0x01

  for (const bytes of [
    reordered,
    changedCiphertext,
    changedRecordType,
    changedManifest,
  ]) {
    await assert.rejects(() =>
      criptoveu.decryptFile(
        fileFromBytes(bytes),
        'senha-fase-3-de-teste',
      ),
    )
  }
})

test('cabeçalho autenticado rejeita RAM, salt e IV alterados', async () => {
  const original = new Uint8Array(await encryptedFixture.blob.arrayBuffer())
  const changedMemory = original.slice()
  changedMemory.set(new TextEncoder().encode('0009'), 10)
  const changedSalt = original.slice()
  changedSalt[18] ^= 0x01
  const changedIv = original.slice()
  changedIv[34] ^= 0x01

  for (const bytes of [changedMemory, changedSalt, changedIv]) {
    await assert.rejects(() =>
      criptoveu.decryptFile(
        fileFromBytes(bytes),
        'senha-fase-3-de-teste',
      ),
    )
  }
})

test('comparação SHA-256 rejeita divergência pós-recuperação', () => {
  assert.throws(
    () =>
      fileIntegrity.assertIntegrityHashes(
        {
          fileHashSha256: 'a'.repeat(64),
          chunkHashesSha256: ['b'.repeat(64)],
        },
        {
          fileHashSha256: 'c'.repeat(64),
          chunkHashesSha256: ['b'.repeat(64)],
        },
      ),
    { code: 'INTEGRITY_MISMATCH' },
  )
})

test('manifesto cifrado não expõe nome, conteúdo ou hash em texto claro', async () => {
  const packageBytes = new Uint8Array(
    await encryptedFixture.blob.arrayBuffer(),
  )
  const plaintextBytes = new Uint8Array(await sourceFixture.arrayBuffer())
  const nameBytes = new TextEncoder().encode(sourceFixture.name)
  const hashBytes = new TextEncoder().encode(
    encryptedFixture.securityReport.fileHashSha256,
  )

  assert.equal(includesBytes(packageBytes, plaintextBytes.slice(0, 64)), false)
  assert.equal(includesBytes(packageBytes, nameBytes), false)
  assert.equal(includesBytes(packageBytes, hashBytes), false)
})

test('limite comunitário considera o conteúdo, não a sobrecarga do pacote', async () => {
  const packageFile = fileFromBytes(
    new Uint8Array(await encryptedFixture.blob.arrayBuffer()),
    'integridade.bin.criptoveu',
  )

  await assert.rejects(
    () =>
      criptoveu.decryptFile(
        packageFile,
        'senha-fase-3-de-teste',
        undefined,
        { maxFileSizeBytes: sourceFixture.size - 1 },
      ),
    { code: 'FILE_TOO_LARGE' },
  )
})

test('inspetor classifica arquivos desconhecidos sem pedir senha', async () => {
  const inspection = await criptoveu.inspectCriptoveuPackage(
    new Blob(['conteúdo comum']),
  )
  assert.equal(inspection.status, 'invalid')
  assert.equal(inspection.format, 'UNKNOWN')
})

test('vetor público CRIPTOVEU4 permanece interoperável', async () => {
  const vector = JSON.parse(
    await readFile(
      new URL(
        '../test-vectors/file-v4/vector-001-basic.json',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  const packageFile = new File(
    [Buffer.from(vector.packageBase64, 'base64')],
    `${vector.expectedFileName}.criptoveu`,
    { type: 'application/octet-stream' },
  )

  const inspection = await criptoveu.inspectCriptoveuPackage(packageFile)
  assert.equal(inspection.status, 'plausible')
  assert.equal(inspection.format, 'CRIPTOVEU4')
  assert.equal(inspection.manifestPresent, true)

  const recovered = await criptoveu.decryptFile(packageFile, vector.password)
  assert.equal(recovered.downloadName, vector.expectedFileName)
  assert.equal(recovered.blob.type, vector.expectedMimeType)
  assert.equal(await recovered.blob.text(), vector.plaintextUtf8)
  assert.equal(
    recovered.securityReport.fileHashSha256,
    vector.manifest.fileHashSha256,
  )
})

test('CSP autoriza somente as políticas nomeadas dos Workers locais', async () => {
  const [vercelConfig, netlifyConfig] = await Promise.all([
    readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
    readFile(new URL('../netlify.toml', import.meta.url), 'utf8'),
  ])

  for (const config of [vercelConfig, netlifyConfig]) {
    assert.match(
      config,
      /trusted-types criptoveu-argon2-worker criptoveu-integrity-worker criptoveu-opfs-crypto-worker/,
    )
    assert.match(config, /worker-src 'self' blob:/)
  }
})

test('limite maximo de arquivo e 5 GB na web (10737418240 bytes) e rejeita arquivos maiores', async () => {
  // Em ambiente Node (não navegador), getPlatformType() retorna 'web',
  // então o limite é 5 GB
  const maxFileSizeBytes = 5 * 1024 * 1024 * 1024
  assert.equal(criptoveu.MAX_FILE_SIZE, maxFileSizeBytes)
  assert.equal(criptoveu.MAX_FILE_SIZE_BYTES, maxFileSizeBytes)

  const oversizedMockFile = {
    name: 'grande.iso',
    size: maxFileSizeBytes + 1,
    type: 'application/octet-stream',
    lastModified: Date.now(),
  }

  assert.throws(
    () => criptoveu.assertSupportedFileSize(oversizedMockFile),
    {
      code: 'FILE_TOO_LARGE',
      message:
        'O arquivo selecionado excede o limite de 5 GB para processamento 100% local e seguro na memória do dispositivo.',
    },
  )

  await assert.rejects(
    () =>
      criptoveu.encryptFile(
        oversizedMockFile,
        'senha-teste',
      ),
    {
      code: 'FILE_TOO_LARGE',
      message:
        'O arquivo selecionado excede o limite de 5 GB para processamento 100% local e seguro na memória do dispositivo.',
    },
  )
})
