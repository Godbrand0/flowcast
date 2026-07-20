import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
  }
  const { token } = await params;

  const { data: recipient, error } = await supabaseAdmin()
    .from("recipients")
    .select("id, email, full_name, status, business_id, businesses(name)")
    .eq("invite_token", token)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!recipient) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  const business = Array.isArray(recipient.businesses)
    ? recipient.businesses[0]
    : recipient.businesses;

  return NextResponse.json({
    email: recipient.email,
    fullName: recipient.full_name,
    status: recipient.status,
    businessName: business?.name ?? "A business",
  });
}
