// Prüfregeln für eingereichte Fotos. Wird im Browser (sofortige Rückmeldung)
// und auf dem Server (verbindliche Prüfung) gleich verwendet.

export type PhotoRules = {
  min_width: number;
  min_height: number;
  max_width: number;
  max_height: number;
  taken_from: string; // "YYYY-MM-DD"
  taken_until: string; // "YYYY-MM-DD"
};

export type PhotoInfo = {
  width: number;
  height: number;
  /** Aufnahmezeitpunkt aus EXIF als "YYYY-MM-DD HH:MM:SS", oder null wenn nicht vorhanden. */
  takenAt: string | null;
};

export const MISSING_DATE_MESSAGE =
  "Es werden nur Bilder akzeptiert, bei denen das Aufnahmedatum aus den EXIF-Daten ausgelesen werden kann. " +
  "Bei diesem Foto fehlt es. Das passiert oft, wenn ein Bild über WhatsApp oder soziale Netzwerke verschickt " +
  "oder bearbeitet wurde. Bitte lade die Originaldatei aus der Kamera oder vom Handy hoch.";

/**
 * Wandelt einen EXIF-Datumswert ("2026:05:01 12:34:56") in "2026-05-01 12:34:56" um.
 * Gibt null zurück, wenn der Wert fehlt oder kein gültiges Datum ist.
 */
export function normalizeExifDate(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(/^(\d{4})[:\-](\d{2})[:\-](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", s = "00"] = m;
  const year = Number(y), month = Number(mo), day = Number(d);
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCMonth() !== month - 1) return null; // z. B. 31. Februar
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

/** Wählt das beste Aufnahmedatum aus den (nicht umgewandelten) EXIF-Feldern. */
export function pickTakenAt(exif: Record<string, unknown> | null | undefined): string | null {
  if (!exif) return null;
  return (
    normalizeExifDate(exif.DateTimeOriginal) ??
    normalizeExifDate(exif.CreateDate) ??
    normalizeExifDate(exif.DateTimeDigitized)
  );
}

/** Breite/Höhe so, wie das Bild angezeigt wird (EXIF-Ausrichtung 5–8 = um 90° gedreht). */
export function orientedSize(width: number, height: number, orientation?: number | null) {
  return orientation && orientation >= 5 && orientation <= 8
    ? { width: height, height: width }
    : { width, height };
}

function formatDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

/** Liefert alle Verstöße als verständliche Meldungen; leeres Array = Foto ist in Ordnung. */
export function checkPhoto(rules: PhotoRules, info: PhotoInfo): string[] {
  const errors: string[] = [];
  const { width, height, takenAt } = info;

  if (width < rules.min_width || height < rules.min_height) {
    errors.push(
      `Das Foto ist zu klein (${width} × ${height} Pixel). ` +
        `Mindestens ${rules.min_width} × ${rules.min_height} Pixel sind nötig.`,
    );
  }
  if (width > rules.max_width || height > rules.max_height) {
    errors.push(
      `Das Foto ist zu groß (${width} × ${height} Pixel). ` +
        `Höchstens ${rules.max_width} × ${rules.max_height} Pixel sind erlaubt.`,
    );
  }

  if (!takenAt) {
    errors.push(MISSING_DATE_MESSAGE);
  } else {
    const day = takenAt.slice(0, 10);
    if (day < rules.taken_from || day > rules.taken_until) {
      errors.push(
        `Das Foto wurde am ${formatDate(day)} aufgenommen. Für diese Runde sind nur Aufnahmen ` +
          `vom ${formatDate(rules.taken_from)} bis ${formatDate(rules.taken_until)} erlaubt.`,
      );
    }
  }
  return errors;
}
