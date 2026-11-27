import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/auth-provider';
import { supabase } from '@/lib/supabase';

// Read only, using the existing client and profiles contract. No second profile
// store, auth metadata edits, local identity persistence or backend writes.
export function useProfileIdentity() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ userId: string; retry: number; username: string | null; error: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    if (userId && supabase) {
      void supabase.from('profiles').select('username').eq('id', userId).single().then(({ data, error }) => {
        if (active) setResult({ userId, retry, username: !error && typeof data?.username === 'string' ? data.username : null, error: Boolean(error || !data) });
      }, () => { if (active) setResult({ userId, retry, username: null, error: true }); });
    }
    return () => { active = false; };
  }, [userId, retry]);
  const current = result?.userId === userId && result?.retry === retry ? result : null;
  return { demo: !session, username: current?.username ?? null, loading: Boolean(session && !current),
    error: current?.error ?? false, retry: () => setRetry(value => value + 1) };
}
