import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { businessesQ } from "@/lib/db/queries";
import { getPublicOrigin } from "@/lib/email/send-invoice";
import { createConnectState } from "@/lib/stripe/connect-state";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const businessId = session?.user?.businessId;
  if (!userId || !businessId) return NextResponse.json({ error: "Sign in to connect Stripe" }, { status: 401 });

  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID?.trim();
  if (!clientId || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe Connect is not configured for this deployment" }, { status: 503 });
  }
  const [business] = await businessesQ.findByIdForUser(businessId, userId);
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 403 });

  try {
    const origin = getPublicOrigin();
    const redirectUri = `${origin}/api/stripe/connect/callback`;
    const state = createConnectState({ businessId, userId });
    const authorizeUrl = new URL("https://connect.stripe.com/oauth/authorize");
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", clientId);
    authorizeUrl.searchParams.set("scope", "read_write");
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("state", state);
    return NextResponse.redirect(authorizeUrl);
  } catch {
    return NextResponse.json({ error: "Unable to create Stripe connection link" }, { status: 500 });
  }
}
