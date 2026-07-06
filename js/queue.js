// ==========================================
// queue.js - Automation Queue & Realtime
// ==========================================

import { supabaseClient, sbReady } from './supabase.js';
import { state } from './store.js';
import { $, pad, fmt, toast, showConfirm } from './utils.js';
import { addBet, refreshFinancialData } from './financeiro.js';
import { updateSummary } from './gerador.js';

export async function enqueueBetsForAutomation() {
    try {
        const btn = $('btn-automation-gen');
        if (btn) {
            btn.classList.add('loading');
            btn.textContent = 'Processando...';
        }

        const qtys = updateSummary();
        const today = new Date().toISOString().slice(0, 10);
        let enqueued = 0;

        for (const g of state.activeGames) {
            const qty = qtys[g.slug];
            if (qty > 0) {
                const el = $('qty-'+g.slug);
                const cost = el && el.dataset ? parseFloat(el.dataset.cost) : 0;
                const total = qty * (isNaN(cost) ? 0 : cost);
                const strategy = $('strategy-selector')?.value || 'statistical';
                const gamesArr = state.currentGamesData[g.slug]?.games || [];

                if (gamesArr.length === 0) continue;

                const betData = {
                    bet_date: today,
                    lottery_type: g.slug,
                    game_count: gamesArr.length,
                    total_cost: total,
                    contest_number: null,
                    notes: `Automacao LotoSmart`,
                    games: [],
                    generation_mode: strategy,
                    automation_status: 'queued',
                    automation_requested_at: new Date().toISOString()
                };

                const insertedBet = await addBet(betData);

                if (!insertedBet || !insertedBet.id) {
                    toast('Erro ao criar a aposta no banco.');
                    continue;
                }

                if (sbReady && state.currentSession) {
                    const betGamesPayload = gamesArr.map((numbers, idx) => ({
                        bet_id: insertedBet.id,
                        owner_id: state.currentSession.user.id,
                        lottery_type: g.slug,
                        numbers: numbers,
                        game_index: idx,
                        status: 'pendente'
                    }));

                    try {
                        const { error: bgErr } = await supabaseClient.from('bet_games').insert(betGamesPayload);
                        if (bgErr) throw bgErr;
                    } catch (e) {
                        console.error('Erro ao criar bet_games:', e);
                        toast('Erro ao registrar jogos individuais: ' + e.message);
                    }

                    try {
                        const { error } = await supabaseClient.from('automation_queue').insert({ 
                            bet_id: insertedBet.id, 
                            owner_id: state.currentSession.user.id, 
                            status: 'queued' 
                        });
                        if (error) throw error;
                        enqueued++;
                    } catch (e) {
                        console.error('Erro ao enfileirar:', e);
                        alert('Erro ao enviar para a fila de automacao: ' + e.message);
                    }
                }
            }
        }

        if (btn) {
            btn.classList.remove('loading');
            btn.textContent = 'Fazer Jogos';
        }

        if (enqueued > 0) {
            toast(`${enqueued} aposta(s) enviada(s) para fila! Acompanhe abaixo.`);
            await refreshPendingPanel();
        } else {
            toast('Nenhuma aposta enfileirada. Banco offline ou sem jogos gerados.');
        }
    } catch (err) {
        console.error('Erro fatal em enqueueBetsForAutomation:', err);
        alert('Erro no botao Fazer Jogos: ' + err.message);
        const btn = $('btn-automation-gen');
        if (btn) {
            btn.classList.remove('loading');
            btn.textContent = 'Fazer Jogos';
        }
    }
}

export async function clearAutomationQueue() {
    if (!sbReady || !state.currentSession) {
        toast('Você precisa estar conectado para limpar a fila.');
        return;
    }

    showConfirm(
        'Limpar Fila de Automação',
        'Limpar a fila cancela todos os jobs pendentes e em processamento.\nO robô vai parar de pegar novas tarefas.\n\nDeseja confirmar?',
        async () => {
            const btn = $('btn-clear-queue-gen');
            const btnPanel = $('btn-clear-queue-panel');
            [btn, btnPanel].forEach(b => { if (b) { b.disabled = true; b.textContent = 'Limpando...'; } });

            try {
                const { error: qErr } = await supabaseClient
                    .from('automation_queue')
                    .delete()
                    .eq('owner_id', state.currentSession.user.id)
                    .in('status', ['queued', 'processing']);
                if (qErr) throw qErr;

                const { error: bErr } = await supabaseClient
                    .from('bets')
                    .update({ automation_status: 'none' })
                    .eq('owner_id', state.currentSession.user.id)
                    .in('automation_status', ['queued', 'processing']);
                if (bErr) throw bErr;

                const { error: bgErr } = await supabaseClient
                    .from('bet_games')
                    .update({ status: 'pendente', error_message: 'Cancelado pelo usuário' })
                    .eq('owner_id', state.currentSession.user.id)
                    .eq('status', 'processando');
                if (bgErr) throw bgErr;

                toast('Fila limpa! O robô não processará mais nenhum job pendente.', 'success');
                await refreshPendingPanel();
            } catch (e) {
                console.error('Erro ao limpar fila:', e);
                toast('Erro ao limpar fila: ' + e.message);
            } finally {
                [btn, btnPanel].forEach(b => {
                    if (b) {
                        b.disabled = false;
                        b.textContent = b.id === 'btn-clear-queue-panel' ? 'Limpar Fila' : '🗑️ Limpar Fila';
                    }
                });
            }
        }
    );
}

export async function resetAllFinancialData() {
    if (!sbReady || !state.currentSession) {
        toast('Você precisa estar conectado.');
        return;
    }

    showConfirm(
        '⚠️ MODO HOMOLOGAÇÃO',
        'Isso vai apagar PERMANENTEMENTE:\n• Todas as apostas (bets)\n• Todos os prêmios (prizes)\n• Todos os jogos individuais (bet_games)\n• Toda a fila de automação\n• Todo o histórico local\n\nTem certeza absoluta?',
        async () => {
            const btn = $('btn-reset-all-data');
            if (btn) { btn.disabled = true; btn.textContent = 'Limpando...'; }

            const uid = state.currentSession.user.id;

            try {
                await supabaseClient.from('automation_queue').delete().eq('owner_id', uid);
                await supabaseClient.from('bet_games').delete().eq('owner_id', uid);
                await supabaseClient.from('bets').delete().eq('owner_id', uid);
                await supabaseClient.from('prizes').delete().eq('owner_id', uid);

                localStorage.removeItem('lotosmart_bets');
                localStorage.removeItem('lotosmart_prizes');
                localStorage.removeItem('lotosmart_history');

                toast('Todos os dados de teste foram apagados!', 'success');
                await refreshFinancialData();
                await refreshPendingPanel();

            } catch (e) {
                console.error('Erro ao resetar dados:', e);
                toast('Erro ao limpar: ' + (e.message || e));
            } finally {
                if (btn) { btn.disabled = false; btn.textContent = '🗑️ Limpar todos os dados de teste'; }
            }
        }
    );
}

// ===== REALTIME CACHE =====
window._betGamesCache = {};

const STATUS_LABELS = {
    pendente:             { label: 'Pendente',           cls: 'status-pendente' },
    processando:          { label: 'Processando...',     cls: 'status-processando' },
    sucesso:              { label: 'Registrado',         cls: 'status-sucesso' },
    erro:                 { label: 'Erro',               cls: 'status-erro' },
    pendente_lancamento:  { label: 'Aguard. Lancamento', cls: 'status-pendente-lancamento' },
    lancado:              { label: 'Lancado',            cls: 'status-lancado' },
};

export function getStatusInfo(status) {
    return STATUS_LABELS[status] || { label: status, cls: '' };
}

export async function refreshPendingPanel() {
    if (!sbReady || !state.currentSession) return;
    try {
        const { data, error } = await supabaseClient
            .from('bet_games')
            .select('*')
            .eq('owner_id', state.currentSession.user.id)
            .in('status', ['pendente', 'processando', 'pendente_lancamento'])
            .order('created_at', { ascending: false });
        if (error) throw error;
        
        (data || []).forEach(bg => { window._betGamesCache[bg.id] = bg; });
        renderPendingPanel(data || []);
    } catch (e) {
        console.error('Erro ao carregar pendentes:', e);
    }
}

export function renderPendingPanel(items) {
    const panel = $('pending-launch-panel');
    if (!panel) return;

    const pendLaunch = items.filter(i => i.status === 'pendente_lancamento');
    const inProgress = items.filter(i => ['pendente', 'processando'].includes(i.status));

    const badge = $('pending-launch-badge');
    if (badge) {
        badge.textContent = pendLaunch.length;
        badge.classList.toggle('hidden', pendLaunch.length === 0);
    }

    if (items.length === 0) {
        panel.innerHTML = '<p class="fin-empty-state">Nenhum jogo aguardando lancamento.</p>';
        return;
    }

    const totalPend = pendLaunch.reduce((acc, bg) => {
        const g = state.activeGames.find(x => x.slug === bg.lottery_type);
        return acc + (g?.parametros?.cost || 3.00);
    }, 0);

    let html = '';
    html += `<div class="pending-summary">
        <span>${pendLaunch.length} jogo(s) prontos p/ lancamento &mdash; <strong>${fmt(totalPend)}</strong></span>
        ${pendLaunch.length > 0 ? `<button class="btn-primary" id="btn-confirm-launch" style="margin-left:12px;padding:8px 16px;font-size:.82rem">Confirmar Lancamento Financeiro</button>` : ''}
    </div>`;

    if (inProgress.length > 0) {
        html += `<div class="pending-group"><p class="pending-group-title">Em andamento (${inProgress.length})</p>`;
        inProgress.forEach(bg => {
            const info = getStatusInfo(bg.status);
            const nums = (bg.numbers || []).map(n => pad(n)).join(', ');
            html += `<div class="pending-game-item">
                <span class="status-badge ${info.cls}">${info.label}</span>
                <span class="pending-lottery">${bg.lottery_type}</span>
                <span class="pending-numbers">${nums}</span>
            </div>`;
        });
        html += `</div>`;
    }

    if (pendLaunch.length > 0) {
        html += `<div class="pending-group"><p class="pending-group-title">Prontos para lancamento (${pendLaunch.length})</p>`;
        pendLaunch.forEach(bg => {
            const info = getStatusInfo(bg.status);
            const nums = (bg.numbers || []).map(n => pad(n)).join(', ');
            html += `<div class="pending-game-item" data-bgid="${bg.id}">
                <span class="status-badge ${info.cls}">${info.label}</span>
                <span class="pending-lottery">${bg.lottery_type}</span>
                <span class="pending-numbers">${nums}</span>
            </div>`;
        });
        html += `</div>`;
    }

    panel.innerHTML = html;
    
    // Bind click event after rendering
    const btn = $('btn-confirm-launch');
    if(btn) {
        btn.addEventListener('click', () => confirmFinancialLaunch(pendLaunch));
    }
}

export async function confirmFinancialLaunch(pendItems) {
    if (!pendItems || pendItems.length === 0) return;

    showConfirm(
        'Confirmar Lançamento Financeiro',
        `Deseja registrar o lançamento de ${pendItems.length} jogo(s) no módulo Financeiro? Isso debitará o custo contábil dos jogos do seu saldo.`,
        async () => {
            const today = new Date().toISOString().slice(0, 10);
            const grouped = {};
            
            pendItems.forEach(bg => {
                if (!grouped[bg.bet_id]) {
                    grouped[bg.bet_id] = { lottery_type: bg.lottery_type, games: [], ids: [] };
                }
                grouped[bg.bet_id].games.push(bg.numbers);
                grouped[bg.bet_id].ids.push(bg.id);
            });

            for (const [bet_id, grp] of Object.entries(grouped)) {
                const g = state.activeGames.find(x => x.slug === grp.lottery_type);
                const costUnit = g?.parametros?.cost || 3.00;
                const total = grp.games.length * costUnit;

                await addBet({
                    bet_date: today,
                    lottery_type: grp.lottery_type,
                    game_count: grp.games.length,
                    total_cost: total,
                    notes: `Lancamento automatico via robo`,
                    games: grp.games,
                });

                if (sbReady && state.currentSession) {
                    await supabaseClient.from('bet_games').update({ status: 'lancado' }).in('id', grp.ids);
                }
            }

            toast(`${pendItems.length} jogo(s) lancados no Financeiro!`, 'success');
            await refreshPendingPanel();
        }
    );
}

let _realtimeChannel = null;

export function initBetGamesRealtime() {
    if (!sbReady || !state.currentSession || !supabaseClient) return;

    if (_realtimeChannel) {
        supabaseClient.removeChannel(_realtimeChannel);
        _realtimeChannel = null;
    }

    _realtimeChannel = supabaseClient
        .channel('bet_games_realtime')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'bet_games',
                filter: `owner_id=eq.${state.currentSession.user.id}`,
            },
            async (payload) => {
                const updated = payload.new;
                if (!updated) return;

                window._betGamesCache[updated.id] = updated;

                const statusEl = document.querySelector(`[data-bgstatus="${updated.id}"]`);
                if (statusEl) {
                    const info = getStatusInfo(updated.status);
                    statusEl.className = `bet-game-status-badge ${info.cls}`;
                    statusEl.textContent = info.label;
                }

                if (['pendente_lancamento', 'erro', 'sucesso'].includes(updated.status)) {
                    await refreshPendingPanel();
                }
            }
        )
        .subscribe();
}
