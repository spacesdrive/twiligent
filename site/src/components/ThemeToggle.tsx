import { Moon, Sun } from './icons';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, toggle] = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to the ${next} theme`}
      className={cn(
        'flex size-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink',
        className,
      )}
    >
      {theme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}
