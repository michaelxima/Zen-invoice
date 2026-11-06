"use server";

import "server-only";

import { ClientDto } from "@/lib/types/dto";
import { getSessionBusinessId } from "../auth/session";
import { clientsQ } from "../db/queries";
import { CreateClientSchema, CreateClientInput } from "../validations/invoice";

export type { CreateClientInput };
const UpdateClientSchema = CreateClientSchema.partial();

function mapDbClientToDto(row: any): ClientDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || undefined,
    address: row.address || undefined,
    currency: row.currency || "USD",
    notes: row.notes || undefined,
    invoiceCount: 0,
    totalBilled: 0,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
  };
}

export async function getClients(searchQuery?: string): Promise<ClientDto[]> {
  const businessId = await getSessionBusinessId();
  let rows = await clientsQ.findByBusinessId(businessId);
  if (searchQuery?.trim()) {
    const query = searchQuery.trim().toLowerCase();
    rows = rows.filter((row) =>
      row.name.toLowerCase().includes(query) || row.email.toLowerCase().includes(query) ||
      Boolean(row.address?.toLowerCase().includes(query))
    );
  }
  return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(mapDbClientToDto);
}

export async function getClientById(id: string): Promise<ClientDto | null> {
  const businessId = await getSessionBusinessId();
  const rows = await clientsQ.findByIdForBusiness(id, businessId);
  return rows[0] ? mapDbClientToDto(rows[0]) : null;
}

export async function createClient(rawInput: CreateClientInput): Promise<ClientDto> {
  const input = CreateClientSchema.parse(rawInput);
  const businessId = await getSessionBusinessId();
  const [row] = await clientsQ.create({
    businessId,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || null,
    address: input.address?.trim() || null,
    currency: input.currency || "USD",
    notes: input.notes?.trim() || null,
  });
  return mapDbClientToDto(row);
}

export async function updateClient(id: string, rawInput: Partial<CreateClientInput>): Promise<ClientDto> {
  const input = UpdateClientSchema.parse(rawInput);
  const businessId = await getSessionBusinessId();
  const rows = await clientsQ.updateForBusiness(id, businessId, {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
    ...(input.phone !== undefined ? { phone: input.phone.trim() || null } : {}),
    ...(input.address !== undefined ? { address: input.address.trim() || null } : {}),
    ...(input.currency !== undefined ? { currency: input.currency } : {}),
    ...(input.notes !== undefined ? { notes: input.notes.trim() || null } : {}),
  });
  if (!rows[0]) throw new Error("Client not found");
  return mapDbClientToDto(rows[0]);
}

export async function deleteClient(id: string): Promise<boolean> {
  const businessId = await getSessionBusinessId();
  const [client] = await clientsQ.findByIdForBusiness(id, businessId);
  if (!client) return false;
  const [hasInvoices, hasEstimates] = await Promise.all([
    clientsQ.hasInvoicesForBusiness(id, businessId),
    clientsQ.hasEstimatesForBusiness(id, businessId),
  ]);
  if (hasInvoices || hasEstimates) {
    throw new Error("This client has financial history. Archive is not available; the client cannot be deleted.");
  }
  const deleted = await clientsQ.deleteForBusiness(id, businessId);
  return deleted.length > 0;
}
