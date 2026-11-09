/**
 * Host state the settings page reads, and the REST client that fetches it.
 *
 * The page talks to the Host only through this module, so the transport stays
 * one function pair instead of being scattered through render code.
 */
/** One stored binding. */
export interface BindingRow {
    /** Skill name exactly as the catalog lists it. */
    readonly skill: string;
    /** Global tool names this skill unlocks. */
    readonly tools: readonly string[];
}
/** Everything the page renders. */
export interface Snapshot {
    /** Skills the catalog currently offers. */
    readonly skills: readonly string[];
    /** False when the catalog could not be read; older Hosts omit the field. */
    readonly skillsResolved: boolean;
    /** Global tool names currently registered. */
    readonly tools: readonly string[];
    /** Cold default-preset tools; null when preview data is unavailable. */
    readonly startupTools: readonly string[] | null;
    /** Stored bindings. */
    readonly bindings: readonly BindingRow[];
    /** Tools hidden regardless of skill loads. */
    readonly blockedTools: readonly string[];
    /** Problems worth surfacing without failing the whole read. */
    readonly warnings: readonly string[];
    /** Absolute path of the document this page reads and writes. */
    readonly bindingPath: string;
    /** Profile that owns the document, or null outside a profile. */
    readonly profileName: string | null;
    /** Absolute path of the legacy global document. */
    readonly legacyBindingPath: string;
    /** True when importing the legacy document is still possible. */
    readonly legacyAvailable: boolean;
}
/** Read the Host state. */
export declare function loadSnapshot(): Promise<Snapshot>;
/**
 * Copy the legacy global document into an empty profile file.
 *
 * The Host refuses this when the profile file already exists, so the action can
 * never overwrite rules the user has since saved.
 */
export declare function importLegacyBindings(): Promise<{
    readonly bindings: readonly BindingRow[];
    readonly blockedTools: readonly string[];
}>;
/** Replace the stored bindings. */
export declare function saveBindings(rows: readonly BindingRow[], blockedTools: readonly string[]): Promise<readonly BindingRow[]>;
//# sourceMappingURL=snapshot.d.ts.map