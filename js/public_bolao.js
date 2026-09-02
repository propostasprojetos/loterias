// ==========================================
// public_bolao.js - Bolão Público (Read-Only)
// ==========================================

import { supabaseClient } from './supabase.js';
import { $, fmt } from './utils.js';

function pad(n) {
    return String(n).padStart(2, '0');
}

function formatDate(dt) {
    if (!dt) return '—';
    if (typeof dt === 'string' && dt.includes('T')) return dt.split('T')[0].split('-').reverse().join('/');
    if (typeof dt === 'string' && dt.includes('-')) return dt.split('-').reverse().join('/');
    return String(dt);
}

function getLotteryLabel(type) {
    if (type === 'lf') return 'Lotofácil';
    if (type === 'qn') return 'Quina';
    if (type === 'ms') return 'Mega-Sena';
    if (type === 'lm') return 'Lotomania';
    return (type || 'Loteria').toUpperCase();
}

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
        const participantes = data.participantes || [];
        const bets = data.bets || [];
        const premios = data.premios || [];
        const vinculos = data.vinculos || [];   // jogo_participantes
        const pr_caixa = data.pr_caixa || [];
        const jogosDetalhados = data.jogos || [];

        const totalApostado = bets.reduce((s, b) => s + Number(b.total_cost || 0), 0);
        const totalPremiado = premios.reduce((s, p) => s + Number(p.premio_recebido || 0), 0);
        
        const totalApostadoCaixa = bets.filter(b => b.manter_em_caixa).reduce((s, b) => s + Number(b.total_cost || 0), 0);
        const totalPremiadoCaixa = pr_caixa.reduce((s, p) => s + Number(p.prize_amount || 0), 0);
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
                return s + Number(bet.total_cost || 0) * Number(v.percentual || 0) / 100;
            }, 0);
            
            const recebido = meusPremios.reduce((s, p) => s + Number(p.premio_recebido || 0), 0);
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

        // Preenche o DOM do Resumo
        $('pub-bolao-nome').textContent = bolao.nome;
        $('pub-bolao-total-arrecadado').textContent = fmt(totalApostado);
        $('pub-bolao-total-apostado').textContent = fmt(totalApostado);
        $('pub-bolao-total-premiado').textContent = fmt(totalPremiado);
        
        const saldoEl = $('pub-bolao-saldo');
        saldoEl.textContent = fmt(saldoGeral);
        saldoEl.className = 'metric-value ' + (saldoGeral > 0 ? 'positive' : (saldoGeral < 0 ? 'negative' : ''));
        
        $('pub-bolao-total-caixa').textContent = fmt(saldoCaixa);

        // Tabela de Ranking
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
                <td style="color:${r.saldo > 0 ? 'var(--green)' : (r.saldo < 0 ? 'var(--red)' : 'var(--text-2)')}; font-weight:600;">${fmt(r.saldo)}</td>
            `;
            tbody.appendChild(tr);
        });

        // =========================================================================
        // ABA DE JOGOS & PAGINAÇÃO (20 JOGOS POR PÁGINA)
        // =========================================================================
        let allJogos = [];
        if (Array.isArray(jogosDetalhados) && jogosDetalhados.length > 0) {
            allJogos = jogosDetalhados.map((j, idx) => ({ ...j, displayIndex: idx + 1 }));
        } else if (Array.isArray(bets) && bets.length > 0) {
            // Se bet_games estiver vazio, tenta extrair de bets.games ou lista as apostas
            bets.forEach(b => {
                if (Array.isArray(b.games) && b.games.length > 0) {
                    b.games.forEach((nums, gIdx) => {
                        allJogos.push({
                            bet_id: b.id,
                            bet_number: b.bet_number,
                            contest_number: b.contest_number,
                            lottery_type: b.lottery_type,
                            bet_date: b.bet_date,
                            game_index: gIdx,
                            displayIndex: allJogos.length + 1,
                            numbers: Array.isArray(nums) ? nums : (nums.numbers || [])
                        });
                    });
                } else {
                    allJogos.push({
                        ...b,
                        isBetSummary: true,
                        displayIndex: allJogos.length + 1
                    });
                }
            });
        }

        // Atualiza contador de jogos na aba
        if ($('pub-total-jogos-count')) {
            $('pub-total-jogos-count').textContent = allJogos.length;
        }

        const PAGE_SIZE = 20;
        let currentPage = 1;
        const totalPages = Math.max(1, Math.ceil(allJogos.length / PAGE_SIZE));

        function renderPaginatedJogos(page) {
            const grid = $('pub-jogos-grid');
            const emptyEl = $('pub-jogos-empty');
            const pagInfo = $('pub-jogos-pag-info');
            const pageIndicator = $('pub-page-indicator');
            const prevBtn = $('btn-pub-prev-page');
            const nextBtn = $('btn-pub-next-page');

            if (!grid) return;
            grid.innerHTML = '';

            if (allJogos.length === 0) {
                if (emptyEl) emptyEl.classList.remove('hidden');
                if ($('pub-pagination-bar')) $('pub-pagination-bar').style.display = 'none';
                if (pagInfo) pagInfo.textContent = '';
                return;
            }

            if (emptyEl) emptyEl.classList.add('hidden');
            if ($('pub-pagination-bar')) $('pub-pagination-bar').style.display = 'flex';

            const startIdx = (page - 1) * PAGE_SIZE;
            const endIdx = Math.min(startIdx + PAGE_SIZE, allJogos.length);
            const pageItems = allJogos.slice(startIdx, endIdx);

            if (pagInfo) {
                pagInfo.textContent = `Exibindo ${startIdx + 1}–${endIdx} de ${allJogos.length} jogos`;
            }
            if (pageIndicator) {
                pageIndicator.textContent = `Página ${page} de ${totalPages}`;
            }
            if (prevBtn) prevBtn.disabled = page <= 1;
            if (nextBtn) nextBtn.disabled = page >= totalPages;

            pageItems.forEach(item => {
                const card = document.createElement('div');
                card.className = 'pub-game-card';

                const ballClass = item.lottery_type === 'lf' ? 'ball-lf' : (item.lottery_type === 'qn' ? 'ball-qn' : '');

                if (item.isBetSummary) {
                    card.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <span style="font-weight:700; color:var(--gold); font-family:var(--font-num); font-size:0.95rem;">
                                ${item.bet_number ? `#${item.bet_number}` : `Aposta #${item.displayIndex}`}
                            </span>
                            <span style="font-size:0.75rem; background:var(--surface-2); padding:2px 8px; border-radius:4px; color:var(--text-3);">${formatDate(item.bet_date)}</span>
                        </div>
                        <div style="font-size:0.85rem; color:var(--text-2); margin-bottom:6px;">
                            <strong style="color:var(--text);">${getLotteryLabel(item.lottery_type)}</strong> ${item.contest_number ? `· Conc. ${item.contest_number}` : ''}
                        </div>
                        <div style="font-size:0.8rem; color:var(--text-3);">
                            ${item.game_count || 1} jogo${(item.game_count || 1) > 1 ? 's' : ''} · Custo: ${fmt(item.total_cost || 0)}
                        </div>
                        ${item.notes ? `<div style="font-size:0.75rem; color:var(--text-3); margin-top:6px; font-style:italic;">${item.notes}</div>` : ''}
                    `;
                } else {
                    const nums = Array.isArray(item.numbers) ? item.numbers : [];
                    const numsHtml = nums.map(n => `<span class="pub-ball ${ballClass}">${pad(n)}</span>`).join('');
                    card.innerHTML = `
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <span style="font-weight:700; color:var(--gold); font-family:var(--font-num); font-size:0.85rem;">
                                JOGO #${item.displayIndex}
                            </span>
                            <span style="font-size:0.75rem; color:var(--text-3);">
                                ${item.bet_number ? `#${item.bet_number} ` : ''}${item.contest_number ? `· Conc. ${item.contest_number}` : ''}
                            </span>
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:2px; margin-top:6px; margin-bottom:8px;">${numsHtml}</div>
                        <div style="font-size:0.75rem; color:var(--text-3); display:flex; justify-content:space-between;">
                            <span>${getLotteryLabel(item.lottery_type)}</span>
                            <span>${formatDate(item.bet_date)}</span>
                        </div>
                    `;
                }
                grid.appendChild(card);
            });
        }

        // Setup Paginação
        $('btn-pub-prev-page')?.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderPaginatedJogos(currentPage);
                $('pub-tab-jogos')?.scrollIntoView({ behavior: 'smooth' });
            }
        });

        $('btn-pub-next-page')?.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderPaginatedJogos(currentPage);
                $('pub-tab-jogos')?.scrollIntoView({ behavior: 'smooth' });
            }
        });

        // Setup Abas
        const tabBtnResumo = $('btn-pub-tab-resumo');
        const tabBtnJogos = $('btn-pub-tab-jogos');
        const tabContentResumo = $('pub-tab-resumo');
        const tabContentJogos = $('pub-tab-jogos');

        tabBtnResumo?.addEventListener('click', () => {
            tabContentResumo.classList.remove('hidden');
            tabContentJogos.classList.add('hidden');
            tabBtnResumo.style.background = 'var(--gold)';
            tabBtnResumo.style.color = '#0e1015';
            tabBtnResumo.style.border = 'none';
            tabBtnJogos.style.background = 'var(--surface-2)';
            tabBtnJogos.style.color = 'var(--text-2)';
            tabBtnJogos.style.border = '1px solid var(--border)';
        });

        tabBtnJogos?.addEventListener('click', () => {
            tabContentResumo.classList.add('hidden');
            tabContentJogos.classList.remove('hidden');
            tabBtnJogos.style.background = 'var(--gold)';
            tabBtnJogos.style.color = '#0e1015';
            tabBtnJogos.style.border = 'none';
            tabBtnResumo.style.background = 'var(--surface-2)';
            tabBtnResumo.style.color = 'var(--text-2)';
            tabBtnResumo.style.border = '1px solid var(--border)';
            renderPaginatedJogos(currentPage);
        });

        // Inicializa primeira página dos jogos
        renderPaginatedJogos(1);

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
