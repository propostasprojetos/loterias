// admin.js - Super Admin Logic para LotoSmart

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar abas do Super Admin
    const adminTabBtns = document.querySelectorAll('.admin-tab-btn');
    adminTabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
            e.target.classList.add('active');
            document.getElementById(e.target.dataset.tab).classList.remove('hidden');
        });
    });

    // Modais Abas (Ex: Perfil vs MÃ³dulos no UsuÃ¡rio)
    const modalTabBtns = document.querySelectorAll('.modal-tab-btn');
    modalTabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.disabled) return;
            const modal = e.target.closest('.modal-content');
            modal.querySelectorAll('.modal-tab-btn').forEach(b => b.classList.remove('active'));
            modal.querySelectorAll('.modal-tab-content').forEach(c => c.classList.add('hidden'));
            e.target.classList.add('active');
            document.getElementById(e.target.dataset.tab).classList.remove('hidden');
        });
    });

    // Fechar modais
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal-overlay').classList.add('hidden');
        });
    });

    // Abrir modais
    document.getElementById('btn-show-create-user')?.addEventListener('click', () => openUserModal());
    document.getElementById('btn-show-create-plan')?.addEventListener('click', () => openPlanModal());
    document.getElementById('btn-show-create-game')?.addEventListener('click', () => openGameModal());

    // Forms
    document.getElementById('form-admin-user')?.addEventListener('submit', saveUser);
    document.getElementById('form-admin-plan')?.addEventListener('submit', savePlan);
    document.getElementById('form-admin-game')?.addEventListener('submit', saveGame);
    
    // Reset password force
    window.handleResetUserPassword = async function(id) {
        alert('Por motivos de segurança, a redefinição de senha de usuários deve ser feita diretamente no painel do Supabase (Authentication -> Users -> Reset Password), pois a API Client não possui privilégios para alterar senhas de terceiros.');
    };

    document.getElementById('btn-reset-user-pass')?.addEventListener('click', async (e) => {
        const id = document.getElementById('edit-user-id').value;
        if(id) {
            await window.handleResetUserPassword(id);
        }
    });

    document.getElementById('btn-refresh-automation')?.addEventListener('click', () => {
        if (typeof loadAutomationQueue === 'function') loadAutomationQueue();
    });
});

async function refreshAdminData() {
    if (!window.sbReady || !window.currentSession) return;
    
    // Verifica is_super_admin
    const { data: isSuper, error: isSuperErr } = await window.supabaseClient.rpc('is_super_admin', { _user_id: window.currentSession.user.id });
    if (isSuperErr || !isSuper) {
        console.warn('Acesso negado: NÃ£o Ã© super admin');
        return;
    }

    try {
        await Promise.all([
            loadDashboardStats(),
            loadUsersAdmin(),
            loadPlansAdmin(),
            loadGamesAdmin(),
            loadAuditAdmin(),
            loadAutomationQueue()
        ]);
    } catch (e) {
        console.error('Erro ao carregar dados do admin:', e);
    }
}

async function loadDashboardStats() {
    const { count: totalUsers } = await window.supabaseClient.from('profiles').select('*', { count: 'exact', head: true });
    const { count: activeUsers } = await window.supabaseClient.from('profiles').select('*', { count: 'exact', head: true }).eq('ativo', true);
    const { count: totalPlans } = await window.supabaseClient.from('planos').select('*', { count: 'exact', head: true }).eq('status', 'ativo');
    const { count: totalGames } = await window.supabaseClient.from('jogos').select('*', { count: 'exact', head: true }).eq('status', 'ativo');

    document.getElementById('admin-stat-total').textContent = totalUsers || 0;
    document.getElementById('admin-stat-active').textContent = activeUsers || 0;
    document.getElementById('admin-stat-planos').textContent = totalPlans || 0;
    document.getElementById('admin-stat-jogos').textContent = totalGames || 0;
}

async function loadUsersAdmin() {
    const { data: users, error } = await window.supabaseClient
        .from('profiles')
        .select('*, planos(nome)')
        .order('created_at', { ascending: false });
    
    if (error) return console.error(error);

    const tbody = document.getElementById('admin-users-table');
    tbody.innerHTML = '';
    
    users.forEach(u => {
        const tr = document.createElement('tr');
        const planName = u.planos ? u.planos.nome : 'Nenhum';
        tr.innerHTML = `
            <td>${u.name || '-'}</td>
            <td>${u.cpf || '-'}</td>
            <td><span class="type-badge badge-prize">${planName}</span></td>
            <td><span class="type-badge ${u.ativo ? 'badge-prize' : 'badge-bet'}">${u.ativo ? 'Ativo' : 'Inativo'}</span></td>
            <td>${u.ultimo_login ? new Date(u.ultimo_login).toLocaleString('pt-BR') : 'Nunca'}</td>
            <td>
                <button class="btn-sm" onclick="editUser('${u.id}')">Editar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function loadPlansAdmin() {
    const { data: plans, error } = await window.supabaseClient.from('planos').select('*, plano_jogos(jogos(nome))').order('criado_em', { ascending: true });
    if (error) return console.error(error);

    const tbody = document.getElementById('admin-plans-table');
    tbody.innerHTML = '';

    plans.forEach(p => {
        const tr = document.createElement('tr');
        const jogosInclusos = p.plano_jogos && p.plano_jogos.length > 0 ? p.plano_jogos.map(pj => pj.jogos.nome).join(', ') : 'Nenhum';
        tr.innerHTML = `
            <td>${p.nome}</td>
            <td>${jogosInclusos}</td>
            <td><span class="type-badge ${p.status === 'ativo' ? 'badge-prize' : 'badge-bet'}">${p.status}</span></td>
            <td>
                <button class="btn-sm" onclick="editPlan('${p.id}')">Editar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function loadGamesAdmin() {
    const { data: games, error } = await window.supabaseClient.from('jogos').select('*').order('ordem', { ascending: true });
    if (error) return console.error(error);

    const tbody = document.getElementById('admin-games-table');
    tbody.innerHTML = '';

    games.forEach(g => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', (e) => {
            if (e.target.closest('button') || e.target.closest('a')) {
                return;
            }
            editGame(g.id);
        });
        const params = g.parametros || {};
        tr.innerHTML = `
            <td>${g.nome}</td>
            <td><code>${g.slug}</code></td>
            <td>${params.range_min || 1} a ${params.range_max || '?'}</td>
            <td>${params.pick_size || '?'}</td>
            <td><span class="type-badge ${g.status === 'ativo' ? 'badge-prize' : 'badge-bet'}">${g.status}</span></td>
            <td>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-icon" style="color: var(--gold); border-color: rgba(232,180,77,.25); width: 28px; height: 28px;" onclick="editGame('${g.id}')" title="Editar">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn-icon" style="color: var(--red); border-color: rgba(232,93,93,.25); width: 28px; height: 28px;" onclick="deleteGame('${g.id}', '${g.nome}')" title="Excluir">
                        ✕
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function loadAuditAdmin() {
    const { data: audit, error } = await window.supabaseClient.from('audit_logs').select('*, profiles(name)').order('created_at', { ascending: false }).limit(20);
    if (error) return console.error(error);

    const tbody = document.getElementById('admin-audit-table');
    tbody.innerHTML = '';
    
    audit.forEach(log => {
        const tr = document.createElement('tr');
        const userName = log.profiles ? log.profiles.name : 'Sistema';
        tr.innerHTML = `
            <td>${new Date(log.created_at).toLocaleString('pt-BR')}</td>
            <td>${log.action}</td>
            <td>${userName}</td>
            <td><pre style="font-size:0.7rem; max-width: 300px; overflow: auto; margin:0;">${JSON.stringify(log.details)}</pre></td>
        `;
        tbody.appendChild(tr);
    });
}

// ======================= MODAIS DE CRIAÃ‡ÃƒO E EDIÃ‡ÃƒO =======================

async function openUserModal(userId = null) {
    document.getElementById('form-admin-user').reset();
    document.getElementById('edit-user-id').value = '';
    document.getElementById('modal-user-title').textContent = userId ? 'Editar Cliente' : 'Novo Cliente';
    
    // Configurar campos baseados se Ã© novo ou ediÃ§Ã£o
    document.getElementById('wrap-user-password').style.display = userId ? 'none' : 'block';
    document.getElementById('user-password').required = !userId;
    document.getElementById('btn-reset-user-pass').classList.toggle('hidden', !userId);
    document.getElementById('btn-tab-modulos').disabled = !userId; // SÃ³ permite mexer no mÃ³dulo de quem jÃ¡ existe por enquanto, ou podemos liberar sempre.
    
    if(!userId) document.getElementById('btn-tab-modulos').disabled = true;

    // Carregar planos no select
    const { data: plans } = await window.supabaseClient.from('planos').select('id, nome').eq('status', 'ativo');
    const selectPlan = document.getElementById('user-plano');
    selectPlan.innerHTML = '<option value="">Sem Plano</option>';
    if (plans) plans.forEach(p => selectPlan.innerHTML += `<option value="${p.id}">${p.nome}</option>`);

    // Carregar overrides
    const { data: games } = await window.supabaseClient.from('jogos').select('slug, nome').eq('status', 'ativo');
    const overridesDiv = document.getElementById('user-games-list');
    overridesDiv.innerHTML = '';
    
    if (userId) {
        document.getElementById('btn-tab-modulos').disabled = false;
        const { data: user } = await window.supabaseClient.from('profiles').select('*').eq('id', userId).single();
        if (user) {
            document.getElementById('edit-user-id').value = user.id;
            document.getElementById('user-name').value = user.name || '';
            document.getElementById('user-email').value = user.email || '';
            document.getElementById('user-cpf').value = user.cpf || '';
            document.getElementById('user-celular').value = user.celular || '';
            document.getElementById('user-status').value = user.ativo.toString();
            document.getElementById('user-plano').value = user.plano_id || '';
            
            const modulos = user.modulos_customizados || {};
            
            // Render overrides
            if (games) {
                games.forEach(g => {
                    const val = modulos[g.slug];
                    const stateStr = val === true ? 'ForÃ§ar LiberaÃ§Ã£o' : val === false ? 'ForÃ§ar Bloqueio' : 'Herdar do Plano';
                    overridesDiv.innerHTML += `
                        <div class="override-card">
                            <div style="font-size: 0.9rem; font-weight: 600; margin-bottom: 8px; color: var(--gold);">${g.nome}</div>
                            <div class="input-row" style="padding: 2px;">
                                <select class="override-select" data-slug="${g.slug}" style="width: 100%; background: none; border: none; color: var(--text); outline: none; font-size: 0.85rem;">
                                    <option value="inherit" ${val === undefined ? 'selected' : ''}>Herdar do Plano</option>
                                    <option value="true" ${val === true ? 'selected' : ''}>Forçar Liberação</option>
                                    <option value="false" ${val === false ? 'selected' : ''}>Forçar Bloqueio</option>
                                </select>
                            </div>
                        </div>
                    `;
                });
            }
        }
    }

    // Reseta as abas para o Perfil
    document.querySelectorAll('#modal-admin-user .modal-tab-btn')[0].click();
    document.getElementById('modal-admin-user').classList.remove('hidden');
}

window.editUser = function(id) { openUserModal(id); };

async function saveUser(e) {
    e.preventDefault();
    const id = document.getElementById('edit-user-id').value;
    const name = document.getElementById('user-name').value;
    const email = document.getElementById('user-email').value;
    const cpf = document.getElementById('user-cpf').value || null;
    const celular = document.getElementById('user-celular').value || null;
    const ativo = document.getElementById('user-status').value === 'true';
    const plano_id = document.getElementById('user-plano').value || null;
    const password = document.getElementById('user-password').value;

    try {
        if (!id) {
            // Criação
            const { data, error } = await window.supabaseClient.rpc('create_user_by_admin', {
                p_name: name,
                p_email: email,
                p_celular: celular,
                p_cpf: cpf,
                p_plano_id: plano_id,
                p_password: password
            });
            if (error) throw error;
            await window.logAudit('create_user', email, { name, email, cpf, celular, plano_id });
            window.toast('Usuário criado com sucesso!');
        } else {
            // Edição
            const modulos = {};
            document.querySelectorAll('.override-select').forEach(sel => {
                const val = sel.value;
                if (val === 'true') modulos[sel.dataset.slug] = true;
                if (val === 'false') modulos[sel.dataset.slug] = false;
            });

            const { error } = await window.supabaseClient.from('profiles').update({
                name, email, cpf, celular, ativo, plano_id, modulos_customizados: modulos
            }).eq('id', id);
            
            if (error) throw error;
            await window.logAudit('edit_user', id, { name, email, cpf, celular, ativo, plano_id, modulos });
            window.toast('Usuário atualizado com sucesso!');
        }
        
        document.getElementById('modal-admin-user').classList.add('hidden');
        await refreshAdminData();
    } catch (err) {
        console.error(err);
        let errorMsg = err.message || err.error_description || JSON.stringify(err);
        if (err.details) errorMsg += ' - ' + err.details;
        alert('Erro ao salvar usuário: ' + errorMsg);
    }
}

async function openPlanModal(planId = null) {
    document.getElementById('form-admin-plan').reset();
    document.getElementById('edit-plan-id').value = '';
    document.getElementById('modal-plan-title').textContent = planId ? 'Editar Plano' : 'Novo Plano';

    // Carregar todos os jogos para checkboxes
    const { data: games } = await window.supabaseClient.from('jogos').select('id, nome').eq('status', 'ativo');
    const gamesDiv = document.getElementById('plan-games-list');
    gamesDiv.innerHTML = '';
    
    let selectedGames = [];
    if (planId) {
        const { data: plan } = await window.supabaseClient.from('planos').select('*, plano_jogos(jogo_id)').eq('id', planId).single();
        if (plan) {
            document.getElementById('edit-plan-id').value = plan.id;
            document.getElementById('plan-name').value = plan.nome;
            document.getElementById('plan-status').value = plan.status;
            selectedGames = plan.plano_jogos.map(pj => pj.jogo_id);
        }
    }

    if (games) {
        games.forEach(g => {
            const isChecked = selectedGames.includes(g.id) ? 'checked' : '';
            gamesDiv.innerHTML += `
                <label class="checkbox-item">
                    <input type="checkbox" name="plan_games" value="${g.id}" ${isChecked}>
                    <span>${g.nome}</span>
                </label>
            `;
        });
    }

    document.getElementById('modal-admin-plan').classList.remove('hidden');
}

window.editPlan = function(id) { openPlanModal(id); };

async function savePlan(e) {
    e.preventDefault();
    const id = document.getElementById('edit-plan-id').value;
    const nome = document.getElementById('plan-name').value;
    const status = document.getElementById('plan-status').value;
    
    // Pegar checkboxes
    const gameIds = Array.from(document.querySelectorAll('input[name="plan_games"]:checked')).map(cb => cb.value);

    try {
        let planId = id;
        if (!id) {
            const { data, error } = await window.supabaseClient.from('planos').insert({ nome, status }).select('id').single();
            if (error) throw error;
            planId = data.id;
            // Insert bindings
            if (gameIds.length > 0) {
                const bindings = gameIds.map(gid => ({ plano_id: planId, jogo_id: gid }));
                await window.supabaseClient.from('plano_jogos').insert(bindings);
            }
            await window.logAudit('create_plan', planId, { nome, status, gameIds });
        } else {
            const { error } = await window.supabaseClient.from('planos').update({ nome, status }).eq('id', id);
            if (error) throw error;
            
            // Delete old bindings
            await window.supabaseClient.from('plano_jogos').delete().eq('plano_id', planId);
            // Insert new bindings
            if (gameIds.length > 0) {
                const bindings = gameIds.map(gid => ({ plano_id: planId, jogo_id: gid }));
                await window.supabaseClient.from('plano_jogos').insert(bindings);
            }
            await window.logAudit('edit_plan', planId, { nome, status, gameIds });
        }

        window.toast('Plano salvo!');
        document.getElementById('modal-admin-plan').classList.add('hidden');
        await refreshAdminData();
    } catch (err) {
        console.error(err);
        alert('Erro ao salvar plano: ' + err.message);
    }
}

async function openGameModal(gameId = null) {
    document.getElementById('form-admin-game').reset();
    document.getElementById('edit-game-id').value = '';
    document.getElementById('modal-game-title').textContent = gameId ? 'Editar Tipo de Jogo' : 'Novo Tipo de Jogo';

    if (gameId) {
        const { data: game } = await window.supabaseClient.from('jogos').select('*').eq('id', gameId).single();
        if (game) {
            document.getElementById('edit-game-id').value = game.id;
            document.getElementById('game-name').value = game.nome;
            document.getElementById('game-slug').value = game.slug;
            document.getElementById('game-status').value = game.status;
            document.getElementById('game-ordem').value = game.ordem || 0;
            
            const params = game.parametros || {};
            document.getElementById('game-range-min').value = params.range_min || 1;
            document.getElementById('game-range-max').value = params.range_max || 60;
            document.getElementById('game-pick').value = params.pick_size || 6;
            document.getElementById('game-cost').value = params.cost || 5.00;
        }
    }
    document.getElementById('modal-admin-game').classList.remove('hidden');
}

window.editGame = function(id) { openGameModal(id); };

window.deleteGame = async function(id, name) {
    if (confirm(`Tem certeza que deseja excluir o tipo de jogo "${name}"?`)) {
        try {
            const { error } = await window.supabaseClient.from('jogos').delete().eq('id', id);
            if (error) throw error;
            await window.logAudit('delete_game_type', id, { slug: name });
            window.toast('Tipo de jogo excluído com sucesso!');
            await refreshAdminData();
        } catch (err) {
            console.error(err);
            alert('Erro ao excluir tipo de jogo: ' + err.message);
        }
    }
};

async function saveGame(e) {
    e.preventDefault();
    const id = document.getElementById('edit-game-id').value;
    
    const payload = {
        nome: document.getElementById('game-name').value,
        slug: document.getElementById('game-slug').value,
        status: document.getElementById('game-status').value,
        ordem: parseInt(document.getElementById('game-ordem').value) || 0,
        parametros: {
            range_min: parseInt(document.getElementById('game-range-min').value),
            range_max: parseInt(document.getElementById('game-range-max').value),
            pick_size: parseInt(document.getElementById('game-pick').value),
            cost: parseFloat(document.getElementById('game-cost').value)
        }
    };

    try {
        if (!id) {
            const { error } = await window.supabaseClient.from('jogos').insert(payload);
            if (error) throw error;
            await window.logAudit('create_game_type', payload.slug, payload);
        } else {
            const { error } = await window.supabaseClient.from('jogos').update(payload).eq('id', id);
            if (error) throw error;
            await window.logAudit('edit_game_type', payload.slug, payload);
        }

        window.toast('Jogo salvo!');
        document.getElementById('modal-admin-game').classList.add('hidden');
        await refreshAdminData();
    } catch (err) {
        console.error(err);
        alert('Erro ao salvar jogo: ' + err.message);
    }
}

// ===== AUTOMATION QUEUE =====
async function loadAutomationQueue() {
    const tbody = document.getElementById('admin-automation-table');
    if (!tbody || !window.supabaseClient) return;

    try {
        const { data: queue, error } = await window.supabaseClient
            .from('automation_queue')
            .select('*')
            .order('scheduled_at', { ascending: false })
            .limit(50);
            
        if (error) throw error;

        tbody.innerHTML = '';
        if (!queue || queue.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-3);">Fila vazia</td></tr>';
            return;
        }

        // Fetch profiles separately to avoid PostgREST foreign key relationship errors
        const ownerIds = [...new Set(queue.map(q => q.owner_id))];
        const { data: profiles } = await window.supabaseClient
            .from('profiles')
            .select('id, name')
            .in('id', ownerIds);
            
        const profileMap = {};
        if (profiles) {
            profiles.forEach(p => profileMap[p.id] = p);
        }

        queue.forEach(job => {
            const tr = document.createElement('tr');
            
            let statusBadge = '';
            switch(job.status) {
                case 'queued': statusBadge = '<span class="type-badge" style="background: var(--surface-3); color: var(--text-2);">Aguardando</span>'; break;
                case 'processing': statusBadge = '<span class="type-badge" style="background: var(--gold-dim); color: var(--gold);">Processando</span>'; break;
                case 'completed': statusBadge = '<span class="type-badge badge-prize">Concluído</span>'; break;
                case 'failed': statusBadge = '<span class="type-badge badge-bet">Falha</span>'; break;
                default: statusBadge = `<span class="type-badge">${job.status}</span>`;
            }

            const dataHora = new Date(job.scheduled_at).toLocaleString('pt-BR');
            const profile = profileMap[job.owner_id];
            const userNome = profile && profile.name ? profile.name : job.owner_id;

            tr.innerHTML = `
                <td>${dataHora}</td>
                <td><div style="font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;" title="${userNome}">${userNome}</div></td>
                <td><div style="font-size: 0.65rem; color: var(--text-3); font-family: monospace;">${job.bet_id}</div></td>
                <td>${statusBadge}</td>
                <td><div style="text-align: center;">${job.retry_count} / ${job.max_retries}</div></td>
                <td><div style="font-size: 0.7rem; color: var(--red); max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${job.last_error || ''}">${job.last_error || '-'}</div></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error('Erro ao carregar fila de automação:', e);
        tbody.innerHTML = `<tr><td colspan="6" style="color: var(--red); text-align: center;">Erro ao carregar dados</td></tr>`;
    }
}


// Global hooks para o app.js
window.refreshAdminData = refreshAdminData;
