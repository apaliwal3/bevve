import { validCoordinates, type Coordinates } from './venue-distance.ts';

export const LOCATION_REFRESH_INTERVAL_MS = 120_000;
export const LOCATION_TIMEOUT_MS = 20_000;
// Keep the last reading visible while the next scheduled acquisition completes.
export const LOCATION_MAX_AGE_MS = LOCATION_REFRESH_INTERVAL_MS + LOCATION_TIMEOUT_MS;
export const LOCATION_MAX_ACCURACY_METERS = 500;
export type LocationFix = Coordinates & { accuracy: number; timestamp: number };
type Issue = 'accuracy' | 'stale' | 'timeout' | 'unavailable';
export type LocationSnapshot = {
  enabled: boolean; status: 'idle' | 'checking' | 'locating' | 'ready' | 'denied' | 'services-off' | 'unavailable' | 'paused';
  canAskAgain: boolean; fix: LocationFix | null; issue: Issue | null; settingsError: boolean;
};
export type LocationRepository = {
  permissions: () => Promise<{ granted: boolean; canAskAgain: boolean }>;
  requestPermissions: () => Promise<{ granted: boolean; canAskAgain: boolean }>;
  servicesEnabled: () => Promise<boolean>;
  watch: (onFix: (value: unknown) => void, onError: () => void) => Promise<() => void>;
  openSettings: () => Promise<void>;
};
type Clock = { now: () => number; set: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>; clear: (timer: ReturnType<typeof setTimeout>) => void };
export function readLocationFix(value: unknown, now: number): LocationFix | Issue {
  if (!value || typeof value !== 'object') return 'unavailable';
  const raw = value as { coords?: Partial<LocationFix>; timestamp?: unknown }, point = raw.coords;
  if (!point || typeof point.latitude !== 'number' || typeof point.longitude !== 'number' || !validCoordinates(point as Coordinates)) return 'unavailable';
  if (typeof raw.timestamp !== 'number' || !Number.isFinite(raw.timestamp) || raw.timestamp > now + 10_000 || now - raw.timestamp >= LOCATION_MAX_AGE_MS) return 'stale';
  if (typeof point.accuracy !== 'number' || !Number.isFinite(point.accuracy) || point.accuracy < 0 || point.accuracy > LOCATION_MAX_ACCURACY_METERS) return 'accuracy';
  return { latitude: point.latitude, longitude: point.longitude, accuracy: point.accuracy, timestamp: raw.timestamp };
}
export function createLocationStore(repository: LocationRepository, clock: Clock = { now: Date.now, set: setTimeout, clear: clearTimeout }) {
  let snapshot: LocationSnapshot = { enabled: true, status: 'idle', canAskAgain: true, fix: null, issue: null, settingsError: false };
  const initial = snapshot, listeners = new Set<() => void>();
  let active = false, foreground = true, generation = 0;
  let permissionChecked = false;
  let permissionRequest: ReturnType<LocationRepository['requestPermissions']> | null = null;
  let remove: (() => void) | null = null, deadline: ReturnType<typeof setTimeout> | null = null,
    expiry: ReturnType<typeof setTimeout> | null = null, refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let pending: { promise: Promise<void>; resolve: () => void } | null = null;
  function publish(patch: Partial<LocationSnapshot>) { snapshot = { ...snapshot, ...patch }; listeners.forEach(listener => listener()); }
  function clearDeadline() { if (deadline !== null) clock.clear(deadline); deadline = null; }
  function clearExpiry() { if (expiry !== null) clock.clear(expiry); expiry = null; }
  function clearRefresh() { if (refreshTimer !== null) clock.clear(refreshTimer); refreshTimer = null; }
  function finish() { const current = pending; pending = null; current?.resolve(); }
  function cancel() { generation++; clearDeadline(); remove?.(); remove = null; finish(); }
  function freshFix() { return snapshot.fix && clock.now() - snapshot.fix.timestamp < LOCATION_MAX_AGE_MS ? snapshot.fix : null; }
  function scheduleRefresh() {
    clearRefresh();
    if (!active || !foreground) return;
    refreshTimer = clock.set(() => {
      refreshTimer = null;
      if (!active || !foreground) return;
      void acquire(false, true);
      scheduleRefresh();
    }, LOCATION_REFRESH_INTERVAL_MS);
  }
  function acquire(ask: boolean, silent = false): Promise<void> {
    if (!active || !foreground || !snapshot.enabled) return Promise.resolve();
    if (pending) return pending.promise;
    cancel(); const run = generation;
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; }); pending = { promise, resolve };
    const current = () => active && foreground && snapshot.enabled && run === generation;
    let receivedFix = false;
    const fail = (issue: Issue) => {
      if (!current()) return;
      cancel();
      if (!freshFix()) { clearExpiry(); publish({ status: 'unavailable', fix: null, issue }); }
    };
    if (!silent && !freshFix()) publish({ status: 'checking', fix: null, issue: null, settingsError: false });
    void (async () => {
      let permission = await repository.permissions(); if (!current()) return;
      if (permission.granted) permissionChecked = true;
      if (!permission.granted && (permissionRequest || ask && permission.canAskAgain)) {
        // Reuse a native prompt across effect replay or a foreground transition.
        permissionChecked = true;
        const request = permissionRequest ?? repository.requestPermissions();
        permissionRequest = request;
        try { permission = await request; }
        finally { if (permissionRequest === request) permissionRequest = null; }
        if (!current()) return;
      }
      publish({ canAskAgain: permission.canAskAgain });
      if (!permission.granted) { clearExpiry(); publish({ status: 'denied', fix: null, issue: null }); finish(); return; }
      const services = await repository.servicesEnabled(); if (!current()) return;
      if (!services) { clearExpiry(); publish({ status: 'services-off', fix: null, issue: null }); finish(); return; }
      if (!silent && !freshFix()) publish({ status: 'locating' });
      let lastIssue: Issue = 'timeout';
      deadline = clock.set(() => fail(lastIssue), LOCATION_TIMEOUT_MS);
      const stop = await repository.watch(value => {
        if (!current() || receivedFix) return;
        const fix = readLocationFix(value, clock.now());
        if (typeof fix === 'string') { lastIssue = fix; return; }
        if (snapshot.fix && fix.timestamp < snapshot.fix.timestamp) return;
        // One acceptable reading per poll; release GPS until the next scheduled refresh.
        receivedFix = true;
        clearDeadline(); clearExpiry(); remove?.(); remove = null;
        publish({ status: 'ready', fix, issue: null }); finish();
        expiry = clock.set(() => {
          expiry = null;
          if (active && foreground && !freshFix()) publish({ status: 'unavailable', fix: null, issue: 'stale' });
        }, LOCATION_MAX_AGE_MS - Math.max(0, clock.now() - fix.timestamp));
      }, () => { if (!receivedFix) fail('unavailable'); });
      if (!current() || receivedFix) stop(); else remove = stop;
    })().catch(() => fail('unavailable'));
    return promise;
  }
  return {
    getSnapshot: () => snapshot, getServerSnapshot: () => initial,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start(isForeground = true) {
      active = true; foreground = isForeground;
      if (foreground) { void acquire(!permissionChecked); scheduleRefresh(); }
      else publish({ status: 'paused', fix: null });
      return () => { active = false; clearRefresh(); clearExpiry(); cancel(); snapshot = { ...snapshot, fix: null, status: 'paused' }; };
    },
    enable(): Promise<void> {
      if (!active) return Promise.resolve();
      return snapshot.status === 'ready' ? Promise.resolve() : acquire(true);
    },
    refresh: () => acquire(false),
    suspend() { foreground = false; clearRefresh(); clearExpiry(); cancel(); publish({ status: 'paused', fix: null, issue: null }); },
    resume() {
      const wasBackground = !foreground; foreground = true;
      if (wasBackground) { void acquire(!permissionChecked); scheduleRefresh(); }
    },
    async openSettings() {
      const run = generation;
      try { await repository.openSettings(); }
      catch { if (active && run === generation) publish({ settingsError: true }); }
    },
  };
}
