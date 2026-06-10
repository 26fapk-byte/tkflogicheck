-- ==========================================
-- TKF LOGICHECK - SISTEMA DE CHECKLIST OPERACIONAL
-- SCRIPT DE CONFIGURAÇÃO DE BANCO DE DADOS (SUPABASE SQL)
-- ==========================================

-- 1. Criação da tabela registros_checklist
CREATE TABLE IF NOT EXISTS public.registros_checklist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    data DATE DEFAULT current_date NOT NULL,
    hora TIME DEFAULT (current_time AT TIME ZONE 'UTC') NOT NULL,
    operador VARCHAR(255) NOT NULL,
    equipamento VARCHAR(255) NOT NULL,
    item VARCHAR(255) NOT NULL,
    status VARCHAR(10) CHECK (status IN ('OK', 'NOK')) NOT NULL,
    observacao TEXT DEFAULT '' NOT NULL,
    user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Ativação de RLS (Row Level Security) para segurança cibernética
ALTER TABLE public.registros_checklist ENABLE ROW LEVEL SECURITY;

-- 3. Criação de políticas (Policies) de acesso
-- Permite que operadores autenticados insiram novos registros
CREATE POLICY "Permite insercoes para operadores autenticados" 
ON public.registros_checklist 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Permite que operadores e gerentes visualizem todos os registros da frota
CREATE POLICY "Permite leitura geral para usuarios autenticados" 
ON public.registros_checklist 
FOR SELECT 
TO authenticated 
USING (true);

-- Permite deleção/reparação apenas por administradores ou gerentes se for desejado (Opcional - por padrão bloqueado)

-- 4. Criação de índices para otimização de buscas operacionais no BI e Power BI
CREATE INDEX IF NOT EXISTS idx_checklist_data_equipamento ON public.registros_checklist (data, equipamento);
CREATE INDEX IF NOT EXISTS idx_checklist_status ON public.registros_checklist (status);
CREATE INDEX IF NOT EXISTS idx_checklist_operador ON public.registros_checklist (operador);

-- 5. Tabela de Checklist Preventivo (novo módulo)
CREATE TABLE IF NOT EXISTS public.checklist_preventivo (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    data DATE NOT NULL,
    hora TIME NOT NULL,
    operador VARCHAR(255) NOT NULL,
    equipamento VARCHAR(255) NOT NULL,
    patrimonio VARCHAR(120) NOT NULL,
    horimetro NUMERIC(12,2) NOT NULL,
    bateria_barras INT NOT NULL,
    observacoes_gerais TEXT DEFAULT '' NOT NULL,
    assinatura_nome VARCHAR(255) NOT NULL,
    assinatura_confirmada BOOLEAN DEFAULT false NOT NULL,
    status_geral VARCHAR(10) CHECK (status_geral IN ('OK', 'NOK')) NOT NULL,
    itens JSONB NOT NULL,
    user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.checklist_preventivo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_preventivo_insert_auth"
ON public.checklist_preventivo
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "checklist_preventivo_select_auth"
ON public.checklist_preventivo
FOR SELECT TO authenticated
USING (true);

CREATE INDEX IF NOT EXISTS idx_checklist_preventivo_data ON public.checklist_preventivo (data, patrimonio);

-- 6. Tabela de Abastecimento de Água e Recarga
CREATE TABLE IF NOT EXISTS public.abastecimento_recarga_bateria (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    data DATE NOT NULL,
    patrimonio VARCHAR(120) NOT NULL,
    horimetro NUMERIC(12,2) NOT NULL,
    operador_inicio VARCHAR(255) NOT NULL,
    operador_termino VARCHAR(255) NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_termino TIME NOT NULL,
    carregador_status VARCHAR(10) CHECK (carregador_status IN ('OK', 'NOK')) NOT NULL,
    reposicao_agua BOOLEAN DEFAULT false NOT NULL,
    responsavel_reposicao VARCHAR(255) DEFAULT '' NOT NULL,
    observacoes TEXT DEFAULT '' NOT NULL,
    assinatura_nome VARCHAR(255) NOT NULL,
    assinatura_confirmada BOOLEAN DEFAULT false NOT NULL,
    user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.abastecimento_recarga_bateria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "abastecimento_insert_auth"
ON public.abastecimento_recarga_bateria
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "abastecimento_select_auth"
ON public.abastecimento_recarga_bateria
FOR SELECT TO authenticated
USING (true);

CREATE INDEX IF NOT EXISTS idx_abastecimento_data ON public.abastecimento_recarga_bateria (data, patrimonio);

-- 7. Tabela de Equipamentos / Frota
CREATE TABLE IF NOT EXISTS public.equipamentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    nome VARCHAR(255) NOT NULL,
    patrimonio VARCHAR(120) NOT NULL UNIQUE,
    tipo VARCHAR(120) NOT NULL,
    ativo BOOLEAN DEFAULT true NOT NULL,
    user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipamentos_insert_auth"
ON public.equipamentos
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "equipamentos_select_auth"
ON public.equipamentos
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "equipamentos_update_auth"
ON public.equipamentos
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_equipamentos_patrimonio ON public.equipamentos (patrimonio);
CREATE INDEX IF NOT EXISTS idx_equipamentos_ativo ON public.equipamentos (ativo);

-- 8. Tabela de Histórico Unificado de Inspeções (Checklist Padrão)
CREATE TABLE IF NOT EXISTS public.historico_inspecoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    data DATE NOT NULL,
    hora TIME NOT NULL,
    operador VARCHAR(255) NOT NULL,
    equipamento VARCHAR(255) NOT NULL,
    patrimonio VARCHAR(120) NOT NULL,
    horimetro NUMERIC(12,2) NOT NULL,
    ligando VARCHAR(10) NOT NULL,
    bateria_barras INT NOT NULL,
    status_geral VARCHAR(10) CHECK (status_geral IN ('OK', 'NOK')) NOT NULL,
    itens JSONB NOT NULL,
    observacao_geral TEXT DEFAULT '' NOT NULL,
    user_id UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.historico_inspecoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permite insercoes para operadores autenticados" 
ON public.historico_inspecoes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Permite leitura geral para usuarios autenticados" 
ON public.historico_inspecoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permite delecao para gerentes e master" 
ON public.historico_inspecoes FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.perfis_usuarios
    WHERE perfis_usuarios.id = auth.uid()
    AND perfis_usuarios.nivel_acesso IN ('gerente', 'master')
  )
);

-- 9. Instruções Adicionais de Conectividade
-- Cole as seguintes variáveis no painel de segredos do Vercel ou no arquivo .env local:
-- VITE_SUPABASE_URL=Sua_URL_do_Projeto_Supabase
-- VITE_SUPABASE_ANON_KEY=Sua_Chave_Anonima_do_Projeto_Supabase

