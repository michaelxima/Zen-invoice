const ZERO_DECIMAL_CURRENCIES = new Set(["JPY"]);

export function roundCurrencyAmount(amount: number, currency: string): number {
  if (!Number.isFinite(amount)) throw new Error("Amount must be finite");
  const decimals = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2;
  const scale = 10 ** decimals;
  return Math.round(amount * scale) / scale;
}

export function toMinorUnits(amount: number, currency: string): number {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be a positive finite number");
  const decimals = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2;
  const minor = Math.round(amount * (10 ** decimals));
  if (!Number.isSafeInteger(minor) || minor <= 0) throw new Error("Amount is outside the supported payment range");
  return minor;
}
