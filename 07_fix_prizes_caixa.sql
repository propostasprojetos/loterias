-- ==============================================================================
-- 07_fix_prizes_caixa.sql
-- CORREÇÃO: Adiciona manter_em_caixa e bolao_id na tabela prizes,
-- vincula prêmios existentes e recria a RPC fn_get_bolao_public_report.
--
-- Execute este script no Supabase > SQL Editor.
-- ==============================================================================

-- 1. Adicionar colunas na tabela prizes (caso não existam)
ALTER TABLE public.prizes ADD COLUMN IF NOT EXISTS manter_em_caixa BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.prizes ADD COLUMN IF NOT EXISTS bolao_id UUID REFERENCES public.boloes(id) ON DELETE SET NULL;
ALTER TABLE public.prizes ADD COLUMN IF NOT EXISTS bet_id UUID REFERENCES public.bets(id) ON DELETE SET NULL;

-- 2. Backfill: Vincular prêmios a bolões a partir das apostas vinculadas
UPDATE public.prizes p
SET bolao_id = b.bolao_id
FROM public.bets b
WHERE p.bet_id = b.id AND p.bolao_id IS NULL AND b.bolao_id IS NOT NULL;

-- 3. Backfill: Se houver prêmio marcado 'manter_em_caixa' sem bolao_id e o usuário tiver bolão ativo, vincula
UPDATE public.prizes p
SET bolao_id = (
    SELECT b.id FROM public.boloes b 
    WHERE b.owner_id = p.owner_id AND b.ativo = true 
    ORDER BY b.created_at DESC LIMIT 1
)
WHERE p.manter_em_caixa = true AND p.bolao_id IS NULL AND p.bet_id IS NULL;

-- 4. Recriar a RPC com suporte a bolao_id direto, bet_id e jogos individuais
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

    -- 3. Apostas do Bolão
    SELECT COALESCE(json_agg(json_build_object(
        'id', b.id, 'bet_date', b.bet_date, 'lottery_type', b.lottery_type,
        'game_count', b.game_count, 'total_cost', b.total_cost, 'contest_number', b.contest_number,
        'bet_number', b.bet_number, 'notes', b.notes, 'games', b.games,
        'manter_em_caixa', b.manter_em_caixa, 'created_at', b.created_at
    ) ORDER BY b.created_at DESC), '[]') INTO v_bets
    FROM public.bets b
    WHERE bolao_id = v_bolao.id;

    -- 4. Jogos detalhados (com dezenas) de bet_games
    SELECT COALESCE(json_agg(json_build_object(
        'id', bg.id,
        'bet_id', bg.bet_id,
        'game_index', bg.game_index,
        'numbers', bg.numbers,
        'lottery_type', bg.lottery_type,
        'bet_number', b.bet_number,
        'contest_number', b.contest_number,
        'bet_date', b.bet_date
    ) ORDER BY b.created_at DESC, bg.game_index ASC), '[]') INTO v_jogos
    FROM public.bet_games bg
    JOIN public.bets b ON b.id = bg.bet_id
    WHERE b.bolao_id = v_bolao.id;

    -- 5. Vínculos (jogo_participantes) para calcular investimento por participante
    SELECT COALESCE(json_agg(json_build_object(
        'bet_id', jp.bet_id,
        'participante_id', jp.participante_id,
        'percentual', jp.percentual
    )), '[]') INTO v_vinculos
    FROM public.jogo_participantes jp
    WHERE jp.bet_id IN (SELECT id FROM public.bets WHERE bolao_id = v_bolao.id);

    -- 6. Prêmios rateados por participante
    SELECT COALESCE(json_agg(json_build_object(
        'bet_id', pp.bet_id,
        'participante_id', pp.participante_id,
        'premio_recebido', pp.premio_recebido,
        'percentual', pp.percentual
    )), '[]') INTO v_premios
    FROM public.premios_participantes pp
    WHERE pp.bet_id IN (SELECT id FROM public.bets WHERE bolao_id = v_bolao.id);

    -- 7. Prêmios mantidos em caixa (vinculados por bolao_id direto OU via aposta)
    SELECT COALESCE(json_agg(json_build_object(
        'bet_id', prz.bet_id,
        'prize_amount', prz.prize_amount,
        'manter_em_caixa', prz.manter_em_caixa
    )), '[]') INTO v_pr_caixa
    FROM public.prizes prz
    WHERE (prz.bolao_id = v_bolao.id OR prz.bet_id IN (SELECT id FROM public.bets WHERE bolao_id = v_bolao.id))
    AND prz.manter_em_caixa = true;

    -- Monta resposta
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

-- 5. Permissões
GRANT EXECUTE ON FUNCTION public.fn_get_bolao_public_report(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.fn_get_bolao_public_report(UUID) TO authenticated;
