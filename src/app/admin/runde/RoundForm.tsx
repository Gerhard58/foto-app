"use client";

import { useActionState } from "react";
import { saveRound } from "../../actions";
import type { Round } from "@/lib/rounds";

/** ISO-Zeitpunkt → Wert für <input type="datetime-local"> in Wiener Zeit */
function toLocalInput(iso?: string) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Vienna",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
  return parts.replace(" ", "T");
}

export default function RoundForm({ round }: { round?: Round }) {
  const [state, action, pending] = useActionState(saveRound, null);
  return (
    <form action={action} className="card">
      {round && <input type="hidden" name="id" value={round.id} />}
      <label htmlFor="title">Titel</label>
      <input id="title" name="title" required defaultValue={round?.title} placeholder="z. B. Frühling 2027" />
      <label htmlFor="description">Beschreibung / Thema (optional)</label>
      <textarea id="description" name="description" rows={3} defaultValue={round?.description ?? ""} />

      <h2>Zeitplan (Wiener Zeit)</h2>
      <div className="row">
        <div>
          <label htmlFor="submit_from">Einreichen ab</label>
          <input id="submit_from" name="submit_from" type="datetime-local" required defaultValue={toLocalInput(round?.submit_from)} />
        </div>
        <div>
          <label htmlFor="submit_until">Einreichen bis</label>
          <input id="submit_until" name="submit_until" type="datetime-local" required defaultValue={toLocalInput(round?.submit_until)} />
        </div>
      </div>
      <label htmlFor="vote_until">Bewerten und kommentieren bis</label>
      <input id="vote_until" name="vote_until" type="datetime-local" required defaultValue={toLocalInput(round?.vote_until)} />

      <h2>Bildgröße (Pixel)</h2>
      <div className="row">
        <div>
          <label htmlFor="min_width">Mindestbreite</label>
          <input id="min_width" name="min_width" type="number" min={1} required defaultValue={round?.min_width ?? 3000} />
        </div>
        <div>
          <label htmlFor="min_height">Mindesthöhe</label>
          <input id="min_height" name="min_height" type="number" min={1} required defaultValue={round?.min_height ?? 2000} />
        </div>
        <div>
          <label htmlFor="max_width">Maximale Breite</label>
          <input id="max_width" name="max_width" type="number" min={1} required defaultValue={round?.max_width ?? 10000} />
        </div>
        <div>
          <label htmlFor="max_height">Maximale Höhe</label>
          <input id="max_height" name="max_height" type="number" min={1} required defaultValue={round?.max_height ?? 10000} />
        </div>
      </div>
      <p className="small muted">Breite und Höhe gelten so, wie das Foto angezeigt wird (Hochformat hat die größere Höhe).</p>

      <h2>Erlaubtes Aufnahmedatum (laut EXIF)</h2>
      <div className="row">
        <div>
          <label htmlFor="taken_from">Von</label>
          <input id="taken_from" name="taken_from" type="date" required defaultValue={round?.taken_from} />
        </div>
        <div>
          <label htmlFor="taken_until">Bis</label>
          <input id="taken_until" name="taken_until" type="date" required defaultValue={round?.taken_until} />
        </div>
      </div>

      {state && !state.ok && <ul className="errors">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <div className="actions">
        <button disabled={pending}>{pending ? "Wird gespeichert …" : "Speichern"}</button>
      </div>
    </form>
  );
}
