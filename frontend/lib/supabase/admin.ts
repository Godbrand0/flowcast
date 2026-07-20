import { createClient } from "@supabase/supabase-js";

// Server-only: uses the service role key. Only import this from API routes.

export function supabaseConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/** Service-role client for API routes only. Never import this from client code. */
export function supabaseAdmin() {
  if (!supabaseConfigured()) {
    throw new Error(
      "Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/** Verifies a Supabase access token (sent from the browser client) and returns its user. */
export async function getUserFromToken(accessToken: string) {
  const { data, error } = await supabaseAdmin().auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user;
}
