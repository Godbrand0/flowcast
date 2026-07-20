import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/auth-header";
import { circleWalletsConfigured, getUserWallets } from "@/lib/circle-wallets";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/admin";

/**
 * Called after the recipient completes the Circle PIN-setup challenge
 * client-side. Fetches the freshly created Arc wallet and finalizes the
 * recipient row.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
  }
  if (!circleWalletsConfigured()) {
    return NextResponse.json({ error: "Circle Wallets not configured" }, { status: 501 });
  }

  const user = await requireSupabaseUser(req);
  if (!user?.email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { token, userToken } = await req.json().catch(() => ({}));
  if (!token || !userToken) {
    return NextResponse.json({ error: "Missing token or userToken" }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data: recipient, error } = await db
    .from("recipients")
    .select("id, email")
    .eq("invite_token", token)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!recipient) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (recipient.email.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "Signed-in email doesn't match this invite" },
      { status: 403 }
    );
  }

  const wallets = await getUserWallets(userToken);
  const wallet = wallets.find((w) => w.blockchain === "ARC-TESTNET") ?? wallets[0];
  if (!wallet) {
    return NextResponse.json({ error: "No wallet found for this user yet" }, { status: 409 });
  }

  const { data: updated, error: updateError } = await db
    .from("recipients")
    .update({
      auth_user_id: user.id,
      circle_user_id: recipient.id,
      wallet_address: wallet.address,
      status: "active",
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", recipient.id)
    .select()
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ recipient: updated });
}
