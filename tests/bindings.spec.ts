/** Bindings document parsing and caching. */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { BindingStore, defaultBindingPath, profileBindingPath } from '../src/bindings.ts'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'skill-gate-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function write(path: string, body: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(body), 'utf8')
}

it('keeps the legacy global file and a profile file apart', () => {
  expect(defaultBindingPath().endsWith(join('skill-gate', 'bindings.json'))).toBe(true)
  expect(profileBindingPath(join('home', 'profiles', 'web')))
    .toBe(join('home', 'profiles', 'web', 'skill-gate', 'bindings.json'))
})

it('reports whether the document exists without throwing on a missing file', async () => {
  const store = new BindingStore(join(root, 'bindings.json'))
  expect(await store.exists()).toBe(false)
  await write(store.file, { version: 1, bindings: [] })
  expect(await store.exists()).toBe(true)
})

it('treats a missing file as an empty document', async () => {
  const store = new BindingStore(join(root, 'bindings.json'))
  const bindings = await store.load()
  expect(bindings.gated.size).toBe(0)
  expect(bindings.bySkill.size).toBe(0)
})

it('collects every named tool and keys bindings by skill', async () => {
  const path = join(root, 'bindings.json')
  await write(path, {
    version: 1,
    bindings: [
      { skill: 'office-docx', tools: ['a', 'b'] },
      { skill: 'office-xlsx', tools: ['c', 'a'] },
    ],
  })
  const bindings = await new BindingStore(path).load()
  expect([...bindings.gated].sort()).toEqual(['a', 'b', 'c'])
  expect(bindings.bySkill.get('office-docx')).toEqual(['a', 'b'])
  expect(bindings.bySkill.get('office-xlsx')).toEqual(['c', 'a'])
})

it('merges two rows naming the same skill', async () => {
  const path = join(root, 'bindings.json')
  await write(path, {
    version: 1,
    bindings: [
      { skill: 's', tools: ['a'] },
      { skill: 's', tools: ['b'] },
    ],
  })
  const bindings = await new BindingStore(path).load()
  expect(bindings.bySkill.get('s')).toEqual(['a', 'b'])
})

it('rejects an unsupported version', async () => {
  const path = join(root, 'bindings.json')
  await write(path, { version: 2, bindings: [] })
  await expect(new BindingStore(path).load()).rejects.toThrow(/unsupported version/)
})

it('rejects a row whose tools are not strings', async () => {
  const path = join(root, 'bindings.json')
  await write(path, { version: 1, bindings: [{ skill: 's', tools: [1] }] })
  await expect(new BindingStore(path).load()).rejects.toThrow(/array of non-empty strings/)
})

it('rejects invalid JSON with the file path in the message', async () => {
  const path = join(root, 'bindings.json')
  await writeFile(path, '{ not json', 'utf8')
  await expect(new BindingStore(path).load()).rejects.toThrow(/not valid JSON/)
})

it('re-reads the file on every load', async () => {
  const path = join(root, 'bindings.json')
  await write(path, { version: 1, bindings: [{ skill: 's', tools: ['a'] }] })
  const store = new BindingStore(path)
  expect([...(await store.load()).gated]).toEqual(['a'])

  await write(path, { version: 1, bindings: [{ skill: 's', tools: ['b'] }] })
  expect([...(await store.load()).gated]).toEqual(['b'])
})

it('round-trips independent blocks and preserves them on binding-only saves', async () => {
  const store = new BindingStore(join(root, 'bindings.json'))
  await store.save([], ['unlag_refresh'])
  expect([...(await store.load()).gated]).toEqual(['unlag_refresh'])
  await store.save([{ skill: 's', tools: ['a'] }])
  expect([...(await store.load()).blockedTools]).toEqual(['unlag_refresh'])
  await store.save(await store.rows(), [])
  expect((await store.load()).blockedTools.size).toBe(0)
})

it('rejects invalid block lists without overwriting the document', async () => {
  const store = new BindingStore(join(root, 'bindings.json'))
  await store.save([], ['unlag_refresh'])
  await expect(store.save([], [42] as never)).rejects.toThrow(/blockedTools/)
  expect([...(await store.load()).blockedTools]).toEqual(['unlag_refresh'])
})
