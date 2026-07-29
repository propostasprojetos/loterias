-- ==============================================================================
-- 05_bolao.sql
-- Módulo de Bolão — LotoSmart
-- Branch: homologacao
-- Execute no SQL Editor do Supabase após os scripts 01 a 04.
-- ==============================================================================

-- ==============================================================================
-- ETAPA 1: CRIAÇÃO DAS TABELAS
-- ==============================================================================

-- -----------------------------------------------------------------------
-- 1.1 boloes
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.boloes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome        TEXT NOT NULL,
    descricao   TEXT,
    ativo       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- 1.2 participantes
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.participantes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bolao_id    UUID NOT NULL REFERENCES public.boloes(id) ON DELETE CASCADE,
    nome        TEXT NOT NULL,
    telefone    TEXT,
    ativo       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- 1.3 jogo_participantes  (relacionamento N:N bets <-> participantes)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jogo_participantes (
    owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bet_id          UUID NOT NULL REFERENCES public.bets(id) ON DELETE CASCADE,
    participante_id UUID NOT NULL REFERENCES public.participantes(id) ON DELETE RESTRICT,
    percentual      NUMERIC(5,2) NOT NULL DEFAULT 100,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (bet_id, participante_id),

    CONSTRAINT jogo_participantes_percentual_pos   CHECK (percentual > 0),
    CONSTRAINT jogo_participantes_percentual_max   CHECK (percentual <= 100)
);

-- -----------------------------------------------------------------------
-- 1.4 premios_participantes  (persistência do cálculo dos prêmios)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.premios_participantes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bet_id          UUID NOT NULL REFERENCES public.bets(id) ON DELETE CASCADE,
    participante_id UUID NOT NULL REFERENCES public.participantes(id) ON DELETE RESTRICT,
    premio_total    NUMERIC(15,2) NOT NULL,
    percentual      NUMERIC(5,2)  NOT NULL,
    premio_recebido NUMERIC(15,2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------
-- 1.5 Adicionar bolao_id na tabela bets (nullable — retrocompatível)
-- -----------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'bets'
          AND column_name  = 'bolao_id'
    ) THEN
        ALTER TABLE public.bets
            ADD COLUMN bolao_id UUID NULL REFERENCES public.boloes(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ==============================================================================
-- ETAPA 2: ÍNDICES
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_boloes_owner         ON public.boloes(owner_id);
CREATE INDEX IF NOT EXISTS idx_participantes_bolao  ON public.participantes(bolao_id);
CREATE INDEX IF NOT EXISTS idx_participantes_owner  ON public.participantes(owner_id);
CREATE INDEX IF NOT EXISTS idx_jp_bet               ON public.jogo_participantes(bet_id);
CREATE INDEX IF NOT EXISTS idx_jp_participante      ON public.jogo_participantes(participante_id);
CREATE INDEX IF NOT EXISTS idx_jp_owner             ON public.jogo_participantes(owner_id);
CREATE INDEX IF NOT EXISTS idx_pp_bet               ON public.premios_participantes(bet_id);
CREATE INDEX IF NOT EXISTS idx_pp_participante      ON public.premios_participantes(participante_id);
CREATE INDEX IF NOT EXISTS idx_pp_owner             ON public.premios_participantes(owner_id);
CREATE INDEX IF NOT EXISTS idx_bets_bolao           ON public.bets(bolao_id);

-- ==============================================================================
-- ETAPA 3: ROW LEVEL SECURITY
-- ==============================================================================

ALTER TABLE public.boloes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participantes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jogo_participantes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premios_participantes ENABLE ROW LEVEL SECURITY;

-- ---------- boloes ----------
DROP POLICY IF EXISTS "Usuario gerencia seus boloes"         ON public.boloes;
DROP POLICY IF EXISTS "Super admin acesso total a boloes"    ON public.boloes;

CREATE POLICY "Usuario gerencia seus boloes"
    ON public.boloes FOR ALL TO authenticated
    USING   (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Super admin acesso total a boloes"
    ON public.boloes FOR ALL TO authenticated
    USING   (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));

-- ---------- participantes ----------
DROP POLICY IF EXISTS "Usuario gerencia seus participantes"         ON public.participantes;
DROP POLICY IF EXISTS "Super admin acesso total a participantes"    ON public.participantes;

CREATE POLICY "Usuario gerencia seus participantes"
    ON public.participantes FOR ALL TO authenticated
    USING   (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Super admin acesso total a participantes"
    ON public.participantes FOR ALL TO authenticated
    USING   (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));

-- ---------- jogo_participantes ----------
DROP POLICY IF EXISTS "Usuario gerencia seus jogo_participantes"       ON public.jogo_participantes;
DROP POLICY IF EXISTS "Super admin acesso total a jogo_participantes"  ON public.jogo_participantes;

CREATE POLICY "Usuario gerencia seus jogo_participantes"
    ON public.jogo_participantes FOR ALL TO authenticated
    USING   (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Super admin acesso total a jogo_participantes"
    ON public.jogo_participantes FOR ALL TO authenticated
    USING   (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));

-- ---------- premios_participantes ----------
DROP POLICY IF EXISTS "Usuario gerencia seus premios_participantes"       ON public.premios_participantes;
DROP POLICY IF EXISTS "Super admin acesso total a premios_participantes"  ON public.premios_participantes;

CREATE POLICY "Usuario gerencia seus premios_participantes"
    ON public.premios_participantes FOR ALL TO authenticated
    USING   (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Super admin acesso total a premios_participantes"
    ON public.premios_participantes FOR ALL TO authenticated
    USING   (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));

-- ==============================================================================
-- ETAPA 4: TRIGGERS E FUNÇÕES DE INTEGRIDADE
-- ==============================================================================

-- -----------------------------------------------------------------------
-- Trigger 1 — Validação da soma de percentuais (deve ser exatamente 100)
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_validar_percentual_bolao()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_soma NUMERIC;
BEGIN
    -- Soma os percentuais de todos os participantes desta aposta,
    -- incluindo o novo/alterado registro
    SELECT COALESCE(SUM(percentual), 0)
    INTO v_soma
    FROM public.jogo_participantes
    WHERE bet_id = NEW.bet_id;

    IF v_soma > 100 THEN
        RAISE EXCEPTION
            'A soma dos percentuais dos participantes da aposta % é % %%, mas não pode ultrapassar 100%%.',
            NEW.bet_id, v_soma;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_percentual ON public.jogo_participantes;
CREATE TRIGGER trg_validar_percentual
    AFTER INSERT OR UPDATE ON public.jogo_participantes
    FOR EACH ROW EXECUTE FUNCTION public.fn_validar_percentual_bolao();

-- -----------------------------------------------------------------------
-- Trigger 2 — Consistência: participante deve pertencer ao mesmo bolão
--             da aposta; sem duplicata; owner_id consistente.
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_validar_consistencia_bolao()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_bolao_bet         UUID;
    v_bolao_participante UUID;
    v_owner_bet         UUID;
    v_owner_part        UUID;
BEGIN
    -- Busca bolao_id e owner_id da aposta
    SELECT bolao_id, owner_id
    INTO v_bolao_bet, v_owner_bet
    FROM public.bets
    WHERE id = NEW.bet_id;

    -- Busca bolao_id e owner_id do participante
    SELECT bolao_id, owner_id
    INTO v_bolao_participante, v_owner_part
    FROM public.participantes
    WHERE id = NEW.participante_id;

    -- Verifica owner_id consistente
    IF v_owner_bet IS DISTINCT FROM NEW.owner_id THEN
        RAISE EXCEPTION
            'owner_id inconsistente: a aposta pertence a % mas o registro indica %.',
            v_owner_bet, NEW.owner_id;
    END IF;

    IF v_owner_part IS DISTINCT FROM NEW.owner_id THEN
        RAISE EXCEPTION
            'owner_id inconsistente: o participante pertence a % mas o registro indica %.',
            v_owner_part, NEW.owner_id;
    END IF;

    -- Verifica bolão se a aposta tem bolao_id definido
    IF v_bolao_bet IS NOT NULL AND v_bolao_participante IS DISTINCT FROM v_bolao_bet THEN
        RAISE EXCEPTION
            'O participante % (bolão %) não pertence ao bolão da aposta % (bolão %).',
            NEW.participante_id, v_bolao_participante, NEW.bet_id, v_bolao_bet;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_consistencia ON public.jogo_participantes;
CREATE TRIGGER trg_validar_consistencia
    BEFORE INSERT OR UPDATE ON public.jogo_participantes
    FOR EACH ROW EXECUTE FUNCTION public.fn_validar_consistencia_bolao();

-- -----------------------------------------------------------------------
-- Trigger 3 — Percentual automático para participante único
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_percentual_automatico()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.jogo_participantes
    WHERE bet_id = NEW.bet_id;

    -- Se há apenas 1 participante, garante 100%
    IF v_count = 1 THEN
        NEW.percentual := 100;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_percentual_automatico ON public.jogo_participantes;
CREATE TRIGGER trg_percentual_automatico
    BEFORE INSERT ON public.jogo_participantes
    FOR EACH ROW EXECUTE FUNCTION public.fn_percentual_automatico();

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================
-- Execute este script no Supabase > SQL Editor.
-- Nenhuma dado existente será perdido ou modificado.
-- A coluna bets.bolao_id é nullable e retrocompatível.
-- ==============================================================================
