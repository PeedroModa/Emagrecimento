-- ============================================================
-- V2 — Etapa 6: marcadores casuais do dia.
--
-- Registro OPCIONAL e de um toque só (treino, álcool, sal fora de casa,
-- dormi mal, viagem) — nunca um check-in obrigatório. NULL numa coluna
-- significa "não respondeu" (dia sem informação), não "não aconteceu";
-- essa distinção é o que impede o motor de insights de tratar silêncio
-- como resposta negativa e inventar uma correlação.
--
-- Idempotente. Rode no SQL Editor do Supabase.
-- ============================================================

create table if not exists day_markers (
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null,
  trained       boolean,
  alcohol       boolean,
  high_sodium   boolean,
  travel        boolean,
  slept_badly   boolean,
  extra_tags    text[],                          -- válvula de escape, sem UI própria ainda
  note          text check (char_length(note) <= 120),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, date),
  check (
    num_nonnulls(trained, alcohol, high_sodium, travel, slept_badly) > 0
    or coalesce(array_length(extra_tags, 1), 0) > 0
    or note is not null
  )
);

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists day_markers_touch on day_markers;
create trigger day_markers_touch before update on day_markers
  for each row execute function set_updated_at();

alter table day_markers enable row level security;

drop policy if exists "day_markers_select_own" on day_markers;
create policy "day_markers_select_own" on day_markers
  for select using (auth.uid() = user_id);

drop policy if exists "day_markers_insert_own" on day_markers;
create policy "day_markers_insert_own" on day_markers
  for insert with check (auth.uid() = user_id);

drop policy if exists "day_markers_update_own" on day_markers;
create policy "day_markers_update_own" on day_markers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "day_markers_delete_own" on day_markers;
create policy "day_markers_delete_own" on day_markers
  for delete using (auth.uid() = user_id);
