-- ============================================================
-- Migração: data-alvo opcional para a meta de peso.
-- Rode no SQL Editor do Supabase se você JÁ tinha rodado o schema.sql
-- antigo. Em banco novo (schema.sql atual) não é necessário.
-- É idempotente: pode rodar mais de uma vez sem quebrar nada.
-- ============================================================

alter table user_settings add column if not exists goal_date date;

-- Sem default: enquanto ninguém escolhe uma data em Ajustes, o app só
-- mostra a projeção da tendência, sem a comparação "planejado vs. projetado".
