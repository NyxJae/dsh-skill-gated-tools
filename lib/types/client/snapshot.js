/**
 * Host state the settings page reads, and the REST client that fetches it.
 *
 * The page talks to the Host only through this module, so the transport stays
 * one function pair instead of being scattered through render code.
 */
/** Route the Host serves this plugin's REST surface on. */
const BASE = '/skill-gate';
/** Read one JSON response, turning every failure into a thrown Error. */
async function readJson(path, init) {
    const response = await fetch(path, {
        headers: { accept: 'application/json', ...init?.headers },
        ...init,
    });
    const text = await response.text();
    let payload;
    try {
        payload = text.length === 0 ? undefined : JSON.parse(text);
    }
    catch {
        throw new Error(`${path} returned non-JSON content`);
    }
    const body = payload;
    if (!response.ok || body?.ok !== true) {
        throw new Error(typeof body?.message === 'string' ? body.message : `${path} failed with ${String(response.status)}`);
    }
    return payload;
}
/** Read the Host state. */
export async function loadSnapshot() {
    const body = await readJson(BASE);
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
    };
}
/**
 * Copy the legacy global document into an empty profile file.
 *
 * The Host refuses this when the profile file already exists, so the action can
 * never overwrite rules the user has since saved.
 */
export async function importLegacyBindings() {
    const body = await readJson(BASE + '/bindings/import-legacy', { method: 'POST' });
    return { bindings: body.bindings, blockedTools: body.blockedTools ?? [] };
}
/** Replace the stored bindings. */
export async function saveBindings(rows, blockedTools) {
    const body = await readJson(`${BASE}/bindings`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bindings: rows, blockedTools }),
    });
    return body.bindings;
}
//# sourceMappingURL=snapshot.js.map