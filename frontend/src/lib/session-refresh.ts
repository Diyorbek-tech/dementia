type SessionUpdateFn = () => Promise<unknown>;

let sessionUpdate: SessionUpdateFn | null = null;

/** Called from a client component inside SessionProvider (see SessionRefresher). */
export function registerSessionRefresh(fn: SessionUpdateFn | null) {
  sessionUpdate = fn;
}

/**
 * Forces NextAuth to re-run the JWT callback (backend token refresh) and returns
 * the resulting session. Returns `undefined` when no updater is registered or
 * when next-auth performs a no-op (e.g. while the session is still loading), so
 * callers can tell a real refresh from a no-op.
 */
export async function refreshAuthSession(): Promise<unknown> {
  if (sessionUpdate) return await sessionUpdate();
  return undefined;
}
