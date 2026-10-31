"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import exifr from "exifr";
import sharp from "sharp";
import { getViewer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkPhoto, orientedSize, pickTakenAt } from "@/lib/checks";
import { phaseOf, type Round } from "@/lib/rounds";

export type ActionResult = { ok: true; message?: string } | { ok: false; errors: string[] };

const fail = (...errors: string[]): ActionResult => ({ ok: false, errors });

// ---------------------------------------------------------------------------
// Anmeldung
// ---------------------------------------------------------------------------

export async function signIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Bitte gib eine gültige E-Mail-Adresse ein.");
  const next = String(formData.get("next") ?? "/");
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const { supabase } = await getViewer();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return fail(`Anmeldung fehlgeschlagen: ${error.message}`);
  return { ok: true, message: `Wir haben dir einen Anmeldelink an ${email} geschickt. Bitte öffne ihn auf diesem Gerät.` };
}

export async function signOut() {
  const { supabase } = await getViewer();
  await supabase.auth.signOut();
  redirect("/");
}

// ---------------------------------------------------------------------------
// Foto einreichen (Datei liegt bereits im Speicher, wird hier verbindlich geprüft)
// ---------------------------------------------------------------------------

export async function submitPhoto(input: {
  roundId: number;
  path: string;
  title: string;
  displayName: string;
}): Promise<ActionResult> {
  const { user } = await getViewer();
  if (!user) return fail("Bitte melde dich zuerst an.");

  const admin = createAdminClient();
  const removeUpload = () => admin.storage.from("photos").remove([input.path]);

  // Nur Dateien aus dem eigenen Upload-Ordner annehmen.
  if (!input.path.startsWith(`uploads/${user.id}/`) || input.path.includes("..")) {
    return fail("Ungültige Datei.");
  }
  const title = input.title.trim();
  const displayName = input.displayName.trim();
  if (!title || title.length > 120) {
    await removeUpload();
    return fail("Bitte gib dem Foto einen Titel (höchstens 120 Zeichen).");
  }
  if (!displayName || displayName.length > 60) {
    await removeUpload();
    return fail("Bitte gib deinen Namen an (höchstens 60 Zeichen).");
  }

  const { data: round } = await admin.from("rounds").select("*").eq("id", input.roundId).maybeSingle<Round>();
  if (!round) {
    await removeUpload();
    return fail("Diese Runde gibt es nicht.");
  }
  if (phaseOf(round) !== "submit") {
    await removeUpload();
    return fail("Für diese Runde können derzeit keine Fotos eingereicht werden.");
  }

  const { data: existing } = await admin
    .from("photos")
    .select("id")
    .eq("round_id", round.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) {
    await removeUpload();
    return fail("Du hast für diese Runde bereits ein Foto eingereicht. Pro Person ist nur ein Foto erlaubt.");
  }

  // Datei laden und prüfen
  const { data: blob, error: dlError } = await admin.storage.from("photos").download(input.path);
  if (dlError || !blob) return fail("Die Datei konnte nicht gelesen werden. Bitte versuche es erneut.");
  const buffer = Buffer.from(await blob.arrayBuffer());

  let width: number, height: number;
  try {
    const meta = await sharp(buffer).metadata();
    if (meta.format !== "jpeg" || !meta.width || !meta.height) throw new Error("kein JPEG");
    ({ width, height } = orientedSize(meta.width, meta.height, meta.orientation));
  } catch {
    await removeUpload();
    return fail("Die Datei ist kein gültiges JPEG-Foto.");
  }

  let exif: Record<string, unknown> | null = null;
  try {
    exif = await exifr.parse(buffer, {
      pick: ["DateTimeOriginal", "CreateDate", "DateTimeDigitized"],
      reviveValues: false,
    });
  } catch {
    exif = null;
  }
  const takenAt = pickTakenAt(exif);

  const errors = checkPhoto(round, { width, height, takenAt });
  if (errors.length > 0) {
    await removeUpload();
    return fail(...errors);
  }

  // Vorschaubild (max. 1600 px, richtig gedreht) für die Galerie
  const previewPath = `previews/${round.id}/${user.id}-${randomUUID()}.jpg`;
  const preview = await sharp(buffer)
    .rotate()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  const { error: upError } = await admin.storage
    .from("photos")
    .upload(previewPath, preview, { contentType: "image/jpeg" });
  if (upError) return fail("Das Vorschaubild konnte nicht gespeichert werden. Bitte versuche es erneut.");

  await admin.from("profiles").upsert({ user_id: user.id, display_name: displayName });

  const { error: insError } = await admin.from("photos").insert({
    round_id: round.id,
    user_id: user.id,
    title,
    original_path: input.path,
    preview_path: previewPath,
    width,
    height,
    taken_at: takenAt,
  });
  if (insError) {
    await admin.storage.from("photos").remove([input.path, previewPath]);
    if (insError.code === "23505") {
      return fail("Du hast für diese Runde bereits ein Foto eingereicht. Pro Person ist nur ein Foto erlaubt.");
    }
    return fail("Das Foto konnte nicht gespeichert werden. Bitte versuche es erneut.");
  }

  revalidatePath(`/runde/${round.id}`);
  return {
    ok: true,
    message: "Danke! Dein Foto hat alle Prüfungen bestanden und wird nach der Freigabe durch die Jury veröffentlicht.",
  };
}

// ---------------------------------------------------------------------------
// Bewerten und Kommentieren (die Datenbankregeln prüfen die Berechtigung)
// ---------------------------------------------------------------------------

export async function ratePhoto(photoId: number, stars: number, roundId: number): Promise<ActionResult> {
  const { supabase, user } = await getViewer();
  if (!user) return fail("Bitte melde dich zuerst an.");
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return fail("Bitte wähle 1 bis 5 Sterne.");
  const { error } = await supabase.from("ratings").insert({ photo_id: photoId, user_id: user.id, stars });
  if (error) {
    if (error.code === "23505") return fail("Du hast dieses Foto bereits bewertet.");
    return fail(
      "Bewerten ist nicht möglich. Bewerten dürfen nur Personen mit eigenem Foto in dieser Runde, nicht das eigene Foto und nur bis zum Ende der Bewertungszeit.",
    );
  }
  revalidatePath(`/runde/${roundId}`);
  return { ok: true };
}

export async function commentPhoto(photoId: number, body: string, roundId: number): Promise<ActionResult> {
  const { supabase, user } = await getViewer();
  if (!user) return fail("Bitte melde dich zuerst an.");
  const text = body.trim();
  if (!text || text.length > 1000) return fail("Der Kommentar muss 1 bis 1000 Zeichen lang sein.");
  const { error } = await supabase.from("comments").insert({ photo_id: photoId, user_id: user.id, body: text });
  if (error) {
    if (error.code === "23505") return fail("Du hast zu diesem Foto bereits einen Kommentar geschrieben.");
    return fail(
      "Kommentieren ist nicht möglich. Kommentieren dürfen nur Personen mit eigenem Foto in dieser Runde, nicht beim eigenen Foto und nur bis zum Ende der Bewertungszeit.",
    );
  }
  revalidatePath(`/runde/${roundId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

function toUtcIso(local: string) {
  // Eingabe aus <input type="datetime-local"> ist Wiener Zeit
  const d = new Date(`${local}:00`);
  const offset = viennaOffsetMinutes(d);
  return new Date(Date.UTC(
    Number(local.slice(0, 4)), Number(local.slice(5, 7)) - 1, Number(local.slice(8, 10)),
    Number(local.slice(11, 13)), Number(local.slice(14, 16)),
  ) - offset * 60_000).toISOString();
}

function viennaOffsetMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Vienna",
    timeZoneName: "longOffset",
  }).formatToParts(date);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const m = tz.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

export async function saveRound(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const { supabase, isAdmin } = await getViewer();
  if (!isAdmin) return fail("Nur für Admins.");

  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const num = (k: string) => Number.parseInt(get(k), 10);
  const id = get("id");

  const round = {
    title: get("title"),
    description: get("description") || null,
    submit_from: get("submit_from"),
    submit_until: get("submit_until"),
    vote_until: get("vote_until"),
    min_width: num("min_width"),
    min_height: num("min_height"),
    max_width: num("max_width"),
    max_height: num("max_height"),
    taken_from: get("taken_from"),
    taken_until: get("taken_until"),
  };

  const errors: string[] = [];
  if (!round.title) errors.push("Titel fehlt.");
  for (const k of ["submit_from", "submit_until", "vote_until", "taken_from", "taken_until"] as const) {
    if (!round[k]) errors.push(`Feld „${k}“ fehlt.`);
  }
  for (const k of ["min_width", "min_height", "max_width", "max_height"] as const) {
    if (!Number.isFinite(round[k]) || round[k] <= 0) errors.push(`Feld „${k}“ muss eine positive Zahl sein.`);
  }
  if (errors.length) return fail(...errors);

  const row = {
    ...round,
    submit_from: toUtcIso(round.submit_from),
    submit_until: toUtcIso(round.submit_until),
    vote_until: toUtcIso(round.vote_until),
  };
  if (!(row.submit_from < row.submit_until && row.submit_until <= row.vote_until)) {
    return fail("Die Zeiten passen nicht: Einreichung ab < Einreichung bis ≤ Bewertung bis.");
  }
  if (round.max_width < round.min_width || round.max_height < round.min_height) {
    return fail("Die Maximalgröße muss mindestens so groß wie die Mindestgröße sein.");
  }
  if (round.taken_from > round.taken_until) return fail("Der Aufnahmezeitraum ist ungültig.");

  const { data, error } = id
    ? await supabase.from("rounds").update(row).eq("id", Number(id)).select("id").single()
    : await supabase.from("rounds").insert(row).select("id").single();
  if (error || !data) return fail(`Speichern fehlgeschlagen: ${error?.message ?? "unbekannt"}`);

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(`/admin/runde/${data.id}`);
}

export async function setPhotoStatus(
  photoId: number,
  status: "approved" | "rejected" | "pending",
  reason?: string,
): Promise<ActionResult> {
  const { supabase, isAdmin } = await getViewer();
  if (!isAdmin) return fail("Nur für Admins.");
  const { data, error } = await supabase
    .from("photos")
    .update({ status, reject_reason: status === "rejected" ? reason?.trim() || null : null })
    .eq("id", photoId)
    .select("round_id")
    .single();
  if (error || !data) return fail("Status konnte nicht geändert werden.");
  revalidatePath(`/admin/runde/${data.round_id}`);
  revalidatePath(`/runde/${data.round_id}`);
  return { ok: true };
}
