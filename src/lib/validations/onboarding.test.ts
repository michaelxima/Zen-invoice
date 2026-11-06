import { describe, expect, it } from "vitest";
import {
  buildBusinessAddress,
  emptyOnboardingValues,
  findFirstInvalidStep,
  formFieldForServerField,
  isSupportedCurrency,
  type OnboardingValues,
  validateOnboardingStep,
} from "./onboarding";

const complete: OnboardingValues = {
  ...emptyOnboardingValues,
  email: "jane@example.test",
  password: "SecurePassphrase-2026!",
  confirmation: "SecurePassphrase-2026!",
  firstName: "Jane",
  lastName: "Doe",
  address: "123 Market Street",
  city: "San Francisco",
  postalCode: "94105",
  country: "United States",
  businessName: "Doe Creative Studio",
};

describe("validateOnboardingStep", () => {
  it("accepts complete values on every step", () => {
    for (const step of [1, 2, 3] as const) expect(validateOnboardingStep(step, complete)).toEqual({});
  });

  it("step 1: email shape, password length and confirmation", () => {
    expect(validateOnboardingStep(1, { ...complete, email: "not-an-email" })).toHaveProperty("email");
    expect(validateOnboardingStep(1, { ...complete, email: "a@b" })).toHaveProperty("email");
    expect(validateOnboardingStep(1, { ...complete, password: "short", confirmation: "short" })).toHaveProperty("password");
    expect(validateOnboardingStep(1, { ...complete, password: "x".repeat(73), confirmation: "x".repeat(73) })).toHaveProperty("password");
    expect(validateOnboardingStep(1, { ...complete, confirmation: "different-passphrase" })).toHaveProperty("confirmation");
  });

  it("step 2: reports each missing required field, ignores optional ones", () => {
    const errors = validateOnboardingStep(2, { ...complete, firstName: " ", city: "", company: "", state: "" });
    expect(Object.keys(errors).sort()).toEqual(["city", "firstName"]);
  });

  it("step 3: business name required and bounded, tax ID optional but bounded", () => {
    expect(validateOnboardingStep(3, { ...complete, businessName: "  " })).toHaveProperty("businessName");
    expect(validateOnboardingStep(3, { ...complete, businessName: "b".repeat(121) })).toHaveProperty("businessName");
    expect(validateOnboardingStep(3, { ...complete, taxId: "" })).toEqual({});
    expect(validateOnboardingStep(3, { ...complete, taxId: "SE556677889901" })).toEqual({});
    expect(validateOnboardingStep(3, { ...complete, taxId: "t".repeat(81) })).toHaveProperty("taxId");
  });

  it("step 3: only supported currencies are accepted", () => {
    expect(validateOnboardingStep(3, { ...complete, currency: "SEK" })).toEqual({});
    expect(validateOnboardingStep(3, { ...complete, currency: "XYZ" })).toHaveProperty("currency");
    expect(validateOnboardingStep(3, { ...complete, currency: "sek" })).toHaveProperty("currency");
    expect(isSupportedCurrency("JPY")).toBe(true);
    expect(isSupportedCurrency("")).toBe(false);
  });
});

describe("findFirstInvalidStep", () => {
  it("returns null when everything is valid", () => {
    expect(findFirstInvalidStep(complete)).toBeNull();
  });

  it("returns the earliest failing step", () => {
    const result = findFirstInvalidStep({ ...complete, email: "", businessName: "" });
    expect(result?.step).toBe(1);
    expect(result?.errors).toHaveProperty("email");
  });
});

describe("formFieldForServerField", () => {
  it("maps server field names to the form field and step that shows them", () => {
    expect(formFieldForServerField("email")).toEqual({ field: "email", step: 1 });
    expect(formFieldForServerField("businessAddress")).toEqual({ field: "address", step: 2 });
    expect(formFieldForServerField("taxId")).toEqual({ field: "taxId", step: 3 });
    expect(formFieldForServerField("form")).toBeNull();
    expect(formFieldForServerField("constructor")).toBeNull();
  });
});

describe("buildBusinessAddress", () => {
  it("joins non-empty trimmed parts in postal order", () => {
    expect(buildBusinessAddress({ ...complete, state: " CA " })).toBe("123 Market Street, San Francisco, CA, 94105, United States");
    expect(buildBusinessAddress(emptyOnboardingValues)).toBe("");
  });
});
