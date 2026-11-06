import type { Metadata } from "next";
import "./globals.css";
import Shortcuts from "./shortcuts";

export const metadata: Metadata = {
  title: {
    default: "Zen-Invoice — Modern Invoicing & Billing",
    template: "%s | Zen-Invoice",
  },
  description: "Create invoices and estimates, manage clients, and track business billing.",
  metadataBase: new URL(process.env.NEXTAUTH_URL || "http://localhost:3005"),
  keywords: ["invoicing", "billing", "estimates", "quotes", "client management"],
  openGraph: {
    title: "Zen-Invoice",
    description: "Create invoices and estimates, manage clients, and track business billing.",
    siteName: "Zen-Invoice",
    locale: "en_US",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/zen-invoice-logo.png" />
        <meta name="theme-color" content="#0f172a" />
      </head>
      <body className="min-h-full flex flex-col">
        <Shortcuts />
        {children}
      </body>
    </html>
  );
}
