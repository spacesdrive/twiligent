import type { FormEvent } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';
import { fieldErrorId } from '@/lib/fieldIds';

export interface LoginEmailStartProps {
  email: string;
  onEmailChange: (value: string) => void;
  loading: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  error?: string;
}

// one field for the address with the Continue arrow inside it; a missing or incomplete address is explained under
// the field when the arrow is pressed, rather than the arrow greying out without saying why
export default function LoginEmailStart({ email, onEmailChange, loading, onSubmit, error }: LoginEmailStartProps) {
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
      <label htmlFor="email" className="text-sm font-medium text-ink">Email</label>
      {/* the group dims itself when anything in it is disabled, and only the arrow should; focus shows on the
          group's own border and faint halo, because the input inside it has none of its own */}
      <InputGroup className="h-12 rounded-field bg-surface-raised has-disabled:bg-surface-raised has-disabled:opacity-100 dark:has-disabled:bg-surface-raised">
        <InputGroupAddon>
          <Mail className="ml-1.5 text-ink-faint" aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          id="email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => onEmailChange(e.target.value)}
          required
          autoComplete="email"
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? fieldErrorId('email') : undefined}
          className="focus-visible:outline-none"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="submit"
            variant="default"
            size="icon-sm"
            className="mr-1.5 size-9 rounded-control"
            aria-label="Continue with email"
            disabled={loading}
          >
            {loading ? <Spinner className="size-4" /> : <ArrowRight />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {error && (
        <p id={fieldErrorId('email')} className="text-sm text-danger"><span className="sr-only">Error: </span>{error}</p>
      )}
    </form>
  );
}
