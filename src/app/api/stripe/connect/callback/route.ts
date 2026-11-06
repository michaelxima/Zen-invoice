import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { businessesQ } from "@/lib/db/queries";
import { getPublicOrigin } from "@/lib/email/send-invoice";
import { verifyConnectState } from "@/lib/stripe/connect-state";

export const runtime = "nodejs";

function settingsRedirect(origin: string, result: string) {
  const url = new URL("/settings", origin);
  url.searchParams.set("stripe", result);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  let origin: string;
  try {
    origin = getPublicOrigin();
  } catch {
    return NextResponse.json({ error: "Application origin is not configured" }, { status: 503 });
  }
  const url = new URL(request.url);
  if (url.searchParams.get("error")) return settingsRedirect(origin, "cancelled");

  const code = url.searchParams.get("code");
  const signedState = url.searchParams.get("state");
  if (!code || !signedState) return settingsRedirect(origin, "error");

  const state = verifyConnectState(signedState);
  const session = await getServerSession(authOptions);
  if (!state || session?.user?.id !== state.userId || session.user.businessId !== state.businessId) {
    return settingsRedirect(origin, "error");
  }

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID?.trim();
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!clientId || !secretKey) return settingsRedirect(origin, "not-configured");
  const [business] = await businessesQ.findByIdForUser(state.businessId, state.userId);
  if (!business) return settingsRedirect(origin, "error");

  try {
    const form = new URLSearchParams({
      client_secret: secretKey,
      code,
      grant_type: "authorization_code",
    });
    const response = await fetch("https://connect.stripe.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      cache: "no-store",
    });
    if (!response.ok) return settingsRedirect(origin, "error");
    const result = await response.json() as { stripe_user_id?: string };
    if (!result.stripe_user_id?.startsWith("acct_")) return settingsRedirect(origin, "error");
    const updated = await businessesQ.updateStripeAccountForUser(state.businessId, state.userId, result.stripe_user_id);
    if (!updated[0]) return settingsRedirect(origin, "error");
    return settingsRedirect(origin, "connected");
  } catch {
    return settingsRedirect(origin, "error");
  }
}
