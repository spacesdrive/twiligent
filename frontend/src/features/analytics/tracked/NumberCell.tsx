import { TableCell } from '@/components/ui/table';
import Num from '@/components/Num';

export interface NumberCellProps {
  value: number | null | undefined;
  className?: string;
}

export default function NumberCell({ value, className = 'text-right font-semibold text-ink' }: NumberCellProps) {
  return <TableCell className={className}><Num value={value ?? 0} /></TableCell>;
}
