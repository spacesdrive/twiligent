import { fileSizeMb } from './queueHelpers.ts';
import { goesLiveLabel } from './scheduleHelpers.ts';
import type { ReactNode } from 'react';
import type { AppAccount } from '../../utils/formatters';
import type { ContentTypeOption } from './publishConstants';
import type { ScheduleFieldValues } from './scheduleHelpers.ts';

interface SummaryRowProps {
  label: string;
  children: ReactNode;
}

interface PostSummaryProps {
  selectedAcct: AppAccount | undefined;
  selectedType: ContentTypeOption | undefined;
  file: File | null;
  fields: ScheduleFieldValues;
}

function SummaryRow({ label, children }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 text-small">
      <span className="text-ink-faint">{label}</span>
      <span className="min-w-0 truncate font-medium text-ink">{children}</span>
    </div>
  );
}

export default function PostSummary({ selectedAcct, selectedType, file, fields }: PostSummaryProps) {
  return (
    <div className="flex flex-col gap-2 rounded-control bg-surface-sunken/60 p-3">
      <SummaryRow label="Account">{selectedAcct ? `@${selectedAcct.username || selectedAcct.title}` : '-'}</SummaryRow>
      <SummaryRow label="Type">{selectedType?.label || '-'}</SummaryRow>
      <SummaryRow label="File">{file ? `${fileSizeMb(file, 1)} MB` : '-'}</SummaryRow>
      <SummaryRow label="Goes live">{goesLiveLabel(fields)}</SummaryRow>
    </div>
  );
}
