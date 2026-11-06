"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { signIn } from "next-auth/react";

type LoginFormProps = { callbackUrl: string; googleConfigured: boolean; initialError?: string | null };

export default function LoginForm({ callbackUrl, googleConfigured, initialError = null }: LoginFormProps) {
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(false);

  async function handleCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      callbackUrl,
      redirect: false,
    });
    if (result?.ok && result.url) {
      window.location.assign(result.url);
      return;
    }
    setError("The email or password is incorrect.");
    setLoading(false);
  }

  async function handleGoogleSignIn() {
    if (!googleConfigured) return;
    setError(null);
    setLoading(true);
    await signIn("google", { callbackUrl });
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 p-8 rounded-2xl shadow-xl backdrop-blur-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 items-center justify-center text-white font-bold text-xl mb-3 shadow-lg shadow-indigo-500/30">ZI</div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Sign in to Zen-Invoice</h1>
          <p className="text-sm text-slate-400 mt-1">Manage invoices, clients, and real-time previews</p>
        </div>

        <form className="space-y-4" onSubmit={handleCredentials}>
          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 text-slate-500" size={18} />
              <input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" required />
            </div>
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 text-slate-500" size={18} />
              <input id="password" name="password" type="password" autoComplete="current-password" placeholder="••••••••" className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" required />
            </div>
          </div>
          <button type="submit" disabled={loading} className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all hover:scale-[1.01]">
            <span>{loading ? "Signing in…" : "Sign In"}</span><ArrowRight size={18} />
          </button>
        </form>

        <div className="my-6 flex items-center justify-center gap-3">
          <div className="h-px bg-slate-800 flex-1" /><span className="text-xs text-slate-500 uppercase tracking-wider">or continue with</span><div className="h-px bg-slate-800 flex-1" />
        </div>

        <button type="button" onClick={handleGoogleSignIn} disabled={!googleConfigured || loading} aria-describedby={!googleConfigured ? "google-unavailable" : undefined} className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-800/80 disabled:cursor-not-allowed disabled:opacity-60 border border-slate-800 text-slate-200 text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-colors">
          <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" />
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
            <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12s.7 2.3 1.9 4.7l3.7-1.9z" />
            <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z" />
          </svg>
          <span>Continue with Google</span>
        </button>
        {!googleConfigured && <p id="google-unavailable" role="status" className="mt-3 text-center text-xs text-amber-300">Google sign-in is not available yet. Sign in with your email and password.</p>}
        {error && <p role="alert" className="mt-3 text-center text-xs text-red-300">{error}</p>}
        <p className="text-center text-xs text-slate-500 mt-6">Don&apos;t have an account?{" "}<Link href="/onboarding" className="text-indigo-400 font-semibold hover:underline">Register here</Link></p>
      </div>
    </div>
  );
}
