import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { after, before, test } from 'node:test'

import { argon2id } from 'hash-wasm'
import { createServer } from 'vite'

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto
}

if (!globalThis.atob) {
  globalThis.atob = (value) => Buffer.from(value, 'base64').toString('binary')
}

if (!globalThis.btoa) {
  globalThis.btoa = (value) => Buffer.from(value, 'binary').toString('base64')
}

class Argon2TestWorker {
  onmessage = null
  onerror = null

  postMessage(request) {
    Promise.resolve()
      .then(async () => {
        const derivedBytes = await argon2id({
          password: request.password,
          salt: new Uint8Array(request.salt),
          iterations: request.iterations,
          parallelism: 1,
          memorySize: request.memorySizeKiB,
          hashLength: 32,
          outputType: 'binary',
        })
        const keyBytes = derivedBytes.slice().buffer
        this.onmessage?.({ data: { id: request.id, keyBytes } })
      })
      .catch((error) => this.onerror?.(error))
  }

  terminate() {}
}

globalThis.Worker = Argon2TestWorker

let vite
let portableVault
let veuNotesCrypto
let veuNotesStorage
let batchQueue

before(async () => {
  vite = await createServer({
    configFile: false,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  })

  ;[portableVault, veuNotesCrypto, veuNotesStorage, batchQueue] =
    await Promise.all([
      vite.ssrLoadModule('/src/lib/portable-vault.ts'),
      vite.ssrLoadModule('/src/lib/veunotes-crypto.ts'),
      vite.ssrLoadModule('/src/lib/veunotes-storage.ts'),
      vite.ssrLoadModule('/src/lib/file-crypto/batch-queue.ts'),
    ])
})

after(async () => {
  await vite?.close()
})

test('cofre portátil cria, edita, etiqueta e pesquisa várias notas', () => {
  const initial = portableVault.createPortableVault('', 1_000)
  const first = portableVault.createPortableVaultNote('Banco', 1_100)
  const second = portableVault.createPortableVaultNote('Servidor', 1_200)
  let vault = portableVault.addPortableVaultNote(initial, first)
  vault = portableVault.addPortableVaultNote(vault, second)
  vault = portableVault.updatePortableVaultNote(
    vault,
    first.id,
    {
      content: 'Código de recuperação canário',
      tags: [' pessoal ', 'recuperação', 'pessoal'],
    },
    1_300,
  )

  const decoded = portableVault.decodePortableVaultPlaintext(
    portableVault.serializePortableVault(vault),
  )

  assert.equal(decoded.migratedFromLegacyNote, false)
  assert.equal(decoded.vault.notes.length, 2)
  assert.deepEqual(
    decoded.vault.notes.find((note) => note.id === first.id).tags,
    ['pessoal', 'recuperação'],
  )
  assert.deepEqual(
    portableVault
      .searchPortableVaultNotes(decoded.vault.notes, 'CANÁRIO')
      .map((note) => note.id),
    [first.id],
  )
  assert.deepEqual(
    portableVault
      .searchPortableVaultNotes(decoded.vault.notes, 'recuperação')
      .map((note) => note.id),
    [first.id],
  )
})

test('nota única legada é migrada sem interpretar JSON comum como formato', () => {
  const legacyText = '{"notes":["isso continua sendo texto da nota"]}'
  const decoded = portableVault.decodePortableVaultPlaintext(legacyText)

  assert.equal(decoded.migratedFromLegacyNote, true)
  assert.equal(decoded.vault.notes.length, 1)
  assert.equal(decoded.vault.notes[0].content, legacyText)
  assert.equal(decoded.vault.notes[0].title, 'Nota migrada')
})

test('documento portátil rejeita campos extras e identificadores duplicados', () => {
  const vault = portableVault.createPortableVault()
  const note = portableVault.createPortableVaultNote()
  const withNote = portableVault.addPortableVaultNote(vault, note)

  assert.throws(
    () =>
      portableVault.assertPortableVaultDocument({
        ...withNote,
        password: 'campo-proibido',
      }),
    /estrutura inválida/,
  )
  assert.throws(
    () =>
      portableVault.assertPortableVaultDocument({
        ...withNote,
        notes: [note, { ...note }],
      }),
    /duplicados/,
  )
  assert.throws(
    () =>
      portableVault.assertPortableVaultDocument({
        ...withNote,
        notes: [{ ...note, content: 'x'.repeat(1_000_001) }],
      }),
    /campos inválidos/,
  )
})

test('arquivo NOTE2 não expõe senha, títulos, etiquetas ou conteúdo do cofre', async () => {
  const password = 'senha-portatil-canario-2026'
  const vault = portableVault.createPortableVault()
  const note = portableVault.createPortableVaultNote(
    'titulo-portatil-canario',
  )
  const populated = portableVault.updatePortableVaultNote(
    portableVault.addPortableVaultNote(vault, note),
    note.id,
    {
      content: 'conteudo-portatil-canario',
      tags: ['etiqueta-portatil-canario'],
    },
  )
  const plaintext = portableVault.serializePortableVault(populated)
  const { blob } = await veuNotesCrypto.createVeuNotesVault(
    plaintext,
    password,
  )
  const exported = JSON.stringify(blob)

  for (const secret of [
    password,
    'titulo-portatil-canario',
    'conteudo-portatil-canario',
    'etiqueta-portatil-canario',
  ]) {
    assert.equal(exported.includes(secret), false)
  }

  const unlocked = await veuNotesCrypto.unlockVeuNotesBlob(blob, password)
  const recovered = portableVault.decodePortableVaultPlaintext(
    unlocked.plaintext,
  )

  assert.equal(recovered.vault.notes[0].title, 'titulo-portatil-canario')
  assert.equal(recovered.vault.notes[0].content, 'conteudo-portatil-canario')
  await assert.rejects(() =>
    veuNotesCrypto.unlockVeuNotesBlob(blob, 'senha-incorreta-para-o-cofre'),
  )
})

test('NOTE3 recupera um ciphertext danificado com paridade', async () => {
  const plaintext = 'backup recuperável com paridade'
  const { blob } = await veuNotesCrypto.createVeuNotesVault(
    plaintext,
    'senha-portatil-paridade-2026',
    'recoverable',
  )
  const ciphertext = Buffer.from(blob.ciphertext, 'base64')
  ciphertext[12] ^= 0x01
  const damaged = {
    ...blob,
    ciphertext: ciphertext.toString('base64'),
  }

  assert.equal(blob.version, 3)
  assert.equal(blob.type, 'NOTE3')
  assert.equal(
    (
      await veuNotesCrypto.unlockVeuNotesBlob(
        damaged,
        'senha-portatil-paridade-2026',
      )
    ).plaintext,
    plaintext,
  )
})

test('VéuNotes usa application/octet-stream para compatibilidade SAF Android e valida extensão .criptoveu-note', () => {
  assert.equal(
    veuNotesStorage.VEU_NOTES_BACKUP_MIME_TYPE,
    'application/octet-stream',
  )
  assert.equal(
    veuNotesStorage.isValidVeuNotesBackupFileName(
      'veunotes-cofre_12_10_2026.criptoveu-note',
    ),
    true,
  )
  assert.equal(
    veuNotesStorage.isValidVeuNotesBackupFileName(
      'veunotes-cofre (versão_14_08_2026) (2).CRIPTOVEU-NOTE',
    ),
    true,
  )
  assert.equal(
    veuNotesStorage.isValidVeuNotesBackupFileName('documento.pdf'),
    false,
  )

  assert.doesNotThrow(() =>
    veuNotesStorage.assertSupportedBackupFile({
      name: 'veunotes-cofre_12_10_2026.criptoveu-note',
      size: 13_602,
    }),
  )

  assert.throws(
    () =>
      veuNotesStorage.assertSupportedBackupFile({
        name: 'fatura.pdf',
        size: 13_602,
      }),
    (error) =>
      error.code === 'INVALID_EXTENSION' &&
      /\.criptoveu-note/.test(error.message),
  )
})

test('validação de lote aceita qualquer quantidade de ficheiros com limite total de 5 GB na web', () => {
  // Na web (detectado como 'web' em ambiente Node), o limite é 5 GB total
  // sem restrição de quantidade de arquivos

  const maxTotalGb = 5
  const maxTotalBytes = maxTotalGb * 1024 * 1024 * 1024

  // Muitos arquivos pequenos devem ser aceitos (sem limite de quantidade)
  const manySmallFiles = Array.from({ length: 100 }, (_, index) => ({
    name: `foto-${index + 1}.jpg`,
    size: 1024, // 1 KB cada
  }))
  const manyResult = batchQueue.validateBatchFileSelection(manySmallFiles)
  assert.equal(manyResult.valid, true)
  assert.equal(manyResult.fileCount, 100)

  // Arquivo individual de 5 GB deve ser aceito no limite
  const singleAtLimitResult = batchQueue.validateBatchFileSelection([
    { name: 'video-5gb.mp4', size: maxTotalBytes },
  ])
  assert.equal(singleAtLimitResult.valid, true)

  // Arquivo individual acima de 5 GB deve ser rejeitado
  const singleTooLargeResult = batchQueue.validateBatchFileSelection([
    { name: 'video-pesado.mp4', size: maxTotalBytes + 1 },
  ])
  assert.equal(singleTooLargeResult.valid, false)
  assert.equal(singleTooLargeResult.code, 'SINGLE_FILE_TOO_LARGE')
  assert.equal(singleTooLargeResult.offendingFileName, 'video-pesado.mp4')

  // Total acima de 5 GB deve ser rejeitado
  const totalTooLargeResult = batchQueue.validateBatchFileSelection([
    { name: 'parte-1.bin', size: maxTotalBytes },
    { name: 'parte-2.bin', size: 1024 },
  ])
  assert.equal(totalTooLargeResult.valid, false)
  assert.equal(totalTooLargeResult.code, 'TOTAL_SIZE_EXCEEDED')
  assert.match(totalTooLargeResult.message, /5 GB/)
})

test('fila de processamento respeita limite de concorrência (1 mobile, 2 desktop) e limpa memória transitória', async () => {
  assert.equal(batchQueue.getBatchCryptoConcurrency(true), 1)
  assert.equal(batchQueue.getBatchCryptoConcurrency(false), 2)

  const items = [1, 2, 3, 4, 5, 6]
  let activeWorkers = 0
  let maxObservedActiveWorkers = 0
  const releasedBuffers = []

  const resultsDesktop = await batchQueue.runBatchCryptoQueue(
    items,
    async (item, index, memoryScope) => {
      activeWorkers += 1
      maxObservedActiveWorkers = Math.max(
        maxObservedActiveWorkers,
        activeWorkers,
      )
      const transientBuffer = new Uint8Array([1, 2, 3, 4])
      memoryScope.trackBuffer(transientBuffer)
      releasedBuffers.push(transientBuffer)

      await new Promise((resolve) => setTimeout(resolve, 15))
      activeWorkers -= 1
      return item * 10 + index
    },
    { concurrency: 2 },
  )

  assert.equal(maxObservedActiveWorkers, 2)
  assert.deepEqual(resultsDesktop, [10, 21, 32, 43, 54, 65])
  for (const buf of releasedBuffers) {
    assert.deepEqual(Array.from(buf), [0, 0, 0, 0])
  }

  let activeMobile = 0
  let maxObservedMobile = 0
  await batchQueue.runBatchCryptoQueue(
    items,
    async (item) => {
      activeMobile += 1
      maxObservedMobile = Math.max(maxObservedMobile, activeMobile)
      await new Promise((resolve) => setTimeout(resolve, 5))
      activeMobile -= 1
      return item
    },
    { isMobileOrTouch: true },
  )
  assert.equal(maxObservedMobile, 1)
})
