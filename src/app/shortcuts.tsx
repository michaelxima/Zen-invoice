"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Shortcuts() {
  const router = useRouter();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        alert("Command palette coming soon");
      }
      if (e.key === "/" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        const input = document.querySelector('input[aria-label="Search invoices"]') as HTMLInputElement | null;
        input?.focus();
      }
      if (e.key.toLowerCase() === "n" && !(e.target instanceof HTMLInputElement)) {
        router.push("/invoices/new");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);
  return null;
}
