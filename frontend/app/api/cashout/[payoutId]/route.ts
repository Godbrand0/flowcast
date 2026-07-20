import { NextRequest, NextResponse } from "next/server";
import { circleConfigured, getWirePayoutStatus } from "@/lib/circle-payouts";
import type { PayoutStatus } from "@/lib/offramp";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ payoutId: string }> }
) {
  const { payoutId } = await params;

  if (payoutId.startsWith("demo_")) {
    const createdAt = parseInt(payoutId.split("_")[1], 36);
    const elapsed = Date.now() - createdAt;
    const status: PayoutStatus =
      !Number.isFinite(elapsed) || elapsed < 0
        ? "failed"
        : elapsed < 8_000
          ? "pending"
          : elapsed < 20_000
            ? "processing"
            : "complete";
    return NextResponse.json({ payoutId, status, mode: "demo" });
  }

  if (!circleConfigured()) {
    return NextResponse.json(
      { error: "Circle credentials not configured" },
      { status: 501 }
    );
  }

  try {
    const status = await getWirePayoutStatus(payoutId);
    return NextResponse.json({ payoutId, status, mode: "circle" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Status lookup failed" },
      { status: 502 }
    );
  }
}
