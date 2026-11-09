/**
 * Plugin entry: wires the binding store, the gate, and the settings route onto
 * Harness events.
 *
 * The plugin observes Agent creation and `skill` tool results; it never
 * registers a tool of its own and never modifies another plugin's
 * registration.
 *
 * @module dsh-skill-gated-tools
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "skill-gate";
export declare const inject: string[];
/** Plugin configuration. */
export interface Config {
    /** Absolute path of the binding document; defaults to the active profile's own file. */
    bindingPath?: string;
    /** Serve the settings REST surface; defaults to true. */
    settingsRoute?: boolean;
}
/** Configuration schema. */
export declare const Config: z<Config>;
/** Read a cold default-preset catalog, independent of any live Agent or skill history. */
export declare function startupToolNames(ctx: Context): Promise<ReadonlySet<string>>;
/**
 * Install the gate.
 * @param ctx - plugin context supplying the tool registry and Agent registry.
 * @param config - optional binding-document override.
 */
export declare function apply(ctx: Context, config?: Config): void;
//# sourceMappingURL=index.d.ts.map