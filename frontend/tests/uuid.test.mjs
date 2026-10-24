import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import test from 'node:test'
import { createUuid } from '../src/lib/uuid.ts'

test('uses native randomUUID when available', (t) => {
  const expected = '50cde245-82a0-49fe-919b-e04c785ab57f'
  t.mock.method(globalThis.crypto, 'randomUUID', () => expected)
  assert.equal(createUuid(), expected)
})

test('creates unique UUID v4 identifiers when HTTP exposes no randomUUID', (t) => {
  // Model the crypto API available on http://PUBLIC_IP, including its receiver.
  t.mock.getter(globalThis, 'crypto', () => ({
    getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
  }))
  const ids = Array.from({ length: 1000 }, () => createUuid())
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) {
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  }
})
