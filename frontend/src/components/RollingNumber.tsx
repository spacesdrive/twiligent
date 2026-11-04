import type { CSSProperties } from 'react';
import { rollingChars } from '@/lib/rollingNumber';
import { cn } from '@/lib/utils';

export interface RollingNumberProps {
  // the number as it should read, already formatted ("12.4K", "1,204")
  text: string;
  className?: string;
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// adapted from Bencho's Rolling counter (MIT, see THIRD_PARTY_NOTICES.md): every digit is a 0 to 9 strip behind a
// one-line window, so a changed value rolls each column to its new digit like an odometer; screen readers get the text
export default function RollingNumber({ text, className }: RollingNumberProps) {
  const chars = rollingChars(text);
  return (
    <span className={cn('roll tabular-nums', className)}>
      <span className="sr-only">{text}</span>
      <span className="roll-row" aria-hidden="true">
        {chars.map((item, index) =>
          item.digit === null ? (
            <span key={item.key} className="roll-sign">{item.char}</span>
          ) : (
            <span key={item.key} className="roll-window">
              <span
                className="roll-strip"
                style={{ '--roll-digit': item.digit, '--roll-order': chars.length - 1 - index } as CSSProperties}
              >
                {DIGITS.map(digit => <span key={digit}>{digit}</span>)}
              </span>
            </span>
          ),
        )}
      </span>
    </span>
  );
}
