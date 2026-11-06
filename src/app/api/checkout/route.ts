import Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { businesses, clients, invoices } from "@/db/schema";
import { getPublicOrigin } from "@/lib/email/send-invoice";
import { toMinorUnits } from "@/lib/money";
import { enforceRateLimit, getRequestRateLimitKey } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
const CheckoutRequestSchema = z.object({ token: z.string().uuid() });

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 8_192) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  let token: string;
  try {
    const input = CheckoutRequestSchema.parse(await request.json());
    token = input.token;
  } catch {
    return NextResponse.json({ error: "A valid invoice portal token is required" }, { status: 400 });
  }

  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip");
  try {
    enforceRateLimit(`checkout:${token}:${getRequestRateLimitKey(ip, token)}`, 10, 60 * 60 * 1000);
  } catch {
    return NextResponse.json({ error: "Too many checkout requests. Try again later." }, { status: 429 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return NextResponse.json({ error: "Card payments are not configured" }, { status: 503 });
  const stripe = new Stripe(secretKey, { apiVersion: "2025-07-30.acacia" as Stripe.LatestApiVersion });

  try {
    const origin = getPublicOrigin();
    const result = await db.transaction(async (tx) => {
      const [invoice] = await tx.select().from(invoices).where(eq(invoices.accessToken, token)).for("update");
      if (!invoice) return { status: 404 as const, error: "Invoice not found" };
      if (invoice.status !== "sent" && invoice.status !== "overdue") {
        return { status: 409 as const, error: "This invoice is not currently payable" };
      }
      const [business] = await tx.select().from(businesses).where(eq(businesses.id, invoice.businessId)).limit(1);
      if (!business?.stripeAccountId) return { status: 503 as const, error: "The issuing business has not connected Stripe" };
      const [client] = await tx.select().from(clients)
        .where(and(eq(clients.id, invoice.clientId), eq(clients.businessId, invoice.businessId))).limit(1);
      if (!client) return { status: 409 as const, error: "Invoice recipient is no longer available" };

      if (invoice.stripeCheckoutSessionId) {
        const previous = await stripe.checkout.sessions.retrieve(invoice.stripeCheckoutSessionId, {}, {
          stripeAccount: business.stripeAccountId,
        });
        if (previous.status === "open" && previous.url) return { status: 200 as const, url: previous.url };
        if (previous.status === "complete") {
          return { status: 409 as const, error: "Payment is being confirmed. Refresh this invoice shortly." };
        }
      }

      const amountMinor = toMinorUnits(Number(invoice.totalAmount), invoice.currency);
      const metadata = { invoiceId: invoice.id, businessId: invoice.businessId };
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{
          price_data: {
            currency: invoice.currency.toLowerCase(),
            product_data: { name: `Invoice ${invoice.invoiceNumber}` },
            unit_amount: amountMinor,
          },
          quantity: 1,
        }],
        customer_email: client.email,
        metadata,
        payment_intent_data: { metadata },
        success_url: `${origin}/portal/${token}?payment=return`,
        cancel_url: `${origin}/portal/${token}?payment=cancelled`,
      }, {
        stripeAccount: business.stripeAccountId,
        idempotencyKey: `invoice-${invoice.id}-${randomUUID()}`,
      });
      if (!session.url) return { status: 502 as const, error: "Stripe did not return a checkout link" };
      await tx.update(invoices).set({ stripeCheckoutSessionId: session.id, updatedAt: new Date() })
        .where(and(eq(invoices.id, invoice.id), eq(invoices.businessId, invoice.businessId)));
      return { status: 200 as const, url: session.url };
    });
    if (result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ url: result.url }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to start card checkout" }, { status: 503 });
  }
}
