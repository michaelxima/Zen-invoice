// Pure rules for sessions and provider sign-in. No database access here, so every branch is unit-tested
// (src/lib/auth/session-rules.test.ts); src/lib/auth/options.ts wires them to NextAuth and the database.

/** Absolute session lifetime. The cookie is refreshed while in use, but the server-side row expires at sign-in + this. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export type StoredSession = { id: string; userId: string; expiresAt: Date; revokedAt: Date | null };

export type SessionRejection = "no_session_id" | "unknown_session" | "user_mismatch" | "revoked" | "expired";
export type SessionCheck = { ok: true } | { ok: false; reason: SessionRejection };

/**
 * Decides whether a decoded session token is still backed by a live server-side session.
 * Tokens issued before server-side sessions existed carry no session id and are rejected.
 */
export function checkStoredSession(
  token: { id?: unknown; sid?: unknown },
  stored: StoredSession | undefined,
  now: Date,
): SessionCheck {
  if (!isUuid(token.sid) || !isUuid(token.id)) return { ok: false, reason: "no_session_id" };
  if (!stored || stored.id !== token.sid) return { ok: false, reason: "unknown_session" };
  if (stored.userId !== token.id) return { ok: false, reason: "user_mismatch" };
  if (stored.revokedAt) return { ok: false, reason: "revoked" };
  if (stored.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  return { ok: true };
}

/** Google sign-in stays off unless explicitly enabled AND configured. Release scope v1: off. */
export function isGoogleSignInEnabled(env: Record<string, string | undefined>): boolean {
  return env.GOOGLE_SIGNIN_ENABLED === "1" && Boolean(env.GOOGLE_CLIENT_ID?.trim()) && Boolean(env.GOOGLE_CLIENT_SECRET?.trim());
}

export type GoogleSignInRejection = "missing_identity" | "email_unverified" | "not_linked";
export type GoogleSignInDecision =
  | { kind: "use_linked"; userId: string }
  | { kind: "create" }
  | { kind: "reject"; reason: GoogleSignInRejection };

/**
 * Who a Google sign-in belongs to. The binding is Google's stable subject, never the email address:
 * - a subject already bound to a user signs in as that user;
 * - a new subject may create a new account only when Google says it verified the email;
 * - a new subject whose email matches an existing account is refused. Joining them needs a deliberate,
 *   authenticated linking step by the existing account's owner (not built yet), because the existing account's
 *   email was never verified and its password would otherwise keep working against the Google owner's data.
 */
export function decideGoogleSignIn(input: {
  subject: unknown;
  email: unknown;
  emailVerified: unknown;
  linkedUserId: string | null;
  existingUserWithEmail: boolean;
}): GoogleSignInDecision {
  if (typeof input.subject !== "string" || !input.subject.trim()) return { kind: "reject", reason: "missing_identity" };
  if (input.linkedUserId) return { kind: "use_linked", userId: input.linkedUserId };
  if (typeof input.email !== "string" || !input.email.includes("@")) return { kind: "reject", reason: "missing_identity" };
  if (input.emailVerified !== true) return { kind: "reject", reason: "email_unverified" };
  if (input.existingUserWithEmail) return { kind: "reject", reason: "not_linked" };
  return { kind: "create" };
}

/** Messages for the sign-in page, keyed by the `error` query value the sign-in flow redirects with. */
export const SIGN_IN_ERROR_MESSAGES: Record<string, string> = {
  google_not_linked:
    "An account with this email already exists. Sign in with your password. Linking Google to an existing account is not available yet.",
  google_email_unverified: "Google has not verified this email address, so it can't be used to sign in.",
  google_missing_identity: "Google did not return a usable account identity. Please try again.",
  google_unavailable: "Google sign-in is not available.",
};
