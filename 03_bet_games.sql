-- ==============================================================================
-- MIGRAÇÃO: bet_games - Tabela filha 1:N para rastreamento individual de jogos
-- Execute este script no SQL Editor do Supabase
-- ==============================================================================

-- ==========================================
-- 1. CRIAÇÃO DA TABELA bet_games
-- ==========================================
CREATE TABLE IF NOT EXISTS public.bet_games (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bet_id          UUID NOT NULL REFERENCES public.bets(id) ON DELETE CASCADE,
    owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lottery_type    TEXT NOT NULL,
    numbers         JSONB NOT NULL,           -- ex: [2, 5, 8, 11, 14, 17, 20, 23, 25, 1, 3, 7, 10, 12, 15]
    game_index      INTEGER NOT NULL,         -- posição do jogo dentro do lote (0-based)
    status          TEXT NOT NULL DEFAULT 'pendente',
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    completed_at    TIMESTAMPTZ,

    CONSTRAINT bet_games_status_check CHECK (
        status IN (
            'pendente',           -- aguardando o robô
            'processando',        -- robô está trabalhando
            'sucesso',            -- registrado com sucesso na Caixa
            'erro',               -- falhou ao registrar
            'pendente_lancamento',-- aguardando lançamento financeiro
            'lancado'             -- já lançado no financeiro
        )
    )
);

-- ==========================================
-- 2. ÍNDICES DE PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_bet_games_bet_id      ON public.bet_games(bet_id);
CREATE INDEX IF NOT EXISTS idx_bet_games_owner_id    ON public.bet_games(owner_id);
CREATE INDEX IF NOT EXISTS idx_bet_games_status      ON public.bet_games(status);
CREATE INDEX IF NOT EXISTS idx_bet_games_lottery     ON public.bet_games(lottery_type);

-- ==========================================
-- 3. TRIGGER: atualiza updated_at automaticamente
-- ==========================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bet_games_updated_at ON public.bet_games;
CREATE TRIGGER trg_bet_games_updated_at
    BEFORE UPDATE ON public.bet_games
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==========================================
-- 4. RLS - ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE public.bet_games ENABLE ROW LEVEL SECURITY;

-- Usuário vê e modifica apenas os seus próprios jogos
DROP POLICY IF EXISTS "Usuario gerencia seus bet_games" ON public.bet_games;
CREATE POLICY "Usuario gerencia seus bet_games"
    ON public.bet_games FOR ALL TO authenticated
    USING   (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- Super admin tem acesso total
DROP POLICY IF EXISTS "Super admin acesso total a bet_games" ON public.bet_games;
CREATE POLICY "Super admin acesso total a bet_games"
    ON public.bet_games FOR ALL TO authenticated
    USING   (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));

-- Worker (service_role) pode ler e atualizar (não precisa de policy pois service_role ignora RLS)

-- ==========================================
-- 5. SUPABASE REALTIME
-- ==========================================
-- Garante que as atualizações de linha completas sejam enviadas ao cliente
ALTER TABLE public.bet_games REPLICA IDENTITY FULL;

-- Adiciona a tabela à publicação do Realtime
-- (O Supabase já tem a publicação 'supabase_realtime' por padrão)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'bet_games'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bet_games;
    END IF;
END
$$;
