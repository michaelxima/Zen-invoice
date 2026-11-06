import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      businessId?: string;
    };
  }

  interface User {
    id: string;
    businessId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    businessId?: string;
    /** Server-side session id (auth_sessions.id). Never copied into the client-visible session. */
    sid?: string;
  }
}
