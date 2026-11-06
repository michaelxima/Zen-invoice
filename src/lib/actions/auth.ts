"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { z } from "zod";
import { usersQ } from "../db/queries";
import { enforceRateLimit, getRequestRateLimitKey } from "../security/rate-limit";

const RegisterSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(72),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  businessName: z.string().trim().min(1).max(120),
  businessAddress: z.string().trim().max(500).optional().default(""),
  currency: z.enum(["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "NOK", "SEK", "DKK"]).default("USD"),
});

export async function registerUser(rawInput: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  businessName: string;
  businessAddress?: string;
  currency?: string;
}) {
  const input = RegisterSchema.parse(rawInput);
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip");
  enforceRateLimit(`register:${getRequestRateLimitKey(ip, input.email)}`, 5, 60 * 60 * 1000);

  const existing = await usersQ.findByEmail(input.email);
  if (existing.length > 0) throw new Error("An account with this email already exists.");

  const passwordHash = await bcrypt.hash(input.password, 12);
  const name = `${input.firstName} ${input.lastName}`;
  try {
    const { user, business } = await usersQ.createWithBusiness(
      { email: input.email, name, passwordHash },
      { name: input.businessName, address: input.businessAddress || null, currency: input.currency, email: input.email },
    );
    return { userId: user.id, businessId: business.id };
  } catch (error) {
    // Enforce uniqueness in PostgreSQL as the race-safe source of truth.
    const dbError = error as { code?: string };
    if (dbError.code === "23505") throw new Error("An account with this email already exists.");
    throw error;
  }
}
