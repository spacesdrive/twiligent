import type { FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { FieldRow } from '@/components/DetailPanel';
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
}

export default function LoginForm({
  isLogin, copy, email, password, onEmailChange, onPasswordChange, showPassword, onTogglePassword, loading, onSubmit,
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
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            className="h-(--control-h-lg) pr-11"
            placeholder={isLogin ? 'Your password' : 'At least 6 characters'}
            value={password}
            onChange={e => onPasswordChange(e.target.value)}
            required
            minLength={6}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 text-ink-faint hover:text-ink"
            onClick={onTogglePassword}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      </FieldRow>
      <Button type="submit" size="lg" className="mt-2 w-full" disabled={loading}>
        {loading && <Spinner className="size-4" />}
        {loading ? copy.busy : copy.submit}
        {!loading && <ArrowRight data-icon="inline-end" />}
      </Button>
    </form>
  );
}
