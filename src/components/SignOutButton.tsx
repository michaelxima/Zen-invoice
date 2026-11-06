"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

// Ends the session through NextAuth: the server revokes this browser's session and clears the cookie.
// A full page load to /login afterwards drops any signed-in state still held in memory.
export function SignOutButton() {
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");

  async function handleSignOut() {
    if (state === "pending") return;
    setState("pending");
    try {
      await signOut({ redirect: false });
      window.location.assign("/login");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      {state === "error" && (
        <span role="alert" className="text-[10px] text-red-300">
          Sign-out failed. Try again.
        </span>
      )}
      <button
        type="button"
        onClick={handleSignOut}
        disabled={state === "pending"}
        aria-label="Sign out"
        title="Sign out"
        className="text-slate-400 hover:text-red-400 disabled:opacity-50 transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
      >
        <LogOut size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
