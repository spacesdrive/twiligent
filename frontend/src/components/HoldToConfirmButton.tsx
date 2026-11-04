import React, { useEffect, useRef, useState } from 'react';
import { createHoldController, DEFAULT_HOLD_MS } from '@/lib/holdProgress';
import { cn } from '@/lib/utils';
import LiveStatus from './LiveStatus';

const HOLD_KEYS = new Set([' ', 'Enter']);

type HoldController = ReturnType<typeof createHoldController>;

export interface HoldToConfirmButtonProps {
  onConfirm: () => void;
  children?: React.ReactNode;
  holdingLabel?: React.ReactNode;
  armedLabel?: React.ReactNode;
  duration?: number;
  disabled?: boolean;
  className?: string;
}

// Destructive confirm: hold it (pointer, Space or Enter), or press it twice. One stray press never fires it, and
// pressing twice serves voice control and switch users, who cannot hold.
export default function HoldToConfirmButton({
  onConfirm,
  children,
  holdingLabel = 'Keep holding',
  armedLabel = 'Press again to confirm',
  duration = DEFAULT_HOLD_MS,
  disabled = false,
  className,
}: HoldToConfirmButtonProps) {
  const [progress, setProgress] = useState(0);
  const [armedState, setArmed] = useState(false);
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

  // a disabled button is never armed, so a busy dialog cannot confirm on the press after it
  const armed = armedState && !disabled;

  const start = () => { if (!disabled) controllerRef.current?.start(); };
  const cancel = () => controllerRef.current?.cancel();
  const holding = progress > 0 && progress < 1;

  // a short press arms the button and the next one confirms; a press that completed a hold is not counted again
  const press = () => {
    if (disabled || controllerRef.current?.completed) return;
    if (armed) {
      setArmed(false);
      confirmRef.current?.();
      return;
    }
    setArmed(true);
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onPointerDown={e => { if (e.button === 0) { e.currentTarget.setPointerCapture?.(e.pointerId); start(); } }}
        onPointerUp={cancel}
        onPointerCancel={cancel}
        onPointerLeave={cancel}
        onClick={e => { if (e.detail > 0) press(); }}
        onKeyDown={e => {
          if (e.key === 'Escape' && armed) { setArmed(false); return; }
          if (!HOLD_KEYS.has(e.key)) return;
          e.preventDefault();
          if (!e.repeat) start();
        }}
        onKeyUp={e => {
          if (!HOLD_KEYS.has(e.key)) return;
          e.preventDefault();
          const completed = controllerRef.current?.completed;
          cancel();
          if (!completed) press();
        }}
        onBlur={() => { cancel(); setArmed(false); }}
        onContextMenu={e => e.preventDefault()}
        className={cn(
          'relative inline-flex h-(--control-h) shrink-0 touch-none items-center justify-center gap-2 overflow-hidden rounded-control bg-danger-soft px-4 text-sm font-medium text-danger select-none',
          'transition-colors duration-(--duration-fast) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          'disabled:pointer-events-none disabled:opacity-50',
          armed && 'bg-brand text-on-brand',
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-brand"
          style={{ width: `${progress * 100}%` }}
        />
        <span className={cn('relative z-10 flex items-center gap-2', progress > 0.5 && 'text-on-brand')}>
          {holding ? holdingLabel : armed ? armedLabel : children}
        </span>
      </button>
      <LiveStatus message={armed ? 'Press the button again to confirm, or press Escape to stop.' : ''} />
    </>
  );
}
