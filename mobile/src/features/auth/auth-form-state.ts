import { validateAuthForm, type AuthFormErrors, type AuthMode, type SignupValues } from './auth-validation.ts';

export const AUTH_DEMO_NOTICE = 'Demo only — backend authentication will be connected later. No credentials were sent or verified, and no account or session was created. Use Explore demo on Welcome to continue.';

// Input drafts only. Never placed in a provider, URL, storage, log, or auth session.
export type AuthFormState = {
  mode: AuthMode;
  values: SignupValues;
  errors: AuthFormErrors;
  passwordVisible: boolean;
  demoNotice: boolean;
};

export function createAuthFormState(mode: AuthMode): AuthFormState {
  return {
    mode, values: { username: '', email: '', password: '' }, errors: {},
    passwordVisible: false, demoNotice: false,
  };
}

type AuthFormAction =
  | { type: 'change'; field: keyof SignupValues; value: string }
  | { type: 'toggle-password' }
  | { type: 'submit' }
  | { type: 'dismiss-notice' }
  | { type: 'reset' };

export function authFormReducer(state: AuthFormState, action: AuthFormAction): AuthFormState {
  switch (action.type) {
    case 'change': {
      const errors = { ...state.errors };
      delete errors[action.field];
      return { ...state, values: { ...state.values, [action.field]: action.value }, errors, demoNotice: false };
    }
    case 'toggle-password': return { ...state, passwordVisible: !state.passwordVisible };
    case 'submit': {
      if (state.demoNotice) return state;
      const errors = validateAuthForm(state.mode, state.values);
      if (Object.keys(errors).length > 0) return { ...state, errors };
      // Valid input only produces a notice. Clear all fields; no account/session is made.
      return { ...createAuthFormState(state.mode), demoNotice: true };
    }
    case 'dismiss-notice': return { ...state, demoNotice: false };
    case 'reset': return createAuthFormState(state.mode);
  }
}
