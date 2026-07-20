import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { requireSupabaseUser } from "@/lib/auth-header";
import {
  circleWalletsConfigured,
  createExternalTransferChallenge,
  createUserToken,
  findUsdcTokenId,
  getUserWallets,
} from "@/lib/circle-wallets";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/admin";

/**
 * Issues a Circle challenge for the signed-in recipient to send USDC from
 * their Circle wallet to an external address they control.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured() || !circleWalletsConfigured()) {
    return NextResponse.json({ error: "Circle Wallets not configured" }, { status: 501 });
  }

  const user = await requireSupabaseUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { destinationAddress, amount } = await req.json().catch(() => ({}));
  if (!destinationAddress || !isAddress(destinationAddress) || !amount) {
    return NextResponse.json(
      { error: "A valid destinationAddress and amount are required" },
      { status: 400 }
    );
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

  const tokenId = await findUsdcTokenId(wallet.id, userToken);
  if (!tokenId) {
    return NextResponse.json({ error: "No USDC balance found on this wallet" }, { status: 409 });
  }

  const { challengeId } = await createExternalTransferChallenge(
    userToken,
    wallet.id,
    destinationAddress,
    tokenId,
    String(amount)
  );

  return NextResponse.json({ challengeId, userToken, encryptionKey });
}
