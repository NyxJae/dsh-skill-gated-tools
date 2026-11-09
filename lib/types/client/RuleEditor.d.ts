import type { ReactNode } from 'react';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { ToolPolicy } from '../policy.ts';
import { NS } from './locales.ts';
/** Selection draft and actions owned by the settings page. */
export interface RuleEditorProps {
    readonly selected: readonly string[];
    readonly policy: ToolPolicy | undefined;
    readonly skills: readonly string[];
    readonly catalog: readonly string[];
    /** False when the catalog could not be read, so a missing name is merely unresolved. */
    readonly catalogResolved: boolean;
    readonly busy: boolean;
    readonly onPolicy: (policy: ToolPolicy) => void;
    readonly onSkills: (skills: readonly string[]) => void;
    readonly onClear: () => void;
    readonly onSave: () => void;
    readonly t: TranslateNS<typeof NS>;
}
/** Render explicit policy choices, multi-skill selection and the save action. */
export declare function RuleEditor({ selected, policy, skills, catalog, catalogResolved, busy, onPolicy, onSkills, onClear, onSave, t }: RuleEditorProps): ReactNode;
//# sourceMappingURL=RuleEditor.d.ts.map