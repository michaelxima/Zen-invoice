"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";
import { 
  Plus, 
  Search, 
  Download,
  Trash2,
  Check,
  ExternalLink,
  Copy,
  Mail,
  History,
  Clock,
  X,
  CheckCircle2,
  FileCheck,
  FileText,
  Send,
  AlertCircle
} from "lucide-react";
import { 
  getInvoices, 
  deleteInvoice, 
  sendInvoiceReminder,
  getInvoiceAuditTrail 
} from "@/lib/actions/invoices";
import { InvoiceDto, InvoiceAuditLogDto } from "@/lib/types/dto";

export default function InvoicesListPage() {
  const [invoices, setInvoices] = useState<InvoiceDto[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const [sendError, setSendError] = useState("");

  // Reminder Modal State
  const [reminderModalInvoice, setReminderModalInvoice] = useState<InvoiceDto | null>(null);
  const [reminderTone, setReminderTone] = useState<"friendly" | "formal" | "urgent">("friendly");
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderSuccess, setReminderSuccess] = useState(false);
  const [reminderError, setReminderError] = useState("");

  // Audit Trail Modal State
  const [auditModalInvoice, setAuditModalInvoice] = useState<InvoiceDto | null>(null);
  const [auditLogs, setAuditLogs] = useState<InvoiceAuditLogDto[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const data = await getInvoices(search, selectedStatus);
      setInvoices(data);
    } catch (err) {
      console.error("Failed to load invoices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [search, selectedStatus]);

  const handleDelete = async (id: string) => {
    if (confirm("Cancel and archive this invoice? Financial history will be retained.")) {
      try {
        await deleteInvoice(id);
        loadInvoices();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Invoice could not be archived.");
      }
    }
  };

  const handleCopyLink = (token: string, id: string) => {
    const url = `${window.location.origin}/portal/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendInvoice = async (invoiceId: string) => {
    setSendingInvoiceId(invoiceId);
    setSendError("");
    try {
      const response = await fetch("/api/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Email provider did not accept this invoice.");
      await loadInvoices();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Invoice email could not be sent.");
    } finally {
      setSendingInvoiceId(null);
    }
  };

  const handleOpenReminderModal = (inv: InvoiceDto) => {
    setReminderModalInvoice(inv);
    setReminderTone(inv.status === "Overdue" ? "urgent" : "friendly");
    setReminderSuccess(false);
    setReminderError("");
  };

  const handleTriggerReminder = async () => {
    if (!reminderModalInvoice) return;
    setSendingReminder(true);
    setReminderError("");
    try {
      await sendInvoiceReminder(reminderModalInvoice.id, reminderTone);
      setReminderSuccess(true);
      setTimeout(() => {
        setReminderModalInvoice(null);
        setReminderSuccess(false);
        loadInvoices();
      }, 1500);
    } catch (err) {
      setReminderError(err instanceof Error ? err.message : "The reminder could not be sent.");
    } finally {
      setSendingReminder(false);
    }
  };

  const handleOpenAuditModal = async (inv: InvoiceDto) => {
    setAuditModalInvoice(inv);
    setLoadingAudit(true);
    try {
      const logs = await getInvoiceAuditTrail(inv.id);
      setAuditLogs(logs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAudit(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-100 flex" style={{ background: "var(--bg-950)" }}>
      <Sidebar currentPath="/invoices" />

      <main className="flex-1 md:ml-64 p-6 md:p-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Invoice Management</h1>
            <p className="text-sm text-slate-400">Create invoices, send them to clients, and track invoice activity</p>
          </div>
          <Link
            href="/invoices/new"
            className="flex items-center justify-center gap-2 py-2.5 px-4 text-white rounded-xl text-sm font-semibold shadow-lg transition-all hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:ring-offset-2 focus:ring-offset-slate-950"
            style={{
              background: "var(--brand-600)",
              boxShadow: "0 10px 15px -3px rgba(79, 70, 229, 0.3)",
            }}
          >
            <Plus size={18} />
            <span>Create New Invoice</span>
          </Link>
        </div>

        {sendError && <p role="alert" className="mt-4 rounded-lg border border-rose-700 bg-rose-950/40 p-3 text-sm text-rose-200">{sendError}</p>}

        {/* Search & Filter Toolbar */}
        <div className="my-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3.5 top-3 text-slate-500" size={18} />
            <input
              type="text"
              aria-label="Search invoices"
              placeholder="Search by invoice #, client, email, or PO #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:border-[var(--brand-600)] transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto" role="group" aria-label="Filter invoices by status">
            {["All", "Draft", "Sent", "Paid", "Overdue", "Cancelled"].map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`
                  px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]
                  ${selectedStatus === status 
                    ? "text-white shadow-md" 
                    : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"}
                `}
                style={selectedStatus === status ? { background: "var(--brand-600)" } : undefined}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Invoices Data Table / Skeletons / Empty State */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden shadow-xl">
          {loading ? (
            <div className="p-6 space-y-4" role="status" aria-label="Loading invoices">
              <span className="sr-only">Loading invoices...</span>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse flex items-center justify-between py-3 border-b border-slate-800/50">
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-800 rounded w-28" />
                    <div className="h-3 bg-slate-800/60 rounded w-20" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-800 rounded w-36" />
                    <div className="h-3 bg-slate-800/60 rounded w-24" />
                  </div>
                  <div className="h-6 bg-slate-800 rounded-full w-20" />
                  <div className="h-5 bg-slate-800 rounded w-16" />
                  <div className="h-6 bg-slate-800 rounded-full w-16" />
                  <div className="h-8 bg-slate-800 rounded w-24" />
                </div>
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-16 px-6 text-center max-w-md mx-auto">
              <div
                className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center border shadow-inner"
                style={{
                  background: "color-mix(in srgb, var(--brand-500) 10%, transparent)",
                  borderColor: "color-mix(in srgb, var(--brand-500) 30%, transparent)",
                  color: "var(--brand-500)",
                }}
              >
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">No invoices found</h3>
              <p className="text-sm text-slate-400 mb-6">
                {search || selectedStatus !== "All"
                  ? "No invoices match your current search or status filter."
                  : "You haven't created any invoices yet. Generate your first invoice to begin billing clients."}
              </p>
              <Link
                href="/invoices/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:ring-offset-2 focus:ring-offset-slate-950"
                style={{
                  background: "var(--brand-600)",
                  boxShadow: "0 10px 15px -3px rgba(79, 70, 229, 0.3)",
                }}
              >
                <Plus size={16} />
                Create your first invoice
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th scope="col" className="py-3.5 px-5">Invoice ID</th>
                    <th scope="col" className="py-3.5 px-5">Client & PO</th>
                    <th scope="col" className="py-3.5 px-5">Activity</th>
                    <th scope="col" className="py-3.5 px-5">Total Amount</th>
                    <th scope="col" className="py-3.5 px-5">Status</th>
                    <th scope="col" className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                      {/* Invoice ID */}
                      <td className="py-4 px-5">
                        <Link 
                          href={`/portal/${inv.accessToken}`} 
                          target="_blank" 
                          className="font-mono font-medium hover:underline flex items-center gap-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)] rounded"
                          style={{ color: "var(--brand-500)" }}
                        >
                          <span>{inv.invoiceNumber}</span>
                          <ExternalLink size={12} className="text-slate-500" />
                        </Link>
                        <div className="text-[10px] text-slate-500 mt-0.5">Due: {inv.dueDate}</div>
                      </td>

                      {/* Client & PO */}
                      <td className="py-4 px-5">
                        <div className="font-semibold text-white">{inv.clientName}</div>
                        {inv.purchaseOrderNumber ? (
                          <div className="text-[11px] font-mono font-medium mt-0.5" style={{ color: "var(--brand-500)" }}>
                            PO: {inv.purchaseOrderNumber}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400">{inv.clientEmail}</div>
                        )}
                      </td>

                      {/* Invoice activity */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5">
                          <span className={`
                            inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border
                            ${inv.deliveryStatus === "Paid" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : ""}
                            ${inv.deliveryStatus === "Opened" || inv.deliveryStatus === "Downloaded" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" : ""}
                            ${inv.deliveryStatus === "Created" || inv.deliveryStatus === "Sent" || inv.deliveryStatus === "Cancelled" ? "bg-slate-800 text-slate-300 border-slate-700" : ""}
                          `}>
                            {inv.deliveryStatus === "Paid" && <Check size={11} />}
                            {inv.deliveryStatus === "Opened" && <CheckCircle2 size={11} />}
                            {inv.deliveryStatus === "Downloaded" && <Download size={11} />}
                            {inv.deliveryStatus === "Sent" && <Send size={11} />}
                            <span>{inv.deliveryStatus}</span>
                          </span>
                        </div>
                        {inv.viewedAt && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Opened: {new Date(inv.viewedAt).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      {/* Total Amount */}
                      <td className="py-4 px-5">
                        <span className="font-bold text-white">
                          {inv.currency} {inv.totalAmount.toFixed(2)}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-5">
                        <span className={`
                          inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border
                          ${inv.status === "Paid" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : ""}
                          ${inv.status === "Sent" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : ""}
                          ${inv.status === "Overdue" ? "bg-rose-500/10 text-rose-400 border-rose-500/30" : ""}
                          ${inv.status === "Draft" || inv.status === "Cancelled" ? "bg-slate-800 text-slate-400 border-slate-700" : ""}
                        `}>
                          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                          <span>{inv.status}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Copy Portal Link */}
                          <button
                            onClick={() => handleCopyLink(inv.accessToken, inv.id)}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
                            title="Copy Client Portal URL"
                            aria-label={`Copy link for invoice ${inv.invoiceNumber}`}
                          >
                            {copiedId === inv.id ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                          </button>

                          {inv.status === "Draft" && (
                            <button
                              onClick={() => handleSendInvoice(inv.id)}
                              disabled={sendingInvoiceId === inv.id}
                              className="p-1.5 text-slate-400 hover:text-emerald-300 disabled:opacity-50 rounded-lg hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
                              title="Send invoice email"
                              aria-label={`Send invoice ${inv.invoiceNumber}`}
                            >
                              <Send size={16} />
                            </button>
                          )}

                          {(inv.status === "Sent" || inv.status === "Overdue") && (
                            <button
                              onClick={() => handleOpenReminderModal(inv)}
                              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
                              title="Send email reminder"
                              aria-label={`Send reminder for invoice ${inv.invoiceNumber}`}
                            ><Mail size={16} /></button>
                          )}

                          {/* Audit Trail History */}
                          <button
                            onClick={() => handleOpenAuditModal(inv)}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
                            title="View invoice activity"
                            aria-label={`View audit trail for invoice ${inv.invoiceNumber}`}
                          >
                            <History size={16} />
                          </button>

                          {/* Archive/cancel */}
                          <button
                            onClick={() => handleDelete(inv.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500"
                            title="Cancel and archive invoice"
                            aria-label={`Cancel and archive invoice ${inv.invoiceNumber}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Reminder Modal */}
      {reminderModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Mail className="text-indigo-400" size={20} />
                <h3 className="font-bold text-white text-base">Send email reminder</h3>
              </div>
              <button 
                onClick={() => setReminderModalInvoice(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
              >
                <X size={18} />
              </button>
            </div>

            {reminderError && <p role="alert" className="mt-4 rounded-lg border border-rose-700 bg-rose-950/40 p-3 text-xs text-rose-200">{reminderError}</p>}
            {reminderSuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 size={40} className="text-emerald-400 mx-auto" />
                <p className="font-bold text-white">Email accepted by provider</p>
                <p className="text-xs text-slate-400">The email service accepted the reminder. This does not confirm inbox delivery.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <p className="text-xs text-slate-400">
                  Select the tone of the reminder notification for{" "}
                  <strong className="text-white">{reminderModalInvoice.clientName}</strong> ({reminderModalInvoice.invoiceNumber}):
                </p>

                <div className="space-y-2">
                  {[
                    { key: "friendly", label: "Friendly Touch-base", desc: "Gentle reminder regarding upcoming due date" },
                    { key: "formal", label: "Standard Corporate Notice", desc: "Standard accounting department follow-up" },
                    { key: "urgent", label: "Final Overdue Escalation", desc: "Notice of overdue status with immediate payment link" }
                  ].map((t) => (
                    <label 
                      key={t.key}
                      onClick={() => setReminderTone(t.key as any)}
                      className={`
                        flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors
                        ${reminderTone === t.key 
                          ? "bg-indigo-600/10 border-indigo-500/50 text-white" 
                          : "bg-slate-800/40 border-slate-800 text-slate-400 hover:border-slate-700"}
                      `}
                    >
                      <input 
                        type="radio" 
                        name="tone" 
                        checked={reminderTone === t.key} 
                        onChange={() => setReminderTone(t.key as any)}
                        className="mt-1 text-indigo-600"
                      />
                      <div>
                        <div className="text-xs font-semibold text-white">{t.label}</div>
                        <div className="text-[11px] text-slate-400">{t.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    onClick={() => setReminderModalInvoice(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTriggerReminder}
                    disabled={sendingReminder}
                    className="px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
                    style={{ background: "var(--brand-600)" }}
                  >
                    {sendingReminder ? "Sending…" : "Send email"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit Trail Modal */}
      {auditModalInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <History className="text-indigo-400" size={20} />
                <div>
                  <h3 className="font-bold text-white text-base">Invoice activity</h3>
                  <p className="text-[11px] text-slate-400">{auditModalInvoice.invoiceNumber} • {auditModalInvoice.clientName}</p>
                </div>
              </div>
              <button 
                onClick={() => setAuditModalInvoice(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 max-h-96 overflow-y-auto space-y-3 pr-2">
              {loadingAudit ? (
                <div className="py-8 text-center text-xs text-slate-500 animate-pulse">Loading invoice activity...</div>
              ) : auditLogs.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">No events logged yet for this invoice.</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-start gap-3">
                    <div className="mt-0.5 p-1 rounded-md bg-slate-800 text-indigo-400">
                      <Clock size={12} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-semibold uppercase text-slate-300">{log.action.replace("_", " ")}</span>
                        <span className="text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      {log.metadata && (
                        <p className="text-[11px] text-slate-400 mt-1">{log.metadata}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 mt-2 border-t border-slate-800 text-right">
              <button
                onClick={() => setAuditModalInvoice(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
