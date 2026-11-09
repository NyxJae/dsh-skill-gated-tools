/** Derive policies for exactly the supplied catalog, without adding missing references. */
export function describeTools(names, bindings, blockedTools) {
    const blocked = new Set(blockedTools);
    const skillsByTool = new Map();
    for (const row of bindings) {
        for (const tool of row.tools) {
            const skills = skillsByTool.get(tool) ?? new Set();
            skills.add(row.skill);
            skillsByTool.set(tool, skills);
        }
    }
    return [...new Set(names)].sort().map(name => {
        const skills = [...skillsByTool.get(name) ?? []].sort();
        return { name, skills, policy: blocked.has(name) ? 'blocked' : skills.length > 0 ? 'gated' : 'available' };
    });
}
/** Replace selected tools' rules, retaining every unrelated binding and block. */
export function replacePolicies(bindings, blockedTools, selected, policy, skills) {
    const targets = new Set(selected);
    const next = new Map();
    for (const row of bindings) {
        const tools = next.get(row.skill) ?? new Set();
        for (const name of row.tools)
            if (!targets.has(name))
                tools.add(name);
        next.set(row.skill, tools);
    }
    if (policy === 'gated') {
        for (const skill of skills) {
            const tools = next.get(skill) ?? new Set();
            for (const name of targets)
                tools.add(name);
            next.set(skill, tools);
        }
    }
    const blocked = new Set(blockedTools.filter(name => !targets.has(name)));
    if (policy === 'blocked')
        for (const name of targets)
            blocked.add(name);
    return {
        bindings: [...next].filter(([, tools]) => tools.size > 0).map(([skill, tools]) => ({ skill, tools: [...tools].sort() })),
        blockedTools: [...blocked].sort(),
    };
}
//# sourceMappingURL=policy.js.map