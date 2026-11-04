// Supabase's default minimum; a project set higher still answers with its own message
export const PASSWORD_MIN_LENGTH = 6;

export interface PasswordProblem {
  field: 'password' | 'confirmation';
  message: string;
}

// what is wrong with a new password before it is sent and which field to fix, or null when it can be saved
export function newPasswordError(password: string, confirmation: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN_LENGTH) return { field: 'password', message: `Use at least ${PASSWORD_MIN_LENGTH} characters.` };
  if (password !== confirmation) return { field: 'confirmation', message: 'The two passwords do not match. Type the same password in both fields.' };
  return null;
}

export function newPasswordProblem(password: string, confirmation: string): string | null {
  return newPasswordError(password, confirmation)?.message ?? null;
}
