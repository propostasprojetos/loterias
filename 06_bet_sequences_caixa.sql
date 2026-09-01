-- ==============================================================================
-- 06_bet_sequences_caixa.sql
-- Módulo de Identificação Sequencial de Apostas + Flag "Manter em Caixa"
-- Branch: homologacao
-- Execute no SQL Editor do Supabase após os scripts 01 a 05.
-- ==============================================================================

-- ==============================================================================
-- ETAPA 1: TABELA DE SEQUÊNCIAS POR USUÁRIO
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.bet_sequences (
    owner_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_value INTEGER NOT NULL DEFAULT 0
);

-- RLS
ALTER TABLE public.bet_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuario gerencia sua sequencia" ON public.bet_sequences;
CREATE POLICY "Usuario gerencia sua sequencia"
    ON public.bet_sequences FOR ALL TO authenticated
    USING   (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Super admin acesso total a bet_sequences" ON public.bet_sequences;
CREATE POLICY "Super admin acesso total a bet_sequences"
    ON public.bet_sequences FOR ALL TO authenticated
    USING   (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));

-- ==============================================================================
-- ETAPA 2: NOVAS COLUNAS NA TABELA BETS
-- ==============================================================================

-- Número sequencial de 5 dígitos (ex: "00001")
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS bet_number VARCHAR(5);

-- Flag "Manter em Caixa"
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS manter_em_caixa BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice para busca por bet_number + owner_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_bets_bet_number_owner
    ON public.bets(owner_id, bet_number)
    WHERE bet_number IS NOT NULL;

-- ==============================================================================
-- ETAPA 3: FUNÇÃO PARA GERAR NÚMERO SEQUENCIAL (CONCURRENCY-SAFE)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_gerar_bet_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_next INTEGER;
BEGIN
    -- Se o bet_number já foi informado, não sobrescreve
    IF NEW.bet_number IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Tenta inserir o registro de sequência se não existir
    INSERT INTO public.bet_sequences (owner_id, current_value)
    VALUES (NEW.owner_id, 0)
    ON CONFLICT (owner_id) DO NOTHING;

    -- Incrementa atomicamente com FOR UPDATE (garante concorrência)
    UPDATE public.bet_sequences
    SET current_value = current_value + 1
    WHERE owner_id = NEW.owner_id
    RETURNING current_value INTO v_next;

    -- Formata com 5 dígitos
    NEW.bet_number := LPAD(v_next::TEXT, 5, '0');

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gerar_bet_number ON public.bets;
CREATE TRIGGER trg_gerar_bet_number
    BEFORE INSERT ON public.bets
    FOR EACH ROW EXECUTE FUNCTION public.fn_gerar_bet_number();

-- ==============================================================================
-- ETAPA 4: BACKFILL — NUMERAR APOSTAS EXISTENTES (ordem cronológica)
-- ==============================================================================
-- Para cada owner_id, numera as apostas existentes que não possuem bet_number.

DO $$
DECLARE
    r RECORD;
    v_counter INTEGER;
    v_prev_owner UUID := NULL;
BEGIN
    FOR r IN (
        SELECT id, owner_id
        FROM public.bets
        WHERE bet_number IS NULL
        ORDER BY owner_id, created_at ASC, id ASC
    ) LOOP
        IF v_prev_owner IS DISTINCT FROM r.owner_id THEN
            -- Busca o valor atual da sequência para este owner
            SELECT COALESCE(current_value, 0) INTO v_counter
            FROM public.bet_sequences
            WHERE owner_id = r.owner_id;

            IF v_counter IS NULL THEN
                INSERT INTO public.bet_sequences (owner_id, current_value)
                VALUES (r.owner_id, 0);
                v_counter := 0;
            END IF;
            v_prev_owner := r.owner_id;
        END IF;

        v_counter := v_counter + 1;

        -- Atualiza sem disparar o trigger (direto via UPDATE)
        UPDATE public.bets
        SET bet_number = LPAD(v_counter::TEXT, 5, '0')
        WHERE id = r.id;

        -- Atualiza a sequência
        UPDATE public.bet_sequences
        SET current_value = v_counter
        WHERE owner_id = r.owner_id;
    END LOOP;
END $$;

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================
-- Execute este script no Supabase > SQL Editor.
-- Nenhum dado existente será perdido ou modificado (apenas enriquecido).
-- O bet_number é gerado automaticamente em TODA nova aposta.
-- O campo manter_em_caixa tem default FALSE (retrocompatível).
-- ==============================================================================
