import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkPhoto,
  normalizeExifDate,
  orientedSize,
  pickTakenAt,
  MISSING_DATE_MESSAGE,
  type PhotoRules,
} from "./checks.ts";

const rules: PhotoRules = {
  min_width: 3000,
  min_height: 2000,
  max_width: 8000,
  max_height: 6000,
  taken_from: "2026-01-01",
  taken_until: "2026-03-31",
};

test("gültiges Foto hat keine Fehler", () => {
  assert.deepEqual(checkPhoto(rules, { width: 4000, height: 3000, takenAt: "2026-02-10 14:00:00" }), []);
});

test("Grenzwerte sind erlaubt", () => {
  assert.deepEqual(checkPhoto(rules, { width: 3000, height: 2000, takenAt: "2026-01-01 00:00:00" }), []);
  assert.deepEqual(checkPhoto(rules, { width: 8000, height: 6000, takenAt: "2026-03-31 23:59:59" }), []);
});

test("zu klein und zu groß", () => {
  assert.match(checkPhoto(rules, { width: 2999, height: 3000, takenAt: "2026-02-01 00:00:00" })[0], /zu klein/);
  assert.match(checkPhoto(rules, { width: 9000, height: 3000, takenAt: "2026-02-01 00:00:00" })[0], /zu groß/);
});

test("fehlendes Aufnahmedatum ergibt den Hinweis", () => {
  assert.deepEqual(checkPhoto(rules, { width: 4000, height: 3000, takenAt: null }), [MISSING_DATE_MESSAGE]);
});

test("Datum außerhalb des Zeitraums", () => {
  const [msg] = checkPhoto(rules, { width: 4000, height: 3000, takenAt: "2026-04-01 08:00:00" });
  assert.match(msg, /01\.04\.2026/);
  assert.match(msg, /01\.01\.2026 bis 31\.03\.2026/);
});

test("EXIF-Datum wird umgewandelt", () => {
  assert.equal(normalizeExifDate("2026:05:01 12:34:56"), "2026-05-01 12:34:56");
  assert.equal(normalizeExifDate("2026:05:01"), "2026-05-01 00:00:00");
  assert.equal(normalizeExifDate("0000:00:00 00:00:00"), null);
  assert.equal(normalizeExifDate("2026:02:31 10:00:00"), null);
  assert.equal(normalizeExifDate(undefined), null);
  assert.equal(normalizeExifDate("    "), null);
});

test("pickTakenAt bevorzugt DateTimeOriginal", () => {
  assert.equal(
    pickTakenAt({ CreateDate: "2025:01:01 00:00:00", DateTimeOriginal: "2026:01:02 03:04:05" }),
    "2026-01-02 03:04:05",
  );
  assert.equal(pickTakenAt({ CreateDate: "2025:01:01 10:00:00" }), "2025-01-01 10:00:00");
  assert.equal(pickTakenAt({}), null);
  assert.equal(pickTakenAt(null), null);
});

test("Hochformat-Ausrichtung tauscht Breite und Höhe", () => {
  assert.deepEqual(orientedSize(6000, 4000, 6), { width: 4000, height: 6000 });
  assert.deepEqual(orientedSize(6000, 4000, 1), { width: 6000, height: 4000 });
  assert.deepEqual(orientedSize(6000, 4000, undefined), { width: 6000, height: 4000 });
});
