import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Angemeldete Person (oder null) samt Admin-Status. */
export async function getViewer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, isAdmin: false };
  const { data } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  return { supabase, user, isAdmin: !!data };
}
