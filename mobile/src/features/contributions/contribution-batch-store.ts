type Draft = { fingerprint: string; dirty: boolean; valid: boolean; save: () => void | Promise<void> };

// Keep confirmed sections out of a retry: crowd reports and prices append history.
export function createContributionBatch() {
  const drafts = new Map<string, Draft>();
  const confirmed = new Map<string, string>();
  const listeners = new Set<() => void>();
  let snapshot = { saving: false, error: false, pending: 0, invalid: false };
  let running: Promise<boolean> | null = null;
  const outstanding = () => [...drafts].filter(([key, draft]) => draft.dirty && confirmed.get(key) !== draft.fingerprint);
  function publish(patch: Partial<typeof snapshot> = {}) {
    const pending = outstanding();
    const next = { ...snapshot, pending: pending.length, invalid: pending.some(([, draft]) => !draft.valid), ...patch };
    if (Object.keys(next).some(key => next[key as keyof typeof next] !== snapshot[key as keyof typeof snapshot])) {
      snapshot = next;
      listeners.forEach(listener => listener());
    }
  }
  return {
    getSnapshot: () => snapshot,
    getConfirmed: (key: string) => confirmed.get(key),
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    register(key: string, draft: Draft) { drafts.set(key, draft); publish(); },
    remove(key: string) { drafts.delete(key); publish(); },
    submit(): Promise<boolean> {
      if (running) return running;
      const pending = outstanding();
      if (pending.some(([, draft]) => !draft.valid)) return Promise.resolve(false);
      publish({ saving: true, error: false });
      running = (async () => {
        let failed = false;
        for (const [key, draft] of pending) {
          try { await draft.save(); confirmed.set(key, draft.fingerprint); }
          catch { failed = true; }
        }
        publish({ saving: false, error: failed });
        return !failed;
      })().finally(() => { running = null; });
      return running;
    },
  };
}
