import type { FormEvent, ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { FieldRow } from '@/components/DetailPanel';
import { CODE_LENGTH, cleanCode } from '@/lib/authErrors';
import type { LoginCopy } from './loginCopy';

export interface LoginCodeFormProps {
  copy: LoginCopy;
  email: string;
  code: string;
  onCodeChange: (value: string) => void;
  loading: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  // seconds until another code may be sent; 0 when it may be sent now
  resendIn: number;
  resending: boolean;
  onResend: () => void;
  // more fields after the code, such as the new password on the reset step
  children?: ReactNode;
  error?: string;
}

// the button stays enabled: a short code is explained under the field instead of a silent grey button
export default function LoginCodeForm({
  copy, email, code, onCodeChange, loading, onSubmit, resendIn, resending, onResend, children, error,
}: LoginCodeFormProps) {
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FieldRow label="Verification code" htmlFor="code" error={error}>
        <Input
          id="code"
          className="h-(--control-h-lg) text-center font-mono text-lg tracking-[0.4em]"
          placeholder="000000"
          value={code}
          onChange={e => onCodeChange(cleanCode(e.target.value))}
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH + 4}
          aria-describedby="code-help"
          autoFocus
        />
      </FieldRow>
      <p id="code-help" className="text-sm text-ink-muted">
        Sent to <span className="font-medium text-ink">{email}</span>. If it has not arrived, check your spam folder.
      </p>
      {children}
      <Button type="submit" size="lg" className="mt-2 w-full" disabled={loading}>
        {loading && <Spinner className="size-4" />}
        {loading ? copy.busy : copy.submit}
      </Button>
      <Button type="button" variant="ghost" size="sm" className="self-center" onClick={onResend} disabled={resending || resendIn > 0}>
        {resending ? <Spinner className="size-4" /> : <RotateCw data-icon="inline-start" />}
        {resending ? 'Sending a new code' : resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
      </Button>
      {resendIn > 0 && <p className="-mt-2 text-center text-small text-ink-muted">Email providers allow one code a minute.</p>}
    </form>
  );
}
