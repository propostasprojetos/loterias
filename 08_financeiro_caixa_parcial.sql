-- ==============================================================================
-- 08_financeiro_caixa_parcial.sql
-- Módulo de Finanças: Pagamentos parciais via Caixa
-- Branch: homologacao
-- ==============================================================================

-- 1. ADICIONAR COLUNAS NUMÉRICAS PARA CAIXA PARCIAL
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS valor_utilizado_caixa NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.prizes ADD COLUMN IF NOT EXISTS valor_retido_caixa NUMERIC(15,2) DEFAULT 0;

-- 2. BACKFILL RETROCOMPATÍVEL
-- Transforma o booleano 'manter_em_caixa' em valor monetário
UPDATE public.bets 
SET valor_utilizado_caixa = total_cost 
WHERE manter_em_caixa = true AND valor_utilizado_caixa = 0;

UPDATE public.prizes 
SET valor_retido_caixa = prize_amount 
WHERE manter_em_caixa = true AND valor_retido_caixa = 0;

-- 3. TRIGGER DE VALIDAÇÃO: NÃO PERMITIR SALDO NEGATIVO NO CAIXA
CREATE OR REPLACE FUNCTION public.fn_validar_saldo_caixa()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_entradas NUMERIC(15,2);
    v_saidas NUMERIC(15,2);
    v_saldo NUMERIC(15,2);
BEGIN
    -- Limpeza de nulos e prevenção básica
    NEW.valor_utilizado_caixa := COALESCE(NEW.valor_utilizado_caixa, 0);

    IF NEW.valor_utilizado_caixa <= 0 THEN
        RETURN NEW;
    END IF;

    IF NEW.valor_utilizado_caixa > NEW.total_cost THEN
        RAISE EXCEPTION 'O valor utilizado do caixa (R$ %) não pode ser maior que o custo da aposta (R$ %).', NEW.valor_utilizado_caixa, NEW.total_cost;
    END IF;

    -- Calcula saldo dependendo se é bolão ou individual
    IF NEW.bolao_id IS NOT NULL THEN
        -- Entradas no caixa deste bolão
        SELECT COALESCE(SUM(valor_retido_caixa), 0) INTO v_entradas
        FROM public.prizes
        WHERE (bolao_id = NEW.bolao_id OR bet_id IN (SELECT id FROM public.bets WHERE bolao_id = NEW.bolao_id))
          AND owner_id = NEW.owner_id;

        -- Saídas do caixa deste bolão (excluindo a própria aposta atual)
        SELECT COALESCE(SUM(valor_utilizado_caixa), 0) INTO v_saidas
        FROM public.bets
        WHERE bolao_id = NEW.bolao_id 
          AND owner_id = NEW.owner_id
          AND id IS DISTINCT FROM NEW.id;
    ELSE
        -- Entradas no caixa individual
        SELECT COALESCE(SUM(valor_retido_caixa), 0) INTO v_entradas
        FROM public.prizes
        WHERE bolao_id IS NULL AND owner_id = NEW.owner_id;

        -- Saídas do caixa individual
        SELECT COALESCE(SUM(valor_utilizado_caixa), 0) INTO v_saidas
        FROM public.bets
        WHERE bolao_id IS NULL AND owner_id = NEW.owner_id AND id IS DISTINCT FROM NEW.id;
    END IF;

    v_saldo := v_entradas - v_saidas;

    -- Valida se há saldo suficiente
    IF NEW.valor_utilizado_caixa > v_saldo THEN
        RAISE EXCEPTION 'Saldo insuficiente no caixa. Disponível: R$ %, Utilizado tentado: R$ %.', v_saldo, NEW.valor_utilizado_caixa;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_saldo_caixa ON public.bets;
CREATE TRIGGER trg_validar_saldo_caixa
    BEFORE INSERT OR UPDATE ON public.bets
    FOR EACH ROW EXECUTE FUNCTION public.fn_validar_saldo_caixa();


-- 4. ATUALIZAR RPC DO BOLÃO PÚBLICO (RETORNAR NOVOS CAMPOS E ATERRAR CÁLCULO)
CREATE OR REPLACE FUNCTION public.fn_get_bolao_public_report(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bolao RECORD;
    v_participantes JSON;
    v_bets JSON;
    v_jogos JSON;
    v_premios JSON;
    v_vinculos JSON;
    v_pr_caixa JSON;
    v_result JSON;
BEGIN
    SELECT id, nome, ativo, owner_id INTO v_bolao
    FROM public.boloes
    WHERE public_token = p_token AND ativo = true;

    IF NOT FOUND THEN RETURN NULL; END IF;

    SELECT COALESCE(json_agg(json_build_object(
        'id', p.id, 'nome', p.nome, 'ativo', p.ativo
    )), '[]') INTO v_participantes
    FROM public.participantes p
    WHERE bolao_id = v_bolao.id;

    SELECT COALESCE(json_agg(json_build_object(
        'id', b.id, 'bet_date', b.bet_date, 'lottery_type', b.lottery_type,
        'game_count', b.game_count, 'total_cost', b.total_cost, 'contest_number', b.contest_number,
        'bet_number', b.bet_number, 'notes', b.notes, 'games', b.games,
        'manter_em_caixa', b.manter_em_caixa, 'valor_utilizado_caixa', b.valor_utilizado_caixa, 'created_at', b.created_at
    ) ORDER BY b.created_at DESC), '[]') INTO v_bets
    FROM public.bets b
    WHERE bolao_id = v_bolao.id;

    SELECT COALESCE(json_agg(json_build_object(
        'id', bg.id, 'bet_id', bg.bet_id, 'game_index', bg.game_index, 'numbers', bg.numbers,
        'lottery_type', bg.lottery_type, 'bet_number', b.bet_number, 'contest_number', b.contest_number,
        'bet_date', b.bet_date
    ) ORDER BY b.created_at DESC, bg.game_index ASC), '[]') INTO v_jogos
    FROM public.bet_games bg
    JOIN public.bets b ON b.id = bg.bet_id
    WHERE b.bolao_id = v_bolao.id;

    SELECT COALESCE(json_agg(json_build_object(
        'bet_id', jp.bet_id, 'participante_id', jp.participante_id, 'percentual', jp.percentual
    )), '[]') INTO v_vinculos
    FROM public.jogo_participantes jp
    WHERE jp.bet_id IN (SELECT id FROM public.bets WHERE bolao_id = v_bolao.id);

    SELECT COALESCE(json_agg(json_build_object(
        'bet_id', pp.bet_id, 'participante_id', pp.participante_id,
        'premio_recebido', pp.premio_recebido, 'percentual', pp.percentual
    )), '[]') INTO v_premios
    FROM public.premios_participantes pp
    WHERE pp.bet_id IN (SELECT id FROM public.bets WHERE bolao_id = v_bolao.id);

    SELECT COALESCE(json_agg(json_build_object(
        'bet_id', prz.bet_id, 'prize_amount', prz.prize_amount,
        'manter_em_caixa', prz.manter_em_caixa, 'valor_retido_caixa', prz.valor_retido_caixa,
        'lottery_type', prz.lottery_type
    )), '[]') INTO v_pr_caixa
    FROM public.prizes prz
    WHERE (prz.bolao_id = v_bolao.id OR prz.bet_id IN (SELECT id FROM public.bets WHERE bolao_id = v_bolao.id))
    AND (prz.manter_em_caixa = true OR prz.valor_retido_caixa > 0);

    v_result := json_build_object(
        'bolao',        json_build_object('id', v_bolao.id, 'nome', v_bolao.nome),
        'participantes', v_participantes,
        'bets',         v_bets,
        'jogos',        v_jogos,
        'vinculos',     v_vinculos,
        'premios',      v_premios,
        'pr_caixa',     v_pr_caixa
    );

    RETURN v_result;
END;
$$;
