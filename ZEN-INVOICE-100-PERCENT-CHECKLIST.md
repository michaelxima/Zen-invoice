# Zen-Invoice 100% Completion Checklist

## Technology
- Next.js 16.3.0 + React 19.2.8 App Router, TypeScript strict
- Drizzle ORM Postgres schema + runtime
- NextAuth Credentials + Google OAuth completed
- Server Actions, bcryptjs auth
- Tailwind v4, Geist font, design tokens
- Production build green, no TS errors
- API stubs: /api/payment/gateways, /api/checkout, /api/send-invoice

## UI / UX
- Sidebar brand Zen-Invoice with logo, home route
- White background toggle persisted via localStorage, global CSS sweep
- Keyboard shortcuts wired
- Client portal polished with sticky Pay Now bar
- Empty states localized for Dashboard, Clients, Estimates, Recurring
- Invoice templates: Default, Finance, Law, Consulting
- Welcome wizard 4 steps on Dashboard
- Settings tabs with icons: Profile, Business, Billing, Appearance
- Payment gateway toggles for Stripe/Klarna

## i18n
- Locales: en, sv, no, da, de, fr, es
- Settings fully translated
- Portal keys: Pay Now, Amount due, Download PDF, read receipt
- Language switcher persists and reloads

## Polish & Promise
- Logo asset optimized, favicon Z
- Registration flow fixed, password confirmation
- Scandinavian currencies added
- Special characters allowed in names
- Welcome to Invoice Zen wizard with restart link
- Build artifacts clean, no mock data leakage

App runs at http://localhost:3005 with NEXTAUTH_URL matched.
