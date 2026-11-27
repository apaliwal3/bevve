export function supabaseConfig(url: string | undefined, key: string | undefined) {
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) return null;
    // createClient appends service paths itself; a copied Data API URL breaks Auth.
    if (/\/(rest|auth|storage|functions|realtime)\/v1(?:\/|$)/i.test(parsed.pathname)) return null;
    if (key.startsWith('sb_publishable_')) return { url, key };
    // Legacy anon keys are JWTs. A service-role JWT must never reach the app.
    const payload = key.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    if (decoded && typeof decoded === 'object' && 'role' in decoded && decoded.role === 'anon') return { url, key };
  } catch { /* Invalid configuration leaves demo browsing available. */ }
  return null;
}
