"use server";

import "server-only";

import { EstimateDto, LineItemDto, InvoiceDto } from "@/lib/types/dto";
import { calculateInvoiceTotals } from "../calculator";
import { roundCurrencyAmount } from "../money";
import { getSessionBusinessId } from "../auth/session";
import { estimatesQ, clientsQ, businessesQ } from "../db/queries";
import { CreateEstimateSchema, CreateEstimateInput } from "../validations/invoice";
import { getInvoiceById } from "./invoices";

export type { CreateEstimateInput };

async function enrichEstimate(row: any): Promise<EstimateDto> {
  const [clientRows, businessRows, itemsRows] = await Promise.all([
    clientsQ.findByIdForBusiness(row.clientId, row.businessId),
    businessesQ.findByIdForInvoice(row.businessId),
    estimatesQ.findItemsByEstimateId(row.id),
  ]);
  const client = clientRows[0];
  const business = businessRows[0];
  const items: LineItemDto[] = itemsRows.map((item) => ({
    id: item.id,
    description: item.description,
    quantity: Number(item.quantity || 1),
    unitPrice: Number(item.unitPrice || 0),
  }));
  const statusMap: Record<string, "Draft" | "Sent" | "Accepted" | "Declined" | "Invoiced"> = {
    draft: "Draft", sent: "Sent", accepted: "Accepted", declined: "Declined", invoiced: "Invoiced",
  };
  return {
    id: row.id,
    accessToken: row.accessToken,
    estimateNumber: row.estimateNumber,
    clientId: row.clientId,
    clientName: client?.name || "Client",
    clientEmail: client?.email || "",
    clientAddress: client?.address || undefined,
    businessName: business?.name || "Business",
    businessEmail: business?.email || "",
    businessAddress: business?.address || undefined,
    issueDate: row.issueDate ? new Date(row.issueDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    validUntil: row.validUntil ? new Date(row.validUntil).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    currency: row.currency || "USD",
    status: statusMap[row.status?.toLowerCase()] || "Draft",
    items,
    subtotal: Number(row.subtotal || 0),
    discountRate: 0,
    discountAmount: Number(row.discountTotal || 0),
    taxRate: 0,
    taxAmount: Number(row.taxTotal || 0),
    totalAmount: Number(row.totalAmount || 0),
    notes: row.notes || undefined,
    convertedInvoiceId: row.convertedInvoiceId || undefined,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
  };
}

export async function getEstimates(search?: string, status?: string): Promise<EstimateDto[]> {
  const businessId = await getSessionBusinessId();
  let rows = await estimatesQ.findByBusinessId(businessId);
  if (status && status !== "All") rows = rows.filter((row) => row.status.toLowerCase() === status.toLowerCase());
  if (search?.trim()) {
    const query = search.trim().toLowerCase();
    rows = rows.filter((row) => row.estimateNumber.toLowerCase().includes(query) || row.clientId.toLowerCase().includes(query));
  }
  return Promise.all(rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(enrichEstimate));
}

export async function getEstimateById(id: string): Promise<EstimateDto | null> {
  const businessId = await getSessionBusinessId();
  const rows = await estimatesQ.findByIdForBusiness(id, businessId);
  return rows[0] ? enrichEstimate(rows[0]) : null;
}

export async function createEstimate(rawInput: CreateEstimateInput): Promise<EstimateDto> {
  const input = CreateEstimateSchema.parse(rawInput);
  const businessId = await getSessionBusinessId();
  const [client] = await clientsQ.findByIdForBusiness(input.clientId, businessId);
  if (!client) throw new Error("Client not found in this business");

  const issueDate = new Date(input.issueDate);
  const validUntil = new Date(input.validUntil);
  if (!Number.isFinite(issueDate.getTime()) || !Number.isFinite(validUntil.getTime()) || validUntil < issueDate) {
    throw new Error("Estimate dates are invalid");
  }
  const currency = input.currency || "USD";
  const totals = calculateInvoiceTotals(input.items, input.taxRate || 0, input.discountRate || 0, currency);
  const estimate = await estimatesQ.create({
    businessId,
    clientId: client.id,
    estimateNumber: input.estimateNumber.trim(),
    status: (input.status || "Draft").toLowerCase(),
    issueDate,
    validUntil,
    currency,
    subtotal: totals.subtotal.toFixed(2),
    taxTotal: totals.taxAmount.toFixed(2),
    discountTotal: totals.discountAmount.toFixed(2),
    totalAmount: totals.total.toFixed(2),
    notes: input.notes?.trim() || null,
  }, input.items.map((item) => ({
    description: item.description.trim(),
    quantity: item.quantity.toString(),
    unitPrice: item.unitPrice.toString(),
    amount: roundCurrencyAmount(item.quantity * item.unitPrice, currency).toFixed(2),
  })));
  return enrichEstimate(estimate);
}

export async function convertEstimateToInvoice(estimateId: string): Promise<InvoiceDto> {
  const businessId = await getSessionBusinessId();
  const [estimate] = await estimatesQ.findByIdForBusiness(estimateId, businessId);
  if (!estimate) throw new Error("Estimate not found");
  const [client] = await clientsQ.findByIdForBusiness(estimate.clientId, businessId);
  if (!client) throw new Error("Estimate client does not belong to this business");
  if (estimate.status === "invoiced") throw new Error("Estimate has already been converted");

  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + 14);
  const created = await estimatesQ.convertToInvoice(
    estimate.id,
    businessId,
    `INV-${issueDate.getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    issueDate,
    dueDate,
  );
  if (!created) throw new Error("Estimate was already converted or is no longer available");
  const invoice = await getInvoiceById(created.id);
  if (!invoice) throw new Error("Converted invoice could not be loaded");
  return invoice;
}

export async function deleteEstimate(id: string): Promise<boolean> {
  const businessId = await getSessionBusinessId();
  const [estimate] = await estimatesQ.findByIdForBusiness(id, businessId);
  if (!estimate) return false;
  if (estimate.status === "invoiced" || estimate.convertedInvoiceId) {
    throw new Error("Converted estimates are retained for financial records and cannot be deleted");
  }
  const deleted = await estimatesQ.deleteForBusiness(id, businessId);
  return deleted.length > 0;
}
