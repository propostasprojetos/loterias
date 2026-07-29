// ==========================================
// financeiro.js - Financial Dashboard & Transactions
// ==========================================

import { supabaseClient, sbReady } from './supabase.js';
import { state } from './store.js';
import { $, fmt, toast, showConfirm, ICON } from './utils.js';

// ===== LOCALSTORAGE FALLBACK =====
function getFinBetsKey() {
    return state.currentSession ? `lotosmart_bets_${state.currentSession.user.id}` : 'lotosmart_bets';
}

function getFinPrizesKey() {
    return state.currentSession ? `lotosmart_prizes_${state.currentSession.user.id}` : 'lotosmart_prizes';
}

function loadLocalBets() {
    try { return JSON.parse(localStorage.getItem(getFinBetsKey())) || []; }
    catch { return []; }
}
function saveLocalBets(data) { localStorage.setItem(getFinBetsKey(), JSON.stringify(data)); }

function loadLocalPrizes() {
    try { return JSON.parse(localStorage.getItem(getFinPrizesKey())) || []; }
    catch { return []; }
}
function saveLocalPrizes(data) { localStorage.setItem(getFinPrizesKey(), JSON.stringify(data)); }

// ===== STATE =====
export let allBets = [];
export let allPrizes = [];
export let finFilter = 'all';
let finChart = null;

// ===== CRUD =====
export async function addBet(betData, participantes = []) {
    let insertedBet = null;
    if (sbReady && state.currentSession) {
        try {
            const dataWithOwner = { ...betData, owner_id: state.currentSession.user.id };
            const { data, error } = await supabaseClient.from('bets').insert(dataWithOwner).select();
            if (error) throw error;
            insertedBet = data?.[0];
            
            if (insertedBet && participantes.length > 0) {
                // Import dinâmico para evitar dependência circular pesada se não precisar
                const BolaoService = await import('./bolao.service.js');
                await BolaoService.vincularParticipantes(insertedBet.id, participantes);
            }
        } catch (e) {
            console.error('Supabase create bet failed, using localStorage:', e);
            const bets = loadLocalBets();
            insertedBet = { ...betData, id: Date.now().toString(), created: new Date().toISOString() };
            bets.unshift(insertedBet);
            saveLocalBets(bets);
        }
    } else {
        const bets = loadLocalBets();
        insertedBet = { ...betData, id: Date.now().toString(), created: new Date().toISOString() };
        bets.unshift(insertedBet);
        saveLocalBets(bets);
    }
    await refreshFinancialData();
    return insertedBet;
}

export async function addPrize(prizeData) {
    if (sbReady && state.currentSession) {
        try {
            const dataWithOwner = { ...prizeData, owner_id: state.currentSession.user.id };
            // prizeData.bet_id is handled below, we might not have it in the prizes table schema explicitly
            // if we do, it's inserted. If not, it just ignores. We definitely use it to calculate the split.
            const bet_id = dataWithOwner.bet_id;
            delete dataWithOwner.bet_id; // in case prizes table doesn't have bet_id

            const { data, error } = await supabaseClient.from('prizes').insert(dataWithOwner).select();
            if (error) throw error;
            
            if (bet_id) {
                const BolaoService = await import('./bolao.service.js');
                await BolaoService.salvarPremiosParticipantes(bet_id, prizeData.prize_amount);
            }
        } catch (e) {
            console.error('Supabase create prize failed, using localStorage:', e);
            const prizes = loadLocalPrizes();
            prizes.unshift({ ...prizeData, id: Date.now().toString(), created: new Date().toISOString() });
            saveLocalPrizes(prizes);
        }
    } else {
        const prizes = loadLocalPrizes();
        prizes.unshift({ ...prizeData, id: Date.now().toString(), created: new Date().toISOString() });
        saveLocalPrizes(prizes);
    }
    await refreshFinancialData();
}

export async function deleteBet(id) {
    if (sbReady && state.currentSession) {
        try {
            // Remove registros dependentes antes de deletar a aposta (caso não haja CASCADE no banco)
            await supabaseClient.from('jogo_participantes').delete().eq('bet_id', id);
            await supabaseClient.from('premios_participantes').delete().eq('bet_id', id);
            await supabaseClient.from('bet_games').delete().eq('bet_id', id);
            await supabaseClient.from('automation_queue').delete().eq('bet_id', id);

            const { error } = await supabaseClient.from('bets').delete().eq('id', id);
            if (error) throw error;
        } catch (e) {
            console.error('Supabase delete bet failed:', e);
            // Fallback: remove do localStorage
            const bets = loadLocalBets().filter(b => b.id !== id);
            saveLocalBets(bets);
        }
    } else {
        const bets = loadLocalBets().filter(b => b.id !== id);
        saveLocalBets(bets);
    }
    await refreshFinancialData();
}

export async function updateBet(id, betData, participantes = []) {
    if (sbReady && state.currentSession) {
        try {
            const { error } = await supabaseClient.from('bets').update(betData).eq('id', id);
            if (error) throw error;
            
            // Atualiza vínculos de participantes (usa vincularParticipantes que já faz delete + insert)
            const BolaoService = await import('./bolao.service.js');
            if (betData.bolao_id && participantes.length > 0) {
                await BolaoService.vincularParticipantes(id, participantes);
            } else {
                // Se removeu o bolão, garante que os vínculos sejam removidos
                await BolaoService.desvincularParticipantes(id);
            }
        } catch (e) {
            console.error('Supabase update bet failed:', e);
            toast('Erro ao atualizar aposta no servidor.', 'error');
        }
    }
    await refreshFinancialData();
}

export async function deletePrize(id) {
    if (sbReady && state.currentSession) {
        try {
            const { error } = await supabaseClient.from('prizes').delete().eq('id', id);
            if (error) throw error;
        } catch (e) {
            console.error('Supabase delete prize failed:', e);
            const prizes = loadLocalPrizes().filter(p => p.id !== id);
            saveLocalPrizes(prizes);
        }
    } else {
        const prizes = loadLocalPrizes().filter(p => p.id !== id);
        saveLocalPrizes(prizes);
    }
    await refreshFinancialData();
}

export async function getAllBets() {
    if (sbReady && state.currentSession) {
        try {
            const { data, error } = await supabaseClient
                .from('bets')
                .select(`*, jogo_participantes(percentual, participantes(nome))`)
                .order('bet_date', { ascending: false });
            if (error) throw error;
            return data;
        } catch (e) {
            console.error('Supabase get bets failed:', e);
            return loadLocalBets();
        }
    }
    return loadLocalBets();
}

export async function getAllPrizes() {
    if (sbReady && state.currentSession) {
        try {
            const { data, error } = await supabaseClient.from('prizes').select('*').order('prize_date', { ascending: false });
            if (error) throw error;
            return data;
        } catch (e) {
            console.error('Supabase get prizes failed:', e);
            return loadLocalPrizes();
        }
    }
    return loadLocalPrizes();
}

export async function refreshFinancialData() {
    [allBets, allPrizes] = await Promise.all([
        getAllBets(),
        getAllPrizes()
    ]);
    renderFinancialDashboard();
    renderTransactions();
    renderFinancialChart();
    
    try {
        const BolaoService = await import('./bolao.service.js');
        const BolaoUI = await import('./bolao.js');
        const boloes = await BolaoService.listBoloes();
        const ativos = boloes.filter(b => b.ativo);
        // Pegar as ultimas apostas para vincular premio
        const recentes = allBets.slice(0, 50); 
        BolaoUI.populateFinanceiroSelects(ativos, recentes);
        populateEditBetSelect(ativos);
    } catch(e) {
        // ignora se o modulo bolao não estiver pronto
    }
}

function populateEditBetSelect(boloes_ativos) {
    const editBolao = $('edit-bet-bolao');
    if (editBolao) {
        const val = editBolao.value;
        editBolao.innerHTML = '<option value="">Aposta Individual (Sem Bolão)</option>';
        boloes_ativos.forEach(b => {
            editBolao.innerHTML += `<option value="${b.id}">${b.nome}</option>`;
        });
        if (val) editBolao.value = val;
    }
}

// ===== RENDER =====
export function renderFinancialDashboard() {
    const totalSpent = allBets.reduce((s, b) => s + (parseFloat(b.total_cost) || 0), 0);
    const totalWon = allPrizes.reduce((s, p) => s + (parseFloat(p.prize_amount) || 0), 0);
    const pl = totalWon - totalSpent;
    const roi = totalSpent > 0 ? ((totalWon / totalSpent) * 100 - 100) : 0;

    const weekSet = new Set();
    allBets.forEach(b => {
        if (b.bet_date) {
            const d = new Date(b.bet_date);
            const weekStart = new Date(d);
            weekStart.setDate(d.getDate() - d.getDay());
            weekSet.add(weekStart.toISOString().slice(0, 10));
        }
    });

    const betsWithPrize = allPrizes.length;
    const totalBetEntries = allBets.length;
    const hitRate = totalBetEntries > 0 ? ((betsWithPrize / totalBetEntries) * 100) : 0;

    if($('fin-total-spent')) {
        $('fin-total-spent').textContent = fmt(totalSpent);
        $('fin-total-spent').className = 'metric-value' + (totalSpent > 0 ? ' negative' : '');
        $('fin-spent-detail').textContent = `${allBets.length} aposta${allBets.length !== 1 ? 's' : ''} registrada${allBets.length !== 1 ? 's' : ''}`;
    }

    if($('fin-total-won')) {
        $('fin-total-won').textContent = fmt(totalWon);
        $('fin-total-won').className = 'metric-value' + (totalWon > 0 ? ' positive' : '');
        $('fin-won-detail').textContent = `${allPrizes.length} prêmio${allPrizes.length !== 1 ? 's' : ''} registrado${allPrizes.length !== 1 ? 's' : ''}`;
    }

    if($('fin-pl')) {
        $('fin-pl').textContent = (pl >= 0 ? '+' : '') + fmt(pl);
        $('fin-pl').className = 'metric-value ' + (pl >= 0 ? 'positive' : 'negative');
        $('fin-pl-detail').textContent = pl >= 0 ? 'Lucro acumulado' : 'Prejuízo acumulado';
    }

    if($('fin-roi')) {
        $('fin-roi').textContent = (roi >= 0 ? '+' : '') + roi.toFixed(1) + '%';
        $('fin-roi').className = 'metric-value ' + (roi >= 0 ? 'positive' : 'negative');
    }

    if($('fin-hit-rate')) {
        $('fin-hit-rate').textContent = hitRate.toFixed(1) + '%';
        $('fin-rate-detail').textContent = `${betsWithPrize} de ${totalBetEntries} apostas premiadas`;
    }

    if($('fin-weeks')) {
        $('fin-weeks').textContent = weekSet.size;
        $('fin-weeks-detail').textContent = weekSet.size > 0 ? `desde ${[...weekSet].sort()[0].split('-').reverse().join('/')}` : '—';
    }
}

export function renderTransactions() {
    const transactions = [];

    allBets.forEach(b => {
        let partStr = '';
        if (b.bolao_id) {
            partStr = ` · 🎰 Bolão`;
            if (b.jogo_participantes && b.jogo_participantes.length > 0) {
                const nomes = b.jogo_participantes.map(p => p.participantes?.nome || 'Desconhecido');
                partStr += ` (${nomes.join(', ')})`;
            }
        } else {
            partStr = ` · 👤 Individual`;
        }
        
        transactions.push({
            id: b.id, type: 'bet', date: b.bet_date, lottery: b.lottery_type,
            details: `${b.game_count || 1} jogo${(b.game_count || 1) > 1 ? 's' : ''}` + 
                     (b.contest_number ? ` · Conc. ${b.contest_number}` : '') + 
                     partStr +
                     (b.notes ? ` · ${b.notes}` : ''),
            amount: -(parseFloat(b.total_cost) || 0), source: 'bets',
            bolao_id: b.bolao_id,
            participantes: b.jogo_participantes || []
        });
    });

    allPrizes.forEach(p => {
        transactions.push({
            id: p.id, type: 'prize', date: p.prize_date, lottery: p.lottery_type,
            details: `${p.matches || 0} acertos` + (p.contest_number ? ` · Conc. ${p.contest_number}` : '') + (p.notes ? ` · ${p.notes}` : ''),
            amount: parseFloat(p.prize_amount) || 0, source: 'prizes'
        });
    });

    transactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const filtered = transactions.filter(t => {
        if (finFilter === 'all') return true;
        if (finFilter === 'bet') return t.type === 'bet';
        if (finFilter === 'prize') return t.type === 'prize';
        if (finFilter === 'lf') return t.lottery === 'lf';
        if (finFilter === 'qn') return t.lottery === 'qn';
        return true;
    });

    const tbody = $('fin-table-body');
    const header = $('fin-history-header');
    const tableWrap = document.querySelector('.fin-table-wrap');
    const emptyState = $('fin-table-empty');

    if(!tbody) return;

    if (transactions.length === 0) {
        if(header) header.style.display = 'none';
        if(tableWrap) tableWrap.style.display = 'none';
        if(emptyState) emptyState.style.display = 'block';
        tbody.innerHTML = '';
        return;
    } else {
        if(header) header.style.display = 'flex';
        if(tableWrap) tableWrap.style.display = 'block';
        if(emptyState) emptyState.style.display = 'none';
    }

    tbody.innerHTML = filtered.map(t => {
        const dateStr = t.date ? t.date.split('-').reverse().join('/') : '—';
        const lotteryLabel = t.lottery === 'lf' ? 'Lotofácil' : t.lottery === 'qn' ? 'Quina' : '—';
        const amountClass = t.amount >= 0 ? 'amount-positive' : 'amount-negative';
        const amountStr = (t.amount >= 0 ? '+' : '') + fmt(Math.abs(t.amount));
        const typeBadge = t.type === 'bet'
            ? '<span class="type-badge badge-bet">Gasto</span>'
            : '<span class="type-badge badge-prize">Prêmio</span>';

        return `<tr>
            <td>${dateStr}</td>
            <td>${typeBadge}</td>
            <td>${lotteryLabel}</td>
            <td>${t.details}</td>
            <td class="amount-cell ${amountClass}">${amountStr}</td>
            <td class="actions-cell">
                ${t.source === 'bets' ? `<button class="btn-icon btn-table-action btn-view-games" title="Ver Jogos" data-id="${t.id}">👁️</button>` : ''}
                ${t.source === 'bets' ? `<button class="btn-icon btn-table-action btn-edit-transaction" title="Editar" data-id="${t.id}" data-source="${t.source}">✏️</button>` : ''}
                <button class="btn-icon btn-table-action btn-del-transaction" title="Excluir" data-id="${t.id}" data-source="${t.source}">${ICON.trash}</button>
            </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('.btn-del-transaction').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const source = btn.dataset.source;
            showConfirm(
                'Excluir Transação',
                'Deseja realmente excluir esta transação do financeiro? Esta ação não pode ser desfeita.',
                async () => {
                    if (source === 'bets') await deleteBet(id);
                    else await deletePrize(id);
                }
            );
        });
    });

    tbody.querySelectorAll('.btn-view-games').forEach(btn => {
        btn.addEventListener('click', () => {
            openViewGamesModal(btn.dataset.id);
        });
    });

    tbody.querySelectorAll('.btn-edit-transaction').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            openEditBetModal(id);
        });
    });
}

export function renderFinancialChart() {
    const chartContainer = $('fin-chart-container');
    
    if (allBets.length === 0 && allPrizes.length === 0) {
        if(chartContainer) chartContainer.style.display = 'none';
        return;
    } else {
        if(chartContainer) chartContainer.style.display = 'block';
    }

    const canvasEl = $('fin-chart');
    if (!canvasEl) return;
    const ctx = canvasEl.getContext('2d');
    
    const allTransactions = [];
    allBets.forEach(b => allTransactions.push({ date: b.bet_date, amount: -(parseFloat(b.total_cost) || 0) }));
    allPrizes.forEach(p => allTransactions.push({ date: p.prize_date, amount: parseFloat(p.prize_amount) || 0 }));
    allTransactions.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    if (allTransactions.length === 0) {
        if (finChart) { finChart.destroy(); finChart = null; }
        return;
    }

    const weeklyData = {};
    allTransactions.forEach(t => {
        if (!t.date) return;
        const d = new Date(t.date);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = weekStart.toISOString().slice(0, 10);
        if (!weeklyData[key]) weeklyData[key] = { spent: 0, won: 0 };
        if (t.amount < 0) weeklyData[key].spent += Math.abs(t.amount);
        else weeklyData[key].won += t.amount;
    });

    const weeks = Object.keys(weeklyData).sort();
    const labels = weeks.map(w => {
        const d = w.split('-');
        return `${d[2]}/${d[1]}`;
    });

    let cumPL = 0;
    const cumulativePL = weeks.map(w => {
        cumPL += weeklyData[w].won - weeklyData[w].spent;
        return cumPL;
    });

    const spentData = weeks.map(w => weeklyData[w].spent);
    const wonData = weeks.map(w => weeklyData[w].won);

    if (finChart) finChart.destroy();

    // Make sure Chart.js is loaded
    if (typeof Chart === 'undefined') return;

    finChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Gastos',
                    data: spentData,
                    backgroundColor: 'rgba(232, 93, 93, 0.6)',
                    borderColor: 'rgba(232, 93, 93, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                    order: 2
                },
                {
                    label: 'Prêmios',
                    data: wonData,
                    backgroundColor: 'rgba(109, 213, 117, 0.6)',
                    borderColor: 'rgba(109, 213, 117, 1)',
                    borderWidth: 1,
                    borderRadius: 4,
                    order: 2
                },
                {
                    label: 'P&L Acumulado',
                    data: cumulativePL,
                    type: 'line',
                    borderColor: '#e8b44d',
                    backgroundColor: 'rgba(232, 180, 77, 0.1)',
                    borderWidth: 2,
                    pointBackgroundColor: '#e8b44d',
                    pointBorderColor: '#0e1015',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    fill: true,
                    tension: 0.3,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#a0a5b8',
                        font: { family: "'Inter', sans-serif", size: 11 },
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 16
                    }
                },
                tooltip: {
                    backgroundColor: '#191c24',
                    borderColor: '#353a4a',
                    borderWidth: 1,
                    titleColor: '#eaedf3',
                    bodyColor: '#a0a5b8',
                    titleFont: { family: "'Inter', sans-serif", weight: '600' },
                    bodyFont: { family: "'Outfit', sans-serif" },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => {
                            const val = ctx.parsed.y;
                            return ` ${ctx.dataset.label}: R$ ${Math.abs(val).toFixed(2).replace('.', ',')}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#636880', font: { family: "'Outfit', sans-serif", size: 10 } },
                    grid: { color: 'rgba(39, 43, 56, 0.5)', drawBorder: false }
                },
                y: {
                    ticks: {
                        color: '#636880',
                        font: { family: "'Outfit', sans-serif", size: 10 },
                        callback: v => 'R$' + v.toFixed(0)
                    },
                    grid: { color: 'rgba(39, 43, 56, 0.5)', drawBorder: false }
                }
            }
        }
    });
}

// ===== HANDLERS =====
export function handleAddBet() {
    const betDate = $('fin-bet-date').value;
    const lotteryType = $('fin-bet-type').value;
    const gameCount = parseInt($('fin-bet-qty').value) || 1;
    const totalCost = parseFloat($('fin-bet-cost').value) || 0;
    const contestNumber = parseInt($('fin-bet-contest').value) || null;
    const notes = $('fin-bet-notes').value.trim();

    if (!betDate) { toast('Informe a data da aposta'); return; }
    if (totalCost <= 0) { toast('Informe o valor gasto'); return; }

    const bolaoId = $('fin-bet-bolao')?.value || null;
    const partWrap = $('fin-bet-participantes-wrap');
    const participantes = [];

    if (bolaoId && !partWrap.classList.contains('hidden')) {
        let soma = 0;
        document.querySelectorAll('.part-row-check:checked').forEach(chk => {
            const pid = chk.value;
            const pct = parseFloat(document.querySelector(`.part-row-pct[data-id="${pid}"]`).value) || 0;
            if (pct > 0) {
                participantes.push({ participante_id: pid, percentual: pct });
                soma += pct;
            }
        });
        
        if (participantes.length === 0) {
            toast('Selecione ao menos um participante do bolão.');
            return;
        }
        if (Math.abs(soma - 100) > 0.01) {
            toast('A soma das cotas deve ser exatamente 100%!');
            return;
        }
    }

    addBet({
        bet_date: betDate,
        lottery_type: lotteryType,
        game_count: gameCount,
        total_cost: totalCost,
        contest_number: contestNumber,
        notes: notes,
        bolao_id: bolaoId
    }, participantes);

    $('fin-bet-contest').value = '';
    $('fin-bet-notes').value = '';
    toast('💸 Gasto registrado com sucesso!');
}

export function handleAddPrize() {
    const prizeDate = $('fin-prize-date').value;
    const lotteryType = $('fin-prize-type').value;
    const matches = parseInt($('fin-prize-matches').value) || 0;
    const prizeAmount = parseFloat($('fin-prize-amount').value) || 0;
    const contestNumber = parseInt($('fin-prize-contest').value) || null;
    const notes = $('fin-prize-notes').value.trim();
    const betId = $('fin-prize-bet')?.value || null;

    if (!prizeDate) { toast('Informe a data do resultado'); return; }
    if (prizeAmount <= 0) { toast('Informe o valor do prêmio'); return; }

    addPrize({
        prize_date: prizeDate,
        lottery_type: lotteryType,
        matches: matches,
        prize_amount: prizeAmount,
        contest_number: contestNumber,
        notes: notes,
        bet_id: betId
    });

    $('fin-prize-contest').value = '';
    $('fin-prize-notes').value = '';
    $('fin-prize-bet').value = '';
}

// ==========================================
// EDIT BET MODAL LOGIC
// ==========================================

async function openEditBetModal(id) {
    const bet = allBets.find(b => b.id === id);
    if (!bet) return;
    
    $('edit-bet-id').value = bet.id;
    $('edit-bet-notes').value = bet.notes || '';
    $('edit-bet-contest').value = bet.contest_number || '';
    $('edit-bet-bolao').value = bet.bolao_id || '';
    
    $('modal-edit-bet').classList.remove('hidden');
    
    if (bet.bolao_id) {
        await renderEditBetParticipantes(bet.bolao_id, bet.jogo_participantes);
    } else {
        $('edit-bet-participantes-wrap').classList.add('hidden');
    }
}

async function renderEditBetParticipantes(bolao_id, existingParts) {
    const wrap = $('edit-bet-participantes-wrap');
    const list = $('edit-bet-participantes-list');
    const totalEl = $('edit-bet-participantes-total');
    
    if (!bolao_id) {
        wrap.classList.add('hidden');
        return;
    }
    
    wrap.classList.remove('hidden');
    list.innerHTML = '<div style="color:var(--text-3); font-size:0.85rem;">Carregando...</div>';
    
    try {
        const BolaoService = await import('./bolao.service.js');
        const parts = await BolaoService.listParticipantesAtivos(bolao_id);
        list.innerHTML = '';
        
        if (parts.length === 0) {
            list.innerHTML = '<div style="color:var(--red); font-size:0.85rem;">Nenhum participante ativo.</div>';
            return;
        }
        
        const pctIgual = +(100 / parts.length).toFixed(2);
        
        parts.forEach(p => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:var(--surface-3); padding:8px 12px; border-radius:4px;';
            
            // Verifica se o participante ja estava na aposta
            const exist = existingParts ? existingParts.find(ep => ep.participante_id === p.id) : null;
            const isChecked = !!exist || !existingParts; // default checked if new, or check if exist
            const val = exist ? exist.percentual : pctIgual;
            
            row.innerHTML = `
                <label style="display:flex; align-items:center; gap:8px; margin:0; flex:1; cursor:pointer;">
                    <input type="checkbox" class="edit-part-row-check" value="${p.id}" style="width:auto;" ${isChecked ? 'checked' : ''}>
                    <span style="font-size:0.9rem; color:var(--text); font-weight:600;">${p.nome}</span>
                </label>
                <div style="display:flex; align-items:center; gap:6px;">
                    <input type="number" class="edit-part-row-pct percentual-input" data-id="${p.id}" value="${val}" min="0.01" max="100" step="0.01">
                    <span style="font-size:0.8rem; color:var(--text-3);">%</span>
                </div>
            `;
            list.appendChild(row);
        });
        
        const calcTotal = () => {
            let sum = 0;
            document.querySelectorAll('.edit-part-row-check:checked').forEach(chk => {
                const val = parseFloat(document.querySelector(`.edit-part-row-pct[data-id="${chk.value}"]`).value) || 0;
                sum += val;
            });
            totalEl.textContent = `Soma Total: ${sum.toFixed(2)}%`;
            totalEl.style.color = Math.abs(sum - 100) < 0.01 ? 'var(--green)' : 'var(--red)';
        };
        
        list.addEventListener('input', calcTotal);
        list.addEventListener('change', calcTotal);
        calcTotal();
        
    } catch (e) {
        list.innerHTML = '<div style="color:var(--red); font-size:0.85rem;">Erro.</div>';
    }
}

// ==========================================
// VIEW BET GAMES MODAL LOGIC
// ==========================================

async function openViewGamesModal(id) {
    const bet = allBets.find(b => b.id === id);
    if (!bet) return;
    
    $('modal-view-games').classList.remove('hidden');
    $('view-games-list').innerHTML = '';
    $('view-games-loading').style.display = 'block';
    $('view-games-title').textContent = `Jogos da Aposta - ${bet.lottery_type.toUpperCase()}`;
    
    if (sbReady && state.currentSession) {
        try {
            const { data, error } = await supabaseClient
                .from('bet_games')
                .select('numbers')
                .eq('bet_id', id)
                .order('game_index', { ascending: true });
                
            $('view-games-loading').style.display = 'none';
            
            if (error) throw error;
            
            if (!data || data.length === 0) {
                $('view-games-list').innerHTML = '<div style="color:var(--text-3); grid-column: 1 / -1; text-align: center;">Nenhum detalhe de jogo registrado para esta aposta (ou aposta manual).</div>';
                return;
            }
            
            const list = $('view-games-list');
            data.forEach((g, idx) => {
                const arr = Array.isArray(g.numbers) ? g.numbers : [];
                const numsStr = arr.map(n => `<span style="display:inline-block; background:var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 2px 6px; font-size:0.8rem; font-weight:600; color:var(--text); margin:2px;">${pad(n)}</span>`).join('');
                
                const card = document.createElement('div');
                card.style.cssText = 'background:var(--surface-3); padding:12px; border-radius:6px; border:1px solid var(--border);';
                card.innerHTML = `
                    <div style="font-size:0.75rem; color:var(--text-3); margin-bottom:8px; font-weight:700;">JOGO ${idx + 1}</div>
                    <div style="display:flex; flex-wrap:wrap;">${numsStr}</div>
                `;
                list.appendChild(card);
            });
            
        } catch(e) {
            console.error('Erro ao buscar jogos da aposta:', e);
            $('view-games-loading').style.display = 'none';
            $('view-games-list').innerHTML = '<div style="color:var(--red); grid-column: 1 / -1; text-align: center;">Erro ao carregar jogos.</div>';
        }
    } else {
        $('view-games-loading').style.display = 'none';
        $('view-games-list').innerHTML = '<div style="color:var(--text-3); grid-column: 1 / -1; text-align: center;">Indisponível no modo offline.</div>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    $('btn-close-edit-bet')?.addEventListener('click', () => {
        $('modal-edit-bet').classList.add('hidden');
    });
    $('btn-cancel-edit-bet')?.addEventListener('click', () => {
        $('modal-edit-bet').classList.add('hidden');
    });
    
    $('btn-close-view-games')?.addEventListener('click', () => {
        $('modal-view-games').classList.add('hidden');
    });
    $('btn-close-view-games-2')?.addEventListener('click', () => {
        $('modal-view-games').classList.add('hidden');
    });
    
    $('edit-bet-bolao')?.addEventListener('change', async (e) => {
        await renderEditBetParticipantes(e.target.value, null);
    });

    $('form-edit-bet')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = $('edit-bet-id').value;
        const notes = $('edit-bet-notes').value.trim();
        const contest = parseInt($('edit-bet-contest').value) || null;
        const bolao_id = $('edit-bet-bolao').value || null;
        
        let participantes = [];
        if (bolao_id) {
            let sum = 0;
            document.querySelectorAll('.edit-part-row-check:checked').forEach(chk => {
                const pct = parseFloat(document.querySelector(`.edit-part-row-pct[data-id="${chk.value}"]`).value) || 0;
                participantes.push({ participante_id: chk.value, percentual: pct });
                sum += pct;
            });
            if (Math.abs(sum - 100) > 0.01) {
                toast('A soma das cotas deve ser exatamente 100%', 'error');
                return;
            }
        }
        
        const updateData = { notes, contest_number: contest, bolao_id };
        await updateBet(id, updateData, participantes);
        
        $('modal-edit-bet').classList.add('hidden');
        toast('Aposta atualizada com sucesso!', 'success');
    });
});

export function setFinFilter(filter) {
    finFilter = filter;
    renderTransactions();
}
