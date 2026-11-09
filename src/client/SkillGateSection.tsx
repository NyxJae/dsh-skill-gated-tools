/** Tool policy workspace: the rule directory and the editor for the current selection. */
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { describeTools, replacePolicies, type ToolPolicy } from '../policy.ts'
import type { BindingRow, Snapshot } from './snapshot.ts'
import { RuleEditor } from './RuleEditor.tsx'
import { ToolDirectory } from './ToolDirectory.tsx'
import { NS } from './locales.ts'
import styles from './SkillGateSection.module.css'

/** Host operations injected into the settings section. */
export interface SkillGateInjected {
  readonly load: () => Promise<Snapshot>
  readonly save: (rows: readonly BindingRow[], blockedTools: readonly string[]) => Promise<readonly BindingRow[]>
  readonly importLegacy: () => Promise<{ readonly bindings: readonly BindingRow[], readonly blockedTools: readonly string[] }>
}
export type SkillGateSectionProps = PropsLocale<typeof NS> & InjectFace<SkillGateInjected>

/** Render searchable rule management for the document this profile owns. */
export function SkillGateSection({ load, save, importLegacy, t }: SkillGateSectionProps): ReactNode {
  const [snapshot, setSnapshot] = useState<Snapshot>()
  const [busy, setBusy] = useState<'load' | 'save' | 'import' | undefined>('load')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error', text: string }>()
  const [filter, setFilter] = useState<ToolPolicy | 'all'>('all')
  const [selected, setSelected] = useState<readonly string[]>([])
  const [policy, setPolicy] = useState<ToolPolicy>()
  const [skills, setSkills] = useState<readonly string[]>([])

  // A reload replaces the rules the draft was derived from. Keeping the old
  // selection would let the next save write a stale policy over the file the
  // host just handed back, so the draft is dropped whenever rules are adopted.
  const clearDraft = useCallback((): void => {
    setSelected([])
    setPolicy(undefined)
    setSkills([])
  }, [])
  const refresh = useCallback(async (): Promise<void> => {
    setBusy('load')
    setMessage(undefined)
    // A failed read keeps the draft: nothing replaced the rules it came from.
    try { setSnapshot(await load()); clearDraft() }
    catch (error) { setMessage({ kind: 'error', text: t('load.failed', { message: String(error) }) }) }
    finally { setBusy(undefined) }
  }, [clearDraft, load, t])
  useEffect(() => { void refresh() }, [refresh])

  const rows = snapshot === undefined ? [] : describeTools([
    ...snapshot.tools, ...snapshot.blockedTools, ...snapshot.bindings.flatMap(row => row.tools),
  ], snapshot.bindings, snapshot.blockedTools)
  const choose = (names: readonly string[]): void => {
    setSelected(names)
    setMessage(undefined)
    const row = names.length === 1 ? rows.find(row => row.name === names[0]) : undefined
    setPolicy(row?.policy)
    setSkills(row?.skills ?? [])
  }
  const persist = async (): Promise<void> => {
    if (snapshot === undefined || busy !== undefined || policy === undefined || selected.length === 0 || (policy === 'gated' && skills.length === 0)) return
    const next = replacePolicies(snapshot.bindings, snapshot.blockedTools, selected, policy, skills)
    setBusy('save')
    setMessage(undefined)
    try {
      const saved = await save(next.bindings, next.blockedTools)
      setSnapshot(current => current === undefined ? current : { ...current, bindings: saved, blockedTools: next.blockedTools })
      setMessage({ kind: 'ok', text: t('save.saved') })
    } catch (error) { setMessage({ kind: 'error', text: t('save.failed', { message: String(error) }) }) }
    finally { setBusy(undefined) }
  }
  const importLegacyRules = async (): Promise<void> => {
    if (snapshot === undefined || busy !== undefined) return
    setBusy('import')
    setMessage(undefined)
    try {
      const imported = await importLegacy()
      setSnapshot(current => current === undefined ? current : {
        ...current,
        bindings: imported.bindings,
        blockedTools: imported.blockedTools,
        legacyAvailable: false,
      })
      clearDraft()
      setMessage({ kind: 'ok', text: t('legacy.imported') })
    } catch (error) { setMessage({ kind: 'error', text: t('legacy.failed', { message: String(error) }) }) }
    finally { setBusy(undefined) }
  }
  const missingSkills = snapshot?.bindings.map(row => row.skill).filter(skill => !snapshot.skills.includes(skill)) ?? []
  // An unavailable catalog leaves saved skills unresolved; it is not proof they were deleted.
  const catalogResolved = snapshot?.skillsResolved ?? true
  return <div className={styles.section}>
    <header className={styles.header}>
      <h2 className={styles.title}>{t('title')}</h2>
      <Button size="sm" variant="outline" disabled={busy !== undefined} onClick={() => { void refresh() }}>{t('refresh')}</Button>
    </header>
    {message !== undefined && <p className={message.kind === 'error' ? styles.error : styles.success} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    {snapshot?.warnings.map(warning => <p key={warning} className={styles.warning}>{warning}</p>)}
    {missingSkills.length > 0 && <p className={styles.warning}>{catalogResolved
      ? t('warn.unknownSkills', { skills: [...new Set(missingSkills)].join(', ') })
      : t('warn.unresolvedSkills', { skills: [...new Set(missingSkills)].join(', ') })}</p>}
    {snapshot?.legacyAvailable === true && <div className={styles.legacy}>
      <p>{t('legacy.body', { path: snapshot.legacyBindingPath })}</p>
      <Button size="sm" variant="outline" disabled={busy !== undefined} onClick={() => { void importLegacyRules() }}>{t('legacy.import')}</Button>
    </div>}
    {busy === 'load' && snapshot === undefined && <p className={styles.loading} role="status">{t('loading')}</p>}
    {snapshot !== undefined && <>
      <div className={styles.ruleCounts}>
        {(['available', 'gated', 'blocked'] as const).map(kind => <button type="button" key={kind} aria-pressed={filter === kind}
          onClick={() => setFilter(filter === kind ? 'all' : kind)}>
          <span className={styles.dot} data-policy={kind} />
          {t('policy.' + kind as 'policy.available' | 'policy.gated' | 'policy.blocked')}<strong>{rows.filter(row => row.policy === kind).length}</strong>
        </button>)}
      </div>
      <div className={styles.workspace} data-has-selection={selected.length > 0 || undefined}>
        <ToolDirectory rows={rows} filter={filter} onFilter={setFilter} knownTools={new Set(snapshot.tools)}
          knownSkills={catalogResolved ? new Set(snapshot.skills) : undefined}
          selected={selected} onSelect={choose} onEdit={name => choose([name])} busy={busy !== undefined} t={t} />
        <RuleEditor key={selected.join('|')} selected={selected} policy={policy} skills={skills} catalog={snapshot.skills}
          catalogResolved={catalogResolved}
          busy={busy !== undefined} onPolicy={setPolicy} onSkills={setSkills} onClear={() => choose([])} onSave={() => { void persist() }} t={t} />
      </div>
      <p className={styles.storage}>
        <span>{t('store.label')}{snapshot.profileName === null ? '' : ' · ' + t('store.profile', { profile: snapshot.profileName })}</span>
        <code>{snapshot.bindingPath}</code>
      </p>
    </>}
  </div>
}
