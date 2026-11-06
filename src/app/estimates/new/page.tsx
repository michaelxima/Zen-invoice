"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { PDFViewer, PDFDownloadLink } from "@react-pdf/renderer";
import { InvoicePdfDocument } from "@/components/pdf/InvoicePdfDocument";
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Download, 
  Save, 
  Eye, 
  FileCheck,
  Users
} from "lucide-react";
import { getClients, createClient } from "@/lib/actions/clients";
import { createEstimate } from "@/lib/actions/estimates";
import { getBusinessSettings } from "@/lib/actions/settings";
import { calculateInvoiceTotals } from "@/lib/calculator";
import { ClientDto } from "@/lib/types/dto";

const ESTIMATE_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "NOK", "SEK", "DKK"] as const;
type EstimateCurrency = typeof ESTIMATE_CURRENCIES[number];
const isEstimateCurrency = (value: string): value is EstimateCurrency => ESTIMATE_CURRENCIES.includes(value as EstimateCurrency);

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export default function NewEstimatePage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [availableClients, setAvailableClients] = useState<ClientDto[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIsClient(true);
    async function load() {
      const [clients, settings] = await Promise.all([getClients(), getBusinessSettings()]);
      setAvailableClients(clients);
      setBusinessName((current) => current || settings.name);
      setBusinessEmail((current) => current || settings.email);
      setBusinessAddress((current) => current || settings.address);
      if (isEstimateCurrency(settings.currency)) setCurrency(settings.currency);
    }
    load();
  }, []);

  const [estimateNumber, setEstimateNumber] = useState(`EST-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  
  const defaultValidDate = new Date();
  defaultValidDate.setDate(defaultValidDate.getDate() + 30);
  const [validUntil, setValidUntil] = useState(defaultValidDate.toISOString().split("T")[0]);

  const [currency, setCurrency] = useState<EstimateCurrency>("USD");
  const status = "Draft" as const;

  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");

  const [items, setItems] = useState<LineItem[]>([
    { id: "1", description: "", quantity: 1, unitPrice: 0 },
  ]);

  const [taxRate, setTaxRate] = useState(10);
  const [discountRate, setDiscountRate] = useState(0);
  const [notes, setNotes] = useState("");

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    const found = availableClients.find((c) => c.id === clientId);
    if (found) {
      setClientName(found.name);
      setClientEmail(found.email);
      setClientAddress(found.address || "");
      if (found.currency && isEstimateCurrency(found.currency)) setCurrency(found.currency);
    }
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      { id: Date.now().toString(), description: "New Scope Item", quantity: 1, unitPrice: 100 }
    ]);
  };

  const handleUpdateItem = (id: string, field: keyof LineItem, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleRemoveItem = (id: string) => {
    if (items.length === 1) return;
    setItems(items.filter(item => item.id !== id));
  };

  const getSymbol = (curr: string) => {
    switch (curr) {
      case "EUR": return "€";
      case "GBP": return "£";
      case "JPY": return "¥";
      case "NOK":
      case "SEK":
      case "DKK": return "kr";
      default: return "$";
    }
  };

  const symbol = getSymbol(currency);

  const totals = calculateInvoiceTotals(items, Number(taxRate), Number(discountRate), currency);
  const { subtotal, discountAmount, taxAmount, total } = totals;

  const pdfProps = {
    invoiceNumber: estimateNumber,
    issueDate,
    dueDate: validUntil,
    currency,
    businessName,
    businessEmail,
    businessAddress,
    clientName,
    clientEmail,
    clientAddress,
    items,
    taxRate: Number(taxRate),
    discountRate: Number(discountRate),
    notes
  };

  const handleSaveEstimate = async () => {
    if (!clientName || !clientEmail) {
      alert("Please provide client name and email.");
      return;
    }

    setSaving(true);
    try {
      let clientId = selectedClientId;
      if (!clientId) {
        const client = await createClient({ name: clientName, email: clientEmail, address: clientAddress, currency });
        clientId = client.id;
      }
      await createEstimate({
        estimateNumber,
        clientId,
        clientName,
        clientEmail,
        clientAddress,
        businessName,
        businessEmail,
        businessAddress,
        issueDate,
        validUntil,
        currency,
        status,
        items,
        taxRate: Number(taxRate),
        discountRate: Number(discountRate),
        notes,
      });

      router.push("/estimates");
    } catch (err) {
      console.error("Failed to save estimate:", err);
      alert(err instanceof Error ? err.message : "Failed to save estimate.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar currentPath="/estimates" />

      <main className="flex-1 md:ml-64 p-4 md:p-8 flex flex-col h-screen overflow-hidden">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <Link 
              href="/estimates"
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>Create Quote / Proposal</span>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {estimateNumber}
                </span>
              </h1>
              <p className="text-xs text-slate-400">Generate structured client estimates and proposals</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleSaveEstimate}
              disabled={saving}
              className="flex items-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02]"
            >
              <Save size={15} />
                  <span>{saving ? "Saving Quote..." : "Save Draft Quote"}</span>
            </button>
          </div>
        </div>

        {/* Split Screen Container */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4 overflow-hidden">
          
          {/* Left Panel: Estimate Form */}
          <div className="lg:col-span-6 xl:col-span-7 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 overflow-y-auto space-y-6">
            
            {/* Metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Quote #</label>
                <input 
                  type="text"
                  value={estimateNumber}
                  onChange={(e) => setEstimateNumber(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as EstimateCurrency)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-indigo-500"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="NOK">NOK (kr)</option>
                  <option value="SEK">SEK (kr)</option>
                  <option value="DKK">DKK (kr)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Issue Date</label>
                <input 
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Valid Until</label>
                <input 
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Client Selector Quick-Fill */}
            {availableClients.length > 0 && (
              <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-indigo-300 font-medium">
                  <Users size={15} />
                  <span>Choose Existing Client:</span>
                </div>
                <select
                  value={selectedClientId}
                  onChange={(e) => handleSelectClient(e.target.value)}
                  className="bg-slate-900 border border-indigo-500/30 rounded-lg px-3 py-1 text-xs text-white focus:outline-hidden"
                >
                  <option value="">-- Or enter custom client --</option>
                  {availableClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Client & Business Info Split */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">Recipient (Client)</span>
                <input 
                  type="text" 
                  placeholder="Client Name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-medium"
                />
                <input 
                  type="email" 
                  placeholder="Client Email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300"
                />
                <input 
                  type="text" 
                  placeholder="Client Address"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Issuer (Your Business)</span>
                <input 
                  type="text" 
                  placeholder="Business Name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white font-medium"
                />
                <input 
                  type="email" 
                  placeholder="Business Email"
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300"
                />
                <input 
                  type="text" 
                  placeholder="Business Address"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300"
                />
              </div>
            </div>

            {/* Scope Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Proposed Line Items</h3>
                <button 
                  onClick={handleAddItem}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  <Plus size={14} /> Add Scope Item
                </button>
              </div>

              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <input 
                      type="text"
                      placeholder="Item description"
                      value={item.description}
                      onChange={(e) => handleUpdateItem(item.id, "description", e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                    />
                    <input 
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => handleUpdateItem(item.id, "quantity", Number(e.target.value))}
                      className="w-16 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-center text-white"
                    />
                    <div className="relative w-24">
                      <span className="absolute left-2.5 top-1.5 text-xs text-slate-500">{symbol}</span>
                      <input 
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Price"
                        value={item.unitPrice}
                        onChange={(e) => handleUpdateItem(item.id, "unitPrice", Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-6 pr-2 py-1.5 text-xs text-white"
                      />
                    </div>
                    <span className="w-20 text-right text-xs font-mono font-bold text-white">
                      {symbol}{(item.quantity * item.unitPrice).toFixed(currency === "JPY" ? 0 : 2)}
                    </span>
                    <button 
                      onClick={() => handleRemoveItem(item.id)}
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Calculations & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Proposal Terms</label>
                <textarea 
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 focus:border-indigo-500"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-mono font-semibold text-white">{symbol}{subtotal.toFixed(currency === "JPY" ? 0 : 2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Tax (%):</span>
                  <input 
                    type="number"
                    min="0"
                    max="100"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-xs text-right text-white"
                  />
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm text-white">
                  <span>Estimated Total:</span>
                  <span className="text-indigo-400 font-mono">{symbol}{total.toFixed(currency === "JPY" ? 0 : 2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Live PDF Canvas Preview */}
          <div className="lg:col-span-6 xl:col-span-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3 shrink-0">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Eye size={15} className="text-indigo-400" /> Real-Time Proposal Canvas
              </span>
              <span className="text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md font-mono">
                Quote Preview
              </span>
            </div>

            <div className="flex-1 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
              {isClient ? (
                <PDFViewer width="100%" height="100%" className="border-0 rounded-xl">
                  <InvoicePdfDocument {...pdfProps} />
                </PDFViewer>
              ) : (
                <div className="text-xs text-slate-500 animate-pulse">Initializing Quote Preview...</div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
