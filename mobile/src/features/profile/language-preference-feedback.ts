import type { PlainTranslationKey } from '../../localization/translation.ts';

type FeedbackState = { error: boolean; saving: boolean; persistent: boolean };

export function languagePreferenceFeedback({ error, saving, persistent }: FeedbackState): PlainTranslationKey {
  if (error) return 'Could not save the language. Tap a language to retry.';
  if (saving) return 'Saving language…';
  return persistent ? 'Language is saved on this device.' : 'Language changes last for this browser session only.';
}
