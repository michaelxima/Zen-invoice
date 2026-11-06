"use client";

import { useEffect, useState } from "react";

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "sv", name: "Swedish" },
  { code: "no", name: "Norwegian" },
  { code: "da", name: "Danish" },
  { code: "de", name: "German" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
];

export default function LanguageSwitcher() {
  const [lang, setLang] = useState("en");

  useEffect(() => {
    const saved = localStorage.getItem("zen-invoice-lang") || "en";
    setLang(saved);
    document.documentElement.lang = saved;
  }, []);

  const changeLang = (code: string) => {
    localStorage.setItem("zen-invoice-lang", code);
    setLang(code);
    document.documentElement.lang = code;
    window.location.reload();
  };

  return (
    <div className="px-4 py-2 border-b border-slate-800">
      <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">Language</label>
      <select
        value={lang}
        onChange={(e) => changeLang(e.target.value)}
        className="w-full bg-slate-800 text-slate-200 text-xs rounded px-2 py-1.5"
      >
        {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
      </select>
    </div>
  );
}
