import SegmentedChoice from '@/components/SegmentedChoice';
import { CONTENT_TYPES } from './publishConstants';
import type { ContentTypeValue } from './publishHelpers.ts';

interface TypePickerProps {
  id: string;
  name: string;
  value: ContentTypeValue | '';
  onChange: (value: ContentTypeValue) => void;
  disabled?: boolean;
  'aria-describedby'?: string;
}

// native radios: one tab stop, arrow keys between the types, and the legend of the surrounding fieldset names it
export default function TypePicker({ id, name, value, onChange, disabled, ...aria }: TypePickerProps) {
  return (
    <SegmentedChoice<ContentTypeValue | ''>
      id={id}
      name={name}
      variant="tiles"
      options={CONTENT_TYPES.map(type => {
        const Icon = type.icon;
        return { value: type.value, label: type.label, icon: <Icon /> };
      })}
      value={value}
      onChange={next => { if (next) onChange(next); }}
      disabled={disabled}
      {...aria}
    />
  );
}
