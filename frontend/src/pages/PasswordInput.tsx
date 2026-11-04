import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PASSWORD_MIN_LENGTH } from '@/lib/passwords';

export interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: 'current-password' | 'new-password';
  showPassword: boolean;
  onTogglePassword: () => void;
  error?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

// the error text is rendered by the caller (FieldRow or the password form); this wires the input to it
export default function PasswordInput({
  id, value, onChange, placeholder, autoComplete, showPassword, onTogglePassword, error, ...aria
}: PasswordInputProps) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={showPassword ? 'text' : 'password'}
        className="h-(--control-h-lg) pr-11"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        minLength={PASSWORD_MIN_LENGTH}
        autoComplete={autoComplete}
        aria-invalid={error || aria['aria-invalid'] ? true : undefined}
        aria-describedby={aria['aria-describedby'] ?? (error ? `${id}-error` : undefined)}
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
  );
}
