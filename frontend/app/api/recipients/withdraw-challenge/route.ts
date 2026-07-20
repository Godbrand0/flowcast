import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/auth-header";
import {
  circleWalletsConfigured,
  createContractExecutionChallenge,
  createUserToken,
  getUserWallets,
} from "@/lib/circle-wallets";
import { STREAM_VAULT_ADDRESS } from "@/lib/contracts";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/admin";

/**
 * Issues a Circle challenge for the signed-in recipient to approve calling
 * StreamVault.withdraw(streamId) from their Circle wallet, via PIN.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured() || !circleWalletsConfigured()) {
    return NextResponse.json({ error: "Circle Wallets not configured" }, { status: 501 });
  }

  const user = await requireSupabaseUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { streamId } = await req.json().catch(() => ({}));
  if (!streamId) {
    return NextResponse.json({ error: "streamId is required" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: recipient, error } = await db
    .from("recipients")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!recipient) return NextResponse.json({ error: "No recipient profile found" }, { status: 404 });

  const { userToken, encryptionKey } = await createUserToken(recipient.id);
  const wallets = await getUserWallets(userToken);
  const wallet = wallets.find((w) => w.blockchain === "ARC-TESTNET") ?? wallets[0];
  if (!wallet) {
    return NextResponse.json({ error: "No wallet found for this recipient" }, { status: 409 });
  }

  const { challengeId } = await createContractExecutionChallenge(
    userToken,
    wallet.id,
    STREAM_VAULT_ADDRESS,
    "withdraw(uint256)",
    [String(streamId)]
  );

  return NextResponse.json({ challengeId, userToken, encryptionKey });
}
