import { Sidebar } from "@/components/Sidebar";

export default function RecurringPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <Sidebar currentPath="/recurring" />
      <main className="flex-1 md:ml-64 p-6 md:p-10 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white">Recurring Invoices</h1>
        <section className="mt-6 rounded-2xl border border-amber-700/50 bg-amber-950/20 p-6">
          <h2 className="font-semibold text-amber-200">Recurring invoicing is not available yet</h2>
          <p className="mt-2 text-sm text-slate-300">
            No schedule is created, saved, or run from this page. We will enable recurring billing only after persistent schedules, tenant authorization, and reliable background execution are implemented and tested.
          </p>
        </section>
      </main>
    </div>
  );
}
