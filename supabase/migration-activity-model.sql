-- ============================================================
-- Migração: modelo de atividade (NEAT + volume de treino).
-- O fator de atividade deixa de ser uma tabela por "treinos/semana" e passa
-- a somar a rotina fora do treino (NEAT) com o volume de treino (dias ×
-- minutos). Duas colunas novas em user_settings.
-- Rode este script no SQL Editor do Supabase se você JÁ tinha rodado o
-- schema.sql antigo. Em banco novo (schema.sql atual) não é necessário.
-- É idempotente: pode rodar mais de uma vez sem quebrar nada.
-- ============================================================

alter table user_settings
  add column if not exists train_minutes int
    default 60
    check (train_minutes between 0 and 240);

alter table user_settings
  add column if not exists neat_level text
    default 'mostly_sitting'
    check (neat_level in ('sitting', 'mostly_sitting', 'on_feet', 'active', 'laborer'));

-- Linhas antigas assumem o default (60 min, 'mostly_sitting') — o mesmo
-- ponto de partida do primeiro acesso. O usuário ajusta em Ajustes.
