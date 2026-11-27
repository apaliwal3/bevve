export type PasswordResetValues = { currentPassword: string; newPassword: string; confirmPassword: string };
export type PasswordResetError = 'Current password is required.' | 'Password is required.' |
  'Password must be at least 6 characters.' | 'Choose a different password.' | 'Passwords do not match.';
export type PasswordResetErrors = Partial<Record<keyof PasswordResetValues, PasswordResetError>>;

export function validatePasswordReset(values: PasswordResetValues): PasswordResetErrors {
  const errors: PasswordResetErrors = {};
  if (!values.currentPassword) errors.currentPassword = 'Current password is required.';
  if (!values.newPassword.trim()) errors.newPassword = 'Password is required.';
  else if (values.newPassword.length < 6) errors.newPassword = 'Password must be at least 6 characters.';
  else if (values.newPassword === values.currentPassword) errors.newPassword = 'Choose a different password.';
  if (!values.confirmPassword || values.confirmPassword !== values.newPassword) errors.confirmPassword = 'Passwords do not match.';
  return errors;
}

type User = { id: string; email?: string };
type PasswordClient = { auth: {
  getUser(): PromiseLike<{ data: { user: User | null }; error: unknown }>;
  signInWithPassword(values: { email: string; password: string }): PromiseLike<{
    data: { user: User | null; session: unknown }; error: unknown;
  }>;
  updateUser(values: { password: string; current_password: string }): PromiseLike<{
    data: { user: User | null }; error: unknown;
  }>;
} };
function failure(code: string) { return Object.assign(new Error(code), { code }); }

// Shared by mobile and the backend service. Supabase Auth owns password storage
// and enforcement; credentials never enter profiles or application persistence.
export async function resetAccountPassword(transport: unknown, values: PasswordResetValues, expectedUserId?: string) {
  if (Object.keys(validatePasswordReset(values)).length) throw failure('invalid_password_reset');
  const client = transport as PasswordClient;
  const account = await client.auth.getUser();
  if (account.error) throw account.error;
  const user = account.data.user;
  if (!user?.email || (expectedUserId !== undefined && user.id !== expectedUserId)) throw failure('session_not_found');

  // Verify the current password even when the project's password-change policy
  // does not require it. A fresh sign-in also satisfies secure-change recency.
  const verified = await client.auth.signInWithPassword({ email: user.email, password: values.currentPassword });
  if (verified.error) {
    if (typeof verified.error === 'object' && 'code' in verified.error && verified.error.code === 'invalid_credentials') {
      throw failure('current_password_incorrect');
    }
    throw verified.error;
  }
  if (verified.data.user?.id !== user.id || !verified.data.session) throw failure('session_not_found');
  const updated = await client.auth.updateUser({ password: values.newPassword, current_password: values.currentPassword });
  if (updated.error) throw updated.error;
  if (updated.data.user?.id !== user.id) throw failure('session_not_found');
}
