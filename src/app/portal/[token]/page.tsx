"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { InvoicePdfDocument } from "@/components/pdf/InvoicePdfDocument";
import { 
  Download, 
  CreditCard,
  CheckCircle2,
  Clock, 
  AlertCircle, 
  Calendar,
  MessageSquare,
  Send,
  Check,
  X,
  Eye
} from "lucide-react";
import { 
  getInvoiceByToken, 
  logInvoiceDownload, 
  addInvoiceComment,
  updateInvoicePO,
} from "@/lib/actions/invoices";
import { InvoiceDto } from "@/lib/types/dto";
import { useTranslation } from "@/lib/useTranslation";

export default function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params);
  const { t } = useTranslation();
  const [invoice, setInvoice] = useState<InvoiceDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  
  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // PO Number State
  const [poNumber, setPoNumber] = useState("");
  const [poSaved, setPoSaved] = useState(false);

  // In-Invoice Comments State
  const [commentText, setCommentText] = useState("");
  const [commentSenderName, setCommentSenderName] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const loadData = async () => {
    try {
      const data = await getInvoiceByToken(resolvedParams.token);
      if (data) {
        setInvoice(data);
        if (data.purchaseOrderNumber) setPoNumber(data.purchaseOrderNumber);
        if (!commentSenderName) setCommentSenderName(data.clientName);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsClient(true);
    loadData();
  }, [resolvedParams.token]);

  const handleDownloadClick = async () => {
    await logInvoiceDownload(resolvedParams.token);
    loadData();
  };

  const handleSavePO = async () => {
    if (!poNumber.trim()) return;
    await updateInvoicePO(resolvedParams.token, poNumber);
    setPoSaved(true);
    setTimeout(() => setPoSaved(false), 2500);
    loadData();
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    try {
      await addInvoiceComment(
        resolvedParams.token,
        "client",
        commentSenderName || invoice?.clientName || "Client",
        commentText
      );
      setCommentText("");
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleExecutePayment = async () => {
    if (!invoice) return;
    setProcessingPayment(true);
    setPaymentError(null);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resolvedParams.token }),
      });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Unable to start card checkout");
      window.location.assign(result.url);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Unable to start card checkout");
    } finally {
      setProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-3 animate-pulse">
          <img src="/zen-invoice-logo.png" alt="Zen-Invoice" className="w-12 h-12 mx-auto rounded-xl object-contain bg-slate-900" />
          <p className="text-sm text-slate-400">Verifying cryptographic digital delivery token...</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
          <AlertCircle size={40} className="text-rose-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Invoice Not Found</h2>
          <p className="text-sm text-slate-400">
            This invoice link may have expired or is invalid. Please contact the issuing business.
          </p>
        </div>
      </div>
    );
  }

  const pdfProps = {
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    businessName: invoice.businessName,
    businessEmail: invoice.businessEmail,
    businessAddress: invoice.businessAddress || "",
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    clientAddress: invoice.clientAddress || "",
    items: invoice.items,
    taxRate: invoice.taxRate,
    discountRate: invoice.discountRate,
    notes: invoice.notes,
  };

  const getSymbol = (curr: string) => {
    switch (curr) {
      case "EUR": return "€";
      case "GBP": return "£";
      case "JPY": return "¥";
      default: return "$";
    }
  };

  const symbol = getSymbol(invoice.currency);

  const timeline = [
    { label: "Created", date: invoice.createdAt, active: true },
    { label: "Opened", date: invoice.viewedAt, active: !!invoice.viewedAt },
    { label: "Paid", date: invoice.paidAt, active: invoice.status === "Paid" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Top Verified Header Bar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/zen-invoice-logo.png" alt="Zen-Invoice" className="w-11 h-11 rounded-xl object-contain bg-slate-900" />

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">{invoice.businessName}</h1>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-300 bg-slate-800 border border-slate-700 px-2.5 py-0.5 rounded-full">
                  Invoice portal
                </span>
              </div>
              <p className="text-xs text-slate-400">{invoice.businessEmail}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isClient && (
              <div onClick={handleDownloadClick}>
                <PDFDownloadLink
                  document={<InvoicePdfDocument {...pdfProps} />}
                  fileName={`${invoice.invoiceNumber}.pdf`}
                  className="flex items-center gap-2 py-2.5 px-4 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl text-xs font-semibold transition-colors"
                >
                  {/* @ts-ignore */}
                  {({ loading: pdfLoading }) => (
                    <>
                      <Download size={14} />
                      <span>{pdfLoading ? "Preparing..." : t('portalDownloadPDF')}</span>
                    </>
                  )}
                </PDFDownloadLink>
              </div>
            )}

            {(invoice.status === "Sent" || invoice.status === "Overdue") && (
              <button
                onClick={() => setIsPaymentModalOpen(true)}
                className="flex items-center gap-2 py-2.5 px-5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02]"
              >
                <CreditCard size={15} />
                <span>Pay by card</span>
              </button>
            )}
          </div>
        </div>

        {/* Invoice timeline */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              Invoice timeline
            </span>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">
              Payment status is confirmed by Stripe
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
            {timeline.map((step) => (
              <div 
                key={step.label}
                className={`p-2.5 rounded-xl border transition-colors ${
                  step.active 
                    ? "bg-indigo-950/30 border-indigo-500/40 text-indigo-200" 
                    : "bg-slate-950/40 border-slate-800/80 text-slate-500"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {step.active ? (
                    <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                  ) : (
                    <Clock size={13} className="text-slate-600 shrink-0" />
                  )}
                  <span className="text-xs font-semibold truncate">{step.label}</span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono truncate">
                  {step.date ? new Date(step.date).toLocaleDateString() : "Pending"}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Invoice Main Interactive Canvas */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-8">
          
          {/* Header & Meta */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-slate-800">
            <div>
                <span className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest block mb-1">
                Invoice
              </span>
              <h2 className="text-3xl font-extrabold text-white tracking-tight">{invoice.invoiceNumber}</h2>
              <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-500" />
                  <span>Issued: <strong>{invoice.issueDate}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={14} className="text-slate-500" />
                  <span>Due: <strong>{invoice.dueDate}</strong></span>
                </div>
                {invoice.viewedAt && (
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <Eye size={14} />
                    <span>Read {new Date(invoice.viewedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="sm:text-right">
              <span className={`
                inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full border
                ${invoice.status === "Paid" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : ""}
                ${invoice.status === "Sent" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : ""}
                ${invoice.status === "Overdue" ? "bg-rose-500/10 text-rose-400 border-rose-500/30" : ""}
                ${invoice.status === "Draft" ? "bg-slate-700/30 text-slate-400 border-slate-700/50" : ""}
              `}>
                {invoice.status === "Paid" && <CheckCircle2 size={13} />}
                <span>Status: {invoice.status}</span>
              </span>
              <div className="text-2xl font-black text-white mt-2 tracking-tight">
                {symbol}{invoice.totalAmount.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Billing Info Grid & PO Number Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
            <div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">Billed To</span>
              <p className="font-bold text-white text-sm">{invoice.clientName}</p>
              <p className="text-slate-400 mt-0.5">{invoice.clientEmail}</p>
              {invoice.clientAddress && <p className="text-slate-400 mt-0.5">{invoice.clientAddress}</p>}
              
              {/* Procurement PO Input Field */}
              <div className="mt-4 pt-3 border-t border-slate-800">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">
                  Your Internal Purchase Order (PO #)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. PO-2026-9810"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-hidden focus:border-indigo-500 font-mono"
                  />
                  <button
                    onClick={handleSavePO}
                    className="py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-colors"
                  >
                    {poSaved ? "Saved ✓" : "Save PO"}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payable To</span>
              <p className="font-bold text-white text-sm">{invoice.businessName}</p>
              <p className="text-slate-400 mt-0.5">{invoice.businessEmail}</p>
              {invoice.businessAddress && <p className="text-slate-400 mt-0.5">{invoice.businessAddress}</p>}

              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                Card availability depends on the issuer&apos;s connected payment account.
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 rounded-l-xl">Description</th>
                  <th className="py-3 px-4 text-center">Qty</th>
                  <th className="py-3 px-4 text-right">Price</th>
                  <th className="py-3 px-4 text-right rounded-r-xl">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {invoice.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-3.5 px-4 font-medium text-white">{item.description}</td>
                    <td className="py-3.5 px-4 text-center text-slate-400">{item.quantity}</td>
                    <td className="py-3.5 px-4 text-right text-slate-400">{symbol}{Number(item.unitPrice).toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                      {symbol}{(Number(item.quantity) * Number(item.unitPrice)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Calculation Summary */}
          <div className="flex justify-end pt-4 border-t border-slate-800">
            <div className="w-full max-w-xs space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold text-white">{symbol}{invoice.subtotal.toFixed(2)}</span>
              </div>
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Discount ({invoice.discountRate}%):</span>
                  <span className="text-red-400 font-mono">-{symbol}{invoice.discountAmount.toFixed(2)}</span>
                </div>
              )}
              {invoice.taxAmount > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Tax ({invoice.taxRate}%):</span>
                  <span className="font-mono text-slate-300">+{symbol}{invoice.taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm text-white">
                <span>Total Amount Due:</span>
                <span className="text-indigo-400 font-mono text-base">{symbol}{invoice.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          {invoice.notes && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Notes & Terms</span>
              <p className="text-slate-300 leading-relaxed">{invoice.notes}</p>
            </div>
          )}

          {/* In-Document Clarification & Queries Feed */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <MessageSquare size={14} className="text-indigo-400" />
                In-Invoice Clarification & Procurement Thread ({invoice.comments.length})
              </h3>
              <span className="text-[10px] text-slate-500">Audited conversation linked to invoice</span>
            </div>

            {invoice.comments.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">
                No questions or notes attached yet. Have a question about this invoice? Send a message directly below.
              </p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {invoice.comments.map((c) => (
                  <div 
                    key={c.id} 
                    className={`p-3 rounded-xl text-xs space-y-1 ${
                      c.sender === "client" 
                        ? "bg-slate-900 border border-slate-800" 
                        : "bg-indigo-950/30 border border-indigo-500/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{c.senderName}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-300">{c.text}</p>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handlePostComment} className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="Type a message or line-item question for the issuer..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={submittingComment || !commentText.trim()}
                className="py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Send size={13} />
                <span>Send</span>
              </button>
            </form>
          </div>

        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-600">
          Powered by <strong className="text-slate-400">Invoice Claw</strong> — invoice sharing and Stripe card payments.
        </div>
      </div>

      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"><CreditCard size={18} /></div>
                <div>
                  <h3 className="text-base font-bold text-white">Pay invoice</h3>
                  <p className="text-xs text-slate-400">Invoice #{invoice.invoiceNumber}</p>
                </div>
              </div>
              <button onClick={() => { setIsPaymentModalOpen(false); setPaymentError(null); }} aria-label="Close payment dialog" className="text-slate-400 hover:text-white"><X size={20} /></button>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs text-slate-400">Amount due</p>
              <p className="mt-1 text-2xl font-bold text-white">{invoice.currency} {invoice.totalAmount.toFixed(2)}</p>
              <p className="mt-2 text-xs text-slate-400">Card payment is securely processed by Stripe. Your invoice will update after Stripe confirms payment.</p>
            </div>
            {paymentError && <p role="alert" className="text-sm text-rose-300">{paymentError}</p>}
            <button onClick={handleExecutePayment} disabled={processingPayment} className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl flex items-center justify-center gap-2">
              <CreditCard size={16} />
              {processingPayment ? "Starting secure checkout…" : "Continue to Stripe Checkout"}
            </button>
          </div>
        </div>
      )}

      {(invoice.status === "Sent" || invoice.status === "Overdue") && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur border-t border-slate-800 p-3 flex items-center justify-between gap-3 z-50">
          <div className="text-xs text-slate-400">{t('portalAmountDue')} {symbol}{invoice.totalAmount}</div>
          <button onClick={()=>setIsPaymentModalOpen(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl">{t('portalPayNow')}</button>
        </div>
      )}
    </div>
  );
}
