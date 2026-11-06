import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth/options";
import { auditQ, businessesQ, clientsQ, invoicesQ } from "@/lib/db/queries";
import { getPublicOrigin, sendInvoiceEmail } from "@/lib/email/send-invoice";
import { enforceRateLimit, getRequestRateLimitKey } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
const SendRequestSchema = z.object({ invoiceId: z.string().uuid() });

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const businessId = session?.user?.businessId;
  if (!userId || !businessId) return NextResponse.json({ error: "Sign in to send invoices" }, { status: 401 });
  const [ownedBusiness] = await businessesQ.findByIdForUser(businessId, userId);
  if (!ownedBusiness) return NextResponse.json({ error: "Business not found" }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 8_192) return NextResponse.json({ error: "Request too large" }, { status: 413 });

  let invoiceId: string;
  try {
    invoiceId = SendRequestSchema.parse(await request.json()).invoiceId;
  } catch {
    return NextResponse.json({ error: "A valid invoiceId is required" }, { status: 400 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip");
  try {
    enforceRateLimit(`send-invoice:${businessId}:${getRequestRateLimitKey(ip, userId)}`, 10, 60 * 60 * 1000);
  } catch {
    return NextResponse.json({ error: "Too many emails. Try again later." }, { status: 429 });
  }

  try {
    const invoiceRows = await invoicesQ.findByIdForBusiness(invoiceId, businessId);
    const invoice = invoiceRows[0];
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    if (invoice.status !== "draft") {
      return NextResponse.json({ error: "Only a draft invoice can be sent here. Use the reminder action for an already-sent invoice." }, { status: 409 });
    }
    const [clientRows, businessRows] = await Promise.all([
      clientsQ.findByIdForBusiness(invoice.clientId, businessId),
      businessesQ.findByIdForInvoice(businessId),
    ]);
    const client = clientRows[0];
    const business = businessRows[0];
    if (!client?.email || !business) return NextResponse.json({ error: "Invoice recipient or issuer information is incomplete" }, { status: 409 });
    const origin = getPublicOrigin();
    const result = await sendInvoiceEmail({
      to: client.email,
      clientName: client.name,
      businessName: business.name,
      invoiceNumber: invoice.invoiceNumber,
      amount: Number(invoice.totalAmount).toFixed(2),
      currency: invoice.currency,
      dueDate: new Date(invoice.dueDate).toISOString().split("T")[0],
      portalUrl: `${origin}/portal/${invoice.accessToken}`,
    });
    const markedSent = await invoicesQ.markSentForBusiness(invoice.id, businessId);
    if (!markedSent.length) return NextResponse.json({ error: "Invoice status changed while the email was being sent. Refresh the invoice list." }, { status: 409 });
    await auditQ.create({ invoiceId: invoice.id, action: "sent", metadata: `Email provider accepted invoice ${result.id}` });
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Invoice email was not accepted by the mail provider" }, { status: 503 });
  }
}
