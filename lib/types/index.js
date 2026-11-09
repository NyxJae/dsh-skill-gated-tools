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
var __addDisposableResource = (this && this.__addDisposableResource) || function (env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async) inner = dispose;
        }
        if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
        if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
};
var __disposeResources = (this && this.__disposeResources) || (function (SuppressedError) {
    return function (env) {
        function fail(e) {
            env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };
})(typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
import { scopeOf } from '@deepseek-ai/dsh-scope';
import z from '@deepseek-ai/schemastery';
import { mountApi } from "./api.js";
import { BindingStore, defaultBindingPath, profileBindingPath } from "./bindings.js";
import { mountClaudeSkills } from "./claude-skills.js";
import { SkillGate, skillNameOf } from "./gate.js";
import { registerGuideSkill } from "./guide.js";
export const name = 'skill-gate';
export const inject = ['tools', 'agents'];
/** Configuration schema. */
export const Config = z.object({
    bindingPath: z.string().description('Absolute path of the binding document.'),
    settingsRoute: z.boolean().default(true).description('Serve the settings REST surface.'),
});
/** Tool names visible in one Agent's scope, as the gate needs them. */
function toolsOf(ctx, agent) {
    return new Set(ctx.tools.schemas(scopeOf(agent.ctx)).map(schema => schema.name));
}
/**
 * Every skill name the settings page can offer.
 *
 * A bare `list()` reads the global layer with no `cwd`, which misses both
 * project roots and any provider mounted by an Agent preset — the standard
 * preset mounts `skill-filesystem` itself, so the global layer often holds
 * nothing at all. Three views are therefore merged:
 *
 * - the global layer, with the deployment's default directory as `cwd`;
 * - the default preset's scope, borrowed for the duration of this read so the
 *   page works before any session exists;
 * - each live Agent's own scope with its resolved working directory.
 * @param ctx - context supplying the skill registry, working directory, and preset registry.
 * @param agents - every live Agent, or a snapshot of them.
 * @returns the union of every view's skill names, name-sorted.
 */
async function skillPanorama(ctx, agents) {
    const names = new Set();
    const collect = async (view) => {
        const skills = ctx.get('skills');
        if (skills === undefined)
            return;
        for (const skill of await skills.list(view))
            names.add(skill.name);
    };
    const workingDirectory = ctx.get('workingDirectory');
    const defaultCwd = workingDirectory?.defaultDirectory;
    await collect(defaultCwd === undefined ? {} : { cwd: defaultCwd });
    // A cold read of the default preset: `acquireScope` mounts the preset's
    // composition without creating an Agent, which is how a session-addressed
    // catalog serves a Session that is not open.
    const presets = ctx.get('agentPresets');
    if (presets !== undefined) {
        try {
            const env_1 = { stack: [], error: void 0, hasError: false };
            try {
                const lease = __addDisposableResource(env_1, await presets.acquireScope(), true);
                await collect({ scope: lease.key, ...defaultCwd === undefined ? {} : { cwd: defaultCwd } });
            }
            catch (e_1) {
                env_1.error = e_1;
                env_1.hasError = true;
            }
            finally {
                const result_1 = __disposeResources(env_1);
                if (result_1)
                    await result_1;
            }
        }
        catch (error) {
            ctx.logger.warn(`skill-gate: default preset skill view skipped: ${String(error)}`);
        }
    }
    for (const agent of agents) {
        try {
            const cwd = workingDirectory === undefined
                ? undefined
                : await workingDirectory.ensure(agent);
            await collect({ scope: scopeOf(agent.ctx), ...cwd === undefined ? {} : { cwd } });
        }
        catch (error) {
            ctx.logger.warn(`skill-gate: skill view for ${String(agent.id)} skipped: ${String(error)}`);
        }
    }
    return [...names].sort();
}
/** Read a cold default-preset catalog, independent of any live Agent or skill history. */
export async function startupToolNames(ctx) {
    const env_2 = { stack: [], error: void 0, hasError: false };
    try {
        const presets = ctx.get('agentPresets');
        if (presets === undefined)
            throw new Error('default preset service is unavailable');
        const lease = __addDisposableResource(env_2, await presets.acquireScope(), true);
        return new Set(ctx.tools.schemas(lease.key).map(schema => schema.name));
    }
    catch (e_2) {
        env_2.error = e_2;
        env_2.hasError = true;
    }
    finally {
        const result_2 = __disposeResources(env_2);
        if (result_2)
            await result_2;
    }
}
/**
 * Install the gate.
 * @param ctx - plugin context supplying the tool registry and Agent registry.
 * @param config - optional binding-document override.
 */
export function apply(ctx, config = {}) {
    // A process launched by `dsh` reports its profile, so two hosts on one
    // Harness home keep separate tables instead of overwriting each other. The
    // legacy global file is never rewritten here: it is offered for an explicit
    // import only.
    const profile = ctx.get('profileContext');
    const legacyPath = defaultBindingPath();
    const store = new BindingStore(config.bindingPath
        ?? (profile === undefined ? legacyPath : profileBindingPath(profile.dir)));
    const locations = profile === undefined
        ? undefined
        : {
            legacyPath,
            profileName: profile.name,
            ...store.file === legacyPath ? {} : { legacy: new BindingStore(legacyPath) },
        };
    const gate = new SkillGate(store);
    ctx.effect(() => () => {
        gate.dispose();
    }, 'skill-gate');
    /**
     * Every tool name the settings page can offer: the unscoped view, the
     * default preset's composition, every live Agent's scope, and everything the
     * gate has seen in a scope before. A composition that mounts a preset per
     * Agent registers its tools in the preset and Agent scopes, so the unscoped
     * view alone is empty before the first session.
     * @returns every visible tool name.
     */
    const toolPanorama = async () => {
        const names = new Set(ctx.tools.schemas().map(schema => schema.name));
        for (const name of gate.observed())
            names.add(name);
        const presets = ctx.get('agentPresets');
        if (presets !== undefined) {
            try {
                const env_3 = { stack: [], error: void 0, hasError: false };
                try {
                    const lease = __addDisposableResource(env_3, await presets.acquireScope(), true);
                    for (const schema of ctx.tools.schemas(lease.key))
                        names.add(schema.name);
                }
                catch (e_3) {
                    env_3.error = e_3;
                    env_3.hasError = true;
                }
                finally {
                    const result_3 = __disposeResources(env_3);
                    if (result_3)
                        await result_3;
                }
            }
            catch (error) {
                ctx.logger.warn(`skill-gate: default preset tool view skipped: ${String(error)}`);
            }
        }
        for (const agent of gate.agents()) {
            for (const name of toolsOf(ctx, agent))
                names.add(name);
        }
        return names;
    };
    // The settings page needs a REST surface; a profile without a web server
    // (headless, ACP, SDK) never runs this block, so the plugin keeps gating
    // tools there instead of failing to boot. A scoped `inject` gives the block
    // its own context, which loads once `webServer` exists and unloads with it.
    if (config.settingsRoute !== false) {
        ctx.inject(['webServer'], (scope) => {
            const skillNames = scope.get('skills') === undefined
                ? undefined
                : () => skillPanorama(scope, [...gate.agents()]);
            mountApi(scope, store, scope.get('webServer'), toolPanorama, skillNames, () => scope.get('connection'), () => startupToolNames(scope), locations);
        });
    }
    // Contributions to global skill discovery: the Claude root as a last-ranked
    // fallback, and the bundled guide skill. A composition without a skill
    // registry (headless, ACP, SDK) still gates tools and skips both.
    ctx.inject(['skills'], (scope) => {
        mountClaudeSkills(scope);
        registerGuideSkill(scope);
    });
    // A malformed binding file must fail visibly without breaking Agent creation:
    // the gate reports the problem and leaves tools visible rather than taking
    // the whole session down over a typo in a visibility table.
    const report = (operation) => (error) => {
        ctx.logger.warn(`skill-gate: ${operation} failed, tools stay visible: ${String(error)}`);
    };
    ctx.on('agent/created', async ({ agent }) => {
        await gate.arm(agent, toolsOf(ctx, agent)).catch(report(`arming ${String(agent.id)}`));
    });
    // A tool that registers after an Agent was armed must still be masked.
    // The listener is synchronous by contract, so the work runs detached.
    ctx.on('tools/change', () => {
        void gate.refresh(agent => toolsOf(ctx, agent)).catch(report('refresh after tools/change'));
    });
    ctx.on('tools/post-execute', async (exec, result, next) => {
        const decision = await next();
        if (exec.name !== 'skill' || result.isError)
            return decision;
        const agent = exec.agent;
        if (agent === undefined)
            return decision;
        const skill = skillNameOf(exec.arguments);
        if (skill === undefined)
            return decision;
        await gate.unlock(agent, skill).catch(report(`unlocking ${skill}`));
        return decision;
    });
}
//# sourceMappingURL=index.js.map