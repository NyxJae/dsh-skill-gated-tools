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
/** One skill and the tools it unlocks. */
export interface SkillBinding {
    /** Skill name exactly as the session catalog lists it. */
    readonly skill: string;
    /** Global tool names this skill unlocks. */
    readonly tools: readonly string[];
}
/** Parsed binding document. */
export interface Bindings {
    /** Skill → the tools it unlocks, keyed by skill name. */
    readonly bySkill: ReadonlyMap<string, readonly string[]>;
    /** Tool names that no skill may unlock. */
    readonly blockedTools: ReadonlySet<string>;
    /** Every blocked or skill-bound tool name. */
    readonly gated: ReadonlySet<string>;
}
/**
 * The legacy global binding file.
 *
 * It stays the fallback for a process that runs outside any profile, and the
 * import source for profile-owned files: nothing reads it as live rules once a
 * profile owns its own table.
 * @returns the absolute path under the Harness home.
 */
export declare function defaultBindingPath(): string;
/**
 * The binding file one profile owns.
 *
 * Two hosts sharing a Harness home still run different profiles, and their
 * rule tables must not overwrite each other; the profile directory is the one
 * identity the launcher hands to every plugin.
 * @param profileDir - absolute profile directory supplied by the launcher.
 * @returns the profile-owned binding path.
 */
export declare function profileBindingPath(profileDir: string): string;
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
export declare function parseBindings(value: unknown, path: string): Bindings;
/** The stored form of one binding, as the settings page edits it. */
export interface BindingRow {
    readonly skill: string;
    readonly tools: readonly string[];
}
/**
 * Reads and writes the binding document.
 *
 * A missing file is a valid empty document, so a fresh install gates nothing.
 * A malformed file throws rather than silently gating nothing: a typo in a
 * visibility table must not look like success.
 */
export declare class BindingStore {
    private readonly path;
    constructor(path: string);
    /** The file this store reads. */
    get file(): string;
    /** Whether the document currently exists on disk. */
    exists(): Promise<boolean>;
    /**
     * Read and parse the current document.
     * @returns the parsed document; empty when the file does not exist.
     */
    load(): Promise<Bindings>;
    /**
     * The current rows, in document order with duplicate skills merged.
     * @returns one row per bound skill.
     */
    rows(): Promise<BindingRow[]>;
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
    save(rows: readonly BindingRow[], blockedTools?: readonly string[]): Promise<BindingRow[]>;
}
//# sourceMappingURL=bindings.d.ts.map