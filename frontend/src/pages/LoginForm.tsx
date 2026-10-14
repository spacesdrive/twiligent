import type { FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { FieldRow } from '@/components/DetailPanel';
import { PASSWORD_MIN_LENGTH } from '@/lib/passwords';
import PasswordInput from './PasswordInput';
import type { LoginCopy } from './loginCopy';

export interface LoginFormProps {
  isLogin: boolean;
  copy: LoginCopy;
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  showPassword: boolean;
  onTogglePassword: () => void;
  loading: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  // shown on the sign-in form only
  onForgotPassword?: () => void;
}

export default function LoginForm({
  isLogin, copy, email, password, onEmailChange, onPasswordChange, showPassword, onTogglePassword, loading, onSubmit, onForgotPassword,
}: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FieldRow label="Email" htmlFor="email">
        <Input
          id="email"
          type="email"
          className="h-(--control-h-lg)"
          placeholder="you@example.com"
          value={email}
          onChange={e => onEmailChange(e.target.value)}
          required
          autoComplete="email"
        />
      </FieldRow>
      <FieldRow label="Password" htmlFor="password">
        <PasswordInput
          id="password"
          value={password}
          onChange={onPasswordChange}
          placeholder={isLogin ? 'Your password' : `At least ${PASSWORD_MIN_LENGTH} characters`}
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          showPassword={showPassword}
          onTogglePassword={onTogglePassword}
        />
      </FieldRow>
      {onForgotPassword && (
        <button
          type="button"
          onClick={onForgotPassword}
          className="-mt-2 self-end rounded-sm text-sm font-medium text-brand-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Forgot password?
        </button>
      )}
      <Button type="submit" size="lg" className="mt-2 w-full" disabled={loading}>
        {loading && <Spinner className="size-4" />}
        {loading ? copy.busy : copy.submit}
        {!loading && <ArrowRight data-icon="inline-end" />}
      </Button>
    </form>
  );
}
