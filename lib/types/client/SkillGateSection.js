import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/** Tool policy workspace: the rule directory and the editor for the current selection. */
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@deepseek-ai/dsh-client-ui-primitives';
import { describeTools, replacePolicies } from "../policy.js";
import { RuleEditor } from "./RuleEditor.js";
import { ToolDirectory } from "./ToolDirectory.js";
import styles from './SkillGateSection.module.css';
/** Render searchable rule management for the document this profile owns. */
export function SkillGateSection({ load, save, importLegacy, t }) {
    const [snapshot, setSnapshot] = useState();
    const [busy, setBusy] = useState('load');
    const [message, setMessage] = useState();
    const [filter, setFilter] = useState('all');
    const [selected, setSelected] = useState([]);
    const [policy, setPolicy] = useState();
    const [skills, setSkills] = useState([]);
    // A reload replaces the rules the draft was derived from. Keeping the old
    // selection would let the next save write a stale policy over the file the
    // host just handed back, so the draft is dropped whenever rules are adopted.
    const clearDraft = useCallback(() => {
        setSelected([]);
        setPolicy(undefined);
        setSkills([]);
    }, []);
    const refresh = useCallback(async () => {
        setBusy('load');
        setMessage(undefined);
        // A failed read keeps the draft: nothing replaced the rules it came from.
        try {
            setSnapshot(await load());
            clearDraft();
        }
        catch (error) {
            setMessage({ kind: 'error', text: t('load.failed', { message: String(error) }) });
        }
        finally {
            setBusy(undefined);
        }
    }, [clearDraft, load, t]);
    useEffect(() => { void refresh(); }, [refresh]);
    const rows = snapshot === undefined ? [] : describeTools([
        ...snapshot.tools, ...snapshot.blockedTools, ...snapshot.bindings.flatMap(row => row.tools),
    ], snapshot.bindings, snapshot.blockedTools);
    const choose = (names) => {
        setSelected(names);
        setMessage(undefined);
        const row = names.length === 1 ? rows.find(row => row.name === names[0]) : undefined;
        setPolicy(row?.policy);
        setSkills(row?.skills ?? []);
    };
    const persist = async () => {
        if (snapshot === undefined || busy !== undefined || policy === undefined || selected.length === 0 || (policy === 'gated' && skills.length === 0))
            return;
        const next = replacePolicies(snapshot.bindings, snapshot.blockedTools, selected, policy, skills);
        setBusy('save');
        setMessage(undefined);
        try {
            const saved = await save(next.bindings, next.blockedTools);
            setSnapshot(current => current === undefined ? current : { ...current, bindings: saved, blockedTools: next.blockedTools });
            setMessage({ kind: 'ok', text: t('save.saved') });
        }
        catch (error) {
            setMessage({ kind: 'error', text: t('save.failed', { message: String(error) }) });
        }
        finally {
            setBusy(undefined);
        }
    };
    const importLegacyRules = async () => {
        if (snapshot === undefined || busy !== undefined)
            return;
        setBusy('import');
        setMessage(undefined);
        try {
            const imported = await importLegacy();
            setSnapshot(current => current === undefined ? current : {
                ...current,
                bindings: imported.bindings,
                blockedTools: imported.blockedTools,
                legacyAvailable: false,
            });
            clearDraft();
            setMessage({ kind: 'ok', text: t('legacy.imported') });
        }
        catch (error) {
            setMessage({ kind: 'error', text: t('legacy.failed', { message: String(error) }) });
        }
        finally {
            setBusy(undefined);
        }
    };
    const missingSkills = snapshot?.bindings.map(row => row.skill).filter(skill => !snapshot.skills.includes(skill)) ?? [];
    // An unavailable catalog leaves saved skills unresolved; it is not proof they were deleted.
    const catalogResolved = snapshot?.skillsResolved ?? true;
    return _jsxs("div", { className: styles.section, children: [_jsxs("header", { className: styles.header, children: [_jsx("h2", { className: styles.title, children: t('title') }), _jsx(Button, { size: "sm", variant: "outline", disabled: busy !== undefined, onClick: () => { void refresh(); }, children: t('refresh') })] }), message !== undefined && _jsx("p", { className: message.kind === 'error' ? styles.error : styles.success, role: message.kind === 'error' ? 'alert' : 'status', children: message.text }), snapshot?.warnings.map(warning => _jsx("p", { className: styles.warning, children: warning }, warning)), missingSkills.length > 0 && _jsx("p", { className: styles.warning, children: catalogResolved
                    ? t('warn.unknownSkills', { skills: [...new Set(missingSkills)].join(', ') })
                    : t('warn.unresolvedSkills', { skills: [...new Set(missingSkills)].join(', ') }) }), snapshot?.legacyAvailable === true && _jsxs("div", { className: styles.legacy, children: [_jsx("p", { children: t('legacy.body', { path: snapshot.legacyBindingPath }) }), _jsx(Button, { size: "sm", variant: "outline", disabled: busy !== undefined, onClick: () => { void importLegacyRules(); }, children: t('legacy.import') })] }), busy === 'load' && snapshot === undefined && _jsx("p", { className: styles.loading, role: "status", children: t('loading') }), snapshot !== undefined && _jsxs(_Fragment, { children: [_jsx("div", { className: styles.ruleCounts, children: ['available', 'gated', 'blocked'].map(kind => _jsxs("button", { type: "button", "aria-pressed": filter === kind, onClick: () => setFilter(filter === kind ? 'all' : kind), children: [_jsx("span", { className: styles.dot, "data-policy": kind }), t('policy.' + kind), _jsx("strong", { children: rows.filter(row => row.policy === kind).length })] }, kind)) }), _jsxs("div", { className: styles.workspace, "data-has-selection": selected.length > 0 || undefined, children: [_jsx(ToolDirectory, { rows: rows, filter: filter, onFilter: setFilter, knownTools: new Set(snapshot.tools), knownSkills: catalogResolved ? new Set(snapshot.skills) : undefined, selected: selected, onSelect: choose, onEdit: name => choose([name]), busy: busy !== undefined, t: t }), _jsx(RuleEditor, { selected: selected, policy: policy, skills: skills, catalog: snapshot.skills, catalogResolved: catalogResolved, busy: busy !== undefined, onPolicy: setPolicy, onSkills: setSkills, onClear: () => choose([]), onSave: () => { void persist(); }, t: t }, selected.join('|'))] }), _jsxs("p", { className: styles.storage, children: [_jsxs("span", { children: [t('store.label'), snapshot.profileName === null ? '' : ' · ' + t('store.profile', { profile: snapshot.profileName })] }), _jsx("code", { children: snapshot.bindingPath })] })] })] });
}
//# sourceMappingURL=SkillGateSection.js.map