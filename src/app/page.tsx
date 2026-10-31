import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { fmtDateTime, phaseOf, PHASE_LABEL, type Round } from "@/lib/rounds";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { supabase } = await getViewer();
  const { data } = await supabase.from("rounds").select("*").order("submit_from", { ascending: false });
  const rounds = (data ?? []) as Round[];

  return (
    <>
      <h1>Wettbewerbsrunden</h1>
      {rounds.length === 0 && <p className="muted">Noch keine Runden angelegt.</p>}
      {rounds.map((r) => {
        const phase = phaseOf(r);
        return (
          <div key={r.id} className="card">
            <h2 style={{ marginTop: 0 }}>
              <Link href={`/runde/${r.id}`}>{r.title}</Link>
            </h2>
            <span className="badge">{PHASE_LABEL[phase]}</span>
            <p className="small muted">
              Einreichen: {fmtDateTime(r.submit_from)} bis {fmtDateTime(r.submit_until)} · Bewerten bis{" "}
              {fmtDateTime(r.vote_until)}
            </p>
            {r.description && <p>{r.description}</p>}
          </div>
        );
      })}
    </>
  );
}
