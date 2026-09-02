-- ==============================================================================
-- 07_bolao_publico.sql
-- Módulo de Compartilhamento Público de Bolões (Link Read-Only)
-- Execute no SQL Editor do Supabase após os scripts anteriores.
-- ==============================================================================

-- 1. Adicionar o token público intransferível na tabela de bolões
ALTER TABLE public.boloes ADD COLUMN IF NOT EXISTS public_token UUID UNIQUE DEFAULT gen_random_uuid();

-- 2. Backfill (garantir que bolões antigos tenham o token)
UPDATE public.boloes SET public_token = gen_random_uuid() WHERE public_token IS NULL;
ALTER TABLE public.boloes ALTER COLUMN public_token SET NOT NULL;

-- 3. Adicionar colunas na tabela prizes (necessárias para o módulo de caixa e bolão)
ALTER TABLE public.prizes ADD COLUMN IF NOT EXISTS manter_em_caixa BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.prizes ADD COLUMN IF NOT EXISTS bolao_id UUID REFERENCES public.boloes(id) ON DELETE SET NULL;
ALTER TABLE public.prizes ADD COLUMN IF NOT EXISTS bet_id UUID REFERENCES public.bets(id) ON DELETE SET NULL;

-- 3. Função RPC Segura (Security Definer) para buscar os dados consolidados do bolão
-- Usa 'SECURITY DEFINER' para poder rodar como o criador da função, ignorando RLS para a leitura controlada.
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
    -- 1. Busca o Bolão pelo Token (garante que apenas quem tem o token veja)
    SELECT id, nome, ativo, owner_id INTO v_bolao
    FROM public.boloes
    WHERE public_token = p_token AND ativo = true;

    IF NOT FOUND THEN
        RETURN NULL; -- Bolão não existe ou está inativo
    END IF;

    -- 2. Busca os Participantes
    SELECT COALESCE(json_agg(json_build_object(
        'id', p.id, 'nome', p.nome, 'ativo', p.ativo
    )), '[]') INTO v_participantes
    FROM public.participantes p
    WHERE bolao_id = v_bolao.id;

    -- 3. Busca as Apostas do Bolão (sem expor games/detalhes sensíveis)
    SELECT COALESCE(json_agg(json_build_object(
        'id', b.id, 'bet_date', b.bet_date, 'lottery_type', b.lottery_type,
        'total_cost', b.total_cost, 'contest_number', b.contest_number,
        'bet_number', b.bet_number, 'manter_em_caixa', b.manter_em_caixa
    )), '[]') INTO v_bets
    FROM public.bets b
    WHERE bolao_id = v_bolao.id;

    -- 4. Busca os vínculos (jogo_participantes) para cálculo de investimento
    SELECT COALESCE(json_agg(json_build_object(
        'bet_id', jp.bet_id,
        'participante_id', jp.participante_id,
        'percentual', jp.percentual
    )), '[]') INTO v_vinculos
    FROM public.jogo_participantes jp
    WHERE jp.bet_id IN (SELECT id FROM public.bets WHERE bolao_id = v_bolao.id);

    -- 5. Busca os Prêmios rateados por participante
    SELECT COALESCE(json_agg(json_build_object(
        'bet_id', pp.bet_id,
        'participante_id', pp.participante_id,
        'premio_recebido', pp.premio_recebido,
        'percentual', pp.percentual
    )), '[]') INTO v_premios
    FROM public.premios_participantes pp
    WHERE pp.bet_id IN (SELECT id FROM public.bets WHERE bolao_id = v_bolao.id);

    -- 6. Busca prêmios gerais mantidos em caixa
    SELECT COALESCE(json_agg(json_build_object(
        'bet_id', prz.bet_id,
        'prize_amount', prz.prize_amount,
        'manter_em_caixa', prz.manter_em_caixa
    )), '[]') INTO v_pr_caixa
    FROM public.prizes prz
    WHERE (prz.bolao_id = v_bolao.id OR prz.bet_id IN (SELECT id FROM public.bets WHERE bolao_id = v_bolao.id))
    AND prz.manter_em_caixa = true;

    -- Monta o JSON de resposta
    v_result := json_build_object(
        'bolao', json_build_object('id', v_bolao.id, 'nome', v_bolao.nome),
        'participantes', v_participantes,
        'bets', v_bets,
        'vinculos', v_vinculos,
        'premios', v_premios,
        'pr_caixa', v_pr_caixa
    );

    RETURN v_result;
END;
$$;

-- 4. Permissões
-- Liberar execução para usuários anônimos (convidados sem login) e logados
GRANT EXECUTE ON FUNCTION public.fn_get_bolao_public_report(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.fn_get_bolao_public_report(UUID) TO authenticated;
