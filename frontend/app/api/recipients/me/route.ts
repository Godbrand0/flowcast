import { NextRequest, NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/auth-header";
import { supabaseAdmin, supabaseConfigured } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 501 });
  }
  const user = await requireSupabaseUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: recipient, error } = await supabaseAdmin()
    .from("recipients")
    .select("*, businesses(name)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!recipient) return NextResponse.json({ error: "No recipient profile found" }, { status: 404 });

  return NextResponse.json({ recipient });
}
