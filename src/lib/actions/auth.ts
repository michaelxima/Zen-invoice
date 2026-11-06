"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { z } from "zod";
import { usersQ } from "../db/queries";
import { enforceRateLimit, getRequestRateLimitKey } from "../security/rate-limit";
import { SUPPORTED_CURRENCIES } from "../validations/onboarding";

const RegisterSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(254, "Email must be 254 characters or fewer.")
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(12, "Password must be between 12 and 72 characters.")
    .max(72, "Password must be between 12 and 72 characters."),
  firstName: z.string().trim().min(1, "First name is required.").max(80, "First name must be 80 characters or fewer."),
  lastName: z.string().trim().min(1, "Last name is required.").max(80, "Last name must be 80 characters or fewer."),
  businessName: z
    .string()
    .trim()
    .min(1, "Business name is required.")
    .max(120, "Business name must be 120 characters or fewer."),
  businessAddress: z.string().trim().max(500, "The address must be 500 characters or fewer.").optional().default(""),
  currency: z.enum(SUPPORTED_CURRENCIES, { error: "Choose a supported currency." }).default("USD"),
  // Same limit as Business Settings (src/lib/actions/settings.ts), stored in businesses.tax_id.
  taxId: z.string().trim().max(80, "Tax ID must be 80 characters or fewer.").optional().default(""),
});

export type RegisterUserInput = z.input<typeof RegisterSchema>;

// Expected failures are returned, not thrown: production builds hide thrown Server Function messages,
// so the user would otherwise never see why registration failed.
export type RegisterUserResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const DUPLICATE_EMAIL = "An account with this email already exists.";

export async function registerUser(rawInput: RegisterUserInput): Promise<RegisterUserResult> {
  const parsed = RegisterSchema.safeParse(rawInput);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = typeof issue.path[0] === "string" ? issue.path[0] : "form";
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, error: "Check the highlighted fields and try again.", fieldErrors };
  }
  const input = parsed.data;

  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip");
  try {
    enforceRateLimit(`register:${getRequestRateLimitKey(ip, input.email)}`, 5, 60 * 60 * 1000);
  } catch {
    return { ok: false, error: "Too many sign-up attempts. Please try again later." };
  }

  const existing = await usersQ.findByEmail(input.email);
  if (existing.length > 0) return { ok: false, error: DUPLICATE_EMAIL, fieldErrors: { email: DUPLICATE_EMAIL } };

  const passwordHash = await bcrypt.hash(input.password, 12);
  const name = `${input.firstName} ${input.lastName}`;
  try {
    await usersQ.createWithBusiness(
      { email: input.email, name, passwordHash },
      {
        name: input.businessName,
        address: input.businessAddress || null,
        taxId: input.taxId || null,
        currency: input.currency,
        email: input.email,
      },
    );
    return { ok: true };
  } catch (error) {
    // Enforce uniqueness in PostgreSQL as the race-safe source of truth.
    const dbError = error as { code?: string };
    if (dbError.code === "23505") return { ok: false, error: DUPLICATE_EMAIL, fieldErrors: { email: DUPLICATE_EMAIL } };
    throw error;
  }
}
