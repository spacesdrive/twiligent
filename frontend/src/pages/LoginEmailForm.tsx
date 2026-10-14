import type { FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { FieldRow } from '@/components/DetailPanel';
import type { LoginCopy } from './loginCopy';

export interface LoginEmailFormProps {
  copy: LoginCopy;
  email: string;
  onEmailChange: (value: string) => void;
  loading: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export default function LoginEmailForm({ copy, email, onEmailChange, loading, onSubmit }: LoginEmailFormProps) {
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
          autoFocus
        />
      </FieldRow>
      <Button type="submit" size="lg" className="mt-2 w-full" disabled={loading}>
        {loading && <Spinner className="size-4" />}
        {loading ? copy.busy : copy.submit}
        {!loading && <ArrowRight data-icon="inline-end" />}
      </Button>
    </form>
  );
}
