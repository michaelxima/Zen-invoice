import "server-only";

import { db } from "../../db";
import {
  businesses,
  clients,
  invoices,
  invoiceItems,
  estimates,
  estimateItems,
  payments,
  auditLogs,
  users,
} from "../../db/schema";
import { eq, desc, and, isNull, ne } from "drizzle-orm";
import { toMinorUnits } from "../money";

export const usersQ = {
  findByEmail: (email: string) => db.select().from(users).where(eq(users.email, email)).limit(1),
  findById: (id: string) => db.select().from(users).where(eq(users.id, id)).limit(1),
  createWithBusiness: (userData: typeof users.$inferInsert, businessData: Omit<typeof businesses.$inferInsert, "userId">) =>
    db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values(userData).returning();
      const [business] = await tx.insert(businesses).values({ ...businessData, userId: user.id }).returning();
      return { user, business };
    }),
};

export const businessesQ = {
  findByUserId: (userId: string) => db.select().from(businesses).where(eq(businesses.userId, userId)),
  ensureDefaultForUser: (userId: string, name: string, email: string) => db.transaction(async (tx) => {
    const [existing] = await tx.select().from(businesses).where(eq(businesses.userId, userId)).limit(1);
    if (existing) return existing;
    const [created] = await tx.insert(businesses).values({ userId, name, currency: "USD", email })
      .onConflictDoNothing({ target: businesses.userId }).returning();
    if (created) return created;
    const [concurrent] = await tx.select().from(businesses).where(eq(businesses.userId, userId)).limit(1);
    if (!concurrent) throw new Error("Default business could not be created");
    return concurrent;
  }),
  findByIdForUser: (id: string, userId: string) =>
    db.select().from(businesses).where(and(eq(businesses.id, id), eq(businesses.userId, userId))).limit(1),
  // Used only after a trusted invoice row or verified portal token has established the business ID.
  findByIdForInvoice: (id: string) => db.select().from(businesses).where(eq(businesses.id, id)).limit(1),
  updateStripeAccountForUser: (id: string, userId: string, stripeAccountId: string) =>
    db.update(businesses).set({ stripeAccountId }).where(and(eq(businesses.id, id), eq(businesses.userId, userId))).returning(),
  updateProfileForUser: (id: string, userId: string, data: Partial<typeof businesses.$inferInsert>) =>
    db.update(businesses).set(data).where(and(eq(businesses.id, id), eq(businesses.userId, userId))).returning(),
};

export const clientsQ = {
  findByBusinessId: (businessId: string) => db.select().from(clients).where(eq(clients.businessId, businessId)),
  findByIdForBusiness: (id: string, businessId: string) =>
    db.select().from(clients).where(and(eq(clients.id, id), eq(clients.businessId, businessId))).limit(1),
  hasInvoicesForBusiness: async (id: string, businessId: string) => {
    const rows = await db.select({ id: invoices.id }).from(invoices)
      .where(and(eq(invoices.clientId, id), eq(invoices.businessId, businessId))).limit(1);
    return rows.length > 0;
  },
  hasEstimatesForBusiness: async (id: string, businessId: string) => {
    const rows = await db.select({ id: estimates.id }).from(estimates)
      .where(and(eq(estimates.clientId, id), eq(estimates.businessId, businessId))).limit(1);
    return rows.length > 0;
  },
  create: (data: typeof clients.$inferInsert) => db.insert(clients).values(data).returning(),
  updateForBusiness: (id: string, businessId: string, data: Partial<typeof clients.$inferInsert>) =>
    db.update(clients).set(data).where(and(eq(clients.id, id), eq(clients.businessId, businessId))).returning(),
  deleteForBusiness: (id: string, businessId: string) =>
    db.delete(clients).where(and(eq(clients.id, id), eq(clients.businessId, businessId))).returning({ id: clients.id }),
};

export const invoicesQ = {
  findByBusinessId: (businessId: string, status?: string) => {
    if (status && status !== "All") {
      return db.select().from(invoices).where(and(eq(invoices.businessId, businessId), eq(invoices.status, status.toLowerCase())));
    }
    return db.select().from(invoices).where(eq(invoices.businessId, businessId));
  },
  findByIdForBusiness: (id: string, businessId: string) =>
    db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.businessId, businessId))).limit(1),
  findByToken: (token: string) => db.select().from(invoices).where(eq(invoices.accessToken, token)).limit(1),
  findItemsByInvoiceId: (invoiceId: string) => db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId)),
  create: (data: typeof invoices.$inferInsert, items: Array<Omit<typeof invoiceItems.$inferInsert, "invoiceId">>) => db.transaction(async (tx) => {
    const [invoice] = await tx.insert(invoices).values(data).returning();
    if (items.length) await tx.insert(invoiceItems).values(items.map((item) => ({ ...item, invoiceId: invoice.id })));
    return invoice;
  }),
  updateStatusForBusiness: (id: string, businessId: string, status: string) =>
    db.update(invoices).set({ status, updatedAt: new Date() })
      .where(and(eq(invoices.id, id), eq(invoices.businessId, businessId))).returning(),
  markSentForBusiness: (id: string, businessId: string) =>
    db.update(invoices).set({ status: "sent", updatedAt: new Date() })
      .where(and(eq(invoices.id, id), eq(invoices.businessId, businessId), eq(invoices.status, "draft"))).returning(),
  updatePOByToken: (token: string, purchaseOrderNumber: string) =>
    db.update(invoices).set({ purchaseOrderNumber, updatedAt: new Date() })
      .where(eq(invoices.accessToken, token)).returning(),
  setViewedAtByToken: (token: string, viewedAt: Date) =>
    db.update(invoices).set({ viewedAt, updatedAt: viewedAt })
      .where(and(eq(invoices.accessToken, token), isNull(invoices.viewedAt))).returning(),
  archiveForBusiness: (id: string, businessId: string) =>
    db.update(invoices).set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(invoices.id, id), eq(invoices.businessId, businessId), isNull(invoices.stripeCheckoutSessionId), ne(invoices.status, "paid"))).returning(),
  recordStripePayment: (input: {
    invoiceId: string;
    businessId: string;
    connectedAccountId: string;
    checkoutSessionId: string;
    paymentIntentId: string | null;
    amountMinor: number;
    currency: string;
  }) => db.transaction(async (tx) => {
    const [invoice] = await tx.select().from(invoices)
      .where(and(eq(invoices.id, input.invoiceId), eq(invoices.businessId, input.businessId))).for("update");
    if (!invoice) return null;
    const [business] = await tx.select().from(businesses)
      .where(and(eq(businesses.id, input.businessId), eq(businesses.stripeAccountId, input.connectedAccountId))).limit(1);
    if (!business) throw new Error("Connected Stripe account mismatch");
    const expectedMinor = toMinorUnits(Number(invoice.totalAmount), invoice.currency);
    if (input.amountMinor !== expectedMinor || input.currency.toLowerCase() !== invoice.currency.toLowerCase()) {
      throw new Error("Stripe payment amount or currency does not match the invoice");
    }
    const [existing] = await tx.select().from(payments).where(eq(payments.transactionId, input.checkoutSessionId)).limit(1);
    if (existing) {
      if (existing.invoiceId !== invoice.id) throw new Error("Stripe session is already associated with another invoice");
      return invoice;
    }
    if (invoice.stripeCheckoutSessionId !== input.checkoutSessionId) throw new Error("Stripe session does not match the active invoice checkout");
    if (invoice.status !== "sent" && invoice.status !== "overdue") throw new Error("Invoice is not payable");

    const paidAt = new Date();
    const inserted = await tx.insert(payments).values({
      invoiceId: invoice.id,
      amount: invoice.totalAmount,
      currency: invoice.currency,
      paymentMethod: "stripe",
      status: "succeeded",
      transactionId: input.checkoutSessionId,
      paidAt,
    }).onConflictDoNothing().returning();
    if (!inserted.length) return invoice;

    const [updated] = await tx.update(invoices)
      .set({ status: "paid", paidAt, stripeCheckoutSessionId: null, updatedAt: paidAt })
      .where(and(eq(invoices.id, invoice.id), eq(invoices.businessId, input.businessId))).returning();
    await tx.insert(auditLogs).values({
      invoiceId: invoice.id,
      action: "paid",
      metadata: `Stripe Connect payment confirmed (session ${input.checkoutSessionId}, intent ${input.paymentIntentId || "n/a"})`,
      createdAt: paidAt,
    });
    return updated;
  }),
};

export const estimatesQ = {
  findByBusinessId: (businessId: string) => db.select().from(estimates).where(eq(estimates.businessId, businessId)),
  findByIdForBusiness: (id: string, businessId: string) =>
    db.select().from(estimates).where(and(eq(estimates.id, id), eq(estimates.businessId, businessId))).limit(1),
  findItemsByEstimateId: (estimateId: string) => db.select().from(estimateItems).where(eq(estimateItems.estimateId, estimateId)),
  create: (data: typeof estimates.$inferInsert, items: Array<Omit<typeof estimateItems.$inferInsert, "estimateId">>) => db.transaction(async (tx) => {
    const [estimate] = await tx.insert(estimates).values(data).returning();
    if (items.length) await tx.insert(estimateItems).values(items.map((item) => ({ ...item, estimateId: estimate.id })));
    return estimate;
  }),
  updateStatusForBusiness: (id: string, businessId: string, status: string) =>
    db.update(estimates).set({ status, updatedAt: new Date() })
      .where(and(eq(estimates.id, id), eq(estimates.businessId, businessId))).returning(),
  deleteForBusiness: (id: string, businessId: string) =>
    db.delete(estimates).where(and(eq(estimates.id, id), eq(estimates.businessId, businessId))).returning({ id: estimates.id }),
  convertToInvoice: (estimateId: string, businessId: string, invoiceNumber: string, issueDate: Date, dueDate: Date) =>
    db.transaction(async (tx) => {
      const [estimate] = await tx.select().from(estimates)
        .where(and(eq(estimates.id, estimateId), eq(estimates.businessId, businessId))).for("update");
      if (!estimate || estimate.status === "invoiced") return null;
      const items = await tx.select().from(estimateItems).where(eq(estimateItems.estimateId, estimate.id));
      const [invoice] = await tx.insert(invoices).values({
        businessId: estimate.businessId,
        clientId: estimate.clientId,
        invoiceNumber,
        status: "sent",
        issueDate,
        dueDate,
        currency: estimate.currency,
        subtotal: estimate.subtotal,
        taxTotal: estimate.taxTotal,
        discountTotal: estimate.discountTotal,
        totalAmount: estimate.totalAmount,
        notes: `Converted from estimate ${estimate.estimateNumber}. ${estimate.notes || ""}`.trim(),
      }).returning();
      if (items.length) {
        await tx.insert(invoiceItems).values(items.map((item) => ({
          invoiceId: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
        })));
      }
      await tx.update(estimates).set({ status: "invoiced", convertedInvoiceId: invoice.id, updatedAt: new Date() })
        .where(and(eq(estimates.id, estimate.id), eq(estimates.businessId, businessId)));
      await tx.insert(auditLogs).values({
        invoiceId: invoice.id,
        action: "created",
        metadata: `Invoice ${invoiceNumber} created from estimate ${estimate.estimateNumber}`,
      });
      return invoice;
    }),
};

export const paymentsQ = {
  create: (data: typeof payments.$inferInsert) => db.insert(payments).values(data).returning(),
  findByInvoiceId: (invoiceId: string) => db.select().from(payments).where(eq(payments.invoiceId, invoiceId)),
};

export const auditQ = {
  create: (data: typeof auditLogs.$inferInsert) => db.insert(auditLogs).values(data).returning(),
  findByInvoiceId: (invoiceId: string) => db.select().from(auditLogs).where(eq(auditLogs.invoiceId, invoiceId)).orderBy(desc(auditLogs.createdAt)),
};

export const dashboardMetricsQ = async (businessId: string) => {
  const invs = await db.select().from(invoices).where(eq(invoices.businessId, businessId));
  const totalInvoices = invs.length;
  const totalOutstanding = invs.filter((invoice) => invoice.status === "sent" || invoice.status === "overdue")
    .reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0);
  const totalPaid = invs.filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0);
  const draftCount = invs.filter((invoice) => invoice.status === "draft").length;
  const overdueCount = invs.filter((invoice) => invoice.status === "overdue").length;
  const recentInvoices = invs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  return { totalInvoices, totalOutstanding, totalPaid, draftCount, overdueCount, recentInvoices };
};
