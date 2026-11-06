import { describe, expect, it } from "vitest";
import {
  SIGN_IN_ERROR_MESSAGES,
  checkStoredSession,
  decideGoogleSignIn,
  isGoogleSignInEnabled,
  isUuid,
  type StoredSession,
} from "./session-rules";

const userId = "8d0f6b3e-3c1a-4c5e-9f1a-2b3c4d5e6f70";
const otherUser = "1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";
const sid = "5f7e2c1a-9b3d-4e8f-a1b2-c3d4e5f6a7b8";
const now = new Date("2026-11-06T12:00:00Z");
const live: StoredSession = { id: sid, userId, expiresAt: new Date("2026-12-06T12:00:00Z"), revokedAt: null };

describe("isUuid", () => {
  it("accepts UUIDs and rejects anything else", () => {
    expect(isUuid(sid)).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("' OR 1=1 --")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(42)).toBe(false);
  });
});

describe("checkStoredSession", () => {
  it("accepts a live session for the same user", () => {
    expect(checkStoredSession({ id: userId, sid }, live, now)).toEqual({ ok: true });
  });

  it.each([
    ["a token without a session id (issued before server-side sessions)", { id: userId }, live, "no_session_id"],
    ["a malformed session id", { id: userId, sid: "abc" }, live, "no_session_id"],
    ["a token without a user id", { sid }, live, "no_session_id"],
    ["a session id with no stored row", { id: userId, sid }, undefined, "unknown_session"],
    ["a stored row for a different id", { id: userId, sid }, { ...live, id: otherUser }, "unknown_session"],
    ["a session that belongs to another user", { id: otherUser, sid }, live, "user_mismatch"],
    ["a revoked session", { id: userId, sid }, { ...live, revokedAt: new Date("2026-11-06T11:00:00Z") }, "revoked"],
    ["an expired session", { id: userId, sid }, { ...live, expiresAt: now }, "expired"],
  ] as const)("rejects %s", (_label, token, stored, reason) => {
    expect(checkStoredSession(token, stored, now)).toEqual({ ok: false, reason });
  });

  it("reports revoked before expired", () => {
    const both = { ...live, revokedAt: new Date("2026-11-01T00:00:00Z"), expiresAt: new Date("2026-11-02T00:00:00Z") };
    expect(checkStoredSession({ id: userId, sid }, both, now)).toEqual({ ok: false, reason: "revoked" });
  });
});

describe("isGoogleSignInEnabled", () => {
  const creds = { GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" };

  it("is off when only the credentials are configured (the v1 default)", () => {
    expect(isGoogleSignInEnabled(creds)).toBe(false);
  });

  it("is on only with the explicit flag and both credentials", () => {
    expect(isGoogleSignInEnabled({ ...creds, GOOGLE_SIGNIN_ENABLED: "1" })).toBe(true);
    expect(isGoogleSignInEnabled({ GOOGLE_SIGNIN_ENABLED: "1", GOOGLE_CLIENT_ID: "id" })).toBe(false);
    expect(isGoogleSignInEnabled({ ...creds, GOOGLE_SIGNIN_ENABLED: "true" })).toBe(false);
    expect(isGoogleSignInEnabled({ GOOGLE_SIGNIN_ENABLED: "1", GOOGLE_CLIENT_ID: " ", GOOGLE_CLIENT_SECRET: "secret" })).toBe(false);
  });
});

describe("decideGoogleSignIn", () => {
  const base = { subject: "google-sub-123", email: "owner@example.test", emailVerified: true, linkedUserId: null, existingUserWithEmail: false };

  it("signs in as the user already bound to this Google subject", () => {
    expect(decideGoogleSignIn({ ...base, linkedUserId: userId, existingUserWithEmail: true })).toEqual({ kind: "use_linked", userId });
  });

  it("creates a new account for a new, verified Google identity", () => {
    expect(decideGoogleSignIn(base)).toEqual({ kind: "create" });
  });

  it("never links to a pre-registered account just because the email matches", () => {
    // The account-takeover case: someone registered this email with a password, without proving they own it.
    expect(decideGoogleSignIn({ ...base, existingUserWithEmail: true })).toEqual({ kind: "reject", reason: "not_linked" });
  });

  it.each([
    ["missing", undefined],
    ["false", false],
    ["the string 'true'", "true"],
  ])("rejects a new identity whose email_verified claim is %s", (_label, emailVerified) => {
    expect(decideGoogleSignIn({ ...base, emailVerified })).toEqual({ kind: "reject", reason: "email_unverified" });
  });

  it("rejects a missing subject or email", () => {
    expect(decideGoogleSignIn({ ...base, subject: "" })).toEqual({ kind: "reject", reason: "missing_identity" });
    expect(decideGoogleSignIn({ ...base, subject: undefined })).toEqual({ kind: "reject", reason: "missing_identity" });
    expect(decideGoogleSignIn({ ...base, email: undefined })).toEqual({ kind: "reject", reason: "missing_identity" });
  });

  it("has a sign-in page message for every rejection reason", () => {
    for (const reason of ["missing_identity", "email_unverified", "not_linked"]) {
      expect(SIGN_IN_ERROR_MESSAGES[`google_${reason}`]).toBeTruthy();
    }
    expect(SIGN_IN_ERROR_MESSAGES.google_unavailable).toBeTruthy();
  });
});
