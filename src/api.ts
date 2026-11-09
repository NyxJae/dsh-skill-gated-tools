/**
 * Settings REST surface for the gate.
 *
 * The page needs three facts it cannot get from the browser: the skill catalog,
 * the registered tool names, and the stored bindings. It also needs a write
 * path. All four live behind this one prefix route, guarded by the connection
 * service's request fence so only the trusted browser reaches it.
 *
 * @module dsh-skill-gated-tools/api
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { BindingRow, BindingStore } from './bindings.ts'

/** Prefix every route in this plugin hangs under. */
export const ROUTE_PREFIX = '/skill-gate'

/** The connection service's request fence, typed locally: its package is browser-side. */
export interface RequestFence {
  requestRejection(request: { readonly headers: IncomingMessage['headers'] }): 401 | 403 | undefined
}

/** The route carrier, typed locally so the route stays optional. */
export interface RouteHost {
  register(route: {
    readonly kind: 'prefix'
    readonly path: string
    readonly handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
}

/** The skill catalog, typed locally so the route stays optional. */
export interface SkillCatalog {
  list(options?: { readonly cwd?: string; readonly scope?: unknown }): Promise<Array<{ readonly name: string }>>
}

/**
 * Where the effective document sits relative to the legacy global one.
 *
 * A profile-owned file is the default, and the legacy document is dead weight
 * until the user asks for it: the page offers that import as one explicit
 * action rather than merging two tables behind the user's back.
 */
export interface StorageLocations {
  /** Absolute path of the legacy global document. */
  readonly legacyPath: string
  /** Profile owning the effective document, when the process runs in one. */
  readonly profileName?: string
  /** Store reading the legacy document; present only when the effective file is a different one. */
  readonly legacy?: BindingStore
}

/** A body larger than this is not a binding document. */
const MAX_BODY_BYTES = 64 * 1024

/** Write a JSON response that browsers must not cache. */
function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(payload))
}

/** Answer 405 with the route's supported methods. */
function sendMethodNotAllowed(res: ServerResponse, allow: string): void {
  res.statusCode = 405
  res.setHeader('allow', allow)
  res.end()
}

/** Resolve a prefix route's request URL against a throwaway origin. */
function requestUrl(req: IncomingMessage): URL {
  return new URL(String(req.url ?? '/'), 'http://localhost')
}

/** Read a JSON request body, bounded by {@link MAX_BODY_BYTES}. */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new Error(`request body exceeds ${String(MAX_BODY_BYTES)} bytes`)
    chunks.push(buffer)
  }
  if (size === 0) return undefined
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** What the settings page reads on open. */
interface Snapshot {
  /** Skills the catalog currently offers, name-sorted. */
  readonly skills: readonly string[]
  /** False when the catalog could not be read: bound skills are unresolved, not deleted. */
  readonly skillsResolved: boolean
  /** Global tool names currently registered, name-sorted. */
  readonly tools: readonly string[]
  /** Cold default-preset tools; null when that view cannot be read. */
  readonly startupTools: readonly string[] | null
  /** Stored bindings. */
  readonly bindings: readonly BindingRow[]
  /** Tools hidden regardless of skill loads. */
  readonly blockedTools: readonly string[]
  /** Problems worth surfacing to the user, without failing the whole read. */
  readonly warnings: readonly string[]
  /** Absolute path of the document this page reads and writes. */
  readonly bindingPath: string
  /** Profile that owns the document, or null outside a profile. */
  readonly profileName: string | null
  /** Absolute path of the legacy global document. */
  readonly legacyBindingPath: string
  /** True when the legacy document exists and the effective file does not yet. */
  readonly legacyAvailable: boolean
}

/** Every tool name the page may offer, already unioned across scopes. */
export type ToolNames = () => Promise<ReadonlySet<string>>

/**
 * Every skill name the page may offer, already unioned across the views that
 * discovery actually depends on.
 *
 * `SkillRegistry.list()` with no options reads the global layer only, and the
 * filesystem provider scans project roots only when it receives a `cwd`. A
 * bare call therefore reports the user and bundled roots of one composition
 * while missing every project skill and every preset-mounted provider. The
 * caller owns that union because only it knows which Agents are live.
 */
export type SkillNames = () => Promise<readonly string[]>

/**
 * Mount the settings REST surface.
 * @param ctx - the injected scope owning the route registration effect.
 * @param store - the binding store the page reads and writes.
 * @param webServer - the route carrier serving every route below.
 * @param toolNames - every tool name the page may offer.
 * @param skillNames - every skill name the page may offer, absent in compositions without skills.
 * @param fence - reads the connection service's request fence at request time.
 * @param startupNames - cold default-preset tools, without live-Agent contributions.
 * @param locations - effective and legacy document locations; absent outside a profile.
 */
export function mountApi(
  ctx: Context,
  store: BindingStore,
  webServer: RouteHost,
  toolNames: ToolNames,
  skillNames: SkillNames | undefined,
  fence: () => RequestFence | undefined,
  startupNames?: ToolNames,
  locations?: StorageLocations,
): void {
  /** Refuse a request the connection fence does not trust. */
  const rejected = (req: IncomingMessage, res: ServerResponse): boolean => {
    const connection = fence()
    if (connection === undefined) {
      sendJson(res, 503, { code: 'trust-fence-unavailable', message: 'the connection service is not available' })
      return true
    }
    const rejection = connection.requestRejection(req)
    if (rejection === undefined) return false
    res.statusCode = rejection
    res.end()
    return true
  }

  /** Collect the current page state. */
  const snapshot = async (): Promise<Snapshot> => {
    const warnings: string[] = []
    let names: string[] = []
    let skillsResolved = false
    try {
      if (skillNames === undefined) throw new Error('no skill catalog in this composition')
      names = [...await skillNames()].sort()
      skillsResolved = true
    } catch (error) {
      warnings.push(`skill catalog unavailable: ${String(error)}`)
    }
    let startupTools: string[] | null = null
    try {
      if (startupNames === undefined) throw new Error('default preset view is unavailable')
      startupTools = [...await startupNames()].sort()
    } catch (error) {
      warnings.push('startup preview unavailable: ' + String(error))
    }
    const toolList = [...await toolNames()].sort()
    const bindings = await store.rows()
    const blockedTools = [...(await store.load()).blockedTools].sort()
    const legacy = locations?.legacy
    const legacyAvailable = legacy !== undefined && !await store.exists() && await legacy.exists()
    return {
      skills: names,
      skillsResolved,
      tools: toolList,
      startupTools,
      bindings,
      blockedTools,
      warnings,
      bindingPath: store.file,
      profileName: locations?.profileName ?? null,
      legacyBindingPath: locations?.legacyPath ?? store.file,
      legacyAvailable,
    }
  }

  ctx.effect(() => webServer.register({
    kind: 'prefix',
    path: ROUTE_PREFIX,
    handler: async (req, res) => {
      if (rejected(req, res)) return
      const url = requestUrl(req)
      try {
        if (url.pathname === ROUTE_PREFIX && req.method === 'GET') {
          sendJson(res, 200, { ok: true, ...await snapshot() })
          return
        }
        if (url.pathname === `${ROUTE_PREFIX}/bindings/import-legacy`) {
          if (req.method !== 'POST') {
            sendMethodNotAllowed(res, 'POST')
            return
          }
          const legacy = locations?.legacy
          if (legacy === undefined) {
            sendJson(res, 409, { ok: false, message: 'this installation has no legacy binding document to import' })
            return
          }
          // Import only fills an empty slot: overwriting the profile's own
          // table would be the one destructive outcome of this action.
          if (await store.exists()) {
            sendJson(res, 409, { ok: false, message: `${store.file} already exists; import never overwrites it` })
            return
          }
          if (!await legacy.exists()) {
            sendJson(res, 404, { ok: false, message: `no legacy document at ${legacy.file}` })
            return
          }
          const document = await legacy.load()
          if (document.gated.size === 0) {
            sendJson(res, 409, { ok: false, message: `${legacy.file} holds no rules to import` })
            return
          }
          const saved = await store.save(await legacy.rows(), [...document.blockedTools])
          sendJson(res, 200, { ok: true, bindings: saved, blockedTools: [...(await store.load()).blockedTools].sort() })
          return
        }
        if (url.pathname === `${ROUTE_PREFIX}/bindings`) {
          if (req.method === 'GET') {
            sendJson(res, 200, { ok: true, bindings: await store.rows(), blockedTools: [...(await store.load()).blockedTools].sort() })
            return
          }
          if (req.method === 'PUT') {
            const body = await readJsonBody(req) as { bindings?: unknown; blockedTools?: unknown } | undefined
            const rows = body?.bindings
            if (!Array.isArray(rows)) {
              sendJson(res, 400, { ok: false, message: 'body must be { bindings: [...] }' })
              return
            }
            const saved = await store.save(rows as BindingRow[], body?.blockedTools as readonly string[] | undefined)
            sendJson(res, 200, { ok: true, bindings: saved, blockedTools: [...(await store.load()).blockedTools].sort() })
            return
          }
          sendMethodNotAllowed(res, 'GET, PUT')
          return
        }
        sendJson(res, 404, { ok: false, message: `no route for ${url.pathname}` })
      } catch (error) {
        sendJson(res, 400, { ok: false, message: String(error) })
      }
    },
  }), `skill-gate: ${ROUTE_PREFIX}`)
}
