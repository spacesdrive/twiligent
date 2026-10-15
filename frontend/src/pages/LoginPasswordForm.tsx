import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { FieldRow } from '@/components/DetailPanel';
import { PASSWORD_MIN_LENGTH } from '@/lib/passwords';
import PasswordInput from './PasswordInput';
import type { LoginCopy } from './loginCopy';

export interface LoginPasswordFormProps {
  // false signs in, true creates a password account
  isSignUp: boolean;
  copy: LoginCopy;
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  showPassword: boolean;
  onTogglePassword: () => void;
  loading: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onForgotPassword: () => void;
  // between signing in and creating an account
  onSwitch: () => void;
}

export default function LoginPasswordForm({
  isSignUp,
  copy,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  showPassword,
  onTogglePassword,
  loading,
  onSubmit,
  onForgotPassword,
  onSwitch,
}: LoginPasswordFormProps) {
  const quietLink =
    'rounded-sm text-caption text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
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
          autoFocus={!email}
        />
      </FieldRow>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-sm font-medium text-ink">
            Password
          </label>
          {!isSignUp && (
            <button type="button" onClick={onForgotPassword} className={quietLink}>
              Forgot your password?
            </button>
          )}
        </div>
        <PasswordInput
          id="password"
          value={password}
          onChange={onPasswordChange}
          placeholder={isSignUp ? `At least ${PASSWORD_MIN_LENGTH} characters` : 'Your password'}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          showPassword={showPassword}
          onTogglePassword={onTogglePassword}
        />
      </div>
      <Button type="submit" size="lg" className="mt-1 w-full" disabled={loading}>
        {loading && <Spinner className="size-4" />}
        {loading ? copy.busy : copy.submit}
      </Button>
      <p className="text-center text-caption text-ink-muted">
        {isSignUp ? 'Already have an account?' : 'No account yet?'}{' '}
        <button type="button" onClick={onSwitch} className={`font-medium text-ink ${quietLink}`}>
          {isSignUp ? 'Sign in' : 'Create one with a password'}
        </button>
      </p>
    </form>
  );
}
