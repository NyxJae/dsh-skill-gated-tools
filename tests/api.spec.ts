/**
 * Settings REST surface against a real HTTP handler.
 *
 * The catalog contract is the point: discovery is layered and cwd-sensitive,
 * so a single `list()` call under-reports. These tests pin the handler to the
 * union its caller supplies, and pin the fence and write path around it.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Context } from '@deepseek-ai/cordis'
import { BindingStore } from '../src/bindings.ts'
import { mountApi, ROUTE_PREFIX, type RequestFence, type RouteHost, type StorageLocations } from '../src/api.ts'

let root: string
const contexts: Context[] = []

/** One captured request the fake server answered. */
interface Captured {
  status: number
  body: string
}

/** Drive one request through a registered prefix handler. */
async function send(
  handler: ((req: IncomingMessage, res: ServerResponse) => void | Promise<void>) | undefined,
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<Captured> {
  if (handler === undefined) throw new Error('route was not registered')
  const result: Captured = { status: 0, body: '' }
  const req = {
    url: path,
    method,
    headers: {},
    [Symbol.asyncIterator]: async function* () {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body))
    },
  } as unknown as IncomingMessage
  const res = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    setHeader(this: { headers: Record<string, string> }, name: string, value: string) {
      this.headers[name] = value
    },
    end(this: { statusCode: number }, text?: string) {
      result.status = this.statusCode
      result.body = text ?? ''
    },
  } as unknown as ServerResponse
  await handler(req, res)
  return result
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'skill-gate-api-'))
})

afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  await rm(root, { recursive: true, force: true })
})

/**
 * Mount the route on a stand-in server and expose one request helper.
 * @param options - the three facts the page reads; `fence` defaults to a
 *   permissive one so the tests below exercise routing rather than the guard.
 * @returns a `request` helper.
 */
function makeRoute(options: {
  tools?: readonly string[]
  startup?: () => Promise<ReadonlySet<string>>
  skills?: () => Promise<readonly string[]>
  fence?: RequestFence
  locations?: StorageLocations
}) {
  const ctx = new Context()
  contexts.push(ctx)
  let handler: ((req: IncomingMessage, res: ServerResponse) => void | Promise<void>) | undefined
  const host: RouteHost = {
    register: (route) => {
      handler = route.handler
      return () => {}
    },
  }
  mountApi(
    ctx,
    new BindingStore(join(root, 'bindings.json')),
    host,
    async () => new Set(options.tools ?? []),
    options.skills,
    () => options.fence ?? { requestRejection: () => undefined },
    options.startup ?? (async () => new Set(options.tools ?? [])),
    options.locations,
  )

  /** Send one request through the registered handler. */
  async function request(path: string, method = 'GET', body?: unknown): Promise<Captured> {
    return send(handler, path, method, body)
  }

  return { request }
}

it('reports every skill name its caller unions, not one raw view', async () => {
  // A bare registry read sees the user roots only; the project and preset
  // skills exist in views the caller must add itself.
  const route = makeRoute({
    skills: async () => ['global-skill', 'project-skill', 'preset-skill'],
  })
  const response = await route.request(ROUTE_PREFIX)
  expect(response.status).toBe(200)
  const payload = JSON.parse(response.body) as { skills: string[]; skillsResolved: boolean }
  expect(payload.skills).toEqual(['global-skill', 'preset-skill', 'project-skill'])
  expect(payload.skillsResolved).toBe(true)
})

it('reports tools and bindings alongside the catalog', async () => {
  const route = makeRoute({ tools: ['read', 'write'], skills: async () => ['a-skill'] })
  const response = await route.request(ROUTE_PREFIX)
  const payload = JSON.parse(response.body) as { tools: string[]; bindings: unknown[]; ok: boolean }
  expect(payload.ok).toBe(true)
  expect(payload.tools).toEqual(['read', 'write'])
  expect(payload.bindings).toEqual([])
})

it('warns instead of failing when the catalog is unavailable', async () => {
  const route = makeRoute({ tools: ['read'], skills: async () => { throw new Error('boom') } })
  const response = await route.request(ROUTE_PREFIX)
  expect(response.status).toBe(200)
  const payload = JSON.parse(response.body) as { skills: string[]; skillsResolved: boolean; warnings: string[] }
  expect(payload.skills).toEqual([])
  expect(payload.skillsResolved).toBe(false)
  expect(payload.warnings[0]).toContain('boom')
})

it('warns instead of failing when the composition mounts no skills', async () => {
  const route = makeRoute({ tools: ['read'] })
  const response = await route.request(ROUTE_PREFIX)
  expect(response.status).toBe(200)
  const payload = JSON.parse(response.body) as { skillsResolved: boolean; warnings: string[] }
  expect(payload.skillsResolved).toBe(false)
  expect(payload.warnings[0]).toContain('no skill catalog')
})

it('writes bindings through the same prefix', async () => {
  const route = makeRoute({ skills: async () => [] })
  const response = await route.request(
    `${ROUTE_PREFIX}/bindings`,
    'PUT',
    { bindings: [{ skill: 'my-skill', tools: ['read'] }] },
  )
  expect(response.status).toBe(200)
  const written = JSON.parse(await readFile(join(root, 'bindings.json'), 'utf8')) as {
    bindings: { skill: string; tools: string[] }[]
  }
  expect(written.bindings).toEqual([{ skill: 'my-skill', tools: ['read'] }])
})

it('rejects a write whose body is not a binding list', async () => {
  const route = makeRoute({ skills: async () => [] })
  const response = await route.request(`${ROUTE_PREFIX}/bindings`, 'PUT', { nope: true })
  expect(response.status).toBe(400)
})

it('answers 503 when the connection service is absent', async () => {
  const ctx = new Context()
  contexts.push(ctx)
  let handler: ((req: IncomingMessage, res: ServerResponse) => void | Promise<void>) | undefined
  mountApi(
    ctx,
    new BindingStore(join(root, 'bindings.json')),
    { register: (route) => { handler = route.handler; return () => {} } },
    async () => new Set<string>(),
    async () => [],
    () => undefined,
  )
  const result = await send(handler, ROUTE_PREFIX)
  expect(result.status).toBe(503)
  expect(JSON.parse(result.body)).toMatchObject({ code: 'trust-fence-unavailable' })
})

it('lets a trusted request through the fence', async () => {
  const route = makeRoute({
    skills: async () => ['a-skill'],
    fence: { requestRejection: () => undefined },
  })
  const response = await route.request(ROUTE_PREFIX)
  expect(response.status).toBe(200)
})

it('refuses a request the fence rejects', async () => {
  const route = makeRoute({
    skills: async () => ['a-skill'],
    fence: { requestRejection: () => 403 },
  })
  const response = await route.request(ROUTE_PREFIX)
  expect(response.status).toBe(403)
})

it('answers 404 for an unknown path under the prefix', async () => {
  const route = makeRoute({ skills: async () => [] })
  const response = await route.request(`${ROUTE_PREFIX}/nope`)
  expect(response.status).toBe(404)
})

it('round-trips block lists and preserves them when only skill bindings are edited', async () => {
  const route = makeRoute({ skills: async () => [] })
  const path = ROUTE_PREFIX + '/bindings'
  const saved = await route.request(path, 'PUT', { bindings: [], blockedTools: ['unlag_refresh'] })
  expect(saved.status).toBe(200)
  expect(JSON.parse(saved.body).blockedTools).toEqual(['unlag_refresh'])
  await route.request(path, 'PUT', { bindings: [{ skill: 's', tools: ['read'] }] })
  const snapshot = JSON.parse((await route.request(ROUTE_PREFIX)).body)
  expect(snapshot.blockedTools).toEqual(['unlag_refresh'])
  expect(snapshot.bindings).toEqual([{ skill: 's', tools: ['read'] }])
  expect((await route.request(path, 'PUT', { bindings: [], blockedTools: [42] })).status).toBe(400)
})

it('reports the effective document, its profile, and the legacy source', async () => {
  const legacy = join(root, 'global', 'bindings.json')
  const locations: StorageLocations = { legacyPath: legacy, profileName: 'web', legacy: new BindingStore(legacy) }
  const route = makeRoute({ tools: ['read'], skills: async () => [], locations })
  const payload = JSON.parse((await route.request(ROUTE_PREFIX)).body) as Record<string, unknown>
  expect(payload.bindingPath).toBe(join(root, 'bindings.json'))
  expect(payload.profileName).toBe('web')
  expect(payload.legacyBindingPath).toBe(legacy)
  expect(payload.legacyAvailable).toBe(false)
})

it('offers a legacy import only while the profile document is still missing', async () => {
  const legacy = join(root, 'global', 'bindings.json')
  await mkdir(dirname(legacy), { recursive: true })
  await writeFile(legacy, JSON.stringify({ version: 1, bindings: [{ skill: 'ssh', tools: ['ssh_exec'] }], blockedTools: ['browser_click'] }))
  const route = makeRoute({ locations: { legacyPath: legacy, profileName: 'web', legacy: new BindingStore(legacy) } })
  expect((JSON.parse((await route.request(ROUTE_PREFIX)).body) as { legacyAvailable: boolean }).legacyAvailable).toBe(true)
  const imported = await route.request(`${ROUTE_PREFIX}/bindings/import-legacy`, 'POST')
  expect(imported.status).toBe(200)
  const after = JSON.parse((await route.request(ROUTE_PREFIX)).body) as {
    legacyAvailable: boolean; bindings: unknown[]; blockedTools: string[]
  }
  expect(after.legacyAvailable).toBe(false)
  expect(after.bindings).toEqual([{ skill: 'ssh', tools: ['ssh_exec'] }])
  expect(after.blockedTools).toEqual(['browser_click'])
  // The legacy document is an import source only: it stays exactly as it was.
  const kept = JSON.parse(await readFile(legacy, 'utf8')) as { bindings: unknown[] }
  expect(kept.bindings).toEqual([{ skill: 'ssh', tools: ['ssh_exec'] }])
})

it('refuses to import over a document the profile already saved', async () => {
  const legacy = join(root, 'global', 'bindings.json')
  await mkdir(dirname(legacy), { recursive: true })
  await writeFile(legacy, JSON.stringify({ version: 1, bindings: [{ skill: 'ssh', tools: ['ssh_exec'] }] }))
  const route = makeRoute({ locations: { legacyPath: legacy, profileName: 'web', legacy: new BindingStore(legacy) } })
  await route.request(`${ROUTE_PREFIX}/bindings`, 'PUT', { bindings: [{ skill: 'keep', tools: ['read'] }] })
  const denied = await route.request(`${ROUTE_PREFIX}/bindings/import-legacy`, 'POST')
  expect(denied.status).toBe(409)
  const payload = JSON.parse((await route.request(ROUTE_PREFIX)).body) as { bindings: unknown[] }
  expect(payload.bindings).toEqual([{ skill: 'keep', tools: ['read'] }])
})

it('reports a missing legacy document instead of creating one', async () => {
  const legacy = join(root, 'global', 'bindings.json')
  const route = makeRoute({ locations: { legacyPath: legacy, profileName: 'web', legacy: new BindingStore(legacy) } })
  const response = await route.request(`${ROUTE_PREFIX}/bindings/import-legacy`, 'POST')
  expect(response.status).toBe(404)
})

it('keeps a stored rule whose skill is absent from the catalog', async () => {
  const route = makeRoute({ tools: ['read'], skills: async () => ['known-skill'] })
  const path = ROUTE_PREFIX + '/bindings'
  await route.request(path, 'PUT', { bindings: [{ skill: 'retired-skill', tools: ['read'] }] })
  const payload = JSON.parse((await route.request(ROUTE_PREFIX)).body) as { skillsResolved: boolean; bindings: unknown[]; blockedTools: string[] }
  expect(payload.skillsResolved).toBe(true)
  expect(payload.bindings).toEqual([{ skill: 'retired-skill', tools: ['read'] }])
  expect(payload.blockedTools).toEqual([])
})
it('separates the startup preset catalog from live-Agent tool discovery', async () => {
  const route = makeRoute({ tools: ['read', 'live-only'], startup: async () => new Set(['read']), skills: async () => [] })
  const payload = JSON.parse((await route.request(ROUTE_PREFIX)).body)
  expect(payload.startupTools).toEqual(['read'])
  expect(payload.tools).toEqual(['live-only', 'read'])
})
it('marks startup preview unavailable rather than claiming a partial view', async () => {
  const route = makeRoute({ tools: ['read'], startup: async () => { throw new Error('preset failed') }, skills: async () => [] })
  const response = await route.request(ROUTE_PREFIX)
  expect(response.status).toBe(200)
  expect(JSON.parse(response.body)).toMatchObject({ startupTools: null, tools: ['read'] })
  expect(JSON.parse(response.body).warnings.join(' ')).toContain('preset failed')
})
