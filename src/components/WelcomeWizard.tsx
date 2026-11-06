"use client";
import { useState } from "react";
import { useTranslation } from "@/lib/useTranslation";
import Link from "next/link";

export default function WelcomeWizard() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const steps = ["Setup company & logos","Pick a design","Integrate payment gateway","Create first invoice"];
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <h2 className="text-lg font-bold mb-4">Welcome to Zen-Invoice</h2>
      <div className="space-y-3">
        {steps.map((s,i)=>(
          <div key={s} className={`p-3 rounded-lg border ${i===step?"border-indigo-500 bg-indigo-500/10":"border-slate-800"}`}>
            <div className="flex justify-between">
              <span className="text-sm">{s}</span>
              <button onClick={()=>setStep(i)} className="text-xs underline">Open</button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Link href="/invoices/new" className="px-3 py-1.5 rounded-lg bg-indigo-600 text-xs">Create first invoice</Link>
        <Link href="/settings" className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs">Settings</Link>
      </div>
    </div>
  );
}
