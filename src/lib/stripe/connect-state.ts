import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type ConnectState = { businessId: string; userId: string; issuedAt: number; nonce: string };

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("NEXTAUTH_SECRET must contain at least 32 characters for OAuth state protection");
  return secret;
}

export function createConnectState(payload: Omit<ConnectState, "issuedAt" | "nonce">): string {
  const body: ConnectState = { ...payload, issuedAt: Date.now(), nonce: randomBytes(16).toString("hex") };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const signature = createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyConnectState(value: string): ConnectState | null {
  const [encoded, signature, extra] = value.split(".");
  if (!encoded || !signature || extra) return null;
  const expected = createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length || !timingSafeEqual(receivedBuffer, expectedBuffer)) return null;
  try {
    const state = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ConnectState;
    if (!state.businessId || !state.userId || !state.nonce || !Number.isFinite(state.issuedAt)) return null;
    if (Date.now() - state.issuedAt > 10 * 60 * 1000 || state.issuedAt > Date.now() + 30_000) return null;
    return state;
  } catch {
    return null;
  }
}
