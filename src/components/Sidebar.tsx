"use client";

import React, { useState } from "react";
import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import { useTranslation } from "@/lib/useTranslation";
import { 
  FileText, 
  Users, 
  LayoutDashboard, 
  Calculator,
  Settings, 
  PlusCircle, 
  Sparkles, 
  LogOut,
  Building2,
  Menu,
  X,
  FileCheck
} from "lucide-react";

interface SidebarProps {
  currentPath?: string;
}

export function Sidebar({ currentPath = "/dashboard" }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [whiteBg, setWhiteBg] = useState(false);
  const { t } = useTranslation();

  React.useEffect(() => {
    const saved = localStorage.getItem('zen-invoice-white') === '1';
    setWhiteBg(saved);
  }, []);

  React.useEffect(() => {
    if (whiteBg) {
      document.documentElement.classList.add('white-bg');
      localStorage.setItem('zen-invoice-white','1');
    } else {
      document.documentElement.classList.remove('white-bg');
      localStorage.setItem('zen-invoice-white','0');
    }
  }, [whiteBg]);

  const navItems = [
    { name: t("sidebarDashboard"), href: "/dashboard", icon: LayoutDashboard },
    { name: t("sidebarInvoices"), href: "/invoices", icon: FileText },
    { name: t("sidebarEstimates"), href: "/estimates", icon: FileCheck },
    { name: t("sidebarClients"), href: "/clients", icon: Users },
    { name: t("sidebarAIAssistant"), href: "/ai-create", icon: Sparkles, badge: "AI" },
    { name: t("sidebarRecurring"), href: "/recurring", icon: Calculator },
  ];

  return (
    <>
      {/* Mobile Menu Button */}
      <button 
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-900 text-white border border-slate-700 shadow-md"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar Overlay for Mobile */}
      {mobileOpen && (
        <div 
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-xs"
        />
      )}

      <aside className={`
        fixed top-0 left-0 bottom-0 z-40 w-64 bg-slate-950 text-slate-200 border-r border-slate-800 flex flex-col justify-between transition-transform duration-200 ease-in-out
        ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div>
          {/* Brand Header */}
          <Link href="/" className="h-16 flex items-center px-6 border-b border-slate-800 gap-3 hover:bg-slate-800/50 transition-colors">
            <img src="/zen-invoice-logo.png" alt="Zen-Invoice" className="h-8 w-auto" />
            <div>
              <span className="font-bold text-lg text-white tracking-tight">Zen-Invoice</span>
              <span className="block text-[10px] font-mono font-medium tracking-wider uppercase" style={{color: 'var(--brand-500)'}}>Pro Edition</span>
            </div>
          </Link>

          <div className="px-4 py-3 border-b border-slate-800">
            <button onClick={() => setWhiteBg(!whiteBg)} className="w-full text-xs font-medium px-3 py-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition">
              {whiteBg ? t("sidebarSwitchToDark") : t("sidebarSwitchToWhite")}
            </button>
          </div>

          <LanguageSwitcher />

          {/* Quick Action Button */}
          <div className="p-4">
            <Link 
              href="/invoices/new"
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 text-white font-medium text-sm rounded-xl shadow-lg transition-all hover:scale-[1.02]"
              style={{backgroundColor:'var(--brand-600)'}}
            >
              <PlusCircle size={18} />
              <span>{t("sidebarCreateInvoice")}</span>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 py-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                    ${isActive 
                      ? "bg-slate-800 text-white font-semibold shadow-inner" 
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={isActive ? "" : "text-slate-400"} style={isActive ? {color:'var(--brand-500)'} : undefined} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border" style={{backgroundColor:'color-mix(in srgb, var(--brand-500) 20%, transparent)', color:'var(--brand-300)', borderColor:'color-mix(in srgb, var(--brand-500) 30%, transparent)'}}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Business Context & User Profile */}
        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800/80">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-md bg-slate-800 flex items-center justify-center text-slate-400">
                <Building2 size={16} />
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">{/* TODO: session.business.name */}Your Business</p>
                <p className="text-[10px] text-slate-400 truncate">{/* TODO: session.business.currency */}USD ($)</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs" style={{backgroundColor:'color-mix(in srgb, var(--brand-500) 20%, transparent)', border:'1px solid color-mix(in srgb, var(--brand-500) 40%, transparent)', color:'var(--brand-300)'}}>
                {/* TODO: session.user.initials */}U
              </div>
              <span className="text-xs font-medium text-slate-300">{/* TODO: session.user.email */}user@example.com</span>
            </div>
            <Link href="/login" className="text-slate-400 hover:text-red-400 transition-colors p-1" title="Sign out">
              <LogOut size={16} />
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
