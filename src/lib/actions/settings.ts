"use server";

import "server-only";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "../auth/options";
import { businessesQ } from "../db/queries";

const BusinessSettingsSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional().default(""),
  address: z.string().trim().max(500).optional().default(""),
  taxId: z.string().trim().max(80).optional().default(""),
  currency: z.enum(["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "NOK", "SEK", "DKK"]),
});

async function getOwnerBusiness() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const businessId = session?.user?.businessId;
  if (!userId || !businessId) throw new Error("Unauthorized");
  const [business] = await businessesQ.findByIdForUser(businessId, userId);
  if (!business) throw new Error("Business not found");
  return { userId, business };
}

export async function getBusinessSettings() {
  const { business } = await getOwnerBusiness();
  return {
    name: business.name,
    email: business.email || "",
    phone: business.phone || "",
    address: business.address || "",
    taxId: business.taxId || "",
    currency: business.currency,
    stripeConnected: Boolean(business.stripeAccountId),
    stripeConnectAvailable: Boolean(process.env.STRIPE_CONNECT_CLIENT_ID && process.env.STRIPE_SECRET_KEY),
  };
}

export async function updateBusinessSettings(rawInput: unknown) {
  const input = BusinessSettingsSchema.parse(rawInput);
  const { userId, business } = await getOwnerBusiness();
  const updated = await businessesQ.updateProfileForUser(business.id, userId, {
    name: input.name,
    email: input.email.toLowerCase(),
    phone: input.phone || null,
    address: input.address || null,
    taxId: input.taxId || null,
    currency: input.currency,
  });
  if (!updated[0]) throw new Error("Business settings could not be saved");
  return { saved: true };
}
