// ==========================================
// public_bolao.js - Bolão Público (Read-Only)
// ==========================================

import { supabaseClient } from './supabase.js';
import { $, fmt } from './utils.js';

export async function initBolaoPublico(token) {
    const loading = $('public-bolao-loading');
    const error = $('public-bolao-error');
    const content = $('public-bolao-content');

    loading.classList.remove('hidden');
    error.classList.add('hidden');
    content.classList.add('hidden');

    try {
        const { data, error: rpcError } = await supabaseClient.rpc('fn_get_bolao_public_report', { p_token: token });

        if (rpcError) throw rpcError;
        if (!data) throw new Error('Bolão não encontrado ou inativo.');

        // Extrai os dados do JSON
        const bolao = data.bolao;
        const participantes = data.participantes;
        const bets = data.bets;
        const premios = data.premios;
        const vinculos = data.vinculos;   // jogo_participantes
        const pr_caixa = data.pr_caixa;

        const totalApostado = bets.reduce((s, b) => s + Number(b.total_cost), 0);
        const totalPremiado = premios.reduce((s, p) => s + Number(p.premio_recebido), 0);
        
        const totalApostadoCaixa = bets.filter(b => b.manter_em_caixa).reduce((s, b) => s + Number(b.total_cost), 0);
        const totalPremiadoCaixa = pr_caixa.reduce((s, p) => s + Number(p.prize_amount), 0);
        const saldoCaixa = totalPremiadoCaixa - totalApostadoCaixa;
        const saldoGeral = totalPremiado - totalApostado;

        // Ranking — usa vinculos (jogo_participantes) para investimento e premios para recebimentos
        const ranking = participantes.map(part => {
            const meusVinculos = vinculos.filter(v => v.participante_id === part.id);
            const meusPremios = premios.filter(p => p.participante_id === part.id);
            
            // Investido = soma de (custo da aposta × percentual desse participante / 100)
            const investido = meusVinculos.reduce((s, v) => {
                const bet = bets.find(b => b.id === v.bet_id);
                if (!bet) return s;
                return s + Number(bet.total_cost) * Number(v.percentual) / 100;
            }, 0);
            
            const recebido = meusPremios.reduce((s, p) => s + Number(p.premio_recebido), 0);
            
            // Apostas em que participou
            const betIds = [...new Set(meusVinculos.map(v => v.bet_id))];
            
            return {
                participante: part,
                jogos: betIds.length,
                investido: +investido.toFixed(2),
                recebido: +recebido.toFixed(2),
                saldo: +(recebido - investido).toFixed(2)
            };
        });

        ranking.sort((a, b) => b.recebido - a.recebido);

        // Preenche o DOM
        $('pub-bolao-nome').textContent = bolao.nome;
        $('pub-bolao-total-arrecadado').textContent = fmt(totalApostado);
        $('pub-bolao-total-apostado').textContent = fmt(totalApostado);
        $('pub-bolao-total-premiado').textContent = fmt(totalPremiado);
        
        const saldoEl = $('pub-bolao-saldo');
        saldoEl.textContent = fmt(saldoGeral);
        saldoEl.className = 'metric-value ' + (saldoGeral > 0 ? 'positive' : (saldoGeral < 0 ? 'negative' : ''));
        
        $('pub-bolao-total-caixa').textContent = fmt(saldoCaixa);

        const tbody = $('pub-bolao-ranking-body');
        tbody.innerHTML = '';
        ranking.forEach((r, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="ranking-pos">${idx + 1}º</td>
                <td>
                    <div style="font-weight:700; color:var(--text);">${r.participante.nome}</div>
                    <div style="font-size:0.7rem; color:var(--text-3);">${r.participante.ativo ? 'Ativo' : 'Inativo'}</div>
                </td>
                <td>${r.jogos}</td>
                <td>${fmt(r.investido)}</td>
                <td style="color:var(--green); font-weight:600;">${fmt(r.recebido)}</td>
                <td style="color:${r.saldo > 0 ? 'var(--green)' : (r.saldo < 0 ? 'var(--red)' : 'var(--text-2)')}">${fmt(r.saldo)}</td>
            `;
            tbody.appendChild(tr);
        });

        loading.classList.add('hidden');
        content.classList.remove('hidden');

    } catch (e) {
        console.error(e);
        loading.classList.add('hidden');
        error.classList.remove('hidden');
    }
}

// Expõe globalmente para o app.js acessar via roteamento
window.initBolaoPublico = initBolaoPublico;
