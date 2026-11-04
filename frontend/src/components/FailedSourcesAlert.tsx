import { AlertTriangle } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { failureSummary } from '@/lib/library';
import type { SourceFailure } from '@/lib/library';

export interface FailedSourcesAlertProps {
  failures: readonly SourceFailure[];
  total: number;
  noun: string;
  onRetry: () => void;
  retrying?: boolean;
}

// totals below leave these accounts out, so the page says which ones and why
export default function FailedSourcesAlert({ failures, total, noun, onRetry, retrying = false }: FailedSourcesAlertProps) {
  if (failures.length === 0) return null;
  return (
    <Alert variant="warning" role="alert">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>Some {noun} are missing</AlertTitle>
      <AlertDescription>{failureSummary(failures, total, noun)} The figures below leave them out.</AlertDescription>
      <AlertAction>
        <Button size="xs" variant="outline" onClick={onRetry} disabled={retrying}>{retrying ? 'Retrying' : 'Try again'}</Button>
      </AlertAction>
    </Alert>
  );
}
