import React from 'react';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';
import HoldToConfirmButton from './HoldToConfirmButton';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: React.ReactNode;
  onConfirm: () => void;
  busy?: boolean;
  hold?: boolean;
  icon?: React.ReactNode;
}

// destructive actions use `hold` so a stray click cannot confirm them
export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  busy = false,
  hold = false,
  icon = <Trash2 />,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          {hold && <AlertDialogMedia>{icon}</AlertDialogMedia>}
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          {hold ? (
            <HoldToConfirmButton onConfirm={onConfirm} disabled={busy}>
              {busy ? <Spinner className="size-4" /> : null}
              {busy ? 'Working' : `Hold to ${confirmLabel.toLowerCase()}`}
            </HoldToConfirmButton>
          ) : (
            <AlertDialogAction onClick={onConfirm} disabled={busy}>
              {busy && <Spinner className="size-4" />}
              {confirmLabel}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
