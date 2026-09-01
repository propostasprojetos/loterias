// ==============================================================================
// bolao.service.js — Camada de acesso ao Supabase para o módulo Bolão
// Não contém lógica de UI. Toda query ao banco centralizada aqui.
// ==============================================================================

import { supabaseClient, sbReady } from './supabase.js';
import { state } from './store.js';

function uid() {
    return state.currentSession?.user?.id ?? null;
}

function assertAuth() {
    const id = uid();
    if (!id) throw new Error('Usuário não autenticado.');
    return id;
}

// ==============================================================================
// BOLÕES
// ==============================================================================

export async function createBolao({ nome, descricao = '' }) {
    const owner_id = assertAuth();
    const { data, error } = await supabaseClient
        .from('boloes')
        .insert({ owner_id, nome, descricao })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateBolao(id, fields) {
    assertAuth();
    const { data, error } = await supabaseClient
        .from('boloes')
        .update(fields)
        .eq('id', id)
        .eq('owner_id', uid())
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function listBoloes() {
    assertAuth();
    const { data, error } = await supabaseClient
        .from('boloes')
        .select('*')
        .eq('owner_id', uid())
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
}

export async function setBolaoAtivo(id, ativo) {
    return updateBolao(id, { ativo });
}

// ==============================================================================
// PARTICIPANTES
// ==============================================================================

export async function createParticipante({ bolao_id, nome, telefone = null }) {
    const owner_id = assertAuth();
    const { data, error } = await supabaseClient
        .from('participantes')
        .insert({ owner_id, bolao_id, nome, telefone })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateParticipante(id, fields) {
    assertAuth();
    const { data, error } = await supabaseClient
        .from('participantes')
        .update(fields)
        .eq('id', id)
        .eq('owner_id', uid())
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function listParticipantes(bolao_id) {
    assertAuth();
    const { data, error } = await supabaseClient
        .from('participantes')
        .select('*')
        .eq('bolao_id', bolao_id)
        .eq('owner_id', uid())
        .order('nome');
    if (error) throw error;
    return data ?? [];
}

export async function listParticipantesAtivos(bolao_id) {
    assertAuth();
    const { data, error } = await supabaseClient
        .from('participantes')
        .select('*')
        .eq('bolao_id', bolao_id)
        .eq('owner_id', uid())
        .eq('ativo', true)
        .order('nome');
    if (error) throw error;
    return data ?? [];
}

// ==============================================================================
// JOGO_PARTICIPANTES
// ==============================================================================

/**
 * Vincula participantes a uma aposta.
 * @param {string} bet_id
 * @param {Array<{participante_id: string, percentual: number}>} participantes
 */
export async function vincularParticipantes(bet_id, participantes) {
    const owner_id = assertAuth();

    // Remove vínculos anteriores (substitui)
    const { error: delErr } = await supabaseClient
        .from('jogo_participantes')
        .delete()
        .eq('bet_id', bet_id)
        .eq('owner_id', owner_id);
    if (delErr) throw delErr;

    if (!participantes || participantes.length === 0) return [];

    // Valida se a soma informada é 100%
    const sumInformada = participantes.reduce((acc, p) => acc + (parseFloat(p.percentual) || 0), 0);
    const requiresRecalc = Math.abs(sumInformada - 100) > 0.05; // Margem para float

    const pctIgual = +(100 / participantes.length).toFixed(2);
    let sum = 0;

    const rows = participantes.map((p, idx) => {
        let pct = requiresRecalc ? pctIgual : (parseFloat(p.percentual) || 0);
        
        // Ajuste no último para garantir exatos 100
        if (idx === participantes.length - 1) {
            pct = +(100 - sum).toFixed(2);
        }
        sum += pct;
        
        return {
            owner_id,
            bet_id,
            participante_id: p.participante_id,
            percentual: pct,
        };
    });

    const { data, error } = await supabaseClient
        .from('jogo_participantes')
        .insert(rows)
        .select();
    if (error) throw error;
    return data ?? [];
}

export async function desvincularParticipantes(bet_id) {
    const owner_id = assertAuth();
    const { error } = await supabaseClient
        .from('jogo_participantes')
        .delete()
        .eq('bet_id', bet_id)
        .eq('owner_id', owner_id);
    if (error) throw error;
}

export async function getVinculosBet(bet_id) {
    assertAuth();
    const { data, error } = await supabaseClient
        .from('jogo_participantes')
        .select('*, participantes(nome)')
        .eq('bet_id', bet_id)
        .eq('owner_id', uid());
    if (error) throw error;
    return data ?? [];
}

// ==============================================================================
// PRÊMIOS DOS PARTICIPANTES
// ==============================================================================

/**
 * Salva o detalhamento de prêmios por participante.
 * @param {string} bet_id
 * @param {number} premio_total
 * @returns {Array} registros gravados
 */
export async function salvarPremiosParticipantes(bet_id, premio_total) {
    const owner_id = assertAuth();

    // Busca participantes vinculados
    const vinculos = await getVinculosBet(bet_id);
    if (!vinculos.length) return [];

    // Remove cálculos anteriores (permite reprocessamento)
    const { error: delErr } = await supabaseClient
        .from('premios_participantes')
        .delete()
        .eq('bet_id', bet_id)
        .eq('owner_id', owner_id);
    if (delErr) throw delErr;

    const rows = vinculos.map(v => ({
        owner_id,
        bet_id,
        participante_id: v.participante_id,
        premio_total,
        percentual: v.percentual,
        premio_recebido: +(premio_total * v.percentual / 100).toFixed(2),
    }));

    const { data, error } = await supabaseClient
        .from('premios_participantes')
        .insert(rows)
        .select();
    if (error) throw error;
    return data ?? [];
}

// ==============================================================================
// RELATÓRIOS
// ==============================================================================

/**
 * Relatório consolidado de um bolão.
 */
export async function obterRelatorioBolao(bolao_id) {
    assertAuth();

    // Apostas do bolão
    const { data: bets, error: bErr } = await supabaseClient
        .from('bets')
        .select('id, total_cost, lottery_type, bet_date, manter_em_caixa')
        .eq('bolao_id', bolao_id)
        .eq('owner_id', uid());
    if (bErr) throw bErr;

    const betIds = (bets ?? []).map(b => b.id);

    // Prêmios dos participantes
    let premios = [];
    let pr_caixa = [];
    if (betIds.length > 0) {
        const { data: pp, error: pErr } = await supabaseClient
            .from('premios_participantes')
            .select('*, participantes(nome)')
            .in('bet_id', betIds)
            .eq('owner_id', uid());
        if (pErr) throw pErr;
        premios = pp ?? [];
        
        // Pega a flag manter_em_caixa dos prêmios
        const { data: prz } = await supabaseClient
            .from('prizes')
            .select('id, prize_amount, bet_id, manter_em_caixa')
            .in('bet_id', betIds)
            .eq('owner_id', uid());
        pr_caixa = prz ?? [];
    }

    // Participantes do bolão
    const participantes = await listParticipantes(bolao_id);

    const totalApostado = (bets ?? []).reduce((s, b) => s + Number(b.total_cost), 0);
    const totalPremiado = premios.reduce((s, p) => s + Number(p.premio_recebido), 0);
    
    // Caixa
    const totalApostadoCaixa = (bets ?? []).filter(b => b.manter_em_caixa).reduce((s, b) => s + Number(b.total_cost), 0);
    const totalPremiadoCaixa = pr_caixa.filter(p => p.manter_em_caixa).reduce((s, p) => s + Number(p.prize_amount), 0);
    const saldoCaixa = totalPremiadoCaixa - totalApostadoCaixa;

    // Ranking por participante
    const ranking = participantes.map(part => {
        const meusPremios = premios.filter(p => p.participante_id === part.id);
        const meusJogos = betIds.length; // simplificado — apostas do bolão
        const recebido = meusPremios.reduce((s, p) => s + Number(p.premio_recebido), 0);
        const investido = (bets ?? []).reduce((s, b) => {
            const vinculo = meusPremios.find(p => p.bet_id === b.id);
            const pct = vinculo ? Number(vinculo.percentual) : 0;
            return s + Number(b.total_cost) * pct / 100;
        }, 0);
        return {
            participante: part,
            jogos: meusJogos,
            premiados: meusPremios.length,
            investido: +investido.toFixed(2),
            recebido: +recebido.toFixed(2),
            saldo: +(recebido - investido).toFixed(2),
            roi: investido > 0 ? +((recebido / investido - 1) * 100).toFixed(2) : 0,
            maiorPremio: meusPremios.length
                ? Math.max(...meusPremios.map(p => Number(p.premio_recebido)))
                : 0,
        };
    });

    ranking.sort((a, b) => b.recebido - a.recebido);

    return {
        bets: bets ?? [],
        premios,
        participantes,
        totalApostado: +totalApostado.toFixed(2),
        totalPremiado: +totalPremiado.toFixed(2),
        saldo: +(totalPremiado - totalApostado).toFixed(2),
        saldoCaixa: +saldoCaixa.toFixed(2),
        roi: totalApostado > 0
            ? +((totalPremiado / totalApostado - 1) * 100).toFixed(2)
            : 0,
        ranking,
    };
}

/**
 * Relatório individual de um participante (todos os bolões).
 */
export async function obterRelatorioParticipante(participante_id) {
    assertAuth();

    const { data: premios, error: pErr } = await supabaseClient
        .from('premios_participantes')
        .select('*, bets(bet_date, total_cost, lottery_type, bolao_id)')
        .eq('participante_id', participante_id)
        .eq('owner_id', uid())
        .order('created_at', { ascending: false });
    if (pErr) throw pErr;

    const { data: part, error: partErr } = await supabaseClient
        .from('participantes')
        .select('*')
        .eq('id', participante_id)
        .single();
    if (partErr) throw partErr;

    const { data: vinculos, error: vErr } = await supabaseClient
        .from('jogo_participantes')
        .select('*, bets(bet_date, total_cost, lottery_type)')
        .eq('participante_id', participante_id)
        .eq('owner_id', uid());
    if (vErr) throw vErr;

    const investido = (vinculos ?? []).reduce((s, v) => {
        return s + Number(v.bets?.total_cost ?? 0) * Number(v.percentual) / 100;
    }, 0);

    const recebido = (premios ?? []).reduce((s, p) => s + Number(p.premio_recebido), 0);
    const premiados = (premios ?? []).length;
    const jogos = (vinculos ?? []).length;

    return {
        participante: part,
        jogos,
        premiados,
        investido: +investido.toFixed(2),
        recebido: +recebido.toFixed(2),
        saldo: +(recebido - investido).toFixed(2),
        roi: investido > 0 ? +((recebido / investido - 1) * 100).toFixed(2) : 0,
        maiorPremio: premiados ? Math.max(...premios.map(p => Number(p.premio_recebido))) : 0,
        historico: premios ?? [],
    };
}
