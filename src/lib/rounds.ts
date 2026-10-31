export type Round = {
  id: number;
  title: string;
  description: string | null;
  submit_from: string;
  submit_until: string;
  vote_until: string;
  min_width: number;
  min_height: number;
  max_width: number;
  max_height: number;
  taken_from: string;
  taken_until: string;
};

export type Phase = "upcoming" | "submit" | "vote" | "ended";

/** In welcher Phase ist die Runde gerade? Bewerten ist ab Freigabe bis vote_until möglich. */
export function phaseOf(round: Round, now = new Date()): Phase {
  if (now < new Date(round.submit_from)) return "upcoming";
  if (now <= new Date(round.submit_until)) return "submit";
  if (now <= new Date(round.vote_until)) return "vote";
  return "ended";
}

export const PHASE_LABEL: Record<Phase, string> = {
  upcoming: "Demnächst",
  submit: "Einreichen möglich",
  vote: "Bewertung läuft",
  ended: "Beendet",
};

const dateTime = new Intl.DateTimeFormat("de-AT", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Vienna",
});
const dateOnly = new Intl.DateTimeFormat("de-AT", { dateStyle: "medium", timeZone: "UTC" });

export const fmtDateTime = (iso: string) => dateTime.format(new Date(iso));
export const fmtDate = (isoDate: string) => dateOnly.format(new Date(`${isoDate}T00:00:00Z`));
