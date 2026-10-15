// enough of a check to enable the Continue button: something, an @, a dot in the domain; Supabase checks the rest
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function looksLikeEmail(value: string): boolean {
  return EMAIL_SHAPE.test(value.trim());
}
