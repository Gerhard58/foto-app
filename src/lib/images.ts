import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Erzeugt zeitlich begrenzte Links (1 Stunde) für Bilder im privaten Speicher. */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await createAdminClient().storage.from("photos").createSignedUrls(paths, 3600);
  if (error || !data) return {};
  const out: Record<string, string> = {};
  for (const item of data) if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  return out;
}
