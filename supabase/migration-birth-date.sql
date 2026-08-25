-- ============================================================
-- Migração: idade deixa de ser fixa e passa a vir da data de nascimento.
-- Rode este script no SQL Editor do Supabase se você JÁ tinha rodado o
-- schema.sql antigo. Em banco novo (schema.sql atual) não é necessário.
-- É idempotente: pode rodar mais de uma vez sem quebrar nada.
-- ============================================================

alter table user_settings add column if not exists birth_date date;

-- A coluna `age` continua existindo como espelho/fallback:
-- quando birth_date está preenchida, o app recalcula `age` sozinho a cada carga.
