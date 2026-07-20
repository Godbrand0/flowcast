import { NextRequest, NextResponse } from "next/server";
import {
  circleConfigured,
  createWirePayout,
} from "@/lib/circle-payouts";
import type { CashoutRequest, CashoutResponse } from "@/lib/offramp";

export async function POST(req: NextRequest) {
  let body: CashoutRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const amount = Number(body.amountUsdc);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  const bank = body.bank;
  if (!bank?.accountHolderName || !bank?.bankName || !bank?.country) {
    return NextResponse.json({ error: "Missing bank details" }, { status: 400 });
  }
  if (!bank.accountNumber && !bank.iban) {
    return NextResponse.json(
      { error: "Provide an account number or IBAN" },
      { status: 400 }
    );
  }

  if (circleConfigured()) {
    try {
      const payout = await createWirePayout(amount.toFixed(2), bank);
      return NextResponse.json({ ...payout, mode: "circle" } satisfies CashoutResponse);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Circle payout failed" },
        { status: 502 }
      );
    }
  }

  // Demo mode — no Circle credentials configured. The payout ID embeds its
  // creation time so the status endpoint can progress it statelessly.
  const payoutId = `demo_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const trackingRef = `FC${Math.floor(1_000_000 + Math.random() * 9_000_000)}`;

  return NextResponse.json({
    payoutId,
    trackingRef,
    status: "pending",
    mode: "demo",
  } satisfies CashoutResponse);
}
