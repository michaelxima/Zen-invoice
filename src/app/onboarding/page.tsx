"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { registerUser } from "@/lib/actions/auth";
import {
  type OnboardingErrors,
  type OnboardingField,
  type OnboardingFormStep,
  type OnboardingValues,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  STEP_FIELDS,
  TAX_ID_MAX_LENGTH,
  buildBusinessAddress,
  emptyOnboardingValues,
  findFirstInvalidStep,
  formFieldForServerField,
  hasErrors,
  isSupportedCurrency,
  validateOnboardingStep,
} from "@/lib/validations/onboarding";

const steps = ["Welcome", "Sign up", "Account", "Business"];

const currencies: Array<[string, string]> = [
  ["USD", "USD — US Dollar"],
  ["EUR", "EUR — Euro"],
  ["GBP", "GBP — British Pound"],
  ["CAD", "CAD — Canadian Dollar"],
  ["AUD", "AUD — Australian Dollar"],
  ["JPY", "JPY — Japanese Yen"],
  ["NOK", "NOK — Norwegian Krone"],
  ["SEK", "SEK — Swedish Krona"],
  ["DKK", "DKK — Danish Krone"],
];

const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--brand-600)] focus:ring-2 focus:ring-[var(--brand-500)]/30";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  // Every field is controlled and lives here, so values survive re-renders, Back/Next and any way of submitting.
  const [values, setValues] = useState<OnboardingValues>(emptyOnboardingValues);
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Focus is moved after React has rendered the new step or the error messages.
  const pendingFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    document.getElementById(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });

  function setField(field: OnboardingField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function bind(field: OnboardingField) {
    return {
      id: field,
      value: values[field],
      error: errors[field],
      onChange: (event: ChangeEvent<HTMLInputElement>) => setField(field, event.target.value),
    };
  }

  function goToStep(next: OnboardingFormStep) {
    setErrors({});
    setFormError("");
    setStep(next);
    pendingFocus.current = STEP_FIELDS[next][0];
  }

  function showErrors(next: OnboardingErrors, onStep: OnboardingFormStep) {
    setErrors(next);
    setStep(onStep);
    pendingFocus.current = STEP_FIELDS[onStep].find((field) => next[field]) ?? null;
  }

  function continueOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = step as OnboardingFormStep;
    const next = validateOnboardingStep(current, values);
    if (hasErrors(next)) {
      showErrors(next, current);
      return;
    }
    if (current === 2 && values.company.trim() && !values.businessName.trim()) {
      setField("businessName", values.company.trim());
    }
    goToStep((current + 1) as OnboardingFormStep);
  }

  async function finishOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const invalid = findFirstInvalidStep(values);
    if (invalid) {
      showErrors(invalid.errors, invalid.step);
      return;
    }
    // Already checked by the step validation above; repeated here so the type is narrowed for the server call.
    const currency = values.currency;
    if (!isSupportedCurrency(currency)) {
      showErrors({ currency: "Choose a supported currency." }, 3);
      return;
    }

    setErrors({});
    setFormError("");
    setSubmitting(true);
    try {
      const result = await registerUser({
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        businessName: values.businessName,
        businessAddress: buildBusinessAddress(values),
        currency,
        taxId: values.taxId,
      });

      if (!result.ok) {
        const mapped: OnboardingErrors = {};
        let firstStep: OnboardingFormStep | null = null;
        for (const [key, message] of Object.entries(result.fieldErrors ?? {})) {
          const target = formFieldForServerField(key);
          if (!target) continue;
          mapped[target.field] ??= message;
          if (firstStep === null || target.step < firstStep) firstStep = target.step;
        }
        if (firstStep !== null && firstStep !== 3) {
          showErrors(mapped, firstStep);
        } else {
          setErrors(mapped);
          setFormError(result.error);
        }
        return;
      }

      const login = await signIn("credentials", { email: values.email, password: values.password, redirect: false });
      if (!login?.ok) {
        setFormError("Your account was created, but signing in failed. Please sign in from the login page.");
        return;
      }
      router.push("/dashboard");
    } catch {
      setFormError("Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

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
              <button type="button" onClick={() => goToStep(1)} className="rounded-lg px-6 py-3 bg-indigo-600 text-white font-bold">Get Started</button>
            </div>
          )}

          {step === 1 && (
            <form noValidate onSubmit={continueOnboarding} className="mx-auto max-w-md space-y-5">
              <StepHeading number={1} title="Create your account" />
              <TextField label="Email address" type="email" autoComplete="email" required {...bind("email")} />
              <TextField
                label="Password"
                type="password"
                autoComplete="new-password"
                required
                maxLength={PASSWORD_MAX_LENGTH}
                hint={`Use ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters. A longer passphrase is recommended.`}
                {...bind("password")}
              />
              <TextField label="Confirm password" type="password" autoComplete="new-password" required {...bind("confirmation")} />
              <SubmitButton>Continue to account details</SubmitButton>
            </form>
          )}

          {step === 2 && (
            <form noValidate onSubmit={continueOnboarding} className="space-y-5">
              <StepHeading number={2} title="Tell us about you" />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField label="First name" autoComplete="given-name" required {...bind("firstName")} />
                <TextField label="Last name" autoComplete="family-name" required {...bind("lastName")} />
                <TextField label="Company name" autoComplete="organization" {...bind("company")} />
                <TextField label="Address" autoComplete="address-line1" required className="sm:col-span-2" {...bind("address")} />
                <TextField label="City" autoComplete="address-level2" required {...bind("city")} />
                <TextField label="Postal code" autoComplete="postal-code" required {...bind("postalCode")} />
                <TextField label="State / region" autoComplete="address-level1" {...bind("state")} />
                <TextField label="Country" autoComplete="country-name" required {...bind("country")} />
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <BackButton onClick={() => goToStep(1)} />
                <SubmitButton>Continue to business</SubmitButton>
              </div>
            </form>
          )}

          {step === 3 && (
            <form noValidate onSubmit={finishOnboarding} className="mx-auto max-w-md space-y-5">
              <StepHeading number={3} title="Set up your business" subtitle="You can change these preferences later." />
              {formError && (
                <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                  {formError}
                </p>
              )}
              <TextField label="Business name" autoComplete="organization" required maxLength={120} {...bind("businessName")} />
              <div>
                <label htmlFor="currency" className="block text-sm font-semibold text-slate-700">Default currency</label>
                <select
                  id="currency"
                  name="currency"
                  value={values.currency}
                  onChange={(event) => setField("currency", event.target.value)}
                  aria-invalid={errors.currency ? true : undefined}
                  aria-describedby={errors.currency ? "currency-error" : undefined}
                  className={inputClass}
                >
                  {currencies.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
                {errors.currency && <p id="currency-error" className="mt-1 text-sm text-red-600" role="alert">{errors.currency}</p>}
              </div>
              <TextField label="Tax ID / VAT number (optional)" maxLength={TAX_ID_MAX_LENGTH} {...bind("taxId")} />
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <BackButton onClick={() => goToStep(2)} />
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
}

// Defined at module level: a component declared inside the page would be a new component type on every
// render, so React would unmount its input and lose focus and the typed value.
type TextFieldProps = {
  id: OnboardingField;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  maxLength?: number;
  hint?: string;
  className?: string;
};

function TextField({ id, label, value, onChange, error, required, type = "text", autoComplete, maxLength, hint, className }: TextFieldProps) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
        {label}
        {required && <span aria-hidden="true" className="text-red-500 font-bold"> *</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        maxLength={maxLength}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={inputClass}
      />
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-red-600" role="alert">{error}</p>}
    </div>
  );
}

function StepHeading({ number, title, subtitle }: { number: OnboardingFormStep; title: string; subtitle?: string }) {
  return (
    <div className="text-center">
      <p className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--brand-600)" }}>Step {number} of 3</p>
      <h2 className="mt-2 text-3xl font-light text-slate-800">{title}</h2>
      {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-5 py-3 text-sm font-bold text-slate-600 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
    >
      Back
    </button>
  );
}

function SubmitButton({ children }: { children: ReactNode }) {
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
