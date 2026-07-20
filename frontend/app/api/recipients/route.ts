import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { sendInviteEmail } from "@/lib/email";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
  }
  const businessId = req.nextUrl.searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "businessId is required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from("recipients")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ recipients: data });
}

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
  }
  const body = await req.json().catch(() => null);
  const businessId = body?.businessId as string | undefined;
  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  const fullName = (body?.fullName as string | undefined)?.trim();

  if (!businessId || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "businessId and a valid email are required" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: business, error: businessError } = await db
    .from("businesses")
    .select("name")
    .eq("id", businessId)
    .maybeSingle();
  if (businessError) return NextResponse.json({ error: businessError.message }, { status: 500 });
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const inviteToken = randomBytes(24).toString("base64url");

  const { data: recipient, error } = await db
    .from("recipients")
    .insert({
      business_id: businessId,
      email,
      full_name: fullName || null,
      invite_token: inviteToken,
      status: "pending",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const onboardUrl = `${req.nextUrl.origin}/recipient/onboard/${inviteToken}`;
  const emailResult = await sendInviteEmail(email, business.name, onboardUrl);

  return NextResponse.json({ recipient, email: emailResult });
}
