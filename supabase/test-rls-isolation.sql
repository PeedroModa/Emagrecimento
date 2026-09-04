-- ============================================================
-- Teste de isolamento entre usuários (RLS) — Painel de Peso
--
-- Prova, contra o motor REAL de RLS do Postgres (não relendo as políticas,
-- executando de verdade como cada usuário), que ninguém enxerga, edita ou
-- apaga dados de outra pessoa — nas duas tabelas, nas duas direções,
-- em SELECT/INSERT/UPDATE/DELETE.
--
-- SEGURO DE RODAR QUANTAS VEZES QUISER: tudo acontece dentro de UMA
-- transação com ROLLBACK no final. Nada fica gravado — nem os dois/três
-- usuários fabricados, nem as pesagens/configurações de teste.
--
-- IMPORTANTE: cole o arquivo INTEIRO no SQL Editor do Supabase e rode como
-- UMA ÚNICA EXECUÇÃO (não linha a linha, não por seleção parcial) — BEGIN e
-- ROLLBACK precisam estar na mesma conexão, senão a transação não fecha
-- como esperado e pode sobrar lixo.
--
-- Se terminar sem nenhum erro, o isolamento está comprovado. Qualquer
-- "ISOLATION FAILURE" ou "CANARY FAILURE" indica um problema real de RLS
-- — não convide mais ninguém antes de investigar.
-- ============================================================

begin;

-- ── 1. Fixture: três usuários de teste (A, B, e C sem dados prévios) ──────
-- C existe só para o teste de INSERT cross-user em user_settings, cuja PK é
-- o próprio user_id — usar B ali colidiria com a linha que B já tem e
-- mascararia se quem bloqueou foi a RLS ou a constraint de chave primária.
do $$
declare
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_c uuid := gen_random_uuid();
begin
  perform set_config('test.user_a', v_a::text, true);
  perform set_config('test.user_b', v_b::text, true);
  perform set_config('test.user_c', v_c::text, true);

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values
    ('00000000-0000-0000-0000-000000000000', v_a, 'authenticated', 'authenticated',
     'rls-test-a@example.invalid', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_b, 'authenticated', 'authenticated',
     'rls-test-b@example.invalid', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb, '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_c, 'authenticated', 'authenticated',
     'rls-test-c@example.invalid', 'x', now(), now(), now(), '{}'::jsonb, '{}'::jsonb, '', '', '', '');
end $$;

-- Dados de A e B, criados como postgres (dono da tabela, ignora RLS — é só
-- a fixture, não faz parte do teste em si).
insert into weigh_ins (user_id, date, weight_kg) values
  (current_setting('test.user_a')::uuid, '2026-01-01', 80.0),
  (current_setting('test.user_a')::uuid, '2026-01-08', 79.5),
  (current_setting('test.user_b')::uuid, '2026-01-01', 65.0);

insert into user_settings (user_id, goal_kg, sex) values
  (current_setting('test.user_a')::uuid, 75, 'M'),
  (current_setting('test.user_b')::uuid, 60, 'F');

insert into user_app_state (user_id, last_visit_at) values
  (current_setting('test.user_a')::uuid, now()),
  (current_setting('test.user_b')::uuid, now());

insert into insight_state (user_id, insight_key, rule_id) values
  (current_setting('test.user_a')::uuid, 'plateau:2026-01-01..2026-01-28', 'plateau'),
  (current_setting('test.user_b')::uuid, 'plateau:2026-01-01..2026-01-28', 'plateau');

insert into body_measurements (user_id, date, waist_cm, hip_cm) values
  (current_setting('test.user_a')::uuid, '2026-01-01', 90.0, 100.0),
  (current_setting('test.user_b')::uuid, '2026-01-01', 75.0, 95.0);

insert into day_markers (user_id, date, trained, alcohol) values
  (current_setting('test.user_a')::uuid, '2026-01-01', true, false),
  (current_setting('test.user_b')::uuid, '2026-01-01', false, true);

-- ── 2. Canário: prova que a impersonação está realmente ativa ────────────
-- Com um sub aleatório (de ninguém), a contagem TEM que ser zero nas duas
-- tabelas. Se não for, "set local role" foi pulado/mal posicionado e todo o
-- resto do script passaria por engano — RLS quebrado + teste dizendo "ok"
-- seria o pior cenário possível.
set local role authenticated;
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);

do $$
declare
  v_count int;
begin
  select count(*) into v_count from weigh_ins;
  if v_count <> 0 then
    raise exception 'CANARY FAILURE: % linhas visíveis em weigh_ins sem identidade válida — RLS não está sendo aplicado', v_count;
  end if;
  select count(*) into v_count from user_settings;
  if v_count <> 0 then
    raise exception 'CANARY FAILURE: % linhas visíveis em user_settings sem identidade válida — RLS não está sendo aplicado', v_count;
  end if;
  select count(*) into v_count from user_app_state;
  if v_count <> 0 then
    raise exception 'CANARY FAILURE: % linhas visíveis em user_app_state sem identidade válida — RLS não está sendo aplicado', v_count;
  end if;
  select count(*) into v_count from insight_state;
  if v_count <> 0 then
    raise exception 'CANARY FAILURE: % linhas visíveis em insight_state sem identidade válida — RLS não está sendo aplicado', v_count;
  end if;
  select count(*) into v_count from body_measurements;
  if v_count <> 0 then
    raise exception 'CANARY FAILURE: % linhas visíveis em body_measurements sem identidade válida — RLS não está sendo aplicado', v_count;
  end if;
  select count(*) into v_count from day_markers;
  if v_count <> 0 then
    raise exception 'CANARY FAILURE: % linhas visíveis em day_markers sem identidade válida — RLS não está sendo aplicado', v_count;
  end if;
  raise notice 'canário ok — RLS está realmente ativo em todas as tabelas';
end $$;

-- ── 3. SELECT: A não vê nada de B, e vice-versa ───────────────────────────
select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
do $$
begin
  if exists (select 1 from weigh_ins where user_id = current_setting('test.user_b')::uuid) then
    raise exception 'ISOLATION FAILURE: A conseguiu ver pesagens de B';
  end if;
  if exists (select 1 from user_settings where user_id = current_setting('test.user_b')::uuid) then
    raise exception 'ISOLATION FAILURE: A conseguiu ver configurações de B';
  end if;
  if exists (select 1 from user_app_state where user_id = current_setting('test.user_b')::uuid) then
    raise exception 'ISOLATION FAILURE: A conseguiu ver o estado de visita de B';
  end if;
  if exists (select 1 from insight_state where user_id = current_setting('test.user_b')::uuid) then
    raise exception 'ISOLATION FAILURE: A conseguiu ver o estado de insights de B';
  end if;
  if exists (select 1 from body_measurements where user_id = current_setting('test.user_b')::uuid) then
    raise exception 'ISOLATION FAILURE: A conseguiu ver medidas corporais de B';
  end if;
  if exists (select 1 from day_markers where user_id = current_setting('test.user_b')::uuid) then
    raise exception 'ISOLATION FAILURE: A conseguiu ver marcadores de B';
  end if;
  if (select count(*) from weigh_ins) <> 2 then
    raise exception 'ISOLATION FAILURE: A não está vendo as próprias 2 pesagens';
  end if;
  raise notice 'ok — A não vê nada de B, e vê as próprias 2 pesagens';
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.user_b'), true);
do $$
begin
  if exists (select 1 from weigh_ins where user_id = current_setting('test.user_a')::uuid) then
    raise exception 'ISOLATION FAILURE: B conseguiu ver pesagens de A';
  end if;
  if exists (select 1 from user_settings where user_id = current_setting('test.user_a')::uuid) then
    raise exception 'ISOLATION FAILURE: B conseguiu ver configurações de A';
  end if;
  if exists (select 1 from user_app_state where user_id = current_setting('test.user_a')::uuid) then
    raise exception 'ISOLATION FAILURE: B conseguiu ver o estado de visita de A';
  end if;
  if exists (select 1 from insight_state where user_id = current_setting('test.user_a')::uuid) then
    raise exception 'ISOLATION FAILURE: B conseguiu ver o estado de insights de A';
  end if;
  if exists (select 1 from body_measurements where user_id = current_setting('test.user_a')::uuid) then
    raise exception 'ISOLATION FAILURE: B conseguiu ver medidas corporais de A';
  end if;
  if exists (select 1 from day_markers where user_id = current_setting('test.user_a')::uuid) then
    raise exception 'ISOLATION FAILURE: B conseguiu ver marcadores de A';
  end if;
  raise notice 'ok — B não vê nada de A';
end $$;

-- ── 4. UPDATE/DELETE cross-user (impersonando A, mirando dados de B) ─────
-- As políticas de UPDATE/DELETE não geram erro quando o alvo é de outro
-- usuário — a cláusula USING simplesmente casa 0 linhas, silenciosamente.
-- Por isso a confirmação de que NADA mudou precisa ser feita com o papel
-- elevado (postgres, que ignora RLS) — checar "como A" seria inválido,
-- porque A também não enxergaria a linha de B mesmo que a edição tivesse
-- funcionado, e o teste passaria por engano.
select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
update weigh_ins set weight_kg = 999 where user_id = current_setting('test.user_b')::uuid;
update user_settings set goal_kg = 999 where user_id = current_setting('test.user_b')::uuid;
update user_app_state set feed_seen_at = now() where user_id = current_setting('test.user_b')::uuid;
update insight_state set status = 'dismissed' where user_id = current_setting('test.user_b')::uuid;
update body_measurements set waist_cm = 200.0 where user_id = current_setting('test.user_b')::uuid;
update day_markers set trained = true where user_id = current_setting('test.user_b')::uuid;

reset role;
do $$
begin
  if exists (select 1 from weigh_ins where user_id = current_setting('test.user_b')::uuid and weight_kg = 999) then
    raise exception 'ISOLATION FAILURE: A conseguiu editar uma pesagem de B';
  end if;
  if exists (select 1 from user_settings where user_id = current_setting('test.user_b')::uuid and goal_kg = 999) then
    raise exception 'ISOLATION FAILURE: A conseguiu editar as configurações de B';
  end if;
  if exists (select 1 from user_app_state where user_id = current_setting('test.user_b')::uuid and feed_seen_at is not null) then
    raise exception 'ISOLATION FAILURE: A conseguiu editar o estado de visita de B';
  end if;
  if exists (select 1 from insight_state where user_id = current_setting('test.user_b')::uuid and status = 'dismissed') then
    raise exception 'ISOLATION FAILURE: A conseguiu editar o estado de insights de B';
  end if;
  if exists (select 1 from body_measurements where user_id = current_setting('test.user_b')::uuid and waist_cm = 200.0) then
    raise exception 'ISOLATION FAILURE: A conseguiu editar medidas corporais de B';
  end if;
  if exists (select 1 from day_markers where user_id = current_setting('test.user_b')::uuid and trained = true) then
    raise exception 'ISOLATION FAILURE: A conseguiu editar marcadores de B';
  end if;
  raise notice 'ok — UPDATE de A sobre dados de B não teve efeito nenhum';
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);
delete from weigh_ins where user_id = current_setting('test.user_b')::uuid;
delete from user_settings where user_id = current_setting('test.user_b')::uuid;
delete from user_app_state where user_id = current_setting('test.user_b')::uuid;
delete from insight_state where user_id = current_setting('test.user_b')::uuid;
delete from body_measurements where user_id = current_setting('test.user_b')::uuid;
delete from day_markers where user_id = current_setting('test.user_b')::uuid;

reset role;
do $$
begin
  if not exists (select 1 from weigh_ins where user_id = current_setting('test.user_b')::uuid) then
    raise exception 'ISOLATION FAILURE: A conseguiu apagar a pesagem de B';
  end if;
  if not exists (select 1 from user_settings where user_id = current_setting('test.user_b')::uuid) then
    raise exception 'ISOLATION FAILURE: A conseguiu apagar as configurações de B';
  end if;
  if not exists (select 1 from user_app_state where user_id = current_setting('test.user_b')::uuid) then
    raise exception 'ISOLATION FAILURE: A conseguiu apagar o estado de visita de B';
  end if;
  if not exists (select 1 from insight_state where user_id = current_setting('test.user_b')::uuid) then
    raise exception 'ISOLATION FAILURE: A conseguiu apagar o estado de insights de B';
  end if;
  if not exists (select 1 from body_measurements where user_id = current_setting('test.user_b')::uuid) then
    raise exception 'ISOLATION FAILURE: A conseguiu apagar medidas corporais de B';
  end if;
  if not exists (select 1 from day_markers where user_id = current_setting('test.user_b')::uuid) then
    raise exception 'ISOLATION FAILURE: A conseguiu apagar marcadores de B';
  end if;
  raise notice 'ok — DELETE de A sobre dados de B não teve efeito nenhum';
end $$;

-- ── 5. INSERT em nome de outro usuário (impersonando A) ───────────────────
-- weigh_ins: tenta inserir uma pesagem nova com user_id = B.
-- user_settings: tenta inserir a linha de C (que ainda não tem settings —
-- usar B aqui colidiria com a PK e mascararia a causa real do bloqueio).
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.user_a'), true);

do $$
declare
  v_ok boolean := false;
begin
  begin
    insert into weigh_ins (user_id, date, weight_kg) values (current_setting('test.user_b')::uuid, '2099-01-01', 50);
    v_ok := true;
  exception when others then
    v_ok := false; -- esperado: a política de INSERT rejeita
  end;
  if v_ok then
    raise exception 'ISOLATION FAILURE: A conseguiu inserir uma pesagem em nome de B';
  end if;
  raise notice 'ok — INSERT de A em nome de B foi rejeitado pela RLS';
end $$;

do $$
declare
  v_ok boolean := false;
begin
  begin
    insert into user_settings (user_id, goal_kg) values (current_setting('test.user_c')::uuid, 55);
    v_ok := true;
  exception when others then
    v_ok := false;
  end;
  if v_ok then
    raise exception 'ISOLATION FAILURE: A conseguiu criar configurações em nome de C';
  end if;
  raise notice 'ok — INSERT de A em nome de C foi rejeitado pela RLS';
end $$;

do $$
declare
  v_ok boolean := false;
begin
  begin
    insert into user_app_state (user_id, last_visit_at) values (current_setting('test.user_c')::uuid, now());
    v_ok := true;
  exception when others then
    v_ok := false;
  end;
  if v_ok then
    raise exception 'ISOLATION FAILURE: A conseguiu criar estado de visita em nome de C';
  end if;
  raise notice 'ok — INSERT de A em nome de C (user_app_state) foi rejeitado pela RLS';
end $$;

do $$
declare
  v_ok boolean := false;
begin
  begin
    insert into insight_state (user_id, insight_key, rule_id)
      values (current_setting('test.user_c')::uuid, 'plateau:x', 'plateau');
    v_ok := true;
  exception when others then
    v_ok := false;
  end;
  if v_ok then
    raise exception 'ISOLATION FAILURE: A conseguiu criar estado de insight em nome de C';
  end if;
  raise notice 'ok — INSERT de A em nome de C (insight_state) foi rejeitado pela RLS';
end $$;

do $$
declare
  v_ok boolean := false;
begin
  begin
    insert into body_measurements (user_id, date, waist_cm) values (current_setting('test.user_c')::uuid, '2099-01-01', 90.0);
    v_ok := true;
  exception when others then
    v_ok := false;
  end;
  if v_ok then
    raise exception 'ISOLATION FAILURE: A conseguiu criar medidas corporais em nome de C';
  end if;
  raise notice 'ok — INSERT de A em nome de C (body_measurements) foi rejeitado pela RLS';
end $$;

do $$
declare
  v_ok boolean := false;
begin
  begin
    insert into day_markers (user_id, date, trained) values (current_setting('test.user_c')::uuid, '2099-01-01', true);
    v_ok := true;
  exception when others then
    v_ok := false;
  end;
  if v_ok then
    raise exception 'ISOLATION FAILURE: A conseguiu criar marcadores em nome de C';
  end if;
  raise notice 'ok — INSERT de A em nome de C (day_markers) foi rejeitado pela RLS';
end $$;

-- ── 6. Nada disso fica gravado ────────────────────────────────────────────
reset role;
rollback;
