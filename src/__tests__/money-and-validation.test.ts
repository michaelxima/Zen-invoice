import { describe, expect, it } from "vitest";
import { calculateInvoiceTotals } from "@/lib/calculator";
import { roundCurrencyAmount, toMinorUnits } from "@/lib/money";
import { CreateEstimateSchema, CreateInvoiceSchema } from "@/lib/validations/invoice";

describe("calculateInvoiceTotals", () => {
  it("applies discount before tax", () => {
    const totals = calculateInvoiceTotals(
      [{ quantity: 5, unitPrice: 100 }, { quantity: 2, unitPrice: 250 }],
      10, 5, "USD",
    );
    expect(totals).toEqual({ subtotal: 1000, discountAmount: 50, taxAmount: 95, total: 1045 });
  });

  it("matches the documented 250 / 5% / 10% example", () => {
    const totals = calculateInvoiceTotals(
      [{ quantity: 2, unitPrice: 100 }, { quantity: 1, unitPrice: 50 }],
      10, 5,
    );
    expect(totals).toEqual({ subtotal: 250, discountAmount: 12.5, taxAmount: 23.75, total: 261.25 });
  });

  it("avoids float drift on cents", () => {
    expect(calculateInvoiceTotals([{ quantity: 3, unitPrice: 0.1 }]).total).toBe(0.3);
  });

  it("rounds zero-decimal currencies to whole units", () => {
    expect(calculateInvoiceTotals([{ quantity: 2, unitPrice: 10.4 }], 0, 0, "JPY").total).toBe(21);
  });

  it("returns zeros for an empty invoice", () => {
    expect(calculateInvoiceTotals([])).toEqual({ subtotal: 0, discountAmount: 0, taxAmount: 0, total: 0 });
  });
});

describe("money helpers", () => {
  it("rounds per currency exponent", () => {
    expect(roundCurrencyAmount(10.6, "JPY")).toBe(11);
    // 10.125 is exactly representable in binary, so this tests half-up rounding without float noise.
    expect(roundCurrencyAmount(10.125, "USD")).toBe(10.13);
  });

  it("converts to Stripe minor units", () => {
    expect(toMinorUnits(11, "JPY")).toBe(11);
    expect(toMinorUnits(10.55, "USD")).toBe(1055);
  });

  it("rejects non-positive or non-finite amounts", () => {
    expect(() => toMinorUnits(0, "USD")).toThrow();
    expect(() => toMinorUnits(-1, "USD")).toThrow();
    expect(() => toMinorUnits(Number.NaN, "USD")).toThrow();
    expect(() => roundCurrencyAmount(Number.POSITIVE_INFINITY, "USD")).toThrow();
  });
});

const invoice = {
  invoiceNumber: "INV-2026-UNIT-01",
  clientId: "79b7b68d-686a-4b39-86f7-13ea17aee8f0",
  clientName: "Test Client",
  clientEmail: "billing@example.com",
  businessName: "Test Business",
  businessEmail: "accounts@example.com",
  issueDate: "2026-11-03",
  dueDate: "2026-11-17",
  currency: "JPY",
  items: [{ description: "Consulting", quantity: 1, unitPrice: 101 }],
};

describe("CreateInvoiceSchema", () => {
  it("accepts a valid JPY invoice", () => {
    expect(CreateInvoiceSchema.parse(invoice).currency).toBe("JPY");
  });

  it("rejects fractional prices in a zero-decimal currency", () => {
    expect(() => CreateInvoiceSchema.parse({ ...invoice, items: [{ ...invoice.items[0], unitPrice: 101.5 }] })).toThrow();
  });

  it("rejects impossible calendar dates", () => {
    expect(() => CreateInvoiceSchema.parse({ ...invoice, issueDate: "2026-02-31" })).toThrow();
  });
});

describe("CreateEstimateSchema", () => {
  it("accepts a valid estimate", () => {
    const estimate = {
      estimateNumber: "EST-2026-UNIT-01",
      clientId: invoice.clientId,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      businessName: invoice.businessName,
      issueDate: invoice.issueDate,
      validUntil: invoice.dueDate,
      currency: "USD",
      items: [{ description: "Consulting", quantity: 2, unitPrice: 25.5 }],
    };
    expect(CreateEstimateSchema.parse(estimate).estimateNumber).toBe(estimate.estimateNumber);
  });
});
