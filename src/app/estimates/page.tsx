"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { useTranslation } from "@/lib/useTranslation";
import { 
  Plus, 
  Search, 
  FileCheck, 
  ArrowRight, 
  Trash2, 
  ExternalLink,
  CheckCircle2,
  Clock,
  Sparkles
} from "lucide-react";
import { getEstimates, convertEstimateToInvoice, deleteEstimate } from "@/lib/actions/estimates";
import { EstimateDto } from "@/lib/types/dto";

export default function EstimatesListPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [estimates, setEstimates] = useState<EstimateDto[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [loading, setLoading] = useState(true);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const loadEstimates = async () => {
    try {
      setLoading(true);
      const data = await getEstimates(search, selectedStatus);
      setEstimates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEstimates();
  }, [search, selectedStatus]);

  const handleConvertToInvoice = async (est: EstimateDto) => {
    if (confirm(`Convert Quote #${est.estimateNumber} to an official invoice?`)) {
      setConvertingId(est.id);
      try {
        await convertEstimateToInvoice(est.id);
        router.push("/invoices");
      } catch (err) {
        console.error(err);
        alert(err instanceof Error ? err.message : "Failed to convert estimate.");
      } finally {
        setConvertingId(null);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this unconverted estimate? Converted financial records cannot be removed.")) {
      try {
        await deleteEstimate(id);
        loadEstimates();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Estimate could not be deleted.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar currentPath="/estimates" />

      <main className="flex-1 md:ml-64 p-6 md:p-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Estimates & Quotes</h1>
            <p className="text-sm text-slate-400">Create client proposals and convert them directly into live invoices</p>
          </div>
          <Link
            href="/estimates/new"
            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02]"
          >
            <Plus size={18} />
            <span>Create New Estimate</span>
          </Link>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="my-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3.5 top-3 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search quotes by number, client or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            {["All", "Draft", "Sent", "Invoiced"].map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`
                  px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors shrink-0
                  ${selectedStatus === status 
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" 
                    : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"}
                `}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Estimates Table */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-5">Estimate ID</th>
                  <th className="py-3.5 px-5">Client</th>
                  <th className="py-3.5 px-5">Issue Date</th>
                  <th className="py-3.5 px-5">Valid Until</th>
                  <th className="py-3.5 px-5">Total Amount</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  Array.from({length:5}).map((_,i)=>(<tr key={i}><td colSpan={7} className="py-6"><div className="h-4 bg-slate-800 rounded animate-pulse"/></td></tr>))
                ) : estimates.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <FileCheck size={28}/>
                      </div>
                      <h3 className="text-base font-bold text-white mb-1">No estimates yet</h3>
                      <p className="text-xs text-slate-400 mb-4">Create a proposal to win more clients.</p>
                      <Link href="/estimates/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold">New Estimate</Link>
                    </td>
                  </tr>
                ) : (
                  estimates.map((est) => (
                    <tr key={est.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 px-5 font-mono font-medium text-indigo-300">
                        {est.estimateNumber}
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-semibold text-white">{est.clientName}</div>
                        <div className="text-xs text-slate-400">{est.clientEmail}</div>
                      </td>
                      <td className="py-4 px-5 text-slate-400">{est.issueDate}</td>
                      <td className="py-4 px-5 text-slate-400">{est.validUntil}</td>
                      <td className="py-4 px-5 font-bold text-white">
                        {est.currency} {est.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-4 px-5">
                        <span className={`
                          px-2.5 py-1 text-xs font-semibold rounded-full border inline-flex items-center gap-1.5
                          ${est.status === "Accepted" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : ""}
                          ${est.status === "Invoiced" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30" : ""}
                          ${est.status === "Sent" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : ""}
                          ${est.status === "Declined" ? "bg-rose-500/10 text-rose-400 border-rose-500/30" : ""}
                          ${est.status === "Draft" ? "bg-slate-700/30 text-slate-400 border-slate-700/50" : ""}
                        `}>
                          {est.status}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {est.status !== "Invoiced" ? (
                            <button
                              onClick={() => handleConvertToInvoice(est)}
                              disabled={convertingId === est.id}
                              className="flex items-center gap-1.5 py-1.5 px-3 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold transition-colors"
                              title="Convert directly to an official invoice"
                            >
                              <ArrowRight size={13} />
                              <span>{convertingId === est.id ? "Converting..." : "Convert to Invoice"}</span>
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 px-2">
                              <CheckCircle2 size={13} /> Invoiced
                            </span>
                          )}
                          <button
                            onClick={() => handleDelete(est.id)}
                            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-red-400 transition-colors"
                            title="Delete Estimate"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
