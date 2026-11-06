"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Sidebar } from "@/components/Sidebar";
import { getBusinessSettings, updateBusinessSettings } from "@/lib/actions/settings";
import { signOutEverywhere } from "@/lib/actions/sessions";

type Settings = {
  name: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  currency: string;
  stripeConnected: boolean;
  stripeConnectAvailable: boolean;
};

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [signingOutEverywhere, setSigningOutEverywhere] = useState(false);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    // Ignore a load that finishes after this effect was cleaned up. In development React runs effects twice,
    // and without this guard the second, late response overwrote whatever the user had already typed.
    let cancelled = false;
    getBusinessSettings()
      .then((loaded) => {
        if (!cancelled) setSettings(loaded);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load business settings.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const query = new URLSearchParams(window.location.search);
    const stripeResult = query.get("stripe");
    if (stripeResult === "connected") setMessage("Stripe account connected.");
    else if (stripeResult === "cancelled") setMessage("Stripe connection was cancelled.");
    else if (stripeResult) setError("Stripe connection could not be completed. Check the Connect configuration and try again.");
    return () => {
      cancelled = true;
    };
  }, []);

  const updateField = (field: keyof Settings, value: string) => {
    setSettings((current) => current ? { ...current, [field]: value } : current);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateBusinessSettings({
        name: settings.name,
        email: settings.email,
        phone: settings.phone,
        address: settings.address,
        taxId: settings.taxId,
        currency: settings.currency,
      });
      setMessage("Business settings saved.");
    } catch {
      setError("Business settings could not be saved. Check the fields and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOutEverywhere = async () => {
    if (signingOutEverywhere) return;
    setSigningOutEverywhere(true);
    setSessionError("");
    try {
      const result = await signOutEverywhere();
      if (!result.ok) {
        setSessionError(result.error);
        setSigningOutEverywhere(false);
        return;
      }
      // This browser's session is already revoked; clear its cookie too, then leave and drop cached pages.
      await signOut({ redirect: false }).catch(() => undefined);
      router.replace("/login");
      router.refresh();
    } catch {
      setSessionError("Signing out of all devices failed. Your sessions were not changed. Try again.");
      setSigningOutEverywhere(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar currentPath="/settings" />
      <main className="flex-1 md:ml-64 p-6 md:p-10 max-w-4xl">
        <h1 className="text-2xl font-bold mb-2">Business Settings</h1>
        <p className="text-sm text-slate-400 mb-6">Update the business details used on your invoices.</p>
        {message && <p role="status" className="mb-4 rounded-lg border border-emerald-700 bg-emerald-950/40 p-3 text-sm text-emerald-200">{message}</p>}
        {error && <p role="alert" className="mb-4 rounded-lg border border-rose-700 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}

        {loading ? <p className="text-sm text-slate-400">Loading business settings…</p> : settings && (
          <div className="space-y-6">
            <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="font-semibold">Business profile</h2>
              <label className="block text-sm">Business name
                <input required maxLength={160} value={settings.name} onChange={(event) => updateField("name", event.target.value)} className="mt-1 w-full bg-slate-800 rounded-lg px-3 py-2" />
              </label>
              <label className="block text-sm">Billing email
                <input required type="email" maxLength={254} value={settings.email} onChange={(event) => updateField("email", event.target.value)} className="mt-1 w-full bg-slate-800 rounded-lg px-3 py-2" />
              </label>
              <label className="block text-sm">Phone
                <input maxLength={40} value={settings.phone} onChange={(event) => updateField("phone", event.target.value)} className="mt-1 w-full bg-slate-800 rounded-lg px-3 py-2" />
              </label>
              <label className="block text-sm">Business address
                <textarea maxLength={500} value={settings.address} onChange={(event) => updateField("address", event.target.value)} className="mt-1 w-full bg-slate-800 rounded-lg px-3 py-2" />
              </label>
              <label className="block text-sm">Tax ID / VAT number
                <input maxLength={80} value={settings.taxId} onChange={(event) => updateField("taxId", event.target.value)} className="mt-1 w-full bg-slate-800 rounded-lg px-3 py-2" />
              </label>
              <label className="block text-sm">Default currency
                <select value={settings.currency} onChange={(event) => updateField("currency", event.target.value)} className="mt-1 w-full bg-slate-800 rounded-lg px-3 py-2">
                  {["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "NOK", "SEK", "DKK"].map((currency) => <option key={currency}>{currency}</option>)}
                </select>
              </label>
              <button disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-sm font-semibold disabled:opacity-50">{saving ? "Saving…" : "Save business settings"}</button>
            </form>

            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
              <h2 className="font-semibold">Invoice payments</h2>
              <p className="text-sm text-slate-400">Connect the Stripe account that should receive card payments for your invoices. Invoice Claw will not mark an invoice paid until Stripe confirms payment through a signed webhook.</p>
              <p className="text-sm">Status: <strong>{settings.stripeConnected ? "Connected" : "Not connected"}</strong></p>
              {settings.stripeConnectAvailable ? (
                <a href="/api/stripe/connect" className="inline-block px-4 py-2 rounded-lg bg-indigo-600 text-sm font-semibold">{settings.stripeConnected ? "Reconnect Stripe" : "Connect Stripe"}</a>
              ) : (
                <p className="text-xs text-amber-300">Stripe Connect is not configured for this deployment. The platform owner must configure its Connect client ID, secret key, and webhook secret first.</p>
              )}
            </section>

            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3" aria-labelledby="sessions-heading">
              <h2 id="sessions-heading" className="font-semibold">Signed-in devices</h2>
              <p className="text-sm text-slate-400">
                If you signed in on a shared computer or think someone else has access, sign out everywhere. Every browser signed in to this account, including this one, will need to sign in again.
              </p>
              {sessionError && <p role="alert" className="rounded-lg border border-rose-700 bg-rose-950/40 p-3 text-sm text-rose-200">{sessionError}</p>}
              <button
                type="button"
                onClick={handleSignOutEverywhere}
                disabled={signingOutEverywhere}
                className="px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-sm font-semibold disabled:opacity-50"
              >
                {signingOutEverywhere ? "Signing out…" : "Sign out of all devices"}
              </button>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
