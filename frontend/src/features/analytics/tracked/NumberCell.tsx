import { TableCell } from '@/components/ui/table';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';

// fmtNum abbreviates only at 1000 and above, so the full value is redundant below that
function showsFullValue(value: number | null | undefined): boolean {
  return Math.abs(Number(value) || 0) >= 1000;
}

export interface NumberCellProps {
  value: number | null | undefined;
}

export default function NumberCell({ value }: NumberCellProps) {
  return (
    <TableCell className="text-right">
      <p className="font-semibold text-ink">{fmtNum(value ?? 0)}</p>
      {showsFullValue(value) && <p className="text-caption text-ink-faint">{fmtNumFull(value)}</p>}
    </TableCell>
  );
}
