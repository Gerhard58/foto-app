"use client";

import { useState, useTransition } from "react";
import { setPhotoStatus } from "../../../actions";

type Props = {
  photo: {
    id: number; title: string; author: string; width: number; height: number; taken_at: string;
    status: "pending" | "approved" | "rejected"; reject_reason: string | null;
  };
  previewUrl?: string;
  originalUrl?: string;
};

const LABEL = { pending: "Wartet auf Freigabe", approved: "Freigegeben", rejected: "Abgelehnt" };

export default function PhotoReview({ photo, previewUrl, originalUrl }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = (status: "approved" | "rejected" | "pending") => {
    let reason: string | undefined;
    if (status === "rejected") {
      const r = prompt("Grund für die Ablehnung (wird der Person angezeigt, optional):");
      if (r === null) return;
      reason = r;
    }
    start(async () => {
      const res = await setPhotoStatus(photo.id, status, reason);
      setError(res.ok ? null : res.errors.join(" "));
    });
  };

  const taken = photo.taken_at.replace("T", " ").slice(0, 16);
  return (
    <div className="card photo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {previewUrl && <img src={previewUrl} alt={photo.title} />}
      <h3 style={{ margin: "8px 0 0" }}>{photo.title}</h3>
      <p className="small muted" style={{ margin: 0 }}>
        von {photo.author} · {photo.width} × {photo.height} px · aufgenommen {taken}
        {originalUrl && <> · <a href={originalUrl} target="_blank" rel="noreferrer">Original</a></>}
      </p>
      <span className={`badge ${photo.status}`}>{LABEL[photo.status]}</span>
      {photo.status === "rejected" && photo.reject_reason && <p className="small">Grund: {photo.reject_reason}</p>}
      <div className="actions">
        {photo.status !== "approved" && <button disabled={pending} onClick={() => set("approved")}>Freigeben</button>}
        {photo.status !== "rejected" && <button className="secondary" disabled={pending} onClick={() => set("rejected")}>Ablehnen</button>}
        {photo.status !== "pending" && <button className="secondary" disabled={pending} onClick={() => set("pending")}>Zurücksetzen</button>}
      </div>
      {error && <p className="msg-err small">{error}</p>}
    </div>
  );
}
