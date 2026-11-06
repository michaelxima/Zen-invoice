"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { useTranslation } from "@/lib/useTranslation";
import WelcomeWizard from "@/components/WelcomeWizard";
import { 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight,
  Plus,
  Sparkles,
  FileCheck,
  FileText
} from "lucide-react";
import { getDashboardMetrics } from "@/lib/actions/invoices";

export default function DashboardPage() {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState({
    totalInvoices: 0,
    totalOutstanding: 0,
    totalPaid: 0,
    draftCount: 0,
    overdueCount: 0,
    recentInvoices: [] as any[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getDashboardMetrics();
        setMetrics(data);
      } catch (err) {
        console.error("Failed to load dashboard metrics:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const cards = [
    { 
      title: "Total Outstanding", 
      amount: `$${(metrics.totalOutstanding || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
      count: `${metrics.overdueCount || 0} overdue / awaiting payment`, 
      icon: Clock, 
      color: "text-amber-400", 
      bg: "bg-amber-500/10" 
    },
    { 
      title: "Paid (All-Time)", 
      amount: `$${(metrics.totalPaid || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
      count: "Completed revenue across accounts", 
      icon: CheckCircle2, 
      color: "text-emerald-400", 
      bg: "bg-emerald-500/10" 
    },
    { 
      title: "Draft Invoices", 
      amount: `${metrics.draftCount || 0} Drafts`, 
      count: "In preparation for client dispatch", 
      icon: AlertCircle, 
      color: "text-[var(--brand-500)]", 
      bg: "bg-[var(--brand-500)]/10" 
    },
  ];

  return (
    <div className="min-h-screen text-slate-100 flex" style={{ background: "var(--bg-950)" }}>
      {/* Sidebar navigation */}
      <Sidebar currentPath="/dashboard" />

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 p-6 md:p-10 max-w-7xl mx-auto">
        {/* Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{t("dashboardTitle")}</h1>
            <p className="text-sm text-slate-400">Welcome back. Here is your live financial snapshot.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/estimates/new"
              className="flex items-center gap-2 py-2 px-4 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
            >
              <FileCheck size={16} style={{ color: "var(--brand-500)" }} />
              <span>New Quote</span>
            </Link>
            <Link
              href="/ai-create"
              className="flex items-center gap-2 py-2 px-4 bg-slate-900 hover:bg-slate-800 border rounded-xl text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
              style={{
                color: "var(--brand-50)",
                borderColor: "color-mix(in srgb, var(--brand-500) 30%, transparent)",
              }}
            >
              <Sparkles size={16} />
              <span>AI Quick Invoice</span>
            </Link>
            <Link
              href="/invoices/new"
              className="flex items-center gap-2 py-2 px-4 text-white rounded-xl text-sm font-medium shadow-lg transition-all hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:ring-offset-2 focus:ring-offset-slate-950"
              style={{
                background: "var(--brand-600)",
                boxShadow: "0 10px 15px -3px rgba(79, 70, 229, 0.3)",
              }}
            >
              <Plus size={16} />
              <span>New Invoice</span>
            </Link>
          </div>
        </div>
        <WelcomeWizard/>
        {/* Metrics Grid with aria-live */}
        <div 
          aria-live="polite" 
          aria-atomic="true" 
          className="grid grid-cols-1 md:grid-cols-3 gap-6 my-8"
        >
          {loading ? (
            [1, 2, 3].map((idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md animate-pulse space-y-4">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-slate-800 rounded w-28" />
                  <div className="h-9 w-9 bg-slate-800 rounded-xl" />
                </div>
                <div className="space-y-2 mt-4">
                  <div className="h-8 bg-slate-800 rounded w-36" />
                  <div className="h-3 bg-slate-800/60 rounded w-48" />
                </div>
              </div>
            ))
          ) : (
            cards.map((m, idx) => {
              const Icon = m.icon;
              return (
                <div 
                  key={idx} 
                  className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md flex flex-col justify-between hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-400">{m.title}</span>
                    <div className={`p-2.5 rounded-xl ${m.bg} ${m.color}`}>
                      <Icon size={20} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <h2 className="text-3xl font-extrabold text-white tracking-tight">{m.amount}</h2>
                    <p className="text-xs text-slate-500 mt-1">{m.count}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Recent Invoices Feed / Skeletons / Empty State */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-white">Recent Invoices</h3>
              <p className="text-xs text-slate-400">Live activity and billing records from your business account</p>
            </div>
            <Link 
              href="/invoices" 
              className="text-xs font-semibold hover:underline flex items-center gap-1 focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)] rounded p-1"
              style={{ color: "var(--brand-500)" }}
            >
              View All <ArrowUpRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3" role="status" aria-label="Loading recent invoices">
              <span className="sr-only">Loading recent invoices...</span>
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse flex items-center justify-between py-3 border-b border-slate-800/50">
                  <div className="h-4 bg-slate-800 rounded w-24" />
                  <div className="h-4 bg-slate-800 rounded w-32" />
                  <div className="h-4 bg-slate-800 rounded w-20" />
                  <div className="h-4 bg-slate-800 rounded w-20" />
                  <div className="h-4 bg-slate-800 rounded w-20" />
                  <div className="h-6 bg-slate-800 rounded-full w-16" />
                </div>
              ))}
            </div>
          ) : !metrics.recentInvoices || metrics.recentInvoices.length === 0 ? (
            <div className="py-12 px-6 text-center max-w-md mx-auto">
              <div
                className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center border shadow-inner"
                style={{
                  background: "color-mix(in srgb, var(--brand-500) 10%, transparent)",
                  borderColor: "color-mix(in srgb, var(--brand-500) 30%, transparent)",
                  color: "var(--brand-500)",
                }}
              >
                <FileText className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-white mb-1">{t('noInvoices')}</h4>
              <p className="text-xs text-slate-400 mb-5">
                {t('noInvoicesDesc')}
              </p>
              <Link
                href="/invoices/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-lg transition-all hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:ring-offset-2 focus:ring-offset-slate-950"
                style={{
                  background: "var(--brand-600)",
                  boxShadow: "0 10px 15px -3px rgba(79, 70, 229, 0.3)",
                }}
              >
                <Plus size={14} />
                {t('createFirstInvoice')}
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-xs uppercase bg-slate-950/60 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th scope="col" className="py-3 px-4 rounded-l-xl">Invoice ID</th>
                    <th scope="col" className="py-3 px-4">Client</th>
                    <th scope="col" className="py-3 px-4">Issue Date</th>
                    <th scope="col" className="py-3 px-4">Due Date</th>
                    <th scope="col" className="py-3 px-4">Total Amount</th>
                    <th scope="col" className="py-3 px-4 rounded-r-xl">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {metrics.recentInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium" style={{ color: "var(--brand-500)" }}>
                        <Link href={`/portal/${inv.accessToken || inv.id}`} target="_blank" className="hover:underline focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)] rounded">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-white">{inv.clientName || "Client"}</td>
                      <td className="py-3.5 px-4 text-slate-400">{inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : "-"}</td>
                      <td className="py-3.5 px-4 text-slate-400">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "-"}</td>
                      <td className="py-3.5 px-4 font-bold text-white">
                        {inv.currency || "USD"} {Number(inv.totalAmount || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`
                          inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border
                          ${inv.status?.toLowerCase() === "paid" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : ""}
                          ${inv.status?.toLowerCase() === "sent" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : ""}
                          ${inv.status?.toLowerCase() === "overdue" ? "bg-rose-500/10 text-rose-400 border-rose-500/30" : ""}
                          ${inv.status?.toLowerCase() === "draft" ? "bg-slate-700/30 text-slate-400 border-slate-700/50" : ""}
                        `}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                          <span className="capitalize">{inv.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
