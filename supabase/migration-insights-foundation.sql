-- ============================================================
-- V2 — Etapa 0: fundação para o motor de descobertas.
--
-- Cria o que a V2 precisa que HOJE nada no schema oferece:
--   1. updated_at automático em weigh_ins (trigger) — sem isso,
--      substituir uma pesagem (addOrReplace) deixa o timestamp
--      congelado no valor do insert original, e "o que mudou desde
--      a última visita" fica cego a substituições.
--   2. user_app_state — quando foi a penúltima visita, para o feed
--      comparar contra ela (não contra a última, que acabou de virar
--      "agora").
--   3. insight_state — o que o usuário já viu/dispensou no feed de
--      descobertas, para não repetir e para ordenar por novidade.
--
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- Rode no SQL Editor do Supabase, num projeto que já tenha
-- schema.sql aplicado.
-- ============================================================

-- ── 1. updated_at automático ─────────────────────────────────
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists weigh_ins_touch on weigh_ins;
create trigger weigh_ins_touch before update on weigh_ins
  for each row execute function set_updated_at();

-- ── 2. Estado de visita ───────────────────────────────────────
create table if not exists user_app_state (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  last_visit_at     timestamptz,
  previous_visit_at timestamptz,
  feed_seen_at      timestamptz,
  updated_at        timestamptz not null default now()
);

drop trigger if exists user_app_state_touch on user_app_state;
create trigger user_app_state_touch before update on user_app_state
  for each row execute function set_updated_at();

alter table user_app_state enable row level security;

drop policy if exists "user_app_state_select_own" on user_app_state;
create policy "user_app_state_select_own" on user_app_state
  for select using (auth.uid() = user_id);

drop policy if exists "user_app_state_insert_own" on user_app_state;
create policy "user_app_state_insert_own" on user_app_state
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_app_state_update_own" on user_app_state;
create policy "user_app_state_update_own" on user_app_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_app_state_delete_own" on user_app_state;
create policy "user_app_state_delete_own" on user_app_state
  for delete using (auth.uid() = user_id);

-- ── 3. Estado do feed de descobertas ─────────────────────────
-- insight_key = "<regra>:<escopo>" (ex.: "plateau:2026-08-05..2026-09-02"),
-- nunca só o id da regra — senão dispensar "platô" uma vez silenciaria
-- todo platô futuro, de qualquer janela.
create table if not exists insight_state (
  user_id       uuid not null references auth.users(id) on delete cascade,
  insight_key   text not null,
  rule_id       text not null,
  rule_version  int  not null default 1,
  status        text not null default 'seen' check (status in ('seen','dismissed','pinned')),
  payload_hash  text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  dismissed_at  timestamptz,
  primary key (user_id, insight_key)
);

create index if not exists insight_state_user_rule_idx on insight_state (user_id, rule_id);

alter table insight_state enable row level security;

drop policy if exists "insight_state_select_own" on insight_state;
create policy "insight_state_select_own" on insight_state
  for select using (auth.uid() = user_id);

drop policy if exists "insight_state_insert_own" on insight_state;
create policy "insight_state_insert_own" on insight_state
  for insert with check (auth.uid() = user_id);

drop policy if exists "insight_state_update_own" on insight_state;
create policy "insight_state_update_own" on insight_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "insight_state_delete_own" on insight_state;
create policy "insight_state_delete_own" on insight_state
  for delete using (auth.uid() = user_id);
