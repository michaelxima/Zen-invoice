import Stripe from "stripe";
import { NextResponse } from "next/server";
import { invoicesQ } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secretKey || !webhookSecret) return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 503 });
  const keyIsLive = secretKey.startsWith("sk_live_") || secretKey.startsWith("rk_live_");
  const keyIsTest = secretKey.startsWith("sk_test_") || secretKey.startsWith("rk_test_");
  if (!keyIsLive && !keyIsTest) return NextResponse.json({ error: "Stripe API key mode is not recognized" }, { status: 503 });
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 1_000_000) return NextResponse.json({ error: "Webhook payload too large" }, { status: 413 });

  let event: Stripe.Event;
  try {
    const payload = await request.text();
    const stripe = new Stripe(secretKey, { apiVersion: "2025-07-30.acacia" as Stripe.LatestApiVersion });
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  // Connect destinations can deliver events from both modes. Never settle a record with the wrong key mode.
  if (event.livemode !== keyIsLive) {
    return NextResponse.json({ received: true });
  }

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return NextResponse.json({ received: true });
  }
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.mode !== "payment" || session.payment_status !== "paid") return NextResponse.json({ received: true });
  const connectedAccountId = event.account;
  const invoiceId = session.metadata?.invoiceId;
  const businessId = session.metadata?.businessId;
  if (!connectedAccountId || !invoiceId || !businessId || !session.amount_total || !session.currency) {
    return NextResponse.json({ error: "Payment event is missing required invoice metadata" }, { status: 400 });
  }
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null;
  try {
    const invoice = await invoicesQ.recordStripePayment({
      invoiceId,
      businessId,
      connectedAccountId,
      checkoutSessionId: session.id,
      paymentIntentId,
      amountMinor: session.amount_total,
      currency: session.currency,
    });
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    return NextResponse.json({ received: true });
  } catch {
    // Do not log provider payloads or customer data. Stripe can retry transient failures.
    return NextResponse.json({ error: "Payment could not be reconciled" }, { status: 409 });
  }
}
