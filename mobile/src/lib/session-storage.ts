// Browser/SSR fallback: keep auth in this app runtime, without browser storage.
const values = new Map<string, string>();
export const sessionStorage = {
  getItem: async (key: string) => values.get(key) ?? null,
  setItem: async (key: string, value: string) => { values.set(key, value); },
  removeItem: async (key: string) => { values.delete(key); },
};
