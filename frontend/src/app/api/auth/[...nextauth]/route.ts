import NextAuth, { type NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";

/**
 * Auth model
 * ──────────
 * Google is used ONLY to identify the user at sign-in. We immediately exchange
 * the Google credentials for the backend's own JWT pair (access + refresh) and
 * from then on the session lives entirely on those backend tokens:
 *
 *   • access token  — short lived (30 min), sent as `Authorization: Bearer …`
 *   • refresh token — long lived (7 days), used to silently mint new access
 *                     tokens inside this callback.
 *
 * Crucially, the backend session is NOT coupled to the Google token lifetime.
 * Once exchanged, Google tokens are discarded. A Google hiccup can never log a
 * user out, and the JWT callback does no network I/O unless the backend access
 * token is actually (near) expired — so `getSession()` stays cheap and the
 * session survives reloads smoothly.
 */
type BackendJwt = JWT & {
  backend_access_token?: string;
  backend_refresh_token?: string;
  backend_token_expires_at?: number; // epoch ms
  backend_token_error?: string;
};

const normalizeUrl = (value: string) => value.replace(/\/+$/, "");
const normalizeApiUrl = (value: string) => normalizeUrl(value).replace(/\/api$/, "");

const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const BACKEND_URL = normalizeUrl(
  process.env.BACKEND_INTERNAL_URL || normalizeApiUrl(PUBLIC_API_URL) || "http://localhost:8000"
);

// Refresh the backend access token when it is within this window of expiring
// (or already gone). One minute of slack comfortably covers clock skew and the
// round-trip to the backend.
const EXPIRES_SOON_WINDOW_MS = 60_000;

// Keep the NextAuth session cookie alive exactly as long as the backend refresh
// token, so the two never expire out of step.
const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60;

if (
  process.env.NODE_ENV !== "production" &&
  process.env.BACKEND_INTERNAL_URL &&
  process.env.NEXT_PUBLIC_API_URL
) {
  const backendHost = normalizeUrl(process.env.BACKEND_INTERNAL_URL);
  const publicHost = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);
  if (backendHost !== publicHost) {
    console.warn(
      "[auth] BACKEND_INTERNAL_URL and NEXT_PUBLIC_API_URL point to different backends. This can cause JWT 401 mismatches."
    );
  }
}

/** Reads the `exp` claim (ms) out of a JWT without verifying the signature. */
function getJwtExpMs(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return decoded.exp ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** One-time exchange: Google credentials → backend (access, refresh) JWT pair. */
async function exchangeBackendToken(googleAccessToken?: string, googleIdToken?: string) {
  const payload: { access_token?: string; id_token?: string } = {};
  if (googleAccessToken) payload.access_token = googleAccessToken;
  if (googleIdToken) payload.id_token = googleIdToken;

  const response = await fetch(`${BACKEND_URL}/api/auth/google/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Backend token exchange failed: ${response.status} ${body}`);
  }

  const data = (await response.json()) as {
    access?: string;
    access_token?: string;
    refresh?: string;
    refresh_token?: string;
  };
  return {
    accessToken: data?.access ?? data?.access_token,
    refreshToken: data?.refresh ?? data?.refresh_token,
  };
}

/** Mints a fresh backend access token from the long-lived refresh token. */
async function refreshBackendAccessToken(refreshToken: string) {
  const response = await fetch(`${BACKEND_URL}/api/auth/jwt/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: refreshToken }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Backend refresh failed: ${response.status} ${body}`);
  }

  // SimpleJWT returns a new `access`; with rotation enabled it also returns a
  // new `refresh`, which we honour if present.
  const data = (await response.json()) as { access?: string; refresh?: string };
  return { accessToken: data.access, refreshToken: data.refresh };
}

export const authOptions: NextAuthOptions = {
  // Stable secret is required for the JWT cookie to decode across reloads and
  // server restarts. Falls back to the env var NextAuth reads by default.
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_S,
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      // We don't need offline access / a Google refresh token: the backend
      // refresh token carries the session. `select_account` gives a clean
      // account picker without forcing the full consent screen every time.
      authorization: {
        params: {
          prompt: "select_account",
          scope: "openid email profile",
        },
      },
    }),
  ],
  pages: {
    signIn: "/",
    error: "/",
  },
  callbacks: {
    async jwt({ token, account, trigger }) {
      const t = token as BackendJwt;

      // ── 1) First sign-in: exchange Google creds for backend JWTs (once). ──
      if (account) {
        try {
          const { accessToken, refreshToken } = await exchangeBackendToken(
            account.access_token,
            account.id_token
          );
          t.backend_access_token = accessToken;
          t.backend_refresh_token = refreshToken;
          t.backend_token_expires_at = accessToken ? getJwtExpMs(accessToken) ?? undefined : undefined;
          t.backend_token_error = accessToken ? undefined : "token_exchange_empty";
        } catch (error) {
          console.error("[auth] Backend token exchange failed:", error);
          t.backend_token_error = "token_exchange_failed";
        }
        return t;
      }

      // ── 2) Subsequent reads: keep the backend access token fresh. ─────────
      const accessToken = t.backend_access_token;
      const expMs = accessToken ? getJwtExpMs(accessToken) : null;
      const expiresSoon =
        trigger === "update" || !expMs || expMs - Date.now() < EXPIRES_SOON_WINDOW_MS;

      // Fast path: token is valid and not expiring → no network call.
      if (accessToken && !expiresSoon) {
        t.backend_token_expires_at = expMs ?? undefined;
        t.backend_token_error = undefined;
        return t;
      }

      // Slow path: refresh using the long-lived backend refresh token.
      if (t.backend_refresh_token) {
        try {
          const refreshed = await refreshBackendAccessToken(t.backend_refresh_token);
          if (refreshed.accessToken) {
            t.backend_access_token = refreshed.accessToken;
            t.backend_token_expires_at = getJwtExpMs(refreshed.accessToken) ?? undefined;
            if (refreshed.refreshToken) t.backend_refresh_token = refreshed.refreshToken;
            t.backend_token_error = undefined;
            return t;
          }
          t.backend_token_error = "refresh_empty";
        } catch (error) {
          console.error("[auth] Backend JWT refresh failed:", error);
          // Refresh token is dead/revoked → the session genuinely needs a
          // re-login. Surface it so the client can redirect cleanly.
          t.backend_token_error = "refresh_failed";
        }
      } else {
        t.backend_token_error = t.backend_token_error || "missing_refresh_token";
      }

      return t;
    },
    async session({ session, token }) {
      const t = token as BackendJwt;
      const s = session as typeof session & {
        backend_access_token?: string;
        backend_token_expires_at?: number;
        backend_token_error?: string;
      };
      s.backend_access_token = t.backend_access_token;
      s.backend_token_expires_at = t.backend_token_expires_at;
      s.backend_token_error = t.backend_token_error;
      return s;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
