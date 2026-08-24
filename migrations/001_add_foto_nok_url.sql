-- Migration 001: adiciona coluna foto_nok_url na tabela de recarga de bateria.
-- Sem esta coluna, registros de recarga com foto NOK falham ao sincronizar
-- (erro PGRST204 - coluna inexistente) e ficam presos na fila de sincronizacao.
-- Execute no SQL Editor do Supabase.

ALTER TABLE public.abastecimento_recarga_bateria
    ADD COLUMN IF NOT EXISTS foto_nok_url TEXT;
