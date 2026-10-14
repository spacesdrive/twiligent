import { useEffect, useState } from 'react';

// seconds left until something may happen again, such as sending another email code; 0 when it may happen now
export function useCountdown(): [secondsLeft: number, start: (seconds: number) => void] {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft(seconds => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  return [secondsLeft, setSecondsLeft];
}
