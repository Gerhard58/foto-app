import Link from "next/link";
import { notFound } from "next/navigation";
import { signedUrls } from "@/lib/images";
import type { Round } from "@/lib/rounds";
import { requireAdmin } from "../../guard";
import RoundForm from "../RoundForm";
import PhotoReview from "./PhotoReview";

export const dynamic = "force-dynamic";

export default async function AdminRoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const { data: round } = await supabase.from("rounds").select("*").eq("id", Number(id)).maybeSingle<Round>();
  if (!round) notFound();

  const { data } = await supabase
    .from("photos")
    .select("id, title, preview_path, original_path, width, height, taken_at, status, reject_reason, created_at, profiles(display_name)")
    .eq("round_id", round.id)
    .order("created_at");
  const photos = (data ?? []) as unknown as Array<{
    id: number; title: string; preview_path: string; original_path: string; width: number; height: number;
    taken_at: string; status: "pending" | "approved" | "rejected"; reject_reason: string | null;
    profiles: { display_name: string } | null;
  }>;
  const order = { pending: 0, approved: 1, rejected: 2 };
  photos.sort((a, b) => order[a.status] - order[b.status]);
  const urls = await signedUrls(photos.flatMap((p) => [p.preview_path, p.original_path]));

  return (
    <>
      <p className="small"><Link href="/admin">← Admin</Link> · <Link href={`/runde/${round.id}`}>Öffentliche Ansicht</Link></p>
      <h1>{round.title}</h1>

      <h2>Eingereichte Fotos ({photos.length})</h2>
      {photos.length === 0 && <p className="muted">Noch keine Einreichungen.</p>}
      <div className="grid">
        {photos.map((p) => (
          <PhotoReview
            key={p.id}
            photo={{ ...p, author: p.profiles?.display_name ?? "?" }}
            previewUrl={urls[p.preview_path]}
            originalUrl={urls[p.original_path]}
          />
        ))}
      </div>

      <h2>Einstellungen der Runde</h2>
      <RoundForm round={round} />
    </>
  );
}
