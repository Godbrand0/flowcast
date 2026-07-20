import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
  }
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("businesses")
    .select("*")
    .ilike("wallet_address", wallet)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ business: data });
}

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
  }
  const body = await req.json().catch(() => null);
  const walletAddress = body?.walletAddress as string | undefined;
  const name = (body?.name as string | undefined)?.trim();

  if (!walletAddress || !isAddress(walletAddress)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Business name is required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("businesses")
    .upsert({ wallet_address: walletAddress, name }, { onConflict: "wallet_address" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ business: data });
}
