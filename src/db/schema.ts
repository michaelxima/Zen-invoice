import { pgTable, text, timestamp, numeric, varchar, uuid, uniqueIndex, index, primaryKey } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const businesses = pgTable("businesses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "restrict" }).notNull().unique(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  address: text("address"),
  taxId: text("tax_id"),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  email: text("email"),
  phone: text("phone"),
  stripeAccountId: text("stripe_account_id").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  businessId: uuid("business_id").references(() => businesses.id, { onDelete: "restrict" }).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  address: text("address"),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  accessToken: uuid("access_token").defaultRandom().notNull().unique(),
  businessId: uuid("business_id").references(() => businesses.id, { onDelete: "restrict" }).notNull(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "restrict" }).notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  status: varchar("status", { length: 20 }).default("draft").notNull(), // draft, sent, paid, overdue, cancelled
  issueDate: timestamp("issue_date").defaultNow().notNull(),
  dueDate: timestamp("due_date").notNull(),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).default("0.00").notNull(),
  taxTotal: numeric("tax_total", { precision: 12, scale: 2 }).default("0.00").notNull(),
  discountTotal: numeric("discount_total", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  notes: text("notes"),
  purchaseOrderNumber: text("purchase_order_number"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
  paymentLink: text("payment_link"),
  viewedAt: timestamp("viewed_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  businessInvoiceNumberUnique: uniqueIndex("invoices_business_invoice_number_uq").on(table.businessId, table.invoiceNumber),
}));

export const invoiceItems = pgTable("invoice_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).default("1.00").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).default("0.00").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
});

export const estimates = pgTable("estimates", {
  id: uuid("id").defaultRandom().primaryKey(),
  accessToken: uuid("access_token").defaultRandom().notNull().unique(),
  businessId: uuid("business_id").references(() => businesses.id, { onDelete: "restrict" }).notNull(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "restrict" }).notNull(),
  estimateNumber: text("estimate_number").notNull(),
  status: varchar("status", { length: 20 }).default("draft").notNull(), // draft, sent, accepted, declined, invoiced
  issueDate: timestamp("issue_date").defaultNow().notNull(),
  validUntil: timestamp("valid_until").notNull(),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).default("0.00").notNull(),
  taxTotal: numeric("tax_total", { precision: 12, scale: 2 }).default("0.00").notNull(),
  discountTotal: numeric("discount_total", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
  notes: text("notes"),
  convertedInvoiceId: uuid("converted_invoice_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  businessEstimateNumberUnique: uniqueIndex("estimates_business_estimate_number_uq").on(table.businessId, table.estimateNumber),
}));

export const estimateItems = pgTable("estimate_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  estimateId: uuid("estimate_id").references(() => estimates.id, { onDelete: "cascade" }).notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).default("1.00").notNull(),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).default("0.00").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).default("0.00").notNull(),
});

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "restrict" }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).default("stripe").notNull(), // verified Stripe Connect payment
  status: varchar("status", { length: 20 }).default("succeeded").notNull(),
  transactionId: text("transaction_id").unique(),
  paidAt: timestamp("paid_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "restrict" }),
  action: varchar("action", { length: 50 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// One row per sign-in. The session cookie carries this row's id; a request is only authenticated while the
// row exists, is not revoked and has not expired. Signing out revokes the row, so a copied cookie stops working.
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: varchar("revoked_reason", { length: 32 }),
  },
  (table) => [index("auth_sessions_user_id_idx").on(table.userId)],
);

// A sign-in provider identity (for example a Google account's stable subject) bound to one user. Users are never
// matched to a provider identity by email alone.
export const authAccounts = pgTable(
  "auth_accounts",
  {
    provider: varchar("provider", { length: 32 }).notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
    uniqueIndex("auth_accounts_user_provider_uq").on(table.userId, table.provider),
  ],
);
