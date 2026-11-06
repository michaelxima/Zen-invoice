export function calculateInvoiceTotals(
  items: Array<{ quantity: number; unitPrice: number }>,
  taxRate: number = 0,
  discountRate: number = 0,
  currency: string = "USD",
) {
  const scale = currency.toUpperCase() === "JPY" ? 1 : 100;
  const subtotalMinor = items.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.unitPrice * scale),
    0,
  );
  const discountMinor = Math.round(subtotalMinor * (discountRate / 100));
  const taxableMinor = subtotalMinor - discountMinor;
  const taxMinor = Math.round(taxableMinor * (taxRate / 100));
  const totalMinor = taxableMinor + taxMinor;
  const money = (minor: number) => minor / scale;

  return {
    subtotal: money(subtotalMinor),
    discountAmount: money(discountMinor),
    taxAmount: money(taxMinor),
    total: money(totalMinor),
  };
}
