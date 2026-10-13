import React, { useEffect, useRef, useState } from 'react';
import { createHoldController, DEFAULT_HOLD_MS } from '@/lib/holdProgress';
import { cn } from '@/lib/utils';

const HOLD_KEYS = new Set([' ', 'Enter']);

type HoldController = ReturnType<typeof createHoldController>;

export interface HoldToConfirmButtonProps {
  onConfirm: () => void;
  children?: React.ReactNode;
  holdingLabel?: React.ReactNode;
  duration?: number;
  disabled?: boolean;
  className?: string;
}

// Destructive confirm that must be held, by pointer or by Space/Enter. A plain click never fires it.
export default function HoldToConfirmButton({
  onConfirm,
  children,
  holdingLabel = 'Keep holding',
  duration = DEFAULT_HOLD_MS,
  disabled = false,
  className,
}: HoldToConfirmButtonProps) {
  const [progress, setProgress] = useState(0);
  const controllerRef = useRef<HoldController | null>(null);
  const confirmRef = useRef(onConfirm);

  useEffect(() => { confirmRef.current = onConfirm; }, [onConfirm]);

  useEffect(() => {
    const controller = createHoldController({
      duration,
      onProgress: setProgress,
      onComplete: () => confirmRef.current?.(),
    });
    controllerRef.current = controller;
    return () => controller.cancel();
  }, [duration]);

  useEffect(() => {
    if (disabled) controllerRef.current?.reset();
  }, [disabled]);

  const start = () => { if (!disabled) controllerRef.current?.start(); };
  const cancel = () => controllerRef.current?.cancel();
  const holding = progress > 0 && progress < 1;

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={e => { if (e.button === 0) { e.currentTarget.setPointerCapture?.(e.pointerId); start(); } }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onKeyDown={e => {
        if (!HOLD_KEYS.has(e.key)) return;
        e.preventDefault();
        if (!e.repeat) start();
      }}
      onKeyUp={e => { if (HOLD_KEYS.has(e.key)) cancel(); }}
      onBlur={cancel}
      onContextMenu={e => e.preventDefault()}
      className={cn(
        'relative inline-flex h-(--control-h) shrink-0 touch-none items-center justify-center gap-2 overflow-hidden rounded-control bg-danger-soft px-4 text-sm font-medium text-danger select-none',
        'transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 bg-brand"
        style={{ width: `${progress * 100}%` }}
      />
      <span className={cn('relative z-10 flex items-center gap-2', progress > 0.5 && 'text-on-brand')}>
        {holding ? holdingLabel : children}
      </span>
      <span role="progressbar" aria-label="Hold progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} className="sr-only" />
    </button>
  );
}
