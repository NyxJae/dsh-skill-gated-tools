/** Searchable, paginated tool directory over the saved access rules. */
import { useId, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolPolicy, ToolRow } from '../policy.ts'
import { NS } from './locales.ts'
import styles from './SkillGateSection.module.css'

/** Directory inputs; selection, filter and busy state are owned by the settings section. */
export interface ToolDirectoryProps {
  readonly rows: readonly ToolRow[]
  readonly filter: ToolPolicy | 'all'
  readonly onFilter: (filter: ToolPolicy | 'all') => void
  readonly knownTools: ReadonlySet<string>
  /** Catalog skills; undefined when the catalog could not be read, so absence proves nothing. */
  readonly knownSkills?: ReadonlySet<string> | undefined
  readonly selected: readonly string[]
  readonly onSelect: (names: readonly string[]) => void
  readonly onEdit: (name: string) => void
  readonly busy: boolean
  readonly t: TranslateNS<typeof NS>
}

const PAGE_SIZE = 10

/** Render a bounded tool table and its search/filter controls. */
export function ToolDirectory({ rows, filter, onFilter, knownTools, knownSkills, selected, onSelect, onEdit, busy, t }: ToolDirectoryProps): ReactNode {
  const searchId = useId()
  const filterId = useId()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const term = query.trim().toLowerCase()
  const matches = rows.filter(row => (filter === 'all' || row.policy === filter)
    && (row.name.toLowerCase().includes(term) || row.skills.some(skill => skill.toLowerCase().includes(term))))
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages - 1)
  const visible = matches.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const pageSelected = visible.length > 0 && visible.every(row => selected.includes(row.name))
  /** A gated row whose catalog is readable and no longer lists one of its skills. */
  const missingSkill = (row: ToolRow): boolean => row.policy === 'gated'
    && knownSkills !== undefined && row.skills.some(skill => !knownSkills.has(skill))
  return <section className={styles.directory}>
    <div className={styles.toolbar}>
      <div className={styles.search}>
        <label className={styles.srOnly} htmlFor={searchId}>{t('table.search')}</label>
        <Input id={searchId} placeholder={t('table.search')} value={query}
          onChange={(event: ChangeEvent<HTMLInputElement>) => { setQuery(event.target.value); setPage(0) }} />
      </div>
      <label className={styles.srOnly} htmlFor={filterId}>{t('table.filter')}</label>
      <select id={filterId} className={styles.select} value={filter}
        onChange={event => { onFilter(event.target.value as ToolPolicy | 'all'); setPage(0) }}>
        <option value="all">{t('policy.all')}</option>
        {(['available', 'gated', 'blocked'] as const).map(policy => <option key={policy} value={policy}>{t('policy.' + policy as 'policy.available' | 'policy.gated' | 'policy.blocked')}</option>)}
      </select>
    </div>
    <table className={styles.table} aria-label={t('table.name')}>
      <thead><tr>
        <th className={styles.checkColumn}>
          <input type="checkbox" aria-label={t('table.selectPage')} disabled={busy || visible.length === 0} checked={pageSelected}
            onChange={() => onSelect(pageSelected
              ? selected.filter(name => !visible.some(row => row.name === name))
              : [...new Set([...selected, ...visible.map(row => row.name)])])} />
        </th>
        <th>{t('table.name')}</th><th>{t('table.policy')}</th>
        <th className={styles.actionColumn}><span className={styles.srOnly}>{t('table.actions')}</span></th>
      </tr></thead>
      <tbody>{visible.map(row => <tr key={row.name} data-tool-row={row.name} data-selected={selected.includes(row.name) || undefined}>
        <td className={styles.checkColumn}><input type="checkbox" aria-label={t('table.selectTool', { tool: row.name })}
          disabled={busy} checked={selected.includes(row.name)} onChange={() => onSelect(selected.includes(row.name)
            ? selected.filter(name => name !== row.name) : [...selected, row.name])} /></td>
        <td><code className={styles.toolName}>{row.name}</code>
          {!knownTools.has(row.name) && <span className={styles.subtle}>{t('table.unregistered')}</span>}
        </td>
        <td><span className={styles.policyBadge} data-policy={row.policy}>{t('policy.' + row.policy as 'policy.available' | 'policy.gated' | 'policy.blocked')}</span>
          {row.policy === 'gated' && <span className={styles.skillNames} title={row.skills.join(', ')}>{row.skills.join(' · ')}</span>}
          {missingSkill(row) && <span className={styles.subtle}>{t('table.missingSkills')}</span>}
        </td>
        <td className={styles.actionColumn}><Button size="sm" variant="outline" disabled={busy}
          aria-label={t('table.editTool', { tool: row.name })} onClick={() => onEdit(row.name)}>{t('table.edit')}</Button></td>
      </tr>)}</tbody>
    </table>
    {matches.length === 0 && <p className={styles.empty}>{t('table.empty')}</p>}
    <div className={styles.pagination}>
      <span className={styles.subtle}>{t('table.result', { count: matches.length })}</span>
      <div className={styles.actions}>
        <Button size="sm" variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{t('table.previous')}</Button>
        <span className={styles.pageNumber}>{t('table.page', { page: currentPage + 1, pages })}</span>
        <Button size="sm" variant="outline" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}>{t('table.next')}</Button>
      </div>
    </div>
  </section>
}
