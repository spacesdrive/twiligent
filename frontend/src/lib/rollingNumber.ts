// the characters of a formatted number, each marked as a rolling digit or a fixed sign (comma, point, unit letter)

export interface RollingChar {
  // counted from the right, so the ones column keeps its key when the number grows a digit on the left
  key: string;
  char: string;
  digit: number | null;
}

export function rollingChars(text: string): RollingChar[] {
  const chars = [...text];
  return chars.map((char, index) => {
    const fromRight = chars.length - 1 - index;
    const digit = /^[0-9]$/.test(char) ? Number(char) : null;
    return { key: `${digit === null ? 's' : 'd'}${fromRight}`, char, digit };
  });
}
