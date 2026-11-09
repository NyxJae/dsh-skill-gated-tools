/** Focused editor for one tool or an explicitly selected group of tools. */
import { useId, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolPolicy } from '../policy.ts'
import { NS } from './locales.ts'
import styles from './SkillGateSection.module.css'

/** Selection draft and actions owned by the settings page. */
export interface RuleEditorProps {
  readonly selected: readonly string[]
  readonly policy: ToolPolicy | undefined
  readonly skills: readonly string[]
  readonly catalog: readonly string[]
  /** False when the catalog could not be read, so a missing name is merely unresolved. */
  readonly catalogResolved: boolean
  readonly busy: boolean
  readonly onPolicy: (policy: ToolPolicy) => void
  readonly onSkills: (skills: readonly string[]) => void
  readonly onClear: () => void
  readonly onSave: () => void
  readonly t: TranslateNS<typeof NS>
}

/** Render explicit policy choices, multi-skill selection and the save action. */
export function RuleEditor({ selected, policy, skills, catalog, catalogResolved, busy, onPolicy, onSkills, onClear, onSave, t }: RuleEditorProps): ReactNode {
  const id = useId()
  const [query, setQuery] = useState('')
  const choices = [...new Set([...catalog, ...skills])].sort().filter(name => name.toLowerCase().includes(query.trim().toLowerCase()))
  return <aside className={styles.editor} aria-label={t('editor.title')}>
    {selected.length === 0 ? <div className={styles.editorEmpty}>
      <span className={styles.emptySymbol} aria-hidden="true">↖</span>
      <h3>{t('editor.emptyTitle')}</h3><p className={styles.subtle}>{t('editor.empty')}</p>
    </div> : <>
      <div className={styles.editorHeading}>
        <h3>{t('editor.title')}</h3>
        <Button size="sm" variant="outline" disabled={busy} onClick={onClear}>{t('editor.clear')}</Button>
      </div>
      <div className={styles.selectionSummary}>
        <strong>{t('editor.count', { count: selected.length })}</strong>
        {selected.length === 1 ? <code className={styles.toolName}>{selected[0]}</code>
          : <details><summary>{t('editor.selectedTools')}</summary><div className={styles.selectedNames}>{selected.map(name => <code key={name}>{name}</code>)}</div></details>}
      </div>
      {selected.length > 1 && <p className={styles.subtle}>{t('editor.batch')}</p>}
      <fieldset className={styles.policyChoices} disabled={busy}>
        <legend className={styles.srOnly}>{t('editor.policy')}</legend>
        {(['available', 'gated', 'blocked'] as const).map(kind => <label key={kind} className={styles.policyChoice} data-active={policy === kind || undefined}>
          <input type="radio" name={id} checked={policy === kind} onChange={() => onPolicy(kind)} />
          <span><strong>{t('policy.' + kind as 'policy.available' | 'policy.gated' | 'policy.blocked')}</strong>
            <span className={styles.subtle}>{t('policy.' + kind + 'Desc' as 'policy.availableDesc' | 'policy.gatedDesc' | 'policy.blockedDesc')}</span></span>
        </label>)}
      </fieldset>
      {policy === 'gated' && <div className={styles.skillPicker}>
        <label className={styles.label} htmlFor={id + '-skills'}>{t('skills.label')}</label>
        <Input id={id + '-skills'} placeholder={t('skills.search')} value={query} disabled={busy} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} />
        <div className={styles.skillChoices}>
          {choices.map(name => <label key={name} className={styles.skillChoice}>
            <input type="checkbox" disabled={busy} checked={skills.includes(name)} onChange={() => onSkills(skills.includes(name) ? skills.filter(skill => skill !== name) : [...skills, name])} />
            <span><code>{name}</code>{!catalog.includes(name) && <span className={styles.subtle}>{t(catalogResolved ? 'skills.missing' : 'skills.unresolved')}</span>}</span>
          </label>)}
          {choices.length === 0 && <p className={styles.subtle}>{t('skills.empty')}</p>}
        </div>
        <p className={styles.subtle}>{t('skills.selected', { count: skills.length })}</p>
      </div>}
      <Button variant="primary" disabled={busy || policy === undefined || (policy === 'gated' && skills.length === 0)} onClick={onSave}>
        {busy ? t('save.saving') : t('save.submit')}
      </Button>
    </>}
  </aside>
}
