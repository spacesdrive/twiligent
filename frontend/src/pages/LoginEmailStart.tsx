import type { FormEvent } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';
import { looksLikeEmail } from '@/lib/emailAddress';

export interface LoginEmailStartProps {
  email: string;
  onEmailChange: (value: string) => void;
  loading: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

// one field for the address with the Continue arrow inside it; the arrow wakes up once the address looks complete
export default function LoginEmailStart({ email, onEmailChange, loading, onSubmit }: LoginEmailStartProps) {
  return (
    <form onSubmit={onSubmit}>
      {/* the group dims itself when anything in it is disabled, and only the arrow should; its focus is one red border
          with a faint halo instead of the default wide ring */}
      <InputGroup className="h-12 rounded-field bg-surface-raised has-disabled:bg-surface-raised has-disabled:opacity-100 dark:has-disabled:bg-surface-raised has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/15">
        <InputGroupAddon>
          <Mail className="ml-1.5 text-ink-faint" />
        </InputGroupAddon>
        <InputGroupInput
          id="email"
          type="email"
          aria-label="Email"
          placeholder="you@example.com"
          value={email}
          onChange={e => onEmailChange(e.target.value)}
          required
          autoComplete="email"
          autoFocus
          className="focus-visible:outline-none"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="submit"
            variant="default"
            size="icon-sm"
            className="mr-1.5 size-9 rounded-control"
            aria-label="Continue with email"
            disabled={loading || !looksLikeEmail(email)}
          >
            {loading ? <Spinner className="size-4" /> : <ArrowRight />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}
