import { useEffect, useState } from "react";
import { translations } from "./i18n";

export function useTranslation() {
  const [lang, setLang] = useState("en");

  useEffect(() => {
    const saved = localStorage.getItem("zen-invoice-lang") || "en";
    setLang(saved);
    const handler = () => setLang(localStorage.getItem("zen-invoice-lang") || "en");
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const t = (key: string, fallback?: string): string => {
    const dict = (translations as any)[lang] || translations.en;
    return dict[key] ?? fallback ?? key;
  };

  return { lang, t };
}
