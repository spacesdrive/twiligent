import { Input } from '@/components/ui/input';

export default function IconInput({ icon, ...props }) {
  const Icon = icon;
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 stroke-[1.75] text-ink-faint" />
      <Input className="pl-9" {...props} />
    </div>
  );
}
