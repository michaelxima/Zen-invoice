import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { usersQ, businessesQ } from "../db/queries";
import { enforceRateLimit, getRequestRateLimitKey } from "../security/rate-limit";

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const authSecret = process.env.NEXTAUTH_SECRET;
if (process.env.NODE_ENV === "production" && (!authSecret || authSecret.length < 32)) {
  throw new Error("NEXTAUTH_SECRET must be configured with at least 32 characters in production");
}

export const authOptions: AuthOptions = {
  providers: [
    ...(googleClientId && googleClientSecret
      ? [GoogleProvider({ clientId: googleClientId, clientSecret: googleClientSecret })]
      : []),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const email = credentials.email.trim().toLowerCase();
          const forwardedFor = request.headers?.["x-forwarded-for"];
          const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
          try {
            enforceRateLimit(`login:${getRequestRateLimitKey(ip || null, email)}`, 10, 15 * 60 * 1000);
          } catch {
            return null;
          }
          const rows = await usersQ.findByEmail(email);
          const user = rows[0];
          if (!user?.passwordHash || !(await bcrypt.compare(credentials.password, user.passwordHash))) return null;

          const business = await businessesQ.ensureDefaultForUser(user.id, `${user.name || "My"} Business`, user.email);
          return { id: user.id, name: user.name || "", email: user.email, businessId: business.id };
        } catch (error) {
          console.error("Credential authorization failed");
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const email = user.email.trim().toLowerCase();
        try {
          let [dbUser] = await usersQ.findByEmail(email);
          let businessId: string | undefined;
          if (!dbUser) {
            try {
              const created = await usersQ.createWithBusiness(
                { email, name: user.name || email.split("@")[0], passwordHash: null },
                { name: `${user.name || email.split("@")[0]}'s Business`, currency: "USD", email },
              );
              dbUser = created.user;
              businessId = created.business.id;
            } catch (error) {
              // A simultaneous OAuth callback may have created the same unique email first.
              const [concurrentUser] = await usersQ.findByEmail(email);
              if (!concurrentUser) throw error;
              dbUser = concurrentUser;
            }
          }
          if (!businessId) {
            const business = await businessesQ.ensureDefaultForUser(dbUser.id, `${dbUser.name || "My"} Business`, dbUser.email);
            businessId = business.id;
          }
          user.id = dbUser.id;
          user.businessId = businessId;
        } catch {
          console.error("Google account provisioning failed");
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.businessId = user.businessId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id as string;
        session.user.businessId = token.businessId as string;
      }
      return session;
    },
  },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  pages: { signIn: "/login" },
  secret: authSecret,
};
