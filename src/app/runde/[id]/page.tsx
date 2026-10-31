import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { signedUrls } from "@/lib/images";
import { fmtDate, fmtDateTime, phaseOf, PHASE_LABEL, type Round } from "@/lib/rounds";
import SubmitForm from "./SubmitForm";
import StarRating from "./StarRating";
import CommentForm from "./CommentForm";

export const dynamic = "force-dynamic";

type Comment = { id: number; body: string; created_at: string; user_id: string; profiles: { display_name: string } | null };
type Photo = {
  id: number;
  user_id: string;
  title: string;
  preview_path: string;
  width: number;
  height: number;
  taken_at: string;
  status: "pending" | "approved" | "rejected";
  reject_reason: string | null;
  profiles: { display_name: string } | null;
  comments: Comment[];
};

export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const roundId = Number(id);
  const { supabase, user } = await getViewer();

  const { data: round } = await supabase.from("rounds").select("*").eq("id", roundId).maybeSingle<Round>();
  if (!round) notFound();
  const phase = phaseOf(round);
  const ended = phase === "ended";

  const { data: photoRows } = await supabase
    .from("photos")
    .select(
      "id, user_id, title, preview_path, width, height, taken_at, status, reject_reason, profiles(display_name), comments(id, body, created_at, user_id, profiles(display_name))",
    )
    .eq("round_id", roundId)
    .order("created_at");
  const photos = (photoRows ?? []) as unknown as Photo[];
  const approved = photos.filter((p) => p.status === "approved");
  const myPhoto = user ? photos.find((p) => p.user_id === user.id) : undefined;

  // Bewertungen: während der Runde nur die eigenen, danach alle (siehe Datenbankregeln)
  const { data: ratingRows } = approved.length
    ? await supabase.from("ratings").select("photo_id, user_id, stars").in("photo_id", approved.map((p) => p.id))
    : { data: [] };
  const ratings = ratingRows ?? [];
  const myRating = new Map(ratings.filter((r) => r.user_id === user?.id).map((r) => [r.photo_id, r.stars]));
  const stats = new Map<number, { avg: number; count: number }>();
  if (ended) {
    for (const p of approved) {
      const list = ratings.filter((r) => r.photo_id === p.id);
      const sum = list.reduce((s, r) => s + r.stars, 0);
      stats.set(p.id, { avg: list.length ? sum / list.length : 0, count: list.length });
    }
    approved.sort((a, b) => (stats.get(b.id)!.avg - stats.get(a.id)!.avg) || (stats.get(b.id)!.count - stats.get(a.id)!.count));
  }

  const canVote = !!myPhoto && myPhoto.status !== "rejected" && phase !== "upcoming" && !ended;
  const urls = await signedUrls([...approved.map((p) => p.preview_path), ...(myPhoto ? [myPhoto.preview_path] : [])]);

  return (
    <>
      <p className="small"><Link href="/">← Alle Runden</Link></p>
      <h1>{round.title}</h1>
      <span className="badge">{PHASE_LABEL[phase]}</span>
      {round.description && <p>{round.description}</p>}

      <div className="card small">
        <strong>Regeln dieser Runde</strong>
        <ul>
          <li>Einreichen vom {fmtDateTime(round.submit_from)} bis {fmtDateTime(round.submit_until)}, bewerten bis {fmtDateTime(round.vote_until)}</li>
          <li>Bildgröße: mindestens {round.min_width} × {round.min_height}, höchstens {round.max_width} × {round.max_height} Pixel</li>
          <li>Aufnahmedatum zwischen {fmtDate(round.taken_from)} und {fmtDate(round.taken_until)}, es muss in den EXIF-Daten stehen</li>
          <li>Nur JPEG-Dateien, ein Foto pro Person</li>
          <li>Bewerten und kommentieren darf, wer selbst ein Foto eingereicht hat, jedes Foto einmal, nicht das eigene</li>
        </ul>
      </div>

      {myPhoto ? (
        <div className="card">
          <strong>Dein Foto: {myPhoto.title}</strong>{" "}
          <span className={`badge ${myPhoto.status}`}>
            {{ pending: "Wartet auf Freigabe", approved: "Freigegeben", rejected: "Abgelehnt" }[myPhoto.status]}
          </span>
          {myPhoto.status === "rejected" && myPhoto.reject_reason && <p className="msg-err">Grund: {myPhoto.reject_reason}</p>}
          {urls[myPhoto.preview_path] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urls[myPhoto.preview_path]} alt={myPhoto.title} style={{ maxWidth: 320, display: "block", marginTop: 8, borderRadius: 6 }} />
          )}
        </div>
      ) : phase === "submit" ? (
        user ? (
          <SubmitForm round={round} userId={user.id} />
        ) : (
          <div className="card">
            <Link href={`/login?next=/runde/${round.id}`}>Melde dich an</Link>, um ein Foto einzureichen.
          </div>
        )
      ) : null}

      <h2>{ended ? "Ergebnis" : "Fotos"}</h2>
      {approved.length === 0 && <p className="muted">Noch keine freigegebenen Fotos.</p>}
      {!ended && approved.length > 0 && (
        <p className="small muted">Die Durchschnittsbewertungen werden nach dem Ende der Bewertungszeit angezeigt.</p>
      )}
      <div className="grid">
        {approved.map((p, i) => {
          const own = p.user_id === user?.id;
          const mine = myRating.get(p.id);
          const hasCommented = p.comments.some((c) => c.user_id === user?.id);
          const s = stats.get(p.id);
          return (
            <div key={p.id} className="card photo">
              {urls[p.preview_path] && (
                <a href={urls[p.preview_path]} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={urls[p.preview_path]} alt={p.title} width={p.width} height={p.height} loading="lazy" />
                </a>
              )}
              <h3 style={{ margin: "8px 0 0" }}>
                {ended && `${i + 1}. `}
                {p.title}
              </h3>
              {ended && <p className="small muted" style={{ margin: 0 }}>von {p.profiles?.display_name}</p>}
              {s && (
                <p className="small" style={{ margin: "4px 0" }}>
                  ★ {s.avg.toFixed(2).replace(".", ",")} aus {s.count} Bewertung{s.count === 1 ? "" : "en"}
                </p>
              )}
              {own ? (
                <p className="small muted">Dein eigenes Foto</p>
              ) : (
                <StarRating photoId={p.id} roundId={round.id} value={mine ?? 0} canRate={canVote && !mine} />
              )}
              {p.comments.map((c) => (
                <div key={c.id} className="comment small">
                  <strong>{c.profiles?.display_name ?? "Teilnehmer"}:</strong> {c.body}
                </div>
              ))}
              {canVote && !own && !hasCommented && <CommentForm photoId={p.id} roundId={round.id} />}
            </div>
          );
        })}
      </div>
    </>
  );
}
