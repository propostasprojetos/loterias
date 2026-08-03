// ==============================================================================
// bolao.js — Interface e Lógica de UI do Módulo de Bolão
// ==============================================================================

import { $, $$, toast, showConfirm, fmt } from './utils.js';
import * as BolaoService from './bolao.service.js';

let boloes = [];
let participantes = [];
let selectedBolaoId = null;

// ==============================================================================
// INICIALIZAÇÃO E EVENTOS
// ==============================================================================
let isBolaoInitialized = false;

export async function initBolao() {
    if (isBolaoInitialized) return;
    isBolaoInitialized = true;

    setupTabs();
    setupModais();
    setupFinanceiroBolao();
    
    // Atualiza a lista inicial
    await refreshBoloes();

    // Filtros e buscas
    $('filtro-bolao-participantes')?.addEventListener('change', (e) => {
        renderListaParticipantes();
    });
    
    $('busca-participante')?.addEventListener('input', (e) => {
        renderListaParticipantes();
    });

    $('relatorio-bolao-select')?.addEventListener('change', async (e) => {
        await renderRelatorioBolao(e.target.value);
    });
}

function setupTabs() {
    $$('.bolao-subtabs .tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = e.target.dataset.bolaoTab;
            
            // Ativa tab visual
            $$('.bolao-subtabs .tab').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');

            // Ativa container
            $$('.bolao-tab-content').forEach(c => c.classList.add('hidden'));
            $(`bolao-tab-${tabId}`)?.classList.remove('hidden');

            // Renderiza conteúdo sob demanda
            if (tabId === 'boloes') renderListaBoloes();
            if (tabId === 'participantes') {
                updateFiltroParticipantes();
                renderListaParticipantes();
            }
            if (tabId === 'relatorios') {
                updateFiltroRelatorios();
            }
        });
    });
}

function setupModais() {
    // Bolão Modal
    $('btn-novo-bolao')?.addEventListener('click', () => abrirModalBolao());
    $('btn-close-bolao')?.addEventListener('click', fecharModalBolao);
    $('btn-cancel-bolao')?.addEventListener('click', fecharModalBolao);
    
    $('form-bolao')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = $('btn-save-bolao');
        btn.disabled = true;
        
        try {
            const id = $('bolao-id').value;
            const nome = $('bolao-nome').value.trim();
            const descricao = $('bolao-descricao').value.trim();
            const ativo = $('bolao-ativo').checked;

            if (id) {
                await BolaoService.updateBolao(id, { nome, descricao, ativo });
                toast('Bolão atualizado com sucesso!', 'success');
            } else {
                await BolaoService.createBolao({ nome, descricao });
                toast('Bolão criado com sucesso!', 'success');
            }
            fecharModalBolao();
            await refreshBoloes();
        } catch (error) {
            toast('Erro ao salvar bolão: ' + error.message);
        } finally {
            btn.disabled = false;
        }
    });

    // Participante Modal
    $('btn-novo-participante')?.addEventListener('click', () => abrirModalParticipante());
    $('btn-close-part')?.addEventListener('click', fecharModalParticipante);
    $('btn-cancel-part')?.addEventListener('click', fecharModalParticipante);

    $('form-participante')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = $('btn-save-part');
        btn.disabled = true;

        try {
            const id = $('part-id').value;
            const bolao_id = $('part-bolao-id').value;
            const nome = $('part-nome').value.trim();
            const telefone = $('part-telefone').value.trim();
            const ativo = $('part-ativo').checked;

            if (!bolao_id) throw new Error('Selecione um bolão.');

            if (id) {
                await BolaoService.updateParticipante(id, { bolao_id, nome, telefone, ativo });
                toast('Participante atualizado!', 'success');
            } else {
                await BolaoService.createParticipante({ bolao_id, nome, telefone });
                toast('Participante cadastrado!', 'success');
            }
            fecharModalParticipante();
            await refreshParticipantes(bolao_id); // se o filtro ativo mudar, ele renderiza
            
            // recarrega todos os participantes para o cache
            participantes = await BolaoService.listParticipantes(bolao_id);
            renderListaParticipantes();
        } catch (error) {
            toast('Erro ao salvar participante: ' + error.message);
        } finally {
            btn.disabled = false;
        }
    });

    // Relatório Individual
    $('btn-close-relatorio')?.addEventListener('click', () => {
        $('modal-relatorio-individual').classList.add('hidden');
    });
}

// ==============================================================================
// BOLÕES - LÓGICA DE INTERFACE
// ==============================================================================

async function refreshBoloes() {
    try {
        boloes = await BolaoService.listBoloes();
        renderListaBoloes();
        updateFiltroParticipantes();
        updateFiltroRelatorios();
    } catch (e) {
        console.error('Erro ao carregar bolões', e);
    }
}

function renderListaBoloes() {
    const list = $('lista-boloes');
    const empty = $('boloes-empty');
    if (!list || !empty) return;

    list.innerHTML = '';
    
    if (boloes.length === 0) {
        empty.classList.remove('hidden');
        return;
    }
    
    empty.classList.add('hidden');

    boloes.forEach(b => {
        const card = document.createElement('div');
        card.className = 'bolao-card';
        card.innerHTML = `
            <div class="bolao-info">
                <h3>${b.nome} ${b.ativo ? '' : '<span style="font-size:0.6rem; background:rgba(239, 68, 68, 0.1); color:var(--red); padding:2px 6px; border-radius:4px;">INATIVO</span>'}</h3>
                ${b.descricao ? `<p>${b.descricao}</p>` : ''}
            </div>
            <div style="display:flex; gap:8px;">
                <button class="btn-icon btn-edit-bolao" data-id="${b.id}" title="Editar bolão">✏️</button>
                <button class="btn-icon btn-toggle-bolao" data-id="${b.id}" title="${b.ativo ? 'Desativar' : 'Reativar'}">
                    ${b.ativo ? '⏸️' : '▶️'}
                </button>
            </div>
        `;
        list.appendChild(card);
    });

    // Eventos
    $$('.btn-edit-bolao').forEach(btn => {
        btn.addEventListener('click', () => {
            const bolao = boloes.find(x => x.id === btn.dataset.id);
            if (bolao) abrirModalBolao(bolao);
        });
    });

    $$('.btn-toggle-bolao').forEach(btn => {
        btn.addEventListener('click', async () => {
            const bolao = boloes.find(x => x.id === btn.dataset.id);
            if (bolao) {
                const acao = bolao.ativo ? 'desativar' : 'reativar';
                showConfirm(`Confirmar Ação`, `Deseja realmente ${acao} o bolão "${bolao.nome}"?`, async () => {
                    await BolaoService.setBolaoAtivo(bolao.id, !bolao.ativo);
                    toast(`Bolão ${bolao.ativo ? 'desativado' : 'reativado'}.`);
                    await refreshBoloes();
                });
            }
        });
    });
}

function abrirModalBolao(bolao = null) {
    $('bolao-id').value = bolao ? bolao.id : '';
    $('bolao-nome').value = bolao ? bolao.nome : '';
    $('bolao-descricao').value = bolao ? bolao.descricao : '';
    
    const ativoField = $('bolao-ativo-field');
    if (bolao) {
        ativoField.style.display = 'block';
        $('bolao-ativo').checked = bolao.ativo;
    } else {
        ativoField.style.display = 'none';
        $('bolao-ativo').checked = true;
    }

    $('modal-bolao-title').textContent = bolao ? 'Editar Bolão' : 'Novo Bolão';
    $('modal-novo-bolao').classList.remove('hidden');
}

function fecharModalBolao() {
    $('modal-novo-bolao').classList.add('hidden');
    $('form-bolao').reset();
}

// ==============================================================================
// INTEGRAÇÃO FINANCEIRO (APOSTAS & PRÊMIOS)
// ==============================================================================

function setupFinanceiroBolao() {
    const betBolao = $('fin-bet-bolao');
    if (betBolao) {
        betBolao.addEventListener('change', async (e) => {
            const bolao_id = e.target.value;
            const wrap = $('fin-bet-participantes-wrap');
            const list = $('fin-bet-participantes-list');
            const totalEl = $('fin-bet-participantes-total');
            
            if (!bolao_id) {
                wrap.classList.add('hidden');
                return;
            }
            
            wrap.classList.remove('hidden');
            list.innerHTML = '<div style="color:var(--text-3); font-size:0.85rem;">Carregando participantes...</div>';
            
            try {
                const parts = await BolaoService.listParticipantesAtivos(bolao_id);
                list.innerHTML = '';
                
                if (parts.length === 0) {
                    list.innerHTML = '<div style="color:var(--red); font-size:0.85rem;">Nenhum participante ativo neste bolão.</div>';
                    return;
                }
                
                const pctIgual = +(100 / parts.length).toFixed(2);
                
                parts.forEach(p => {
                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:var(--surface-3); padding:8px 12px; border-radius:4px;';
                    row.innerHTML = `
                        <label style="display:flex; align-items:center; gap:8px; margin:0; flex:1; cursor:pointer;">
                            <input type="checkbox" class="part-row-check" value="${p.id}" style="width:auto;" checked>
                            <span style="font-size:0.9rem; color:var(--text); font-weight:600;">${p.nome}</span>
                        </label>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <input type="number" class="part-row-pct percentual-input" data-id="${p.id}" value="${pctIgual}" min="0.01" max="100" step="0.01">
                            <span style="font-size:0.8rem; color:var(--text-3);">%</span>
                        </div>
                    `;
                    list.appendChild(row);
                });
                
                const calcTotal = () => {
                    let sum = 0;
                    document.querySelectorAll('.part-row-check:checked').forEach(chk => {
                        const val = parseFloat(document.querySelector(`.part-row-pct[data-id="${chk.value}"]`).value) || 0;
                        sum += val;
                    });
                    totalEl.textContent = `Soma Total: ${sum.toFixed(2)}%`;
                    totalEl.style.color = Math.abs(sum - 100) < 0.01 ? 'var(--green)' : 'var(--red)';
                };
                
                list.addEventListener('input', calcTotal);
                list.addEventListener('change', calcTotal);
                calcTotal();
                
            } catch (e) {
                list.innerHTML = '<div style="color:var(--red); font-size:0.85rem;">Erro ao carregar participantes.</div>';
            }
        });
    }
}

export function populateFinanceiroSelects(boloes_ativos, apostas_recentes) {
    const betBolao = $('fin-bet-bolao');
    if (betBolao) {
        const val = betBolao.value;
        betBolao.innerHTML = '<option value="">Aposta Individual (Sem Bolão)</option>';
        boloes_ativos.forEach(b => {
            betBolao.innerHTML += `<option value="${b.id}">${b.nome}</option>`;
        });
        if (val) betBolao.value = val;
    }
    
    const genBolao = $('gen-bolao-select');
    if (genBolao) {
        const val = genBolao.value;
        genBolao.innerHTML = '<option value="">Aposta Individual (Sem Bolão)</option>';
        boloes_ativos.forEach(b => {
            genBolao.innerHTML += `<option value="${b.id}">${b.nome}</option>`;
        });
        if (val) genBolao.value = val;
    }
    
    const prizeBet = $('fin-prize-bet');
    if (prizeBet) {
        const val = prizeBet.value;
        prizeBet.innerHTML = '<option value="">Nenhuma / Prêmio Individual</option>';
        apostas_recentes.forEach(b => {
            const dateStr = new Date(b.bet_date).toLocaleDateString('pt-BR');
            const conc = b.contest_number ? `Conc. ${b.contest_number}` : '';
            const isBolao = b.bolao_id ? ` [Bolão]` : '';
            prizeBet.innerHTML += `<option value="${b.id}">${dateStr} - ${b.lottery_type} ${conc}${isBolao}</option>`;
        });
        if (val) prizeBet.value = val;
    }
}

// ==============================================================================
// PARTICIPANTES - LÓGICA DE INTERFACE
// ==============================================================================

function updateFiltroParticipantes() {
    const select = $('filtro-bolao-participantes');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione um Bolão...</option>';
    boloes.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.nome + (b.ativo ? '' : ' (Inativo)');
        select.appendChild(opt);
    });
    
    select.addEventListener('change', async (e) => {
        const bolao_id = e.target.value;
        if (bolao_id) {
            participantes = await BolaoService.listParticipantes(bolao_id);
            renderListaParticipantes();
        } else {
            participantes = [];
            renderListaParticipantes();
        }
    });
}

function renderListaParticipantes() {
    const list = $('lista-participantes');
    const empty = $('participantes-empty');
    if (!list || !empty) return;

    list.innerHTML = '';
    
    const termo = $('busca-participante')?.value.toLowerCase() || '';
    const filtrados = participantes.filter(p => p.nome.toLowerCase().includes(termo));

    if (filtrados.length === 0) {
        empty.classList.remove('hidden');
        return;
    }
    
    empty.classList.add('hidden');

    filtrados.forEach(p => {
        const bolao = boloes.find(b => b.id === p.bolao_id);
        const card = document.createElement('div');
        card.className = 'participante-card';
        card.innerHTML = `
            <div class="participante-header">
                <span class="participante-nome">${p.nome}</span>
                <span class="participante-badge ${p.ativo ? 'ativo' : 'inativo'}">${p.ativo ? 'Ativo' : 'Inativo'}</span>
            </div>
            <div class="participante-bolao-nome">${bolao ? bolao.nome : 'Bolão Desconhecido'}</div>
            ${p.telefone ? `<div class="participante-telefone">📞 ${p.telefone}</div>` : ''}
            <div class="participante-actions">
                <button class="btn-primary btn-sm btn-edit-part" data-id="${p.id}" style="flex:1; padding:6px;">Editar</button>
                <button class="btn-secondary btn-sm btn-report-part" data-id="${p.id}" style="flex:1; padding:6px;">Extrato</button>
            </div>
        `;
        list.appendChild(card);
    });

    $$('.btn-edit-part').forEach(btn => {
        btn.addEventListener('click', () => {
            const p = participantes.find(x => x.id === btn.dataset.id);
            if (p) abrirModalParticipante(p);
        });
    });

    $$('.btn-report-part').forEach(btn => {
        btn.addEventListener('click', async () => {
            await abrirRelatorioParticipante(btn.dataset.id);
        });
    });
}

function abrirModalParticipante(participante = null) {
    const select = $('part-bolao-id');
    select.innerHTML = '<option value="">Selecione...</option>';
    
    // Lista apenas bolões ativos, exceto se editando participante de bolão inativo
    boloes.forEach(b => {
        if (b.ativo || (participante && participante.bolao_id === b.id)) {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.nome;
            select.appendChild(opt);
        }
    });

    $('part-id').value = participante ? participante.id : '';
    $('part-bolao-id').value = participante ? participante.bolao_id : ($('filtro-bolao-participantes')?.value || '');
    $('part-nome').value = participante ? participante.nome : '';
    $('part-telefone').value = participante ? (participante.telefone || '') : '';
    
    const ativoField = $('part-ativo-field');
    if (participante) {
        ativoField.style.display = 'block';
        $('part-ativo').checked = participante.ativo;
    } else {
        ativoField.style.display = 'none';
        $('part-ativo').checked = true;
    }

    $('modal-part-title').textContent = participante ? 'Editar Participante' : 'Novo Participante';
    $('modal-novo-participante').classList.remove('hidden');
}

function fecharModalParticipante() {
    $('modal-novo-participante').classList.add('hidden');
    $('form-participante').reset();
}

async function refreshParticipantes(bolao_id) {
    if ($('filtro-bolao-participantes')?.value === bolao_id) {
        participantes = await BolaoService.listParticipantes(bolao_id);
        renderListaParticipantes();
    }
}

// ==============================================================================
// RELATÓRIOS
// ==============================================================================

function updateFiltroRelatorios() {
    const select = $('relatorio-bolao-select');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione o Bolão para ver o relatório...</option>';
    boloes.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.nome;
        select.appendChild(opt);
    });
}

async function renderRelatorioBolao(bolao_id) {
    const content = $('bolao-relatorio-content');
    if (!bolao_id) {
        content.classList.add('hidden');
        return;
    }

    content.classList.remove('hidden');
    content.style.opacity = '0.5';

    try {
        const rel = await BolaoService.obterRelatorioBolao(bolao_id);
        
        $('bolao-total-arrecadado').textContent = fmt(rel.totalApostado); // Em um bolão real arrecadado pode ser diferente do apostado, mas aqui igualamos para simplificar
        $('bolao-total-apostado').textContent = fmt(rel.totalApostado);
        $('bolao-total-premiado').textContent = fmt(rel.totalPremiado);
        $('bolao-saldo').textContent = fmt(rel.saldo);
        
        const saldoEl = $('bolao-saldo');
        saldoEl.className = 'metric-value ' + (rel.saldo > 0 ? 'positive' : (rel.saldo < 0 ? 'negative' : ''));
        
        $('bolao-roi').textContent = rel.roi + '%';
        $('bolao-roi').className = 'metric-value ' + (rel.roi > 0 ? 'positive' : (rel.roi < 0 ? 'negative' : ''));
        
        const ativos = rel.participantes.filter(p => p.ativo).length;
        $('bolao-qtd-participantes').textContent = `${ativos} / ${rel.participantes.length}`;

        const tbody = $('bolao-ranking-body');
        tbody.innerHTML = '';

        rel.ranking.forEach((r, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="ranking-pos">${idx + 1}º</td>
                <td>
                    <div style="font-weight:700; color:var(--text);">${r.participante.nome}</div>
                    <div style="font-size:0.7rem; color:var(--text-3);">${r.participante.ativo ? 'Ativo' : 'Inativo'}</div>
                </td>
                <td>${r.jogos}</td>
                <td>${r.premiados}</td>
                <td>${fmt(r.investido)}</td>
                <td style="color:var(--green); font-weight:600;">${fmt(r.recebido)}</td>
                <td style="color:${r.saldo > 0 ? 'var(--green)' : (r.saldo < 0 ? 'var(--red)' : 'var(--text-2)')}">${fmt(r.saldo)}</td>
                <td style="color:${r.roi > 0 ? 'var(--green)' : (r.roi < 0 ? 'var(--red)' : 'var(--text-2)')}">${r.roi}%</td>
                <td><button class="btn-table-action btn-report-part" data-id="${r.participante.id}" title="Ver extrato">📄</button></td>
            `;
            tbody.appendChild(tr);
        });

        $$('#bolao-ranking-body .btn-report-part').forEach(btn => {
            btn.addEventListener('click', async () => {
                await abrirRelatorioParticipante(btn.dataset.id);
            });
        });

    } catch (e) {
        console.error(e);
        toast('Erro ao gerar relatório do bolão');
    } finally {
        content.style.opacity = '1';
    }
}

async function abrirRelatorioParticipante(participante_id) {
    $('modal-relatorio-individual').classList.remove('hidden');
    const content = $('relatorio-individual-content');
    content.innerHTML = '<div style="text-align:center; color:var(--text-3); padding: 40px;">Gerando extrato...</div>';

    try {
        const rel = await BolaoService.obterRelatorioParticipante(participante_id);
        
        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid var(--border); padding-bottom:12px;">
                <div>
                    <h3 style="margin:0; font-size:1.4rem; color:var(--text);">${rel.participante.nome}</h3>
                    <span class="participante-badge ${rel.participante.ativo ? 'ativo' : 'inativo'}">${rel.participante.ativo ? 'Ativo' : 'Inativo'}</span>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:0.8rem; color:var(--text-3);">Saldo Total</div>
                    <div style="font-size:1.4rem; font-weight:700; font-family:var(--font-num); color:${rel.saldo > 0 ? 'var(--green)' : (rel.saldo < 0 ? 'var(--red)' : 'var(--text)')}">${fmt(rel.saldo)}</div>
                </div>
            </div>

            <div class="bolao-stats-grid fin-dashboard" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 24px;">
                <div class="fin-metric-card">
                    <span class="metric-label">Investido</span>
                    <span class="metric-value negative">${fmt(rel.investido)}</span>
                </div>
                <div class="fin-metric-card">
                    <span class="metric-label">Recebido</span>
                    <span class="metric-value positive">${fmt(rel.recebido)}</span>
                </div>
                <div class="fin-metric-card">
                    <span class="metric-label">ROI</span>
                    <span class="metric-value" style="color:${rel.roi > 0 ? 'var(--green)' : (rel.roi < 0 ? 'var(--red)' : 'var(--text)')}">${rel.roi}%</span>
                </div>
            </div>
            
            <h4 style="color:var(--gold); margin-bottom:12px;">Histórico de Premiações</h4>
        `;

        if (rel.historico.length === 0) {
            html += `<p style="color:var(--text-3); font-size:0.9rem; text-align:center; padding:20px; background:var(--surface-2); border-radius:var(--radius-sm);">Nenhuma premiação registrada para este participante ainda.</p>`;
        } else {
            html += `
                <div class="fin-table-wrap">
                    <table class="fin-table">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Loteria</th>
                                <th>Prêmio Total (Bolão)</th>
                                <th>Cota (%)</th>
                                <th>Valor Recebido</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rel.historico.map(p => `
                                <tr>
                                    <td>${new Date(p.bets.bet_date).toLocaleDateString('pt-BR')}</td>
                                    <td><span class="type-badge" style="background:var(--surface-3); color:var(--text);">${p.bets.lottery_type}</span></td>
                                    <td>${fmt(p.premio_total)}</td>
                                    <td>${p.percentual}%</td>
                                    <td style="color:var(--green); font-weight:700;">${fmt(p.premio_recebido)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        content.innerHTML = html;
    } catch (e) {
        console.error(e);
        content.innerHTML = '<div style="color:var(--red); padding:20px;">Erro ao carregar o extrato do participante.</div>';
    }
}
