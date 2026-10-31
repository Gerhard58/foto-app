# Fotowettbewerb

Web-App für Fotowettbewerbe mit mehreren Runden pro Jahr. Sie läuft im Browser am PC und am Handy und lässt sich dort wie eine App auf den Startbildschirm legen.

## Was die App kann

- **Anmelden per E-Mail-Link** (ohne Passwort).
- **Foto einreichen:** ein JPEG-Foto pro Person und Runde. Geprüft wird
  - die Bildgröße (Mindest- und Maximalgröße für Breite und Höhe, so wie das Foto angezeigt wird),
  - das Aufnahmedatum aus den EXIF-Daten (muss im erlaubten Zeitraum liegen).
  Fehlt das Aufnahmedatum, wird das Foto mit dem Hinweis abgelehnt, dass nur Bilder mit auslesbarem EXIF-Datum akzeptiert werden.
  Die Prüfung läuft zuerst im Browser (sofortige Rückmeldung) und dann verbindlich auf dem Server.
- **Freigabe:** Neue Fotos sind erst sichtbar, wenn ein Admin sie freigibt. Ablehnen mit Begründung ist möglich.
- **Bewerten und kommentieren:** Wer in einer Runde selbst ein Foto eingereicht hat, darf jedes andere freigegebene Foto dieser Runde einmal mit 1 bis 5 Sternen bewerten und einmal kommentieren. Das eigene Foto kann man nicht bewerten.
- **Ergebnis:** Durchschnittsbewertungen und Namen werden erst nach dem Ende der Bewertungszeit angezeigt, als Rangliste.
- **Admin-Bereich** (`/admin`): Runden anlegen und bearbeiten (Zeitplan, Bildgrößen, Aufnahmezeitraum), Fotos freigeben oder ablehnen.

Die Berechtigungen (wer was sehen, bewerten oder kommentieren darf) sind direkt in der Datenbank festgelegt (`supabase/schema.sql`), nicht nur in der Oberfläche.

## Technik

- [Next.js](https://nextjs.org) (Webseite und Server), gehostet auf [Vercel](https://vercel.com)
- [Supabase](https://supabase.com): Datenbank, Anmeldung, Bildspeicher
- `exifr` liest die EXIF-Daten, `sharp` ermittelt die Bildgröße und erzeugt Vorschaubilder (max. 1600 px)

## Einrichtung (einmalig, ca. 15 Minuten)

### 1. Supabase

1. Im Supabase-Projekt unter **Project Settings → General** die Region prüfen. Ideal ist *Central EU (Frankfurt)*.
2. **SQL Editor → New query**: den gesamten Inhalt von [`supabase/schema.sql`](supabase/schema.sql) einfügen und auf **Run** klicken.
3. **Project Settings → API Keys** (bzw. **API**): diese drei Werte bereithalten:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**geheim**, nirgends veröffentlichen)

### 2. Vercel

1. **Add New → Project**, das Repository `foto-app` importieren.
2. Unter **Environment Variables** die drei Werte von oben eintragen.
3. **Deploy** klicken. Danach hat die App eine Adresse wie `https://foto-app-xyz.vercel.app`.

### 3. Supabase mit der Adresse verbinden

In Supabase unter **Authentication → URL Configuration**:

- **Site URL**: die Vercel-Adresse, z. B. `https://foto-app-xyz.vercel.app`
- **Redirect URLs**: `https://foto-app-xyz.vercel.app/auth/callback` hinzufügen

Optional unter **Authentication → Emails** den Text der Anmelde-E-Mail auf Deutsch ändern.

### 4. Sich selbst zum Admin machen

1. In der App mit der eigenen E-Mail-Adresse anmelden.
2. In Supabase im **SQL Editor** ausführen (E-Mail anpassen):
   ```sql
   insert into public.admins (user_id)
     select id from auth.users where email = 'deine@email.at';
   ```
3. Seite neu laden: oben erscheint der Link **Admin**. Dort die erste Runde anlegen.

### Hinweis zu E-Mails

Supabase verschickt mit dem eingebauten E-Mail-Dienst nur wenige Anmelde-Mails pro Stunde. Für Tests reicht das. Für einen echten Wettbewerb mit vielen Teilnehmenden sollte unter **Project Settings → Authentication → SMTP Settings** ein eigener E-Mail-Dienst eingetragen werden (z. B. Resend oder Brevo, beide mit kostenlosem Kontingent).

## Lokal entwickeln

```bash
npm install
cp .env.example .env.local   # Werte aus Supabase eintragen
npm run dev                  # http://localhost:3000
npm test                     # Tests der Prüfregeln
```
