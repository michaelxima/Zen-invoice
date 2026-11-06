"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useTranslation } from "@/lib/useTranslation";
import { 
  Users, 
  Plus, 
  Search, 
  Mail, 
  Phone, 
  MapPin, 
  Building, 
  Trash2, 
  Edit3,
  X,
  Check
} from "lucide-react";
import { getClients, createClient, updateClient, deleteClient } from "@/lib/actions/clients";
import { ClientDto } from "@/lib/types/dto";

const CLIENT_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "NOK", "SEK", "DKK"] as const;
type ClientCurrency = typeof CLIENT_CURRENCIES[number];
const normalizeClientCurrency = (value: string): ClientCurrency => CLIENT_CURRENCIES.includes(value as ClientCurrency) ? value as ClientCurrency : "USD";

export default function ClientsPage() {
  const { t } = useTranslation();
  const [clients, setClients] = useState<ClientDto[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientDto | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    currency: "USD" as ClientCurrency,
    notes: ""
  });

  const loadClients = async () => {
    try {
      setLoading(true);
      const data = await getClients(searchQuery);
      setClients(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, [searchQuery]);

  const handleOpenAddModal = () => {
    setEditingClient(null);
    setFormData({ name: "", email: "", phone: "", address: "", currency: "USD", notes: "" });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (client: ClientDto) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email,
      phone: client.phone || "",
      address: client.address || "",
      currency: normalizeClientCurrency(client.currency || "USD"),
      notes: client.notes || ""
    });
    setIsModalOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    try {
      if (editingClient) {
        await updateClient(editingClient.id, formData);
      } else {
        await createClient(formData);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Client could not be saved.");
      return;
    }
    setIsModalOpen(false);
    loadClients();
  };

  const handleDeleteClient = async (id: string) => {
    if (confirm("Are you sure you want to delete this client?")) {
      try {
        await deleteClient(id);
        loadClients();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Client could not be deleted.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar currentPath="/clients" />

      <main className="flex-1 md:ml-64 p-6 md:p-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Client Management</h1>
            <p className="text-sm text-slate-400">Manage your business clients and billing details</p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all hover:scale-[1.02]"
          >
            <Plus size={18} />
            <span>Add New Client</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="my-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-3 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search clients by name, email or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Clients Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array.from({length:6}).map((_,i)=>(<div key={i} className="animate-pulse bg-slate-900/60 border border-slate-800 rounded-2xl p-6 h-48"/>))
          ) : clients.length === 0 ? (
            <div className="col-span-3 py-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Users size={28}/>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{t('noClients')}</h3>
              <p className="text-sm text-slate-400 mb-6">{t('noClientsDesc')}</p>
              <button onClick={()=>setIsModalOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold">Add New Client</button>
            </div>
          ) : (
            clients.map((client) => (
              <div key={client.id} className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition-colors">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-lg">
                        {client.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base leading-snug">{client.name}</h3>
                        <span className="inline-block text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 mt-0.5">
                          {client.currency}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleOpenEditModal(client)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Edit client"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteClient(client.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                        title="Delete client"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-400 my-4">
                    <div className="flex items-center gap-2">
                      <Mail size={14} className="text-slate-500 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                    {client.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-slate-500 shrink-0" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                    {client.address && (
                      <div className="flex items-start gap-2">
                        <MapPin size={14} className="text-slate-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{client.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                  <span>{client.invoiceCount || 0} invoices created</span>
                  <span className="text-indigo-400 font-medium">
                    {client.currency} {(client.totalBilled || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} billed
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal for Add / Edit Client */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
                <h3 className="text-lg font-bold text-white">
                  {editingClient ? "Edit Client Details" : "Add New Client"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveClient} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Client Name *</label>
                  <input
                    type="text"
                    required
                    placeholder=""
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="billing@acme.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Currency</label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value as ClientCurrency })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-indigo-500"
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
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Phone</label>
                  <input
                    type="text"
                    placeholder="+1 (555) 000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Billing Address</label>
                  <textarea
                    rows={2}
                    placeholder="100 Main St, Suite 400..."
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2"
                  >
                    <Check size={16} />
                    <span>Save Client</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
