export type RecoveredPasswordValues = { newPassword: string; confirmPassword: string };
export type RecoveredPasswordErrors = Partial<Record<keyof RecoveredPasswordValues,
  'Password is required.' | 'Password must be at least 6 characters.' | 'Passwords do not match.'>>;

export function validateRecoveredPassword(values: RecoveredPasswordValues): RecoveredPasswordErrors {
  const errors: RecoveredPasswordErrors = {};
  if (!values.newPassword.trim()) errors.newPassword = 'Password is required.';
  else if (values.newPassword.length < 6) errors.newPassword = 'Password must be at least 6 characters.';
  if (!values.confirmPassword || values.confirmPassword !== values.newPassword) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

type RecoveryClient = { auth: {
  resetPasswordForEmail(email: string, options: { redirectTo: string }): PromiseLike<{ error: unknown }>;
  getUser(): PromiseLike<{ data: { user: { id: string } | null }; error: unknown }>;
  updateUser(values: { password: string }): PromiseLike<{ data: { user: { id: string } | null }; error: unknown }>;
} };
export function recoveryError() { return Object.assign(new Error('password_recovery_required'), { code: 'password_recovery_required' }); }

export async function requestPasswordRecovery(transport: unknown, email: string, redirectTo: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('invalid_recovery_email');
  const target = new URL(redirectTo);
  if (!['https:', 'http:', 'mobile:', 'exp:', 'exps:'].includes(target.protocol)) throw new Error('invalid_recovery_redirect');
  const { error } = await (transport as RecoveryClient).auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw error;
}

// Supabase validates the session obtained from the email link. Never accept a
// caller-supplied email or user ID as authority to change an account's password.
export async function updateRecoveredPassword(transport: unknown, values: RecoveredPasswordValues, expectedUserId: string) {
  if (Object.keys(validateRecoveredPassword(values)).length) throw new Error('invalid_password_reset');
  const client = transport as RecoveryClient;
  const account = await client.auth.getUser();
  if (account.error) throw account.error;
  if (!expectedUserId || account.data.user?.id !== expectedUserId) throw recoveryError();
  const updated = await client.auth.updateUser({ password: values.newPassword });
  if (updated.error) throw updated.error;
  if (updated.data.user?.id !== expectedUserId) throw recoveryError();
}
