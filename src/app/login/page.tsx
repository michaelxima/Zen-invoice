import LoginForm from "./login-form";
import { SIGN_IN_ERROR_MESSAGES, isGoogleSignInEnabled } from "@/lib/auth/session-rules";

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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[]; error?: string | string[] }>;
}) {
  const { callbackUrl, error } = await searchParams;
  const googleConfigured = isGoogleSignInEnabled(process.env);
  const errorCode = Array.isArray(error) ? error[0] : error;
  const initialError = errorCode ? (SIGN_IN_ERROR_MESSAGES[errorCode] ?? null) : null;

  return <LoginForm callbackUrl={safeCallbackUrl(callbackUrl)} googleConfigured={googleConfigured} initialError={initialError} />;
}
