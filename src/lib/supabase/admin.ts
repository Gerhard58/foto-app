import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase-Client mit Service-Role-Schlüssel. Umgeht alle Zugriffsregeln,
 * darf daher nur auf dem Server und nur nach eigener Prüfung verwendet werden.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
