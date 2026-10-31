-- Foto-Wettbewerb: Datenbank-Schema für Supabase
-- Einmal im Supabase-Dashboard unter "SQL Editor" ausführen.

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

-- Admins: wer Runden anlegen und Fotos freigeben darf
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- Profil: angezeigter Name einer teilnehmenden Person
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);

-- Wettbewerbsrunden mit eigenen Prüfregeln
create table public.rounds (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 120),
  description text,
  submit_from timestamptz not null,   -- Einreichung ab
  submit_until timestamptz not null,  -- Einreichung bis
  vote_until timestamptz not null,    -- Bewertung bis
  min_width int not null check (min_width > 0),
  min_height int not null check (min_height > 0),
  max_width int not null,
  max_height int not null,
  taken_from date not null,           -- frühestes erlaubtes Aufnahmedatum
  taken_until date not null,          -- spätestes erlaubtes Aufnahmedatum
  created_at timestamptz not null default now(),
  check (submit_from < submit_until and submit_until <= vote_until),
  check (max_width >= min_width and max_height >= min_height),
  check (taken_from <= taken_until)
);

-- Eingereichte Fotos (ein Foto pro Person und Runde)
create table public.photos (
  id bigint generated always as identity primary key,
  round_id bigint not null references public.rounds (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  original_path text not null,
  preview_path text not null,
  width int not null,
  height int not null,
  taken_at timestamp not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  created_at timestamptz not null default now(),
  unique (round_id, user_id)
);

-- Sternebewertungen (eine pro Person und Foto, nicht änderbar)
create table public.ratings (
  photo_id bigint not null references public.photos (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (user_id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);

-- Kommentare (einer pro Person und Foto)
create table public.comments (
  id bigint generated always as identity primary key,
  photo_id bigint not null references public.photos (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (user_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  unique (photo_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen
-- ---------------------------------------------------------------------------

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Darf die angemeldete Person dieses Foto bewerten bzw. kommentieren?
-- Bedingungen: eigenes, nicht abgelehntes Foto in derselben Runde,
-- Zielfoto ist freigegeben, nicht das eigene, und die Bewertungszeit läuft.
create function public.can_vote(target_photo bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.photos target
    join public.rounds r on r.id = target.round_id
    join public.photos own
      on own.round_id = target.round_id
     and own.user_id = auth.uid()
     and own.status <> 'rejected'
    where target.id = target_photo
      and target.status = 'approved'
      and target.user_id <> auth.uid()
      and now() <= r.vote_until
  );
$$;

-- Ist die Bewertungszeit der Runde dieses Fotos vorbei?
create function public.voting_ended(target_photo bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.photos p join public.rounds r on r.id = p.round_id
    where p.id = target_photo and now() > r.vote_until
  );
$$;

-- ---------------------------------------------------------------------------
-- Zugriffsregeln (Row Level Security)
-- ---------------------------------------------------------------------------

alter table public.admins   enable row level security;
alter table public.profiles enable row level security;
alter table public.rounds   enable row level security;
alter table public.photos   enable row level security;
alter table public.ratings  enable row level security;
alter table public.comments enable row level security;

create policy "admins: eigene Zeile lesen" on public.admins
  for select using (user_id = auth.uid());

create policy "profiles: alle lesen" on public.profiles for select using (true);
create policy "profiles: eigenes anlegen" on public.profiles
  for insert with check (user_id = auth.uid());
create policy "profiles: eigenes ändern" on public.profiles
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "rounds: alle lesen" on public.rounds for select using (true);
create policy "rounds: admin schreibt" on public.rounds
  for all using (public.is_admin()) with check (public.is_admin());

-- Fotos werden nur vom Server (nach der Prüfung) angelegt.
create policy "photos: freigegebene, eigene oder admin" on public.photos
  for select using (status = 'approved' or user_id = auth.uid() or public.is_admin());
create policy "photos: admin ändert" on public.photos
  for update using (public.is_admin()) with check (public.is_admin());
create policy "photos: admin löscht" on public.photos
  for delete using (public.is_admin());

-- Bewertungen sind während der Runde nur für die eigene Person sichtbar,
-- danach für alle (damit niemand vom Zwischenstand beeinflusst wird).
create policy "ratings: lesen" on public.ratings
  for select using (user_id = auth.uid() or public.is_admin() or public.voting_ended(photo_id));
create policy "ratings: bewerten" on public.ratings
  for insert with check (user_id = auth.uid() and public.can_vote(photo_id));

create policy "comments: alle lesen" on public.comments
  for select using (true);
create policy "comments: schreiben" on public.comments
  for insert with check (user_id = auth.uid() and public.can_vote(photo_id));
create policy "comments: admin löscht" on public.comments
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Speicher für die Bilddateien (privat; Anzeige über signierte Links)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 52428800, array['image/jpeg']);

-- Angemeldete Personen dürfen nur in ihren eigenen Ordner "uploads/<user-id>/" hochladen.
create policy "upload in eigenen Ordner" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = 'uploads'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Nach der ersten Anmeldung: sich selbst zum Admin machen (E-Mail anpassen)
-- ---------------------------------------------------------------------------
-- insert into public.admins (user_id)
--   select id from auth.users where email = 'deine@email.at';
