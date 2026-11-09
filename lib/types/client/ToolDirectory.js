import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Searchable, paginated tool directory over the saved access rules. */
import { useId, useState } from 'react';
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives';
import styles from './SkillGateSection.module.css';
const PAGE_SIZE = 10;
/** Render a bounded tool table and its search/filter controls. */
export function ToolDirectory({ rows, filter, onFilter, knownTools, knownSkills, selected, onSelect, onEdit, busy, t }) {
    const searchId = useId();
    const filterId = useId();
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(0);
    const term = query.trim().toLowerCase();
    const matches = rows.filter(row => (filter === 'all' || row.policy === filter)
        && (row.name.toLowerCase().includes(term) || row.skills.some(skill => skill.toLowerCase().includes(term))));
    const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
    const currentPage = Math.min(page, pages - 1);
    const visible = matches.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
    const pageSelected = visible.length > 0 && visible.every(row => selected.includes(row.name));
    /** A gated row whose catalog is readable and no longer lists one of its skills. */
    const missingSkill = (row) => row.policy === 'gated'
        && knownSkills !== undefined && row.skills.some(skill => !knownSkills.has(skill));
    return _jsxs("section", { className: styles.directory, children: [_jsxs("div", { className: styles.toolbar, children: [_jsxs("div", { className: styles.search, children: [_jsx("label", { className: styles.srOnly, htmlFor: searchId, children: t('table.search') }), _jsx(Input, { id: searchId, placeholder: t('table.search'), value: query, onChange: (event) => { setQuery(event.target.value); setPage(0); } })] }), _jsx("label", { className: styles.srOnly, htmlFor: filterId, children: t('table.filter') }), _jsxs("select", { id: filterId, className: styles.select, value: filter, onChange: event => { onFilter(event.target.value); setPage(0); }, children: [_jsx("option", { value: "all", children: t('policy.all') }), ['available', 'gated', 'blocked'].map(policy => _jsx("option", { value: policy, children: t('policy.' + policy) }, policy))] })] }), _jsxs("table", { className: styles.table, "aria-label": t('table.name'), children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { className: styles.checkColumn, children: _jsx("input", { type: "checkbox", "aria-label": t('table.selectPage'), disabled: busy || visible.length === 0, checked: pageSelected, onChange: () => onSelect(pageSelected
                                            ? selected.filter(name => !visible.some(row => row.name === name))
                                            : [...new Set([...selected, ...visible.map(row => row.name)])]) }) }), _jsx("th", { children: t('table.name') }), _jsx("th", { children: t('table.policy') }), _jsx("th", { className: styles.actionColumn, children: _jsx("span", { className: styles.srOnly, children: t('table.actions') }) })] }) }), _jsx("tbody", { children: visible.map(row => _jsxs("tr", { "data-tool-row": row.name, "data-selected": selected.includes(row.name) || undefined, children: [_jsx("td", { className: styles.checkColumn, children: _jsx("input", { type: "checkbox", "aria-label": t('table.selectTool', { tool: row.name }), disabled: busy, checked: selected.includes(row.name), onChange: () => onSelect(selected.includes(row.name)
                                            ? selected.filter(name => name !== row.name) : [...selected, row.name]) }) }), _jsxs("td", { children: [_jsx("code", { className: styles.toolName, children: row.name }), !knownTools.has(row.name) && _jsx("span", { className: styles.subtle, children: t('table.unregistered') })] }), _jsxs("td", { children: [_jsx("span", { className: styles.policyBadge, "data-policy": row.policy, children: t('policy.' + row.policy) }), row.policy === 'gated' && _jsx("span", { className: styles.skillNames, title: row.skills.join(', '), children: row.skills.join(' · ') }), missingSkill(row) && _jsx("span", { className: styles.subtle, children: t('table.missingSkills') })] }), _jsx("td", { className: styles.actionColumn, children: _jsx(Button, { size: "sm", variant: "outline", disabled: busy, "aria-label": t('table.editTool', { tool: row.name }), onClick: () => onEdit(row.name), children: t('table.edit') }) })] }, row.name)) })] }), matches.length === 0 && _jsx("p", { className: styles.empty, children: t('table.empty') }), _jsxs("div", { className: styles.pagination, children: [_jsx("span", { className: styles.subtle, children: t('table.result', { count: matches.length }) }), _jsxs("div", { className: styles.actions, children: [_jsx(Button, { size: "sm", variant: "outline", disabled: currentPage === 0, onClick: () => setPage(currentPage - 1), children: t('table.previous') }), _jsx("span", { className: styles.pageNumber, children: t('table.page', { page: currentPage + 1, pages }) }), _jsx(Button, { size: "sm", variant: "outline", disabled: currentPage >= pages - 1, onClick: () => setPage(currentPage + 1), children: t('table.next') })] })] })] });
}
//# sourceMappingURL=ToolDirectory.js.map