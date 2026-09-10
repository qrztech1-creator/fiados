-- ============================================================
-- QRZ FOOD — SUPABASE SETUP
-- Schema completo para gestão de fiados multi-tenant
-- ============================================================

-- 1. TABELA: clients (empresas/padarias gerenciadas)
CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    email TEXT,
    password_hash TEXT NOT NULL,
    color TEXT DEFAULT '#e8590c',
    name_map JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABELA: records (lançamentos de fiados)
CREATE TABLE IF NOT EXISTS public.records (
    id SERIAL PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    indice INTEGER,
    banco TEXT,
    banco_normalized TEXT,
    fatura TEXT,
    historico TEXT,
    valor NUMERIC(12,2) DEFAULT 0,
    saldo_atual NUMERIC(12,2) DEFAULT 0,
    data_emissao TIMESTAMPTZ,
    usuario TEXT,
    parcela TEXT,
    batch TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(client_id, indice)
);

-- 3. TABELA: payments (baixas/cobranças registradas)
CREATE TABLE IF NOT EXISTS public.payments (
    id SERIAL PRIMARY KEY,
    record_id INTEGER NOT NULL REFERENCES public.records(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    note TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABELA: import_logs (histórico de importações)
CREATE TABLE IF NOT EXISTS public.import_logs (
    id SERIAL PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    filename TEXT,
    record_count INTEGER,
    imported_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_records_client ON public.records(client_id);
CREATE INDEX IF NOT EXISTS idx_records_indice ON public.records(client_id, indice);
CREATE INDEX IF NOT EXISTS idx_records_banco ON public.records(client_id, banco_normalized);
CREATE INDEX IF NOT EXISTS idx_payments_record ON public.payments(record_id);
CREATE INDEX IF NOT EXISTS idx_payments_client ON public.payments(client_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

-- clients: leitura pública (para login do cliente), escrita só admin
CREATE POLICY "clients_read" ON public.clients FOR SELECT USING (true);
CREATE POLICY "clients_insert" ON public.clients FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "clients_update" ON public.clients FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "clients_delete" ON public.clients FOR DELETE USING (auth.role() = 'authenticated');

-- records: leitura pública, escrita só admin
CREATE POLICY "records_read" ON public.records FOR SELECT USING (true);
CREATE POLICY "records_insert" ON public.records FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "records_update" ON public.records FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "records_delete" ON public.records FOR DELETE USING (auth.role() = 'authenticated');

-- payments: leitura e escrita pública (clientes registram baixas sem auth)
CREATE POLICY "payments_read" ON public.payments FOR SELECT USING (true);
CREATE POLICY "payments_insert" ON public.payments FOR INSERT WITH CHECK (true);
CREATE POLICY "payments_update" ON public.payments FOR UPDATE USING (true);
CREATE POLICY "payments_delete" ON public.payments FOR DELETE USING (true);

-- import_logs: somente admin
CREATE POLICY "logs_read" ON public.import_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "logs_insert" ON public.import_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- FUNÇÕES RPC
-- ============================================================

-- Retorna info do cliente para login (só senha hash + config visual)
CREATE OR REPLACE FUNCTION public.get_client_auth(p_client_id TEXT)
RETURNS JSON AS $$
    SELECT row_to_json(t) FROM (
        SELECT password_hash, name, short_name, color, name_map, email
        FROM public.clients WHERE id = p_client_id
    ) t;
$$ LANGUAGE sql SECURITY DEFINER;

-- Conta registros por cliente (para o admin)
CREATE OR REPLACE FUNCTION public.count_client_records(p_client_id TEXT)
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER FROM public.records WHERE client_id = p_client_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Soma total de saldo por cliente
CREATE OR REPLACE FUNCTION public.sum_client_balance(p_client_id TEXT)
RETURNS NUMERIC AS $$
    SELECT COALESCE(SUM(saldo_atual), 0) FROM public.records WHERE client_id = p_client_id;
$$ LANGUAGE sql SECURITY DEFINER;
