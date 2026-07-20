/**
 * Server-side Circle Payouts client (wire offramp) — this is Circle's older
 * Business Account/Payments product, a separate host from the Wallets (W3S)
 * API in circle-wallets.ts.
 *
 * Live when CIRCLE_API_KEY is set; callers fall back to demo mode otherwise.
 * Uses the sandbox host by default — set
 * CIRCLE_PAYOUTS_API_BASE=https://api.circle.com for production.
 */
import { randomUUID } from "crypto";
import type { BankDetails, PayoutStatus } from "./offramp";

const CIRCLE_API_BASE =
  process.env.CIRCLE_PAYOUTS_API_BASE ?? "https://api-sandbox.circle.com";

export function circleConfigured(): boolean {
  return !!process.env.CIRCLE_API_KEY;
}

async function circleFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${CIRCLE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(
      `Circle ${path} failed (${res.status}): ${body?.message ?? "unknown error"}`
    );
  }
  return body.data as T;
}

/** Register the recipient's bank and create a wire payout. */
export async function createWirePayout(
  amountUsdc: string,
  bank: BankDetails
): Promise<{ payoutId: string; trackingRef: string; status: PayoutStatus }> {
  const wireAccount = await circleFetch<{ id: string }>(
    "/v1/businessAccount/banks/wires",
    {
      method: "POST",
      body: JSON.stringify({
        idempotencyKey: randomUUID(),
        accountNumber: bank.accountNumber,
        routingNumber: bank.routingNumber,
        iban: bank.iban,
        billingDetails: {
          name: bank.accountHolderName,
          city: bank.city,
          country: bank.country,
          line1: bank.addressLine1,
          postalCode: bank.postalCode ?? "00000",
        },
        bankAddress: {
          bankName: bank.bankName,
          country: bank.country,
        },
      }),
    }
  );

  const payout = await circleFetch<{
    id: string;
    trackingRef?: string;
    status: string;
  }>("/v1/businessAccount/payouts", {
    method: "POST",
    body: JSON.stringify({
      idempotencyKey: randomUUID(),
      destination: { type: "wire", id: wireAccount.id },
      amount: { amount: amountUsdc, currency: "USD" },
    }),
  });

  return {
    payoutId: payout.id,
    trackingRef: payout.trackingRef ?? "",
    status: normalizeStatus(payout.status),
  };
}

export async function getWirePayoutStatus(payoutId: string): Promise<PayoutStatus> {
  const payout = await circleFetch<{ status: string }>(
    `/v1/businessAccount/payouts/${payoutId}`
  );
  return normalizeStatus(payout.status);
}

function normalizeStatus(status: string): PayoutStatus {
  switch (status) {
    case "complete":
      return "complete";
    case "failed":
      return "failed";
    case "pending":
      return "pending";
    default:
      return "processing";
  }
}
