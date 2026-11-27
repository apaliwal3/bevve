export type RecoveryLink = { access_token: string; refresh_token: string } | { code: string } | { error: true };

// Read callback credentials only here, never through router params or logs.
export function readPasswordRecoveryLink(value: string): RecoveryLink | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (!['mobile:', 'exp:', 'exps:', 'https:', 'http:'].includes(url.protocol)) return null;
  const path = url.protocol === 'mobile:' && url.hostname ? '/' + url.hostname + url.pathname : url.pathname;
  if (!['/recover-password', '/--/recover-password'].includes(path.replace(/\/$/, ''))) return null;
  const params = new URLSearchParams(url.search);
  new URLSearchParams(url.hash.slice(1)).forEach((value, key) => params.set(key, value));
  if (params.has('error') || params.has('error_code')) return { error: true };
  const code = params.get('code');
  if (code) return { code };
  const access_token = params.get('access_token'), refresh_token = params.get('refresh_token');
  if (params.get('type') !== 'recovery' || !access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}
