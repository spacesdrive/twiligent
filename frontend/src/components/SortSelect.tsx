import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface SortOption {
  value: string;
  label: string;
}

export interface SortSelectProps {
  options: readonly SortOption[];
  value: string;
  onChange: (value: string) => void;
}

// the one sort control for every library, in grid and list alike
export default function SortSelect({ options, value, onChange }: SortSelectProps) {
  return (
    <Select value={value} onValueChange={next => { if (next) onChange(next as string); }} items={[...options]}>
      <SelectTrigger className="h-(--control-h-lg) w-48" aria-label="Sort by"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
