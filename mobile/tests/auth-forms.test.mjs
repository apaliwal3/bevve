import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MIN_PASSWORD_LENGTH, MIN_USERNAME_LENGTH, validateAuthForm,
  validateEmail, validateLogin, validatePassword, validateSignup,
} from '../src/features/auth/auth-validation.ts';
import {
  authFormReducer, createAuthFormState,
} from '../src/features/auth/auth-form-state.ts';

const sample = Object.freeze({ username: 'Alessia', email: 'alessia@example.com', password: 'demo123' });
function fill(mode, values = sample) {
  return Object.entries(values).reduce((state, [field, value]) =>
    authFormReducer(state, { type: 'change', field, value }), createAuthFormState(mode));
}
const submit = (state) => authFormReducer(state, { type: 'submit' });

test('email validation distinguishes missing input from an invalid address shape', () => {
  for (const email of ['', ' ', '\n\t']) assert.equal(validateEmail(email), 'Email is required.');
  for (const email of ['alessia', 'user@domain', '@example.com', 'user@', 'a b@example.com',
    'a@@example.com', 'user@example .com', 'user@example.com\nother']) {
    assert.equal(validateEmail(email), 'Enter a valid email address.', email);
  }
});

test('email validation accepts ordinary, alias and subdomain addresses with outer whitespace', () => {
  for (const email of ['you@example.com', 'ege+bevve@students.example.it', 'USER@EXAMPLE.COM', '  you@example.com  ']) {
    assert.equal(validateEmail(email), undefined, email);
  }
});

test('password validation follows the approved six-character minimum and rejects blank passwords', () => {
  assert.equal(MIN_PASSWORD_LENGTH, 6);
  for (const password of ['', ' ', '      ']) assert.equal(validatePassword(password), 'Password is required.');
  for (const password of ['a', '12345']) assert.equal(validatePassword(password), 'Password must be at least 6 characters.');
  for (const password of ['123456', 'demo123', '  abc ']) assert.equal(validatePassword(password), undefined);
});

test('Login validates email and password without requiring a Signup username', () => {
  assert.deepEqual(validateLogin({ email: sample.email, password: sample.password }), {});
  assert.deepEqual(validateAuthForm('login', { ...sample, username: '' }), {});
  assert.deepEqual(Object.keys(validateLogin({ email: '', password: '' })).sort(), ['email', 'password']);
});

test('Signup requires a username of at least two characters after trimming', () => {
  assert.equal(MIN_USERNAME_LENGTH, 2);
  for (const username of ['', ' ', 'A', ' A ']) {
    assert.equal(validateSignup({ ...sample, username }).username, 'Username must be at least 2 characters.');
  }
  for (const username of ['Al', '  Al  ', 'Giulia']) {
    assert.deepEqual(validateSignup({ ...sample, username }), {});
  }
});

test('Signup collects all field errors and matches the Figma form without a confirmation field', () => {
  assert.deepEqual(Object.keys(validateSignup({ username: '', email: 'bad', password: 'short' })).sort(),
    ['email', 'password', 'username']);
  assert.deepEqual(validateAuthForm('signup', sample), {});
  assert.deepEqual(Object.keys(createAuthFormState('signup').values).sort(), ['email', 'password', 'username']);
});

test('an invalid submission keeps its local draft and produces field errors without starting a request', () => {
  const state = fill('signup', { username: 'A', email: 'invalid', password: 'short' });
  const next = submit(state);
  assert.equal(next.status, 'idle');
  assert.deepEqual(next.values, state.values);
  assert.deepEqual(Object.keys(next.errors).sort(), ['email', 'password', 'username']);
  assert.deepEqual(state.errors, {});
});

test('editing a field clears only that field error and does not mutate previous form state', () => {
  const previous = submit(createAuthFormState('signup'));
  const next = authFormReducer(previous, { type: 'change', field: 'email', value: sample.email });
  assert.equal(next.errors.email, undefined);
  assert.equal(next.errors.password, previous.errors.password);
  assert.equal(next.errors.username, previous.errors.username);
  assert.equal(previous.values.email, '');
  assert.equal(next.values.email, sample.email);
});

test('show/hide preserves the exact password draft, including meaningful spaces', () => {
  const state = fill('login', { email: sample.email, password: ' demo123 ' });
  const shown = authFormReducer(state, { type: 'toggle-password' });
  assert.equal(shown.passwordVisible, true);
  assert.equal(shown.values.password, ' demo123 ');
  const hidden = authFormReducer(shown, { type: 'toggle-password' });
  assert.equal(hidden.passwordVisible, false);
  assert.equal(hidden.values.password, ' demo123 ');
});

test('valid Login and Signup submissions clear passwords and wait for the backend result', () => {
  for (const mode of ['login', 'signup']) {
    const filled = fill(mode);
    const shown = authFormReducer(filled, { type: 'toggle-password' });
    const next = submit(shown);
    assert.equal(next.status, 'submitting');
    assert.equal(next.passwordVisible, false);
    assert.equal(next.values.email, sample.email);
    assert.equal(next.values.password, '');
    assert.ok(!JSON.stringify(next).includes(sample.password));
  }
});

test('repeated submission taps and field edits do not change a pending request', () => {
  const state = submit(fill('login'));
  assert.equal(submit(state), state);
  assert.equal(state.status, 'submitting');
  assert.equal(state.values.password, '');
  assert.equal(authFormReducer(state, { type: 'change', field: 'email', value: 'other@example.com' }), state);
});

test('email confirmation clears drafts and editing starts a new form', () => {
  const completed = authFormReducer(submit(fill('signup')), { type: 'confirm-email' });
  assert.equal(completed.status, 'confirm-email');
  assert.deepEqual(completed.values, { username: '', email: '', password: '' });
  const editing = authFormReducer(completed, { type: 'change', field: 'username', value: 'New name' });
  assert.equal(editing.status, 'idle');
  assert.deepEqual(editing.values, { username: 'New name', email: '', password: '' });
  const next = submit(editing);
  assert.ok(next.errors.email);
  assert.ok(next.errors.password);
});

test('the route-leave reset clears drafts, errors, visibility and request state while preserving form mode', () => {
  for (const mode of ['login', 'signup']) {
    const filled = fill(mode);
    const shown = authFormReducer(filled, { type: 'toggle-password' });
    assert.deepEqual(authFormReducer(shown, { type: 'reset' }), createAuthFormState(mode));
    const invalid = submit(createAuthFormState(mode));
    assert.deepEqual(authFormReducer(invalid, { type: 'reset' }), createAuthFormState(mode));
    const notice = submit(filled);
    assert.deepEqual(authFormReducer(notice, { type: 'reset' }), createAuthFormState(mode));
  }
});

test('a failed request allows retry without restoring the password', () => {
  const next = authFormReducer(submit(fill('login')), { type: 'failed' });
  assert.equal(next.status, 'idle');
  assert.equal(next.values.email, sample.email);
  assert.equal(next.values.password, '');
  assert.ok(submit(next).errors.password);
});

test('Signup rejects usernames beyond the database limit without truncating them', () => {
  assert.equal(validateSignup({ ...sample, username: 'x'.repeat(41) }).username, 'Username must be at most 40 characters.');
  assert.equal(validateSignup({ ...sample, username: 'x'.repeat(40) }).username, undefined);
});
