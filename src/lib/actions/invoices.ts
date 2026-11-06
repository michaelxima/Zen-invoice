"use server";

import "server-only";

import { headers } from "next/headers";
import { InvoiceDto, LineItemDto, InvoiceCommentDto, InvoiceAuditLogDto } from "@/lib/types/dto";
import { calculateInvoiceTotals } from "../calculator";
import { roundCurrencyAmount } from "../money";
import { getSessionBusinessId } from "../auth/session";
import { invoicesQ, auditQ, clientsQ, businessesQ, dashboardMetricsQ } from "../db/queries";
import { enforceRateLimit, getRequestRateLimitKey } from "../security/rate-limit";
import { sendInvoiceEmail, getPublicOrigin } from "../email/send-invoice";
import {
  CreateInvoiceSchema,
  CreateInvoiceInput,
  UpdateInvoicePOSchema,
  AddInvoiceCommentSchema,
} from "../validations/invoice";

export type { CreateInvoiceInput };

async function enrichInvoice(row: any): Promise<InvoiceDto> {
  const [clientRows, businessRows, itemsRows, auditRows] = await Promise.all([
    clientsQ.findByIdForBusiness(row.clientId, row.businessId),
    businessesQ.findByIdForInvoice(row.businessId),
    invoicesQ.findItemsByInvoiceId(row.id),
    auditQ.findByInvoiceId(row.id),
  ]);
  const client = clientRows[0];
  const business = businessRows[0];
  const items: LineItemDto[] = itemsRows.map((item) => ({
    id: item.id,
    description: item.description,
    quantity: Number(item.quantity || 1),
    unitPrice: Number(item.unitPrice || 0),
  }));
  const comments: InvoiceCommentDto[] = auditRows.filter((log) => log.action === "comment_added").map((log) => ({
    id: log.id,
    sender: "client",
    senderName: "Client",
    text: log.metadata || "",
    createdAt: new Date(log.createdAt).toISOString(),
  }));
  const remindersSent = auditRows.filter((log) => log.action === "reminder_sent").map((log) => ({
    id: log.id,
    type: row.status === "overdue" ? "overdue_escalation" : "payment_reminder",
    tone: "friendly" as const,
    sentAt: new Date(log.createdAt).toISOString(),
    recipientEmail: client?.email || "",
  }));
  const statusMap: Record<string, "Draft" | "Sent" | "Paid" | "Overdue" | "Cancelled"> = {
    draft: "Draft", sent: "Sent", paid: "Paid", overdue: "Overdue", cancelled: "Cancelled",
  };
  const status = statusMap[row.status?.toLowerCase()] || "Draft";
  const downloadedLog = auditRows.find((log) => log.action === "downloaded");
  const deliveryStatus = status === "Cancelled" ? "Cancelled"
    : status === "Paid" ? "Paid"
      : row.viewedAt ? "Opened"
        : auditRows.some((log) => log.action === "sent") ? "Sent" : "Created";
  return {
    id: row.id,
    accessToken: row.accessToken,
    invoiceNumber: row.invoiceNumber,
    clientId: row.clientId,
    clientName: client?.name || "Client",
    clientEmail: client?.email || "",
    clientAddress: client?.address || undefined,
    businessName: business?.name || "Business",
    businessEmail: business?.email || "",
    businessAddress: business?.address || undefined,
    issueDate: row.issueDate ? new Date(row.issueDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    dueDate: row.dueDate ? new Date(row.dueDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    currency: row.currency || "USD",
    status,
    deliveryStatus,
    items,
    subtotal: Number(row.subtotal || 0),
    discountRate: 0,
    discountAmount: Number(row.discountTotal || 0),
    taxRate: 0,
    taxAmount: Number(row.taxTotal || 0),
    totalAmount: Number(row.totalAmount || 0),
    notes: row.notes || undefined,
    paymentLink: row.paymentLink || undefined,
    purchaseOrderNumber: row.purchaseOrderNumber || (row.notes?.startsWith("PO:") ? row.notes.replace("PO:", "").trim() : undefined),
    viewedAt: row.viewedAt ? new Date(row.viewedAt).toISOString() : undefined,
    downloadedAt: downloadedLog ? new Date(downloadedLog.createdAt).toISOString() : undefined,
    paidAt: row.paidAt ? new Date(row.paidAt).toISOString() : undefined,
    comments,
    remindersSent,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
  };
}

export async function getInvoices(search?: string, status?: string): Promise<InvoiceDto[]> {
  const businessId = await getSessionBusinessId();
  let rows = await invoicesQ.findByBusinessId(businessId, status);
  if (search?.trim()) {
    const query = search.trim().toLowerCase();
    rows = rows.filter((row) => row.invoiceNumber.toLowerCase().includes(query) || row.clientId.toLowerCase().includes(query));
  }
  return Promise.all(rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(enrichInvoice));
}

export async function getInvoiceById(id: string): Promise<InvoiceDto | null> {
  const businessId = await getSessionBusinessId();
  const rows = await invoicesQ.findByIdForBusiness(id, businessId);
  return rows[0] ? enrichInvoice(rows[0]) : null;
}

export async function getInvoiceByToken(token: string): Promise<InvoiceDto | null> {
  const rows = await invoicesQ.findByToken(token);
  const invoice = rows[0];
  if (!invoice) return null;
  if (!invoice.viewedAt) {
    const viewedAt = new Date();
    const updated = await invoicesQ.setViewedAtByToken(token, viewedAt);
    if (updated.length) {
      await auditQ.create({ invoiceId: invoice.id, action: "viewed", metadata: "Invoice viewed via bearer portal token", createdAt: viewedAt });
    }
    const refreshed = await invoicesQ.findByToken(token);
    return refreshed[0] ? enrichInvoice(refreshed[0]) : null;
  }
  return enrichInvoice(invoice);
}

export async function logInvoiceDownload(token: string): Promise<InvoiceDto | null> {
  const rows = await invoicesQ.findByToken(token);
  const invoice = rows[0];
  if (!invoice) return null;
  await auditQ.create({ invoiceId: invoice.id, action: "downloaded", metadata: "Invoice PDF downloaded using bearer portal token" });
  return enrichInvoice(invoice);
}

export async function createInvoice(rawInput: CreateInvoiceInput): Promise<InvoiceDto> {
  const input = CreateInvoiceSchema.parse(rawInput);
  const businessId = await getSessionBusinessId();
  const [client] = await clientsQ.findByIdForBusiness(input.clientId, businessId);
  if (!client) throw new Error("Client not found in this business");
  const issueDate = new Date(`${input.issueDate}T00:00:00.000Z`);
  const dueDate = new Date(`${input.dueDate}T00:00:00.000Z`);
  if (!Number.isFinite(issueDate.getTime()) || !Number.isFinite(dueDate.getTime()) || dueDate < issueDate) {
    throw new Error("Invoice dates are invalid");
  }
  const totals = calculateInvoiceTotals(input.items, input.taxRate, input.discountRate, input.currency);
  if (!Number.isFinite(totals.total) || totals.total <= 0 || totals.total > 9_999_999_999.99) {
    throw new Error("Invoice total is outside the supported range");
  }
  const invoice = await invoicesQ.create({
    businessId,
    clientId: client.id,
    invoiceNumber: input.invoiceNumber.trim(),
    status: input.status.toLowerCase(),
    issueDate,
    dueDate,
    currency: input.currency,
    subtotal: totals.subtotal.toFixed(2),
    taxTotal: totals.taxAmount.toFixed(2),
    discountTotal: totals.discountAmount.toFixed(2),
    totalAmount: totals.total.toFixed(2),
    notes: input.notes?.trim() || null,
    purchaseOrderNumber: input.purchaseOrderNumber?.trim() || null,
  }, input.items.map((item) => ({
    description: item.description.trim(),
    quantity: item.quantity.toString(),
    unitPrice: item.unitPrice.toString(),
    amount: roundCurrencyAmount(item.quantity * item.unitPrice, input.currency).toFixed(2),
  })));
  await auditQ.create({ invoiceId: invoice.id, action: "created", metadata: `Invoice #${invoice.invoiceNumber} created` });
  return enrichInvoice(invoice);
}

export async function updateInvoicePO(token: string, purchaseOrderNumber: string): Promise<InvoiceDto> {
  const validated = UpdateInvoicePOSchema.parse({ token, purchaseOrderNumber });
  const rows = await invoicesQ.findByToken(validated.token);
  const invoice = rows[0];
  if (!invoice) throw new Error("Invoice not found");
  const updated = await invoicesQ.updatePOByToken(validated.token, validated.purchaseOrderNumber);
  if (!updated[0]) throw new Error("Invoice not found");
  await auditQ.create({ invoiceId: invoice.id, action: "po_updated", metadata: "Client submitted a purchase order number" });
  return enrichInvoice(updated[0]);
}

export async function addInvoiceComment(
  token: string,
  _claimedSender: "client" | "issuer",
  senderName: string,
  text: string,
): Promise<InvoiceCommentDto> {
  const validated = AddInvoiceCommentSchema.parse({ token, senderName, text });
  const rows = await invoicesQ.findByToken(validated.token);
  const invoice = rows[0];
  if (!invoice) throw new Error("Invoice not found");
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip");
  enforceRateLimit(`portal-comment:${token}:${getRequestRateLimitKey(ip, token)}`, 8, 60 * 60 * 1000);
  const [log] = await auditQ.create({ invoiceId: invoice.id, action: "comment_added", metadata: validated.text });
  return { id: log.id, sender: "client", senderName: validated.senderName, text: validated.text, createdAt: new Date(log.createdAt).toISOString() };
}

export async function sendInvoiceReminder(invoiceId: string, tone: "friendly" | "formal" | "urgent" = "friendly") {
  const businessId = await getSessionBusinessId();
  enforceRateLimit(`reminder:${businessId}`, 10, 60 * 60 * 1000);
  const invoiceRows = await invoicesQ.findByIdForBusiness(invoiceId, businessId);
  const invoice = invoiceRows[0];
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status !== "sent" && invoice.status !== "overdue") throw new Error("A reminder can only be sent for an already-sent invoice");
  const [clientRows, businessRows] = await Promise.all([
    clientsQ.findByIdForBusiness(invoice.clientId, businessId),
    businessesQ.findByIdForInvoice(businessId),
  ]);
  const client = clientRows[0];
  const business = businessRows[0];
  if (!client?.email || !business) throw new Error("Invoice recipient or issuer information is missing");
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
    reminderTone: tone,
  });
  const [log] = await auditQ.create({ invoiceId: invoice.id, action: "reminder_sent", metadata: `Email provider accepted reminder ${result.id}` });
  return { id: log.id, type: invoice.status === "overdue" ? "overdue_escalation" : "payment_reminder", tone, sentAt: new Date(log.createdAt).toISOString(), recipientEmail: client.email };
}

export async function getInvoiceAuditTrail(invoiceId: string): Promise<InvoiceAuditLogDto[]> {
  const businessId = await getSessionBusinessId();
  const invoice = await invoicesQ.findByIdForBusiness(invoiceId, businessId);
  if (!invoice[0]) throw new Error("Invoice not found");
  const logs = await auditQ.findByInvoiceId(invoiceId);
  return logs.map((log) => ({
    id: log.id,
    invoiceId: log.invoiceId || invoiceId,
    action: log.action as any,
    timestamp: new Date(log.createdAt).toISOString(),
    metadata: log.metadata || undefined,
    ipAddress: log.ipAddress || undefined,
  }));
}

export async function deleteInvoice(id: string): Promise<boolean> {
  const businessId = await getSessionBusinessId();
  const updated = await invoicesQ.archiveForBusiness(id, businessId);
  const invoice = updated[0];
  if (!invoice) throw new Error("Invoice not found, already paid, or has an active checkout; financial records are retained");
  await auditQ.create({ invoiceId: invoice.id, action: "cancelled", metadata: "Invoice archived/cancelled by the business; financial history retained" });
  return true;
}

export async function getDashboardMetrics() {
  const businessId = await getSessionBusinessId();
  return dashboardMetricsQ(businessId);
}
