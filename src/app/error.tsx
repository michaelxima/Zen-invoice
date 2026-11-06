"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to observability service (e.g. Sentry, Datadog, OpenTelemetry, CloudWatch)
    console.error("[Invoice Claw Observability] Unhandled Application Error:", {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      timestamp: new Date().toISOString(),
      url: typeof window !== "undefined" ? window.location.href : "unknown",
    });
  }, [error]);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6 text-center"
      style={{ background: "var(--bg-950)", color: "var(--text-100)" }}
    >
      <div
        className="max-w-md w-full p-8 rounded-2xl border shadow-2xl space-y-6"
        style={{
          background: "var(--bg-900)",
          borderColor: "rgba(239, 68, 68, 0.2)",
        }}
      >
        <div
          className="w-16 h-16 mx-auto rounded-full flex items-center justify-center border shadow-inner"
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            borderColor: "rgba(239, 68, 68, 0.3)",
            color: "var(--danger)",
          }}
        >
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight">Something went wrong</h2>
          <p className="text-sm" style={{ color: "var(--text-400)" }}>
            An unexpected error occurred. It has been recorded in our observability telemetry.
          </p>
          {error.digest && (
            <p className="text-xs font-mono py-1 px-2 rounded inline-block mt-2" style={{ background: "var(--bg-800)", color: "var(--text-300)" }}>
              Digest ID: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={() => reset()}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{
              background: "var(--brand-600)",
              outlineColor: "var(--brand-500)",
            }}
          >
            <RotateCcw className="w-4 h-4" />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all border focus:outline-none focus:ring-2"
            style={{
              background: "var(--bg-800)",
              borderColor: "rgba(255, 255, 255, 0.1)",
              color: "var(--text-100)",
            }}
          >
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
