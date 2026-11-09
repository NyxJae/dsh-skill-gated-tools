import type { ReactNode } from 'react';
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { BindingRow, Snapshot } from './snapshot.ts';
import { NS } from './locales.ts';
/** Host operations injected into the settings section. */
export interface SkillGateInjected {
    readonly load: () => Promise<Snapshot>;
    readonly save: (rows: readonly BindingRow[], blockedTools: readonly string[]) => Promise<readonly BindingRow[]>;
    readonly importLegacy: () => Promise<{
        readonly bindings: readonly BindingRow[];
        readonly blockedTools: readonly string[];
    }>;
}
export type SkillGateSectionProps = PropsLocale<typeof NS> & InjectFace<SkillGateInjected>;
/** Render searchable rule management for the document this profile owns. */
export declare function SkillGateSection({ load, save, importLegacy, t }: SkillGateSectionProps): ReactNode;
//# sourceMappingURL=SkillGateSection.d.ts.map