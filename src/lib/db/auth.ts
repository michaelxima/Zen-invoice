import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "../../db";
import { authAccounts, authSessions, businesses, users } from "../../db/schema";

export type SessionRevokeReason = "sign_out" | "sign_out_everywhere";

export const authSessionsQ = {
  create: async (userId: string, expiresAt: Date) => {
    const [row] = await db.insert(authSessions).values({ userId, expiresAt }).returning({ id: authSessions.id });
    return row;
  },

  findById: async (id: string) => {
    const [row] = await db
      .select({
        id: authSessions.id,
        userId: authSessions.userId,
        expiresAt: authSessions.expiresAt,
        revokedAt: authSessions.revokedAt,
      })
      .from(authSessions)
      .where(eq(authSessions.id, id))
      .limit(1);
    return row;
  },

  revoke: (id: string, reason: SessionRevokeReason) =>
    db
      .update(authSessions)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(authSessions.id, id), isNull(authSessions.revokedAt)))
      .returning({ id: authSessions.id }),

  revokeAllForUser: (userId: string, reason: SessionRevokeReason) =>
    db
      .update(authSessions)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)))
      .returning({ id: authSessions.id }),
};

export const authAccountsQ = {
  findUserId: async (provider: string, providerAccountId: string) => {
    const [row] = await db
      .select({ userId: authAccounts.userId })
      .from(authAccounts)
      .where(and(eq(authAccounts.provider, provider), eq(authAccounts.providerAccountId, providerAccountId)))
      .limit(1);
    return row?.userId ?? null;
  },

  /** Creates the user, their default business and the provider binding together, or none of them. */
  createUserWithBusinessAndAccount: (input: {
    email: string;
    name: string;
    provider: string;
    providerAccountId: string;
  }) =>
    db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({ email: input.email, name: input.name, passwordHash: null }).returning();
      const [business] = await tx
        .insert(businesses)
        .values({ userId: user.id, name: `${input.name}'s Business`, currency: "USD", email: input.email })
        .returning();
      await tx.insert(authAccounts).values({ provider: input.provider, providerAccountId: input.providerAccountId, userId: user.id });
      return { userId: user.id, businessId: business.id };
    }),
};
