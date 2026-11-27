// Names and avatars have no database contract yet. Never infer names from an
// email address or invent account identity from fixture people.
export function profileInitials(name: string) {
  return Array.from(name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => Array.from(part)[0]).join('').toLocaleUpperCase()).slice(0, 2).join('');
}

export async function exitProfile(session: unknown, signOut: () => Promise<void>, onWelcome: () => void) {
  if (session) await signOut();
  onWelcome();
}
