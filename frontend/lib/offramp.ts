export interface BankDetails {
  country: string;
  currency: string;
  bankName: string;
  accountHolderName: string;
  accountNumber?: string;
  routingNumber?: string; // US ACH/wire
  iban?: string; // EU/UK/international
  city: string;
  addressLine1: string;
  postalCode?: string;
}

export interface CashoutRequest {
  amountUsdc: string; // decimal string, e.g. "500.00"
  bank: BankDetails;
}

export interface CashoutResponse {
  payoutId: string;
  trackingRef: string;
  status: PayoutStatus;
  mode: "circle" | "demo";
}

export type PayoutStatus = "pending" | "processing" | "complete" | "failed";

/** Key offramp corridors (Circle Payouts supports 180+ countries). */
export const CORRIDORS = [
  { country: "NG", label: "Nigeria", currency: "NGN", fields: "local" },
  { country: "GH", label: "Ghana", currency: "GHS", fields: "local" },
  { country: "KE", label: "Kenya", currency: "KES", fields: "local" },
  { country: "US", label: "United States", currency: "USD", fields: "us" },
  { country: "GB", label: "United Kingdom", currency: "GBP", fields: "iban" },
  { country: "DE", label: "Europe (SEPA)", currency: "EUR", fields: "iban" },
] as const;

export type Corridor = (typeof CORRIDORS)[number];

/**
 * Display-only FX estimates for the demo UI. A production build would quote
 * these live from Circle at payout time.
 */
export const FX_ESTIMATES: Record<string, { rate: number; symbol: string }> = {
  NGN: { rate: 1560, symbol: "₦" },
  GHS: { rate: 15.5, symbol: "GH₵" },
  KES: { rate: 129, symbol: "KSh" },
  USD: { rate: 1, symbol: "$" },
  GBP: { rate: 0.79, symbol: "£" },
  EUR: { rate: 0.92, symbol: "€" },
};

export const TRANSFER_FEE_USDC = 2;

export function estimateReceipt(amountUsdc: number, currency: string): string {
  const fx = FX_ESTIMATES[currency];
  if (!fx) return "—";
  const net = Math.max(0, amountUsdc - TRANSFER_FEE_USDC) * fx.rate;
  return `${fx.symbol}${net.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

const SAVED_BANK_KEY = "flowcast.savedBank";

/** Saved locally for demo convenience; production stores this encrypted server-side. */
export function loadSavedBank(): BankDetails | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SAVED_BANK_KEY);
    return raw ? (JSON.parse(raw) as BankDetails) : null;
  } catch {
    return null;
  }
}

export function saveBank(bank: BankDetails) {
  localStorage.setItem(SAVED_BANK_KEY, JSON.stringify(bank));
}
