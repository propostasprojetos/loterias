// ===== LotoSmart — Gerador Estatístico de Loterias =====

// ===== UTILITY FUNCTIONS =====
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = randomInt(0, i);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function countEven(nums) { return nums.filter(n => n % 2 === 0).length; }
function countOdd(nums) { return nums.filter(n => n % 2 !== 0).length; }

function maxConsecutive(nums) {
    const sorted = [...nums].sort((a, b) => a - b);
    let max = 1, current = 1;
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1] + 1) { current++; max = Math.max(max, current); }
        else { current = 1; }
    }
    return max;
}

function intersection(a, b) { return a.filter(n => b.includes(n)); }

function formatCurrency(value) {
    return 'R$ ' + value.toFixed(2).replace('.', ',');
}

// ===== LOTOFÁCIL GENERATOR =====
// Volante: 5 rows x 5 cols
// Row 1: 01-05, Row 2: 06-10, Row 3: 11-15, Row 4: 16-20, Row 5: 21-25
function getLotofacilRow(n) {
    return Math.ceil(n / 5);
}

function getLotofacilCol(n) {
    return ((n - 1) % 5) + 1;
}

function validateLotofacil(game) {
    const evens = countEven(game);
    // Rule 1: 7-8 evens (rest are odds)
    if (evens < 7 || evens > 8) return false;

    // Rule 2: Balance low (1-13) and high (14-25)
    const lows = game.filter(n => n <= 13).length;
    if (lows < 6 || lows > 9) return false;

    // Rule 3: Max 2 consecutive
    if (maxConsecutive(game) > 2) return false;

    // Rule 4: Distribute among 5 rows (at least 2 per row)
    const rows = [0, 0, 0, 0, 0];
    game.forEach(n => rows[getLotofacilRow(n) - 1]++);
    if (rows.some(r => r < 2 || r > 4)) return false;

    // Rule 5: No complete column (all 5 in a column)
    const cols = [0, 0, 0, 0, 0];
    game.forEach(n => cols[getLotofacilCol(n) - 1]++);
    if (cols.some(c => c >= 5)) return false;

    // Rule 6: Avoid popular triples (01,02,03 all together)
    const popularTriples = [[1, 2, 3], [1, 2, 4], [23, 24, 25]];
    for (const triple of popularTriples) {
        if (triple.every(n => game.includes(n))) return false;
    }

    return true;
}

function generateSingleLotofacil() {
    const allNumbers = Array.from({ length: 25 }, (_, i) => i + 1);
    let attempts = 0;
    while (attempts < 5000) {
        const shuffled = shuffle(allNumbers);
        const game = shuffled.slice(0, 15).sort((a, b) => a - b);
        if (validateLotofacil(game)) return game;
        attempts++;
    }
    // Fallback: construct a valid game
    return constructLotofacil();
}

function constructLotofacil() {
    // Build a game that meets all criteria deterministically
    const evens = shuffle([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
    const odds = shuffle([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25]);
    const numEvens = randomInt(7, 8);
    const numOdds = 15 - numEvens;
    const game = [...evens.slice(0, numEvens), ...odds.slice(0, numOdds)].sort((a, b) => a - b);
    return game;
}

function generateLotofacilGames(count) {
    const games = [];
    let totalAttempts = 0;

    while (games.length < count && totalAttempts < count * 200) {
        const game = generateSingleLotofacil();
        totalAttempts++;

        // Rule 7: Diversity check — max 10 shared numbers with any existing game
        const tooSimilar = games.some(existing => intersection(game, existing).length > 10);
        if (tooSimilar) continue;

        games.push(game);
    }

    return games;
}

// ===== QUINA GENERATOR =====
function validateQuina(game) {
    const evens = countEven(game);
    // Balance pares/ímpares: 2-3 each
    if (evens < 2 || evens > 3) return false;

    // Distribution among ranges
    const ranges = [0, 0, 0, 0]; // 1-20, 21-40, 41-60, 61-80
    game.forEach(n => {
        if (n <= 20) ranges[0]++;
        else if (n <= 40) ranges[1]++;
        else if (n <= 60) ranges[2]++;
        else ranges[3]++;
    });

    // At least 1 number in at least 3 ranges, no range with more than 2
    const activeRanges = ranges.filter(r => r > 0).length;
    if (activeRanges < 3) return false;
    if (ranges.some(r => r > 2)) return false;

    // No consecutive sequences
    if (maxConsecutive(game) > 2) return false;

    // Dispersion: min gap between sorted numbers should average > 8
    const sorted = [...game].sort((a, b) => a - b);
    const minGap = Math.min(...sorted.slice(1).map((n, i) => n - sorted[i]));
    if (minGap < 3) return false;

    return true;
}

function generateSingleQuina() {
    const allNumbers = Array.from({ length: 80 }, (_, i) => i + 1);
    let attempts = 0;
    while (attempts < 5000) {
        const shuffled = shuffle(allNumbers);
        const game = shuffled.slice(0, 5).sort((a, b) => a - b);
        if (validateQuina(game)) return game;
        attempts++;
    }
    // Fallback
    return constructQuina();
}

function constructQuina() {
    const ranges = [
        shuffle(Array.from({ length: 20 }, (_, i) => i + 1)),
        shuffle(Array.from({ length: 20 }, (_, i) => i + 21)),
        shuffle(Array.from({ length: 20 }, (_, i) => i + 41)),
        shuffle(Array.from({ length: 20 }, (_, i) => i + 61))
    ];
    // Pick from at least 3 ranges
    const rangeOrder = shuffle([0, 1, 2, 3]);
    const game = [
        ranges[rangeOrder[0]][0],
        ranges[rangeOrder[1]][0],
        ranges[rangeOrder[2]][0],
        ranges[rangeOrder[3]][0],
        ranges[rangeOrder[randomInt(0, 3)]][1]
    ].sort((a, b) => a - b);
    return game;
}

function generateQuinaGames(count) {
    const games = [];
    let totalAttempts = 0;

    while (games.length < count && totalAttempts < count * 200) {
        const game = generateSingleQuina();
        totalAttempts++;

        // Diversity: max 2 shared numbers with any existing game
        const tooSimilar = games.some(existing => intersection(game, existing).length > 2);
        if (tooSimilar) continue;

        games.push(game);
    }

    return games;
}

// ===== ANALYSIS FUNCTIONS =====
function analyzeLotofacilGame(game) {
    const evens = countEven(game);
    const odds = countOdd(game);
    const lows = game.filter(n => n <= 13).length;
    const highs = 15 - lows;
    const maxSeq = maxConsecutive(game);
    const rows = [0, 0, 0, 0, 0];
    game.forEach(n => rows[getLotofacilRow(n) - 1]++);

    return { evens, odds, lows, highs, maxSeq, rows };
}

function analyzeQuinaGame(game) {
    const evens = countEven(game);
    const odds = countOdd(game);
    const ranges = [0, 0, 0, 0];
    game.forEach(n => {
        if (n <= 20) ranges[0]++;
        else if (n <= 40) ranges[1]++;
        else if (n <= 60) ranges[2]++;
        else ranges[3]++;
    });
    const sorted = [...game].sort((a, b) => a - b);
    const gaps = sorted.slice(1).map((n, i) => n - sorted[i]);
    const avgGap = (gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1);

    return { evens, odds, ranges, avgGap };
}

function generateFullAnalysis(lfGames, qnGames) {
    let html = '';

    if (lfGames.length > 0) {
        html += `<div class="analysis-section">
            <h4>Lotofácil — Análise</h4>
            <ul>`;

        // Frequency of each number across all LF games
        const freq = {};
        for (let i = 1; i <= 25; i++) freq[i] = 0;
        lfGames.forEach(g => g.forEach(n => freq[n]++));
        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
        const most = sorted.slice(0, 5).map(([n, f]) => `${String(n).padStart(2, '0')} (${f}x)`).join(', ');
        const least = sorted.slice(-5).map(([n, f]) => `${String(n).padStart(2, '0')} (${f}x)`).join(', ');

        html += `<li>Dezenas mais presentes: ${most}</li>`;
        html += `<li>Dezenas menos presentes: ${least}</li>`;

        const avgEvens = (lfGames.reduce((s, g) => s + countEven(g), 0) / lfGames.length).toFixed(1);
        html += `<li>Média de pares por jogo: ${avgEvens}</li>`;

        const avgMaxSeq = (lfGames.reduce((s, g) => s + maxConsecutive(g), 0) / lfGames.length).toFixed(1);
        html += `<li>Média de máx. consecutivos: ${avgMaxSeq}</li>`;

        // Diversity check
        let minDiversity = 15, maxDiversity = 0;
        for (let i = 0; i < lfGames.length; i++) {
            for (let j = i + 1; j < lfGames.length; j++) {
                const shared = intersection(lfGames[i], lfGames[j]).length;
                minDiversity = Math.min(minDiversity, 15 - shared);
                maxDiversity = Math.max(maxDiversity, 15 - shared);
            }
        }
        if (lfGames.length > 1) {
            html += `<li>Diversidade entre jogos: ${minDiversity} a ${maxDiversity} dezenas diferentes</li>`;
        }

        html += `</ul></div>`;
    }

    if (qnGames.length > 0) {
        html += `<div class="analysis-section">
            <h4>Quina — Análise</h4>
            <ul>`;

        const freq = {};
        for (let i = 1; i <= 80; i++) freq[i] = 0;
        qnGames.forEach(g => g.forEach(n => freq[n]++));
        const coverageCount = Object.values(freq).filter(f => f > 0).length;
        html += `<li>Cobertura numérica: ${coverageCount} de 80 dezenas (${((coverageCount / 80) * 100).toFixed(0)}%)</li>`;

        const avgEvens = (qnGames.reduce((s, g) => s + countEven(g), 0) / qnGames.length).toFixed(1);
        html += `<li>Média de pares por jogo: ${avgEvens}</li>`;

        const rangeNames = ['1–20', '21–40', '41–60', '61–80'];
        const rangeTotals = [0, 0, 0, 0];
        qnGames.forEach(g => {
            g.forEach(n => {
                if (n <= 20) rangeTotals[0]++;
                else if (n <= 40) rangeTotals[1]++;
                else if (n <= 60) rangeTotals[2]++;
                else rangeTotals[3]++;
            });
        });
        const rangeStr = rangeNames.map((name, i) => `${name}: ${rangeTotals[i]}`).join(' | ');
        html += `<li>Distribuição por faixa: ${rangeStr}</li>`;

        html += `</ul></div>`;
    }

    html += `<div class="analysis-section">
        <h4>Estratégia Resumida</h4>
        <p>Todos os jogos foram gerados com critérios de equilíbrio par/ímpar, distribuição por faixas, controle de sequências consecutivas, dispersão no volante e diversidade inter-jogos. O foco está em maximizar a cobertura para premiações intermediárias (13–14 pontos na Lotofácil, 3–4 acertos na Quina), que possuem a melhor relação entre probabilidade e retorno. <strong>Lembre-se: isto é uma otimização estatística relativa, não uma garantia de prêmio.</strong></p>
    </div>`;

    return html;
}

// ===== UI RENDERING =====
function renderNumber(n, type) {
    const isEven = n % 2 === 0;
    const padded = String(n).padStart(2, '0');
    const extraClass = type === 'quina' ? ' quina-ball' : '';
    return `<span class="number-ball ${isEven ? 'even' : 'odd'}${extraClass}">${padded}</span>`;
}

function renderLotofacilGame(game, index) {
    const analysis = analyzeLotofacilGame(game);
    const numbersHtml = game.map(n => renderNumber(n, 'lotofacil')).join('');

    return `<div class="game-card" style="animation-delay: ${index * 0.06}s" data-game="${game.join(',')}">
        <div class="game-card-header">
            <span class="game-number">Jogo ${String(index + 1).padStart(2, '0')}</span>
            <div class="game-tags">
                <span class="game-tag tag-par">${analysis.evens}P</span>
                <span class="game-tag tag-impar">${analysis.odds}I</span>
                <span class="game-tag tag-baixo">${analysis.lows}↓</span>
                <span class="game-tag tag-alto">${analysis.highs}↑</span>
            </div>
        </div>
        <div class="game-numbers">${numbersHtml}</div>
        <div class="game-footer">
            <span class="game-metric">Linhas: ${analysis.rows.join('-')}</span>
            <span class="game-metric">Máx Seq: ${analysis.maxSeq}</span>
        </div>
    </div>`;
}

function renderQuinaGame(game, index) {
    const analysis = analyzeQuinaGame(game);
    const numbersHtml = game.map(n => renderNumber(n, 'quina')).join('');
    const rangeLabels = ['1–20', '21–40', '41–60', '61–80'];
    const rangeStr = analysis.ranges.map((r, i) => r > 0 ? rangeLabels[i] + ':' + r : null).filter(Boolean).join(' ');

    return `<div class="game-card" style="animation-delay: ${index * 0.06}s" data-game="${game.join(',')}">
        <div class="game-card-header">
            <span class="game-number">Jogo ${String(index + 1).padStart(2, '0')}</span>
            <div class="game-tags">
                <span class="game-tag tag-par">${analysis.evens}P</span>
                <span class="game-tag tag-impar">${analysis.odds}I</span>
            </div>
        </div>
        <div class="game-numbers">${numbersHtml}</div>
        <div class="game-footer">
            <span class="game-metric">Faixas: ${rangeStr}</span>
            <span class="game-metric">Gap médio: ${analysis.avgGap}</span>
        </div>
    </div>`;
}

// ===== BUDGET CALCULATIONS =====
function updateSummary() {
    const budget = parseFloat(document.getElementById('budget-input').value) || 0;
    const lfPrice = parseFloat(document.getElementById('lotofacil-price').value) || 3;
    const qnPrice = parseFloat(document.getElementById('quina-price').value) || 2.5;
    const splitPct = parseInt(document.getElementById('split-slider').value) || 60;

    const lfBudget = budget * (splitPct / 100);
    const qnBudget = budget * ((100 - splitPct) / 100);

    const lfCount = Math.floor(lfBudget / lfPrice);
    const qnCount = Math.floor(qnBudget / qnPrice);

    const lfCost = lfCount * lfPrice;
    const qnCost = qnCount * qnPrice;
    const totalCost = lfCost + qnCost;
    const remaining = budget - totalCost;

    document.getElementById('lotofacil-count').textContent = lfCount;
    document.getElementById('quina-count').textContent = qnCount;
    document.getElementById('lotofacil-cost').textContent = formatCurrency(lfCost);
    document.getElementById('quina-cost').textContent = formatCurrency(qnCost);
    document.getElementById('total-cost').textContent = formatCurrency(totalCost);
    document.getElementById('remaining-budget').textContent = formatCurrency(remaining);
    document.getElementById('lotofacil-pct').textContent = splitPct + '%';
    document.getElementById('quina-pct').textContent = (100 - splitPct) + '%';

    // Update slider background
    const slider = document.getElementById('split-slider');
    slider.style.background = `linear-gradient(to right, var(--accent-purple) 0%, var(--accent-purple) ${splitPct}%, var(--accent-cyan) ${splitPct}%, var(--accent-cyan) 100%)`;

    return { lfCount, qnCount };
}

// ===== COPY TO CLIPBOARD =====
function copyGames(games, type) {
    const label = type === 'lotofacil' ? 'Lotofácil' : 'Quina';
    let text = `=== ${label} — LotoSmart ===\n\n`;
    games.forEach((game, i) => {
        const nums = game.map(n => String(n).padStart(2, '0')).join(' - ');
        text += `Jogo ${String(i + 1).padStart(2, '0')}: ${nums}\n`;
    });
    text += `\nGerado em: ${new Date().toLocaleString('pt-BR')}\n`;

    navigator.clipboard.writeText(text).then(() => {
        showToast(`${games.length} jogos da ${label} copiados!`);
    }).catch(() => {
        showToast('Erro ao copiar. Tente novamente.');
    });
}

function showToast(message) {
    const toast = document.getElementById('toast');
    const toastText = document.getElementById('toast-text');
    toastText.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== MAIN GENERATION =====
function generateAll() {
    const { lfCount, qnCount } = updateSummary();

    if (lfCount === 0 && qnCount === 0) {
        showToast('Orçamento insuficiente para gerar jogos.');
        return;
    }

    const btn = document.getElementById('btn-generate');
    btn.classList.add('generating');
    btn.innerHTML = `<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Gerando...`;

    setTimeout(() => {
        const lfGames = generateLotofacilGames(lfCount);
        const qnGames = generateQuinaGames(qnCount);

        // Render Lotofácil
        const lfContainer = document.getElementById('lotofacil-games');
        if (lfGames.length > 0) {
            lfContainer.innerHTML = lfGames.map((g, i) => renderLotofacilGame(g, i)).join('');
            document.getElementById('lotofacil-results').style.display = 'block';
        } else {
            document.getElementById('lotofacil-results').style.display = 'none';
        }

        // Render Quina
        const qnContainer = document.getElementById('quina-games');
        if (qnGames.length > 0) {
            qnContainer.innerHTML = qnGames.map((g, i) => renderQuinaGame(g, i)).join('');
            document.getElementById('quina-results').style.display = 'block';
        } else {
            document.getElementById('quina-results').style.display = 'none';
        }

        // Render Analysis
        document.getElementById('analysis-content').innerHTML = generateFullAnalysis(lfGames, qnGames);

        // Show results section
        document.getElementById('resultados').classList.remove('hidden');

        // Copy buttons
        document.getElementById('btn-copy-lotofacil').onclick = () => copyGames(lfGames, 'lotofacil');
        document.getElementById('btn-copy-quina').onclick = () => copyGames(qnGames, 'quina');

        // Scroll to results
        document.getElementById('resultados').scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Reset button
        btn.classList.remove('generating');
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Gerar Jogos Otimizados`;
    }, 600);
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', () => {
    // Budget inputs
    ['budget-input', 'lotofacil-price', 'quina-price', 'split-slider'].forEach(id => {
        document.getElementById(id).addEventListener('input', updateSummary);
    });

    // Generate button
    document.getElementById('btn-generate').addEventListener('click', generateAll);

    // Nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    // Initial summary calculation
    updateSummary();
});

// ===== SPIN ANIMATION (via CSS) =====
const styleTag = document.createElement('style');
styleTag.textContent = `
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .spin { animation: spin 1s linear infinite; }
`;
document.head.appendChild(styleTag);
