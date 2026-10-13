import { fileSizeMb } from './queueHelpers.js';
import { goesLiveLabel } from './scheduleHelpers.js';

function SummaryRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 text-small">
      <span className="text-ink-faint">{label}</span>
      <span className="min-w-0 truncate font-medium text-ink">{children}</span>
    </div>
  );
}

export default function PostSummary({ selectedAcct, selectedType, file, fields }) {
  return (
    <div className="flex flex-col gap-2 rounded-control bg-surface-sunken/60 p-3">
      <SummaryRow label="Account">{selectedAcct ? `@${selectedAcct.username || selectedAcct.title}` : '-'}</SummaryRow>
      <SummaryRow label="Type">{selectedType?.label || '-'}</SummaryRow>
      <SummaryRow label="File">{file ? `${fileSizeMb(file, 1)} MB` : '-'}</SummaryRow>
      <SummaryRow label="Goes live">{goesLiveLabel(fields)}</SummaryRow>
    </div>
  );
}
