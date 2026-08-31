-- ============================================================
-- Migração: contexto da variação (tags opcionais por pesagem).
-- Rode este script no SQL Editor do Supabase se você JÁ tinha rodado o
-- schema.sql antigo. Em banco novo (schema.sql atual) não é necessário.
-- É idempotente: pode rodar mais de uma vez sem quebrar nada.
-- ============================================================

alter table weigh_ins add column if not exists context_tags text[];

-- NULL = nunca perguntado; '{}' = perguntado, usuário pulou;
-- {a,b} = perguntado, usuário marcou até 2 tags.
