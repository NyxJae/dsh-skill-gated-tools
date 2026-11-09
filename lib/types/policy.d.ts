/** Saved tool policies shared by the tool directory and the rule editor. */
import type { BindingRow } from './bindings.ts';
/** Access before any skill has loaded. */
export type ToolPolicy = 'available' | 'gated' | 'blocked';
/** One tool with its saved policy and unlocking skills. */
export interface ToolRow {
    readonly name: string;
    readonly policy: ToolPolicy;
    readonly skills: readonly string[];
}
/** Derive policies for exactly the supplied catalog, without adding missing references. */
export declare function describeTools(names: readonly string[], bindings: readonly BindingRow[], blockedTools: readonly string[]): ToolRow[];
/** Replace selected tools' rules, retaining every unrelated binding and block. */
export declare function replacePolicies(bindings: readonly BindingRow[], blockedTools: readonly string[], selected: readonly string[], policy: ToolPolicy, skills: readonly string[]): {
    bindings: BindingRow[];
    blockedTools: string[];
};
//# sourceMappingURL=policy.d.ts.map