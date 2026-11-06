import LoginForm from "./login-form";

const DEFAULT_CALLBACK_URL = "/dashboard";

function safeCallbackUrl(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return DEFAULT_CALLBACK_URL;
  }
  try {
    const parsed = new URL(candidate, "http://localhost");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_CALLBACK_URL;
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string | string[] }> }) {
  const { callbackUrl } = await searchParams;
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());

  return <LoginForm callbackUrl={safeCallbackUrl(callbackUrl)} googleConfigured={googleConfigured} />;
}
