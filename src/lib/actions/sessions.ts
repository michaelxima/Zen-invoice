"use server";

import "server-only";

import { getServerSession } from "next-auth";
import { authOptions } from "../auth/options";
import { authSessionsQ } from "../db/auth";

export type SignOutEverywhereResult = { ok: true; revoked: number } | { ok: false; error: string };

/** Revokes every session of the signed-in user, on every device, including this one. */
export async function signOutEverywhere(): Promise<SignOutEverywhereResult> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "You are not signed in." };
  const revoked = await authSessionsQ.revokeAllForUser(userId, "sign_out_everywhere");
  return { ok: true, revoked: revoked.length };
}
