import Link from "next/link";
import { fmtDateTime, phaseOf, PHASE_LABEL, type Round } from "@/lib/rounds";
import { requireAdmin } from "./guard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("rounds").select("*").order("submit_from", { ascending: false });
  const { data: pending } = await supabase.from("photos").select("round_id").eq("status", "pending");
  const pendingByRound = new Map<number, number>();
  for (const p of pending ?? []) pendingByRound.set(p.round_id, (pendingByRound.get(p.round_id) ?? 0) + 1);

  return (
    <>
      <h1>Admin</h1>
      <div className="actions" style={{ marginBottom: 16 }}>
        <Link href="/admin/runde/neu"><button>Neue Runde anlegen</button></Link>
      </div>
      {((data ?? []) as Round[]).map((r) => (
        <div key={r.id} className="card">
          <Link href={`/admin/runde/${r.id}`}><strong>{r.title}</strong></Link>{" "}
          <span className="badge">{PHASE_LABEL[phaseOf(r)]}</span>{" "}
          {pendingByRound.get(r.id) ? (
            <span className="badge pending">{pendingByRound.get(r.id)} warten auf Freigabe</span>
          ) : null}
          <p className="small muted" style={{ marginBottom: 0 }}>
            Einreichen {fmtDateTime(r.submit_from)} bis {fmtDateTime(r.submit_until)} · Bewerten bis {fmtDateTime(r.vote_until)}
          </p>
        </div>
      ))}
    </>
  );
}
