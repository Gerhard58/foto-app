"use client";

import { useState, useTransition } from "react";
import { ratePhoto } from "../../actions";

export default function StarRating({
  photoId,
  roundId,
  value,
  canRate,
}: {
  photoId: number;
  roundId: number;
  value: number;
  canRate: boolean;
}) {
  const [hover, setHover] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!canRate) {
    if (!value) return null;
    return (
      <div className="small">
        Deine Bewertung:{" "}
        <span className="stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} className={n <= value ? "on" : ""}>★</span>
          ))}
        </span>
      </div>
    );
  }

  const rate = (stars: number) => {
    if (!confirm(`${stars} Stern${stars === 1 ? "" : "e"} vergeben? Die Bewertung kann nicht mehr geändert werden.`)) return;
    start(async () => {
      const res = await ratePhoto(photoId, stars, roundId);
      setError(res.ok ? null : res.errors.join(" "));
    });
  };

  return (
    <div>
      <span className="stars" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={pending}
            className={n <= hover ? "on" : ""}
            onMouseEnter={() => setHover(n)}
            onClick={() => rate(n)}
            aria-label={`${n} Stern${n === 1 ? "" : "e"}`}
          >
            ★
          </button>
        ))}
      </span>
      {error && <p className="msg-err small">{error}</p>}
    </div>
  );
}
