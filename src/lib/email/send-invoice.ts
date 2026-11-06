import "server-only";

import { Resend } from "resend";

export type InvoiceEmail = {
  to: string;
  clientName: string;
  businessName: string;
  invoiceNumber: string;
  amount: string;
  currency: string;
  dueDate: string;
  portalUrl: string;
  reminderTone?: "friendly" | "formal" | "urgent";
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]!);
}

export function getPublicOrigin(): string {
  const configured = process.env.NEXTAUTH_URL;
  if (!configured) throw new Error("NEXTAUTH_URL must be configured before sending external links");
  const url = new URL(configured);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("Production NEXTAUTH_URL must use HTTPS");
  }
  return url.origin;
}

export async function sendInvoiceEmail(input: InvoiceEmail): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Invoice email is not configured");
  const resend = new Resend(apiKey);
  const name = escapeHtml(input.clientName);
  const business = escapeHtml(input.businessName);
  const invoiceNumber = escapeHtml(input.invoiceNumber);
  const amount = escapeHtml(`${input.currency} ${input.amount}`);
  const dueDate = escapeHtml(input.dueDate);
  const portalUrl = escapeHtml(input.portalUrl);
  const toneCopy = input.reminderTone === "urgent"
    ? "Our records indicate this invoice is overdue. Please review the invoice and contact the issuer if you have questions."
    : input.reminderTone === "formal"
      ? "This is a reminder to review the outstanding invoice and arrange payment by the due date."
      : "Just a friendly reminder to review this invoice when convenient.";
  const subjectPrefix = input.reminderTone ? "Payment reminder" : "Invoice";
  const text = `${business} sent invoice ${invoiceNumber} for ${amount}. Due: ${dueDate}. View invoice: ${input.portalUrl}${input.reminderTone ? `\n\n${toneCopy}` : ""}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0f172a"><h1 style="font-size:22px">${subjectPrefix} ${invoiceNumber}</h1><p>Hello ${name},</p><p>${input.reminderTone ? toneCopy : `${business} has sent you an invoice for <strong>${amount}</strong>.`}</p><p>Due date: <strong>${dueDate}</strong></p><p><a href="${portalUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">View invoice</a></p><p style="font-size:12px;color:#64748b">Sent by ${business} using Invoice Claw.</p></div>`;
  const result = await resend.emails.send({
    from,
    to: [input.to],
    subject: `${subjectPrefix} #${input.invoiceNumber}`,
    html,
    text,
  });
  if (result.error || !result.data?.id) throw new Error("Email provider did not accept the message");
  return { id: result.data.id };
}
