-- ==============================================================================
-- MIGRAÇÃO DE BANCO DE DADOS: AUTOMAÇÃO DE APOSTAS LOTOSMART
-- Etapas 1, 2 e 3
-- ==============================================================================

-- ==========================================
-- ETAPA 1: CORREÇÃO DE BUGS EM DADOS LEGADOS
-- ==========================================
-- Converte a string duplamente serializada para array JSONB nativo 
-- (Onde jsonb_typeof(games) é 'string')
UPDATE public.bets 
SET games = games::text::jsonb 
WHERE jsonb_typeof(games) = 'string';


-- ==========================================
-- ETAPA 2: EVOLUÇÃO DA TABELA BETS
-- ==========================================
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS automation_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS automation_requested_at TIMESTAMPTZ;
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS automation_completed_at TIMESTAMPTZ;
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS external_protocol TEXT;

-- Adiciona a constraint de validação de status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'bets_automation_status_check'
    ) THEN
        ALTER TABLE public.bets ADD CONSTRAINT bets_automation_status_check 
        CHECK (automation_status IN ('none','queued','processing','submitted','completed','failed','cancelled'));
    END IF;
END $$;


-- ==========================================
-- ETAPA 3: CRIAÇÃO DA AUTOMATION_QUEUE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.automation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bet_id UUID NOT NULL REFERENCES public.bets(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued',
    scheduled_at TIMESTAMPTZ DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    last_error TEXT,
    worker_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT automation_queue_status_check CHECK (status IN ('queued', 'processing', 'submitted', 'completed', 'failed', 'cancelled'))
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_automation_queue_status ON public.automation_queue(status);
CREATE INDEX IF NOT EXISTS idx_automation_queue_owner ON public.automation_queue(owner_id);
CREATE INDEX IF NOT EXISTS idx_automation_queue_bet_id ON public.automation_queue(bet_id);

-- RLS
ALTER TABLE public.automation_queue ENABLE ROW LEVEL SECURITY;

-- Policy 1: Usuário vê e atualiza apenas suas tarefas
DROP POLICY IF EXISTS "Usuário gerencia sua própria fila de automação" ON public.automation_queue;
CREATE POLICY "Usuário gerencia sua própria fila de automação"
    ON public.automation_queue FOR ALL TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- Policy 2: Super Admin tem acesso total
DROP POLICY IF EXISTS "Super admin acesso total a automation_queue" ON public.automation_queue;
CREATE POLICY "Super admin acesso total a automation_queue"
    ON public.automation_queue FOR ALL TO authenticated
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));

-- ==========================================
-- FUNÇÃO RPC: claim_next_job
-- ==========================================
-- Função atômica para o worker capturar uma tarefa sem concorrência
CREATE OR REPLACE FUNCTION public.claim_next_job(p_worker_id TEXT)
RETURNS SETOF public.automation_queue
LANGUAGE plpgsql
SECURITY DEFINER -- Necessário para rodar com permissões elevadas internas
AS $$
DECLARE
    v_job_id UUID;
BEGIN
    -- Busca e bloqueia a próxima tarefa pendente
    SELECT id INTO v_job_id
    FROM public.automation_queue
    WHERE status = 'queued'
      AND scheduled_at <= now()
    ORDER BY scheduled_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- Se encontrou uma tarefa, atualiza para processing e retorna
    IF v_job_id IS NOT NULL THEN
        RETURN QUERY
        UPDATE public.automation_queue
        SET status = 'processing',
            started_at = now(),
            worker_id = p_worker_id
        WHERE id = v_job_id
        RETURNING *;
    END IF;
END;
$$;
