// Client-side checks for the onboarding steps. The server action re-validates everything with Zod
// (src/lib/actions/auth.ts); these checks only give fast, per-step feedback.

// The currencies a business can choose at sign-up. The server schema uses this same list.
export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "NOK", "SEK", "DKK"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export type OnboardingValues = {
  email: string;
  password: string;
  confirmation: string;
  firstName: string;
  lastName: string;
  company: string;
  address: string;
  city: string;
  postalCode: string;
  state: string;
  country: string;
  businessName: string;
  currency: string;
  taxId: string;
};

export type OnboardingField = keyof OnboardingValues;
export type OnboardingErrors = Partial<Record<OnboardingField, string>>;
export type OnboardingFormStep = 1 | 2 | 3;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 72;
export const BUSINESS_NAME_MAX_LENGTH = 120;
export const TAX_ID_MAX_LENGTH = 80;

export const emptyOnboardingValues: OnboardingValues = {
  email: "",
  password: "",
  confirmation: "",
  firstName: "",
  lastName: "",
  company: "",
  address: "",
  city: "",
  postalCode: "",
  state: "",
  country: "",
  businessName: "",
  currency: "USD",
  taxId: "",
};

export const STEP_FIELDS: Record<OnboardingFormStep, readonly OnboardingField[]> = {
  1: ["email", "password", "confirmation"],
  2: ["firstName", "lastName", "company", "address", "city", "postalCode", "state", "country"],
  3: ["businessName", "currency", "taxId"],
};

const REQUIRED_ACCOUNT_FIELDS: Array<[OnboardingField, string]> = [
  ["firstName", "First name"],
  ["lastName", "Last name"],
  ["address", "Address"],
  ["city", "City"],
  ["postalCode", "Postal code"],
  ["country", "Country"],
];

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateOnboardingStep(step: OnboardingFormStep, values: OnboardingValues): OnboardingErrors {
  const errors: OnboardingErrors = {};

  if (step === 1) {
    if (!EMAIL_SHAPE.test(values.email.trim())) errors.email = "Enter a valid email address.";
    if (values.password.length < PASSWORD_MIN_LENGTH || values.password.length > PASSWORD_MAX_LENGTH) {
      errors.password = `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters.`;
    }
    if (values.confirmation !== values.password) errors.confirmation = "Passwords must match.";
  }

  if (step === 2) {
    for (const [field, label] of REQUIRED_ACCOUNT_FIELDS) {
      if (!values[field].trim()) errors[field] = `${label} is required.`;
    }
  }

  if (step === 3) {
    const businessName = values.businessName.trim();
    if (!businessName) errors.businessName = "Business name is required.";
    else if (businessName.length > BUSINESS_NAME_MAX_LENGTH) {
      errors.businessName = `Business name must be ${BUSINESS_NAME_MAX_LENGTH} characters or fewer.`;
    }
    if (!isSupportedCurrency(values.currency)) errors.currency = "Choose a supported currency.";
    if (values.taxId.trim().length > TAX_ID_MAX_LENGTH) {
      errors.taxId = `Tax ID must be ${TAX_ID_MAX_LENGTH} characters or fewer.`;
    }
  }

  return errors;
}

export function hasErrors(errors: OnboardingErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** The earliest step that fails validation, so a final submit can send the user back to it. */
export function findFirstInvalidStep(
  values: OnboardingValues,
): { step: OnboardingFormStep; errors: OnboardingErrors } | null {
  for (const step of [1, 2, 3] as const) {
    const errors = validateOnboardingStep(step, values);
    if (hasErrors(errors)) return { step, errors };
  }
  return null;
}

/** Maps a field name reported by the server action back to the form field and step that shows it. */
export function formFieldForServerField(key: string): { field: OnboardingField; step: OnboardingFormStep } | null {
  const field: OnboardingField | null =
    key === "businessAddress" ? "address" : key in emptyOnboardingValues ? (key as OnboardingField) : null;
  if (!field) return null;
  const step = ([1, 2, 3] as const).find((candidate) => STEP_FIELDS[candidate].includes(field));
  return step ? { field, step } : null;
}

export function buildBusinessAddress(values: OnboardingValues): string {
  return [values.address, values.city, values.state, values.postalCode, values.country]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}
