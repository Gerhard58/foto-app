"use client";

import { useState, useTransition } from "react";
import { commentPhoto } from "../../actions";

export default function CommentForm({ photoId, roundId }: { photoId: number; roundId: number }) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await commentPhoto(photoId, text, roundId);
          if (res.ok) setText("");
          setError(res.ok ? null : res.errors.join(" "));
        });
      }}
      style={{ marginTop: 8 }}
    >
      <textarea
        rows={2}
        maxLength={1000}
        placeholder="Kommentar schreiben (einer pro Foto) …"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && <p className="msg-err small">{error}</p>}
      <div className="actions" style={{ marginTop: 6 }}>
        <button className="secondary" disabled={pending || !text.trim()}>Kommentieren</button>
      </div>
    </form>
  );
}
