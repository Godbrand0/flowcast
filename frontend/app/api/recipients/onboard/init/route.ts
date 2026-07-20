import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/auth-header";
import {
  ALREADY_INITIALIZED_CODE,
  circleWalletsConfigured,
  createUserToken,
  ensureCircleUser,
  initializeUserWallet,
} from "@/lib/circle-wallets";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/admin";

/**
 * Called right after the recipient signs in with Google on the invite page.
 * Verifies their session matches the invited email, provisions a Circle
 * end-user, and returns a wallet-creation challenge for the Web SDK to run.
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

  const { token } = await req.json().catch(() => ({}));
  if (!token) return NextResponse.json({ error: "Missing invite token" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: recipient, error } = await db
    .from("recipients")
    .select("id, email, status")
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
  if (recipient.status === "active") {
    return NextResponse.json({ error: "This invite has already been used" }, { status: 409 });
  }

  await ensureCircleUser(recipient.id);
  const { userToken, encryptionKey } = await createUserToken(recipient.id);

  try {
    const { challengeId } = await initializeUserWallet(userToken);
    return NextResponse.json({
      challengeId,
      userToken,
      encryptionKey,
      appId: process.env.NEXT_PUBLIC_CIRCLE_APP_ID,
    });
  } catch (e) {
    const circleCode = (e as { circleCode?: number }).circleCode;
    if (circleCode === ALREADY_INITIALIZED_CODE) {
      // This user already completed PIN setup — skip straight to finalizing
      // with their existing wallet instead of asking them to set it up again.
      return NextResponse.json({ alreadyInitialized: true, userToken, encryptionKey });
    }
    throw e;
  }
}
