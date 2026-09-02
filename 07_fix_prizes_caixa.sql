-- ==============================================================================
-- 07_fix_prizes_caixa.sql
-- CORREÇÃO: Adiciona a coluna manter_em_caixa na tabela prizes
-- e recria a RPC fn_get_bolao_public_report com a correção.
--
-- Execute este script no Supabase > SQL Editor.
-- É seguro rodar mesmo que o 07_bolao_publico.sql já tenha sido executado.
-- ==============================================================================

-- 1. Adicionar coluna manter_em_caixa na tabela prizes (caso não exista)
ALTER TABLE public.prizes ADD COLUMN IF NOT EXISTS manter_em_caixa BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Recriar a RPC com a correção (CREATE OR REPLACE é idempotente)
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
    v_premios JSON;
    v_vinculos JSON;
    v_pr_caixa JSON;
    v_result JSON;
BEGIN
    -- 1. Busca o Bolão pelo Token
    SELECT id, nome, ativo, owner_id INTO v_bolao
    FROM public.boloes
    WHERE public_token = p_token AND ativo = true;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- 2. Participantes
    SELECT COALESCE(json_agg(json_build_object(
        'id', p.id, 'nome', p.nome, 'ativo', p.ativo
    )), '[]') INTO v_participantes
    FROM public.participantes p
    WHERE bolao_id = v_bolao.id;

    -- 3. Apostas do Bolão (campos selecionados, sem expor jogos internos)
    SELECT COALESCE(json_agg(json_build_object(
        'id', b.id, 'bet_date', b.bet_date, 'lottery_type', b.lottery_type,
        'total_cost', b.total_cost, 'contest_number', b.contest_number,
        'bet_number', b.bet_number, 'manter_em_caixa', b.manter_em_caixa
    )), '[]') INTO v_bets
    FROM public.bets b
    WHERE bolao_id = v_bolao.id;

    -- 4. Vínculos (jogo_participantes) para calcular investimento por participante
    SELECT COALESCE(json_agg(json_build_object(
        'bet_id', jp.bet_id,
        'participante_id', jp.participante_id,
        'percentual', jp.percentual
    )), '[]') INTO v_vinculos
    FROM public.jogo_participantes jp
    WHERE jp.bet_id IN (SELECT id FROM public.bets WHERE bolao_id = v_bolao.id);

    -- 5. Prêmios rateados por participante
    SELECT COALESCE(json_agg(json_build_object(
        'bet_id', pp.bet_id,
        'participante_id', pp.participante_id,
        'premio_recebido', pp.premio_recebido,
        'percentual', pp.percentual
    )), '[]') INTO v_premios
    FROM public.premios_participantes pp
    WHERE pp.bet_id IN (SELECT id FROM public.bets WHERE bolao_id = v_bolao.id);

    -- 6. Prêmios gerais mantidos em caixa
    SELECT COALESCE(json_agg(json_build_object(
        'bet_id', prz.bet_id,
        'prize_amount', prz.prize_amount,
        'manter_em_caixa', prz.manter_em_caixa
    )), '[]') INTO v_pr_caixa
    FROM public.prizes prz
    WHERE prz.bet_id IN (SELECT id FROM public.bets WHERE bolao_id = v_bolao.id)
    AND prz.manter_em_caixa = true;

    -- Monta resposta
    v_result := json_build_object(
        'bolao',        json_build_object('id', v_bolao.id, 'nome', v_bolao.nome),
        'participantes', v_participantes,
        'bets',         v_bets,
        'vinculos',     v_vinculos,
        'premios',      v_premios,
        'pr_caixa',     v_pr_caixa
    );

    RETURN v_result;
END;
$$;

-- 3. Reconfirmar permissões
GRANT EXECUTE ON FUNCTION public.fn_get_bolao_public_report(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.fn_get_bolao_public_report(UUID) TO authenticated;

-- ==============================================================================
-- FIM — Pronto! Execute e teste novamente o link público do bolão.
-- ==============================================================================
