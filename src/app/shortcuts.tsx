"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { resolveShortcut } from "@/lib/shortcuts";

// Single-key shortcuts on signed-in pages: "/" focuses invoice search, "n" opens a new invoice.
// The rules for when they fire live in src/lib/shortcuts.ts. There is no command palette yet, so
// Ctrl/Cmd+K is left to the browser.
export default function Shortcuts() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const action = resolveShortcut(event, pathname);
      if (!action) return;

      if (action.kind === "focus-search") {
        const search = document.querySelector<HTMLInputElement>('input[aria-label="Search invoices"]');
        // No search box on this page: leave "/" to the browser (for example quick find).
        if (!search) return;
        event.preventDefault();
        search.focus();
        return;
      }

      event.preventDefault();
      router.push(action.href);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router, pathname]);

  return null;
}
