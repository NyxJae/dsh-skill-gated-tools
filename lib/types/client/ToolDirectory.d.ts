import type { ReactNode } from 'react';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { ToolPolicy, ToolRow } from '../policy.ts';
import { NS } from './locales.ts';
/** Directory inputs; selection, filter and busy state are owned by the settings section. */
export interface ToolDirectoryProps {
    readonly rows: readonly ToolRow[];
    readonly filter: ToolPolicy | 'all';
    readonly onFilter: (filter: ToolPolicy | 'all') => void;
    readonly knownTools: ReadonlySet<string>;
    /** Catalog skills; undefined when the catalog could not be read, so absence proves nothing. */
    readonly knownSkills?: ReadonlySet<string> | undefined;
    readonly selected: readonly string[];
    readonly onSelect: (names: readonly string[]) => void;
    readonly onEdit: (name: string) => void;
    readonly busy: boolean;
    readonly t: TranslateNS<typeof NS>;
}
/** Render a bounded tool table and its search/filter controls. */
export declare function ToolDirectory({ rows, filter, onFilter, knownTools, knownSkills, selected, onSelect, onEdit, busy, t }: ToolDirectoryProps): ReactNode;
//# sourceMappingURL=ToolDirectory.d.ts.map