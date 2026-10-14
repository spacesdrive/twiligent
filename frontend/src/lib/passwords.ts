// Supabase's default minimum; a project set higher still answers with its own message
export const PASSWORD_MIN_LENGTH = 6;

// what is wrong with a new password before it is sent, or null when it can be saved
export function newPasswordProblem(password: string, confirmation: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password !== confirmation) return 'The two passwords do not match.';
  return null;
}
