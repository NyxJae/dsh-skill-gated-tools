/**
 * Binding document for skill-gated tools.
 *
 * The file is the plugin's only persistent state. It is read at Agent creation
 * and again whenever a new skill loads, so an edit affects the next load
 * without a process restart. The document is small, so it is read every time
 * rather than cached: a cache keyed on mtime and size would silently serve a
 * stale table after a same-size edit.
 *
 * @module dsh-skill-gated-tools/bindings
 */
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
/**
 * The legacy global binding file.
 *
 * It stays the fallback for a process that runs outside any profile, and the
 * import source for profile-owned files: nothing reads it as live rules once a
 * profile owns its own table.
 * @returns the absolute path under the Harness home.
 */
export function defaultBindingPath() {
    return dshHomePath('skill-gate', 'bindings.json');
}
/**
 * The binding file one profile owns.
 *
 * Two hosts sharing a Harness home still run different profiles, and their
 * rule tables must not overwrite each other; the profile directory is the one
 * identity the launcher hands to every plugin.
 * @param profileDir - absolute profile directory supplied by the launcher.
 * @returns the profile-owned binding path.
 */
export function profileBindingPath(profileDir) {
    return join(profileDir, 'skill-gate', 'bindings.json');
}
const EMPTY = { bySkill: new Map(), gated: new Set(), blockedTools: new Set() };
/**
 * Read a binding document out of parsed JSON.
 *
 * Two spellings are accepted for the same content: the stored document with
 * `version`, and the plain `{ bindings }` body the settings page sends. Rows
 * for the same skill merge, so an entry added twice unions its tools.
 * @param value - parsed JSON.
 * @param path - file the value came from, for diagnostics.
 * @returns the indexed document.
 * @throws {Error} when the value is not a valid document.
 */
export function parseBindings(value, path) {
    if (typeof value !== 'object' || value === null) {
        throw new Error(`skill-gate: ${path} must contain a JSON object`);
    }
    const root = value;
    if (root.version !== undefined && root.version !== 1) {
        throw new Error(`skill-gate: ${path} declares unsupported version ${String(root.version)}; expected 1`);
    }
    const blocked = root.blockedTools === undefined ? [] : root.blockedTools;
    if (!Array.isArray(blocked) || blocked.some(tool => typeof tool !== 'string' || tool.trim() === '')) {
        throw new Error(`skill-gate: ${path} "blockedTools" must be an array of non-empty strings`);
    }
    const blockedTools = new Set(blocked);
    const rows = root.bindings ?? [];
    if (!Array.isArray(rows))
        throw new Error(`skill-gate: ${path} "bindings" must be an array`);
    const bySkill = new Map();
    const gated = new Set(blockedTools);
    for (const [index, row] of rows.entries()) {
        if (typeof row !== 'object' || row === null) {
            throw new Error(`skill-gate: ${path} bindings[${index}] must be an object`);
        }
        const entry = row;
        const skill = entry.skill;
        if (typeof skill !== 'string' || skill === '') {
            throw new Error(`skill-gate: ${path} bindings[${index}].skill must be a non-empty string`);
        }
        const tools = entry.tools;
        if (!Array.isArray(tools) || tools.some(tool => typeof tool !== 'string' || tool === '')) {
            throw new Error(`skill-gate: ${path} bindings[${index}].tools must be an array of non-empty strings`);
        }
        const names = tools;
        bySkill.set(skill, [...(bySkill.get(skill) ?? []), ...names]);
        for (const name of names)
            gated.add(name);
    }
    return { bySkill, gated, blockedTools };
}
/**
 * Reads and writes the binding document.
 *
 * A missing file is a valid empty document, so a fresh install gates nothing.
 * A malformed file throws rather than silently gating nothing: a typo in a
 * visibility table must not look like success.
 */
export class BindingStore {
    path;
    constructor(path) {
        this.path = path;
    }
    /** The file this store reads. */
    get file() {
        return this.path;
    }
    /** Whether the document currently exists on disk. */
    async exists() {
        try {
            await access(this.path);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Read and parse the current document.
     * @returns the parsed document; empty when the file does not exist.
     */
    async load() {
        let raw;
        try {
            raw = await readFile(this.path, 'utf8');
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return EMPTY;
            throw error;
        }
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch (cause) {
            throw new Error(`skill-gate: ${this.path} is not valid JSON`, { cause });
        }
        return parseBindings(parsed, this.path);
    }
    /**
     * The current rows, in document order with duplicate skills merged.
     * @returns one row per bound skill.
     */
    async rows() {
        const { bySkill } = await this.load();
        return [...bySkill].map(([skill, tools]) => ({ skill, tools: [...new Set(tools)].sort() }));
    }
    /**
     * Replace the document.
     *
     * The write goes to a sibling temporary file and is renamed into place, so a
     * reader never observes a half-written document. Rows are validated with the
     * same parser `load` uses, so a page that sends a malformed body is rejected
     * instead of persisted.
     * @param rows - the bindings to store.
     * @param blockedTools - always-hidden tools; omitted preserves the stored list.
     * @returns the rows as stored, with duplicate skills merged.
     * @throws {Error} when the rows are not a valid document.
     */
    async save(rows, blockedTools) {
        const blocked = blockedTools === undefined ? [...(await this.load()).blockedTools] : blockedTools;
        const document = { version: 1, bindings: rows, blockedTools: blocked };
        parseBindings(document, this.path);
        await mkdir(dirname(this.path), { recursive: true });
        const temporary = join(dirname(this.path), `.${Date.now()}.bindings.json`);
        await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
        await rename(temporary, this.path);
        return this.rows();
    }
}
//# sourceMappingURL=bindings.js.map