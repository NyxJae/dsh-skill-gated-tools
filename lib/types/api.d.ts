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
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Context } from '@deepseek-ai/cordis';
import type { BindingStore } from './bindings.ts';
/** Prefix every route in this plugin hangs under. */
export declare const ROUTE_PREFIX = "/skill-gate";
/** The connection service's request fence, typed locally: its package is browser-side. */
export interface RequestFence {
    requestRejection(request: {
        readonly headers: IncomingMessage['headers'];
    }): 401 | 403 | undefined;
}
/** The route carrier, typed locally so the route stays optional. */
export interface RouteHost {
    register(route: {
        readonly kind: 'prefix';
        readonly path: string;
        readonly handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
    }): () => void;
}
/** The skill catalog, typed locally so the route stays optional. */
export interface SkillCatalog {
    list(options?: {
        readonly cwd?: string;
        readonly scope?: unknown;
    }): Promise<Array<{
        readonly name: string;
    }>>;
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
    readonly legacyPath: string;
    /** Profile owning the effective document, when the process runs in one. */
    readonly profileName?: string;
    /** Store reading the legacy document; present only when the effective file is a different one. */
    readonly legacy?: BindingStore;
}
/** Every tool name the page may offer, already unioned across scopes. */
export type ToolNames = () => Promise<ReadonlySet<string>>;
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
export type SkillNames = () => Promise<readonly string[]>;
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
export declare function mountApi(ctx: Context, store: BindingStore, webServer: RouteHost, toolNames: ToolNames, skillNames: SkillNames | undefined, fence: () => RequestFence | undefined, startupNames?: ToolNames, locations?: StorageLocations): void;
//# sourceMappingURL=api.d.ts.map