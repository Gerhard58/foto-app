"use client";

import { useState } from "react";
import exifr from "exifr";
import { createClient } from "@/lib/supabase/client";
import { checkPhoto, pickTakenAt } from "@/lib/checks";
import type { Round } from "@/lib/rounds";
import { submitPhoto } from "../../actions";

const MAX_BYTES = 50 * 1024 * 1024;

/** Angezeigte Bildgröße im Browser (moderne Browser berücksichtigen die EXIF-Drehung). */
function readSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Bild nicht lesbar"));
    };
    img.src = url;
  });
}

export default function SubmitForm({ round, userId }: { round: Round; userId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "checking" | "uploading" | "done">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setErrors([]);
    setStatus("checking");

    // 1. Schnelle Prüfung im Browser, damit niemand umsonst hochlädt
    if (file.type !== "image/jpeg") {
      setErrors(["Bitte lade eine JPEG-Datei (.jpg) hoch."]);
      return setStatus("idle");
    }
    if (file.size > MAX_BYTES) {
      setErrors(["Die Datei ist größer als 50 MB."]);
      return setStatus("idle");
    }
    try {
      const [size, exif] = await Promise.all([
        readSize(file),
        exifr.parse(file, { pick: ["DateTimeOriginal", "CreateDate", "DateTimeDigitized"], reviveValues: false }).catch(() => null),
      ]);
      const found = checkPhoto(round, { ...size, takenAt: pickTakenAt(exif) });
      if (found.length) {
        setErrors(found);
        return setStatus("idle");
      }
    } catch {
      setErrors(["Die Datei konnte nicht gelesen werden. Ist es ein gültiges Foto?"]);
      return setStatus("idle");
    }

    // 2. Direkt in den Speicher hochladen, 3. verbindliche Prüfung auf dem Server
    setStatus("uploading");
    const path = `uploads/${userId}/${round.id}-${crypto.randomUUID()}.jpg`;
    const { error } = await createClient().storage.from("photos").upload(path, file, { contentType: "image/jpeg" });
    if (error) {
      setErrors([`Hochladen fehlgeschlagen: ${error.message}`]);
      return setStatus("idle");
    }
    const res = await submitPhoto({ roundId: round.id, path, title, displayName: name });
    if (!res.ok) {
      setErrors(res.errors);
      return setStatus("idle");
    }
    setMessage(res.message ?? "Eingereicht.");
    setStatus("done");
  }

  if (status === "done") return <div className="card msg-ok">{message}</div>;

  const busy = status !== "idle";
  return (
    <form className="card" onSubmit={onSubmit}>
      <strong>Foto einreichen</strong>
      <label htmlFor="file">Foto (JPEG, Originaldatei)</label>
      <input id="file" type="file" accept="image/jpeg" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <div className="row">
        <div>
          <label htmlFor="title">Titel des Fotos</label>
          <input id="title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label htmlFor="name">Dein Name (wird angezeigt)</label>
          <input id="name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>
      {errors.length > 0 && (
        <ul className="errors">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      <div className="actions">
        <button disabled={busy || !file}>
          {status === "checking" ? "Wird geprüft …" : status === "uploading" ? "Wird hochgeladen …" : "Einreichen"}
        </button>
      </div>
      <p className="small muted">Pro Runde ist nur ein Foto möglich. Es wird erst nach der Freigabe veröffentlicht.</p>
    </form>
  );
}
