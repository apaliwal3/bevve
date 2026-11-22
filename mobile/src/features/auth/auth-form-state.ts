import { validateAuthForm, type AuthFormErrors, type AuthMode, type SignupValues } from './auth-validation.ts';

// Input drafts only. Never placed in a provider, URL, storage, log, or auth session.
export type AuthFormState = {
  mode: AuthMode;
  values: SignupValues;
  errors: AuthFormErrors;
  passwordVisible: boolean;
  status: 'idle' | 'submitting' | 'confirm-email';
};

export function createAuthFormState(mode: AuthMode): AuthFormState {
  return {
    mode, values: { username: '', email: '', password: '' }, errors: {},
    passwordVisible: false, status: 'idle',
  };
}

type AuthFormAction =
  | { type: 'change'; field: keyof SignupValues; value: string }
  | { type: 'toggle-password' }
  | { type: 'submit' }
  | { type: 'failed' }
  | { type: 'confirm-email' }
  | { type: 'reset' };

export function authFormReducer(state: AuthFormState, action: AuthFormAction): AuthFormState {
  switch (action.type) {
    case 'change': {
      if (state.status === 'submitting') return state;
      const errors = { ...state.errors };
      delete errors[action.field];
      return { ...state, values: { ...state.values, [action.field]: action.value }, errors, status: 'idle' };
    }
    case 'toggle-password': return { ...state, passwordVisible: !state.passwordVisible };
    case 'submit': {
      if (state.status !== 'idle') return state;
      const errors = validateAuthForm(state.mode, state.values);
      if (Object.keys(errors).length > 0) return { ...state, errors };
      // The caller captures validated input before dispatching. Retain no password
      // while the request is pending or after a failed request.
      return { ...state, values: { ...state.values, password: '' }, passwordVisible: false,
        errors: {}, status: 'submitting' };
    }
    case 'failed': return { ...state, status: 'idle' };
    case 'confirm-email': return { ...createAuthFormState(state.mode), status: 'confirm-email' };
    case 'reset': return createAuthFormState(state.mode);
  }
}
