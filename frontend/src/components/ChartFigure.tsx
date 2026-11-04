import React, { useId, useState } from 'react';
import { Table as TableIcon, LineChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface ChartTableColumn {
  key: string;
  label: string;
  numeric?: boolean;
  format?: (value: unknown) => string;
}

export interface ChartTableSpec {
  caption: string;
  columns: ChartTableColumn[];
  rows: readonly object[];
}

export interface ChartFigureProps {
  // the chart's name for screen readers, usually its title
  label?: string;
  // the takeaway in words, computed from the data and read in place of the plot
  description?: string;
  summary?: string;
  table?: ChartTableSpec;
  children: React.ReactNode;
  className?: string;
}

function cellText(column: ChartTableColumn, row: object): string {
  const value = (row as Record<string, unknown>)[column.key];
  if (column.format) return column.format(value);
  return value == null ? '' : String(value);
}

// a chart with its takeaway in words and its numbers as a table, for anyone who cannot read the plot
export default function ChartFigure({ label, description, summary, table, children, className }: ChartFigureProps) {
  const [showTable, setShowTable] = useState(false);
  const summaryId = useId();
  if (!summary && !table) {
    return (
      <figure aria-label={label} aria-describedby={description ? summaryId : undefined} className={className}>
        {description && <p id={summaryId} className="sr-only">{description}</p>}
        {children}
      </figure>
    );
  }
  return (
    <figure className={cn('flex flex-col gap-2', className)} aria-describedby={summary ? summaryId : undefined}>
      {showTable && table ? (
        <Table aria-label={table.caption} containerClassName="max-h-80 overflow-y-auto">
          <TableHeader>
            <TableRow>
              {table.columns.map(column => (
                <TableHead key={column.key} className={cn(column.numeric && 'text-right')}>{column.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.rows.map((row, index) => (
              <TableRow key={index}>
                {table.columns.map(column => (
                  <TableCell key={column.key} className={cn(column.numeric && 'text-right')}>{cellText(column, row)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        children
      )}
      {(summary || table) && (
        <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2">
          {summary ? <p id={summaryId} className="max-w-prose text-small text-ink-muted">{summary}</p> : <span />}
          {table && (
            <Button variant="ghost" size="sm" onClick={() => setShowTable(shown => !shown)} aria-pressed={showTable}>
              {showTable ? <LineChart data-icon="inline-start" /> : <TableIcon data-icon="inline-start" />}
              {showTable ? 'Show chart' : 'Show table'}
            </Button>
          )}
        </figcaption>
      )}
    </figure>
  );
}
