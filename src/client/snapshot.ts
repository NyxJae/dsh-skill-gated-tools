/**
 * Host state the settings page reads, and the REST client that fetches it.
 *
 * The page talks to the Host only through this module, so the transport stays
 * one function pair instead of being scattered through render code.
 */

/** One stored binding. */
export interface BindingRow {
  /** Skill name exactly as the catalog lists it. */
  readonly skill: string
  /** Global tool names this skill unlocks. */
  readonly tools: readonly string[]
}

/** Everything the page renders. */
export interface Snapshot {
  /** Skills the catalog currently offers. */
  readonly skills: readonly string[]
  /** False when the catalog could not be read; older Hosts omit the field. */
  readonly skillsResolved: boolean
  /** Global tool names currently registered. */
  readonly tools: readonly string[]
  /** Cold default-preset tools; null when preview data is unavailable. */
  readonly startupTools: readonly string[] | null
  /** Stored bindings. */
  readonly bindings: readonly BindingRow[]
  /** Tools hidden regardless of skill loads. */
  readonly blockedTools: readonly string[]
  /** Problems worth surfacing without failing the whole read. */
  readonly warnings: readonly string[]
  /** Absolute path of the document this page reads and writes. */
  readonly bindingPath: string
  /** Profile that owns the document, or null outside a profile. */
  readonly profileName: string | null
  /** Absolute path of the legacy global document. */
  readonly legacyBindingPath: string
  /** True when importing the legacy document is still possible. */
  readonly legacyAvailable: boolean
}

/** Route the Host serves this plugin's REST surface on. */
const BASE = '/skill-gate'

/** Read one JSON response, turning every failure into a thrown Error. */
async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { accept: 'application/json', ...init?.headers },
    ...init,
  })
  const text = await response.text()
  let payload: unknown
  try {
    payload = text.length === 0 ? undefined : JSON.parse(text)
  } catch {
    throw new Error(`${path} returned non-JSON content`)
  }
  const body = payload as { ok?: unknown, message?: unknown } | undefined
  if (!response.ok || body?.ok !== true) {
    throw new Error(typeof body?.message === 'string' ? body.message : `${path} failed with ${String(response.status)}`)
  }
  return payload as T
}

/** Read the Host state. */
export async function loadSnapshot(): Promise<Snapshot> {
  const body = await readJson<Snapshot & { ok: true }>(BASE)
  return {
    skills: body.skills,
    skillsResolved: body.skillsResolved ?? true,
    tools: body.tools,
    startupTools: body.startupTools ?? null,
    bindings: body.bindings,
    blockedTools: body.blockedTools ?? [],
    warnings: body.warnings,
    bindingPath: body.bindingPath ?? BASE,
    profileName: body.profileName ?? null,
    legacyBindingPath: body.legacyBindingPath ?? '',
    legacyAvailable: body.legacyAvailable ?? false,
  }
}

/**
 * Copy the legacy global document into an empty profile file.
 *
 * The Host refuses this when the profile file already exists, so the action can
 * never overwrite rules the user has since saved.
 */
export async function importLegacyBindings(): Promise<{ readonly bindings: readonly BindingRow[], readonly blockedTools: readonly string[] }> {
  const body = await readJson<{ ok: true, bindings: readonly BindingRow[], blockedTools?: readonly string[] }>(BASE + '/bindings/import-legacy', { method: 'POST' })
  return { bindings: body.bindings, blockedTools: body.blockedTools ?? [] }
}

/** Replace the stored bindings. */
export async function saveBindings(rows: readonly BindingRow[], blockedTools: readonly string[]): Promise<readonly BindingRow[]> {
  const body = await readJson<{ ok: true, bindings: readonly BindingRow[] }>(`${BASE}/bindings`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bindings: rows, blockedTools }),
  })
  return body.bindings
}
