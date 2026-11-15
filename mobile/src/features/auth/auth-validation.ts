export type AuthMode = 'login' | 'signup';
export type LoginValues = { email: string; password: string };
export type SignupValues = LoginValues & { username: string };
export type AuthFormErrors = Partial<Record<keyof SignupValues, string>>;

export const MIN_PASSWORD_LENGTH = 6;
export const MIN_USERNAME_LENGTH = 2;

// Shape validation only. These functions do not verify an email or authenticate anyone.
export function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (!value) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.';
}

export function validatePassword(password: string): string | undefined {
  if (!password.trim()) return 'Password is required.';
  // Check the original value: spaces in a password must never be silently removed.
  if (password.length < MIN_PASSWORD_LENGTH) return 'Password must be at least 6 characters.';
}

export function validateLogin(values: LoginValues): AuthFormErrors {
  const errors: AuthFormErrors = {};
  const email = validateEmail(values.email);
  const password = validatePassword(values.password);
  if (email) errors.email = email;
  if (password) errors.password = password;
  return errors;
}

export function validateSignup(values: SignupValues): AuthFormErrors {
  const errors = validateLogin(values);
  if (values.username.trim().length < MIN_USERNAME_LENGTH) errors.username = 'Username must be at least 2 characters.';
  return errors;
}

export function validateAuthForm(mode: AuthMode, values: SignupValues): AuthFormErrors {
  return mode === 'signup' ? validateSignup(values) : validateLogin(values);
}
