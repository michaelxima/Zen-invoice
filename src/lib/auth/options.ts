import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider, { type GoogleProfile } from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { usersQ, businessesQ } from "../db/queries";
import { authAccountsQ, authSessionsQ } from "../db/auth";
import { enforceRateLimit, getRequestRateLimitKey } from "../security/rate-limit";
import {
  SESSION_MAX_AGE_SECONDS,
  checkStoredSession,
  decideGoogleSignIn,
  isGoogleSignInEnabled,
  isUuid,
} from "./session-rules";

const authSecret = process.env.NEXTAUTH_SECRET;
if (process.env.NODE_ENV === "production" && (!authSecret || authSecret.length < 32)) {
  throw new Error("NEXTAUTH_SECRET must be configured with at least 32 characters in production");
}

// Release scope v1 keeps Google sign-in off. It is only offered when GOOGLE_SIGNIN_ENABLED=1 and both
// credentials are set; having the credentials in .env.local is not enough.
const googleEnabled = isGoogleSignInEnabled(process.env);

export const authOptions: AuthOptions = {
  providers: [
    ...(googleEnabled
      ? [GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID!.trim(), clientSecret: process.env.GOOGLE_CLIENT_SECRET!.trim() })]
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
        } catch {
          console.error("Credential authorization failed");
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;
      if (!googleEnabled) return "/login?error=google_unavailable";

      try {
        const google = profile as Partial<GoogleProfile> | undefined;
        const subject = account.providerAccountId;
        const email = typeof google?.email === "string" ? google.email.trim().toLowerCase() : undefined;
        const linkedUserId = subject ? await authAccountsQ.findUserId("google", subject) : null;
        const existingUserWithEmail = !linkedUserId && email ? (await usersQ.findByEmail(email)).length > 0 : false;

        const decision = decideGoogleSignIn({
          subject,
          email,
          emailVerified: google?.email_verified,
          linkedUserId,
          existingUserWithEmail,
        });

        if (decision.kind === "reject") return `/login?error=google_${decision.reason}`;

        if (decision.kind === "use_linked") {
          const [dbUser] = await usersQ.findById(decision.userId);
          if (!dbUser) return "/login?error=google_missing_identity";
          const business = await businessesQ.ensureDefaultForUser(dbUser.id, `${dbUser.name || "My"} Business`, dbUser.email);
          user.id = dbUser.id;
          user.businessId = business.id;
          return true;
        }

        try {
          const created = await authAccountsQ.createUserWithBusinessAndAccount({
            email: email!,
            name: (typeof google?.name === "string" && google.name.trim()) || email!.split("@")[0],
            provider: "google",
            providerAccountId: subject,
          });
          user.id = created.userId;
          user.businessId = created.businessId;
          return true;
        } catch (error) {
          // Unique email or identity: a password account or a simultaneous callback got there first. Never link.
          if ((error as { code?: string }).code === "23505") return "/login?error=google_not_linked";
          throw error;
        }
      } catch {
        console.error("Google sign-in failed");
        return false;
      }
    },

    async jwt({ token, user }) {
      if (user) {
        // Sign-in: start a server-side session and bind the cookie to it.
        const session = await authSessionsQ.create(user.id, new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000));
        token.id = user.id;
        token.businessId = user.businessId;
        token.sid = session.id;
        return token;
      }

      // Every later use of the cookie: it only counts while its server-side session is live. Throwing makes
      // NextAuth treat the request as signed out and clear the cookie.
      const stored = isUuid(token.sid) ? await authSessionsQ.findById(token.sid) : undefined;
      const check = checkStoredSession(token, stored, new Date());
      if (!check.ok) throw new Error(`Session rejected: ${check.reason}`);
      return token;
    },

    async session({ session, token }) {
      // The session id stays server-side; the browser only needs who is signed in.
      if (session?.user) {
        session.user.id = token.id as string;
        session.user.businessId = token.businessId as string;
      }
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      // Revoke this browser's server-side session, so a copy of the cookie stops working too.
      if (isUuid(token?.sid)) await authSessionsQ.revoke(token.sid, "sign_out");
    },
  },
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS, updateAge: 24 * 60 * 60 },
  pages: { signIn: "/login" },
  secret: authSecret,
};
