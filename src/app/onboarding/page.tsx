"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { registerUser } from "@/lib/actions/auth";

type AccountDetails = {
  firstName: string;
  lastName: string;
  company: string;
  address: string;
  city: string;
  postalCode: string;
  state: string;
  country: string;
};

const steps = ["Welcome", "Sign up", "Account", "Business"];

const emptyAccount: AccountDetails = {
  firstName: "",
  lastName: "",
  company: "",
  address: "",
  city: "",
  postalCode: "",
  state: "",
  country: "",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [account, setAccount] = useState<AccountDetails>(emptyAccount);
  const [businessName, setBusinessName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  function updateAccount(field: keyof AccountDetails, value: string) {
    setAccount((current) => ({ ...current, [field]: value }));
  }

  function validateCurrentStep() {
    const nextErrors: Record<string, string> = {};

    if (step === 1) {
      if (!email.includes("@")) nextErrors.email = "Enter a valid email address.";
      if (password.length < 12 || password.length > 72) nextErrors.password = "Password must be between 12 and 72 characters.";
      if (confirmation !== password) nextErrors.confirmation = "Passwords must match.";
    }

    if (step === 2) {
      const required: Array<[keyof AccountDetails, string]> = [
        ["firstName", "First name"],
        ["lastName", "Last name"],
        ["address", "Address"],
        ["city", "City"],
        ["postalCode", "Postal code"],
        ["country", "Country"],
      ];

      required.forEach(([field, label]) => {
        if (!account[field].trim()) nextErrors[field] = `${label} is required.`;
      });
    }

    if (step === 3) {
      if (!businessName.trim()) nextErrors.businessName = "Business name is required.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function continueOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (validateCurrentStep()) {
      if (step === 2 && account.company.trim() && !businessName.trim()) setBusinessName(account.company.trim());
      setStep((current) => Math.min(current + 1, steps.length - 1));
    }
  }

  async function finishOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || !password) {
      setErrors({ businessName: "Email and password are required." });
      setSubmitting(false);
      return;
    }
    if (password !== confirmation) {
      setErrors({ businessName: "Passwords do not match." });
      setSubmitting(false);
      return;
    }
    if (!businessName.trim()) {
      setErrors({ businessName: "Business name is required." });
      setSubmitting(false);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      const businessAddress = [account.address, account.city, account.state, account.postalCode, account.country].map((value) => value.trim()).filter(Boolean).join(", ");
      await registerUser({
        email,
        password,
        firstName: account.firstName,
        lastName: account.lastName,
        businessName,
        businessAddress,
        currency,
      });

      const login = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!login?.ok) throw new Error("Account created, but sign-in failed. Please sign in from the login page.");
      router.push("/dashboard");
    } catch (err: any) {
      setErrors({ businessName: err.message || "Registration failed" });
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--brand-600)] focus:ring-2 focus:ring-[var(--brand-500)]/30";

  return (
    <main className="min-h-screen px-4 py-10 sm:py-16" style={{ background: "var(--bg-950)" }}>
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-10 text-center text-white">
          <Link href="/" className="inline-flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] rounded-lg p-1" aria-label="Zen-Invoice home">
            <Image src="/zen-invoice-logo.png" alt="Zen-Invoice" width={160} height={44} className="h-11 w-auto" priority />
            <span className="text-3xl font-bold tracking-tight">Zen-Invoice</span>
          </Link>
          <h1 className="mt-8 text-3xl font-light sm:text-4xl">Build your invoicing workspace</h1>
          <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-slate-300">
            A few quick details and you&apos;ll be ready to send your first invoice.
          </p>
        </header>

        <nav aria-label="Onboarding progress" className="mb-8">
          <ol className="flex items-center justify-center">
            {steps.map((label, index) => (
              <li key={label} className="flex flex-1 items-center last:flex-none sm:max-w-56">
                <div
                  className={`flex w-full items-center justify-center gap-2 rounded-md border px-2 py-2 text-xs font-bold uppercase tracking-wide sm:text-sm ${
                    index === step
                      ? "border-white bg-slate-700 text-white"
                      : index < step
                        ? "border-[var(--brand-500)] bg-[var(--brand-600)] text-white shadow"
                        : "border-slate-600 text-slate-400"
                  }`}
                  aria-current={index === step ? "step" : undefined}
                >
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{index + 1}</span>
                </div>
                {index < steps.length - 1 && <span aria-hidden="true" className="h-0.5 w-5 bg-slate-600 sm:w-8" />}
              </li>
            ))}
          </ol>
        </nav>

        <section className="rounded-xl bg-slate-50 p-6 shadow-2xl sm:p-10 border border-slate-200">
          {step === 0 && (
            <div className="text-center max-w-xl mx-auto space-y-6">
              <h1 className="text-4xl font-light text-slate-800">Welcome to Zen-Invoice</h1>
              <p className="text-slate-600">Getting started is easy:</p>
              <ul className="text-left space-y-2 text-slate-700">
                <li>• Setup your company & logos</li>
                <li>• Pick a design!</li>
                <li>• Integrate your payment gateway!</li>
                <li>👉 Create your first invoice, it only takes a minute!</li>
              </ul>
              <p className="text-sm text-slate-500">Your business profile is saved securely and can be updated later.</p>
              <button onClick={()=>setStep(1)} className="rounded-lg px-6 py-3 bg-indigo-600 text-white font-bold">Get Started</button>
            </div>
          )}
          {step === 1 && (
            <form noValidate onSubmit={continueOnboarding} className="mx-auto max-w-md space-y-5">
              <div className="text-center">
                <p className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--brand-600)" }}>Step 1 of 3</p>
                <h2 className="mt-2 text-3xl font-light text-slate-800">Create your account</h2>
              </div>
              <Field label="Email address" error={errors.email} required>
                <input id="email" type="email" autoComplete="email" defaultValue={email} onBlur={(event) => setEmail(event.currentTarget.value)} className={inputClass} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} tabIndex={0} />
              </Field>
              <Field label="Password" error={errors.password} required>
                <input id="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} defaultValue={password} onBlur={(event) => setPassword(event.currentTarget.value)} className={inputClass} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "password-error" : "password-hint"} tabIndex={0} />
              </Field>
              <p id="password-hint" className="-mt-3 text-xs text-slate-500">Use 12–72 characters. A longer passphrase is recommended.</p>
              <Field label="Confirm password" error={errors.confirmation} required>
                <input id="confirmation" type="password" autoComplete="new-password" defaultValue={confirmation} onBlur={(event) => setConfirmation(event.currentTarget.value)} className={inputClass} aria-invalid={Boolean(errors.confirmation)} aria-describedby={errors.confirmation ? "confirmation-error" : undefined} tabIndex={0} />
              </Field>
              <SubmitButton>Continue to account details</SubmitButton>
            </form>
          )}

          {step === 2 && (
            <form noValidate onSubmit={continueOnboarding} className="space-y-5">
              <div className="text-center">
                <p className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--brand-600)" }}>Step 2 of 3</p>
                <h2 className="mt-2 text-3xl font-light text-slate-800">Tell us about you</h2>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <AccountField label="First name" field="firstName" required />
                <AccountField label="Last name" field="lastName" required />
                <AccountField label="Company name" field="company" />
                <div className="sm:col-span-2"><AccountField label="Address" field="address" required /></div>
                <AccountField label="City" field="city" required />
                <AccountField label="Postal code" field="postalCode" required />
                <AccountField label="State / region" field="state" />
                <AccountField label="Country" field="country" required />
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button type="button" onClick={() => { setErrors({}); setStep(1); }} className="rounded-lg px-5 py-3 text-sm font-bold text-slate-600 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]">Back</button>
                <SubmitButton>Continue to business</SubmitButton>
              </div>
            </form>
          )}

          {step === 3 && (
            <form noValidate onSubmit={finishOnboarding} className="mx-auto max-w-md space-y-5">
              <div className="text-center">
                <p className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--brand-600)" }}>Step 3 of 3</p>
                <h2 className="mt-2 text-3xl font-light text-slate-800">Set up your business</h2>
                <p className="mt-2 text-sm text-slate-600">You can change these preferences later.</p>
              </div>
              <Field label="Business name" error={errors.businessName} required>
                <input id="businessName" defaultValue={businessName} onBlur={(event) => setBusinessName(event.currentTarget.value)} className={inputClass} aria-invalid={Boolean(errors.businessName)} aria-describedby={errors.businessName ? "businessName-error" : undefined} tabIndex={0} pattern=".*" inputMode="text" spellCheck={true} />
              </Field>
              <Field label="Default currency">
                <select id="currency" value={currency} onChange={(event) => setCurrency(event.target.value)} className={inputClass}>
                  {[["USD", "USD — US Dollar"], ["EUR", "EUR — Euro"], ["GBP", "GBP — British Pound"], ["CAD", "CAD — Canadian Dollar"], ["AUD", "AUD — Australian Dollar"], ["JPY", "JPY — Japanese Yen"], ["NOK", "NOK — Norwegian Krone"], ["SEK", "SEK — Swedish Krona"], ["DKK", "DKK — Danish Krone"]].map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
              </Field>
              <Field label="Tax ID / VAT number (optional)">
                <input id="taxId" className={inputClass} />
              </Field>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <button type="button" onClick={() => setStep(2)} className="rounded-lg px-5 py-3 text-sm font-bold text-slate-600 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]">Back</button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-bold text-white shadow-lg transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
                  style={{
                    background: "var(--brand-600)",
                    boxShadow: "0 10px 15px -3px rgba(79, 70, 229, 0.3)",
                    outlineColor: "var(--brand-500)",
                  }}
                >
                  {submitting ? "Finishing..." : "Finish and open dashboard"}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );

  function AccountField({ label, field, required, type = "text" }: { label: string; field: keyof AccountDetails; required?: boolean; type?: string }) {
    const error = errors[field];
    const [value, setValue] = useState(account[field]);
    return (
      <div>
        <label htmlFor={field} className="block text-sm font-semibold text-slate-700">
          {label}
          {required && <span className="text-red-500 font-bold"> *</span>}
        </label>
        <input id={field} name={field} type={type} autoComplete="off" inputMode="text" spellCheck={true} pattern=".*" value={value} onChange={(e) => setValue(e.target.value)} onBlur={(e) => updateAccount(field, e.target.value)} className={inputClass} aria-invalid={Boolean(error)} aria-describedby={error ? `${field}-error` : undefined} tabIndex={0} />
        {error && <p id={`${field}-error`} className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
      </div>
    );
  }
}

function Field({ label, error, required, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode }) {
  const id = typeof children === "object" && children && "props" in children ? (children.props as { id?: string }).id : undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="text-red-500 font-bold"> *</span>}
      </label>
      {children}
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-bold text-white shadow-lg transition focus:outline-none focus:ring-2 focus:ring-offset-2"
      style={{
        background: "var(--brand-600)",
        boxShadow: "0 10px 15px -3px rgba(79, 70, 229, 0.3)",
        outlineColor: "var(--brand-500)",
      }}
    >
      {children}
    </button>
  );
}
