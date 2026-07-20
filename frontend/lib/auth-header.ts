import { NextRequest } from "next/server";
import { getUserFromToken } from "@/lib/supabase/admin";

/** Extracts and verifies the Supabase user from an `Authorization: Bearer <token>` header. */
export async function requireSupabaseUser(req: NextRequest) {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  return getUserFromToken(token);
}
