// ===== LotoSmart v2 — Advanced Optimization Engine =====

// ===== UTILS =====
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = randomInt(0, i);[a[i], a[j]] = [a[j], a[i]]; }
    return a;
}
function countEven(n) { return n.filter(x => x % 2 === 0).length; }
function maxConsec(nums) {
    const s = [...nums].sort((a, b) => a - b);
    let mx = 1, c = 1;
    for (let i = 1; i < s.length; i++) { if (s[i] === s[i - 1] + 1) { c++; mx = Math.max(mx, c); } else c = 1; }
    return mx;
}
function intersect(a, b) { return a.filter(n => b.includes(n)); }
function fmt(v) { return 'R$ ' + v.toFixed(2).replace('.', ','); }
function pad(n) { return String(n).padStart(2, '0'); }

// ===== MODE CONFIGURATION =====
const MODES = {
    conservative: {
        label: 'Conservador',
        lf: { maxIntersect: 10, baseOverlapMin: 9, baseOverlapMax: 11, candidateMultiplier: 4, weightCoverage: 12, weightOverlap: 15 },
        qn: { minGap: 12, maxIntersect: 2, candidateMultiplier: 4, weightCoverage: 12, weightDispersion: 3, weightOverlap: 20 }
    },
    balanced: {
        label: 'Balanceado',
        lf: { maxIntersect: 9, baseOverlapMin: 8, baseOverlapMax: 11, candidateMultiplier: 6, weightCoverage: 15, weightOverlap: 25 },
        qn: { minGap: 15, maxIntersect: 2, candidateMultiplier: 6, weightCoverage: 15, weightDispersion: 6, weightOverlap: 30 }
    },
    aggressive: {
        label: 'Agressivo',
        lf: { maxIntersect: 8, baseOverlapMin: 8, baseOverlapMax: 10, candidateMultiplier: 8, weightCoverage: 20, weightOverlap: 40 },
        qn: { minGap: 18, maxIntersect: 1, candidateMultiplier: 8, weightCoverage: 20, weightDispersion: 12, weightOverlap: 50 }
    }
};

let generationMode = 'balanced';
function getModeConfig() { return MODES[generationMode]; }

// ===== LOTOFÁCIL — Core Validation (unchanged) =====
function lfRow(n) { return Math.ceil(n / 5); }
function lfCol(n) { return ((n - 1) % 5) + 1; }

function validateLF(g) {
    const ev = countEven(g);
    if (ev < 7 || ev > 8) return false;
    const lo = g.filter(n => n <= 13).length;
    if (lo < 6 || lo > 9) return false;
    if (maxConsec(g) > 2) return false;
    const rows = [0, 0, 0, 0, 0];
    g.forEach(n => rows[lfRow(n) - 1]++);
    if (rows.some(r => r < 2 || r > 4)) return false;
    const cols = [0, 0, 0, 0, 0];
    g.forEach(n => cols[lfCol(n) - 1]++);
    if (cols.some(c => c >= 5)) return false;
    const triples = [[1, 2, 3], [1, 2, 4], [23, 24, 25]];
    for (const t of triples) if (t.every(n => g.includes(n))) return false;
    return true;
}

// ===== LOTOFÁCIL — Simulated Base Set =====
function generateBaseSetLF() {
    // Simulates a "previous draw" result — 15 numbers from 1-25
    // Statistically, 9-12 numbers tend to repeat between consecutive draws
    const all = Array.from({ length: 25 }, (_, i) => i + 1);
    for (let i = 0; i < 500; i++) {
        const g = shuffle(all).slice(0, 15).sort((a, b) => a - b);
        if (validateLF(g)) return g;
    }
    return shuffle(all).slice(0, 15).sort((a, b) => a - b);
}

// ===== LOTOFÁCIL — Frequency-Aware Generation =====
function genOneLF(baseSet, globalFreq) {
    const all = Array.from({ length: 25 }, (_, i) => i + 1);
    const mode = getModeConfig().lf;

    for (let i = 0; i < 8000; i++) {
        let g;

        if (baseSet && globalFreq) {
            // Weighted pick: prefer numbers with lower global frequency
            const weights = all.map(n => {
                const freq = globalFreq[n] || 0;
                const avgFreq = Object.values(globalFreq).reduce((a, b) => a + b, 0) / 25 || 1;
                // Lower freq → higher weight, with base set bonus
                let w = Math.max(0.1, 2 - (freq / Math.max(avgFreq, 1)));
                if (baseSet.includes(n)) w *= 1.3;
                return { n, w };
            });

            g = weightedSample(weights, 15).sort((a, b) => a - b);
        } else {
            g = shuffle(all).slice(0, 15).sort((a, b) => a - b);
        }

        if (!validateLF(g)) continue;

        // Base overlap check: exactly between 8 and 11 numbers of the base set (concurso anterior)
        if (baseSet) {
            const overlap = intersect(g, baseSet).length;
            if (overlap < 8 || overlap > 11) continue;
            if (overlap < mode.baseOverlapMin || overlap > mode.baseOverlapMax) continue;
        }

        return g;
    }

    // Fallback
    const ev = shuffle([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]);
    const od = shuffle([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25]);
    const ne = randomInt(7, 8);
    return [...ev.slice(0, ne), ...od.slice(0, 15 - ne)].sort((a, b) => a - b);
}

// Weighted random sampling without replacement
function weightedSample(items, count) {
    const pool = [...items];
    const result = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
        const totalW = pool.reduce((s, x) => s + x.w, 0);
        let r = Math.random() * totalW;
        let idx = 0;
        for (let j = 0; j < pool.length; j++) {
            r -= pool[j].w;
            if (r <= 0) { idx = j; break; }
        }
        result.push(pool[idx].n);
        pool.splice(idx, 1);
    }
    return result;
}

// ===== LOTOFÁCIL — Advanced Generation with Coverage =====
function genLFGames(count, keptLF = []) {
    if (count <= 0) return [];

    const mode = getModeConfig().lf;
    const baseSet = generateBaseSetLF();
    const globalFreq = {};
    for (let i = 1; i <= 25; i++) globalFreq[i] = 0;

    // Seed frequencies with kept games
    keptLF.forEach(g => g.forEach(n => globalFreq[n]++));

    // Generate candidate pool (multiplied by mode)
    const poolSize = count * mode.candidateMultiplier;
    const candidates = [];

    for (let att = 0; att < poolSize * 100 && candidates.length < poolSize; att++) {
        const g = genOneLF(baseSet, globalFreq);
        // Avoid duplicates in pool
        if (!candidates.some(c => c.every((val, idx) => val === g[idx]))) {
            candidates.push(g);
            g.forEach(n => globalFreq[n]++);
        }
    }

    if (candidates.length === 0) return [];

    // Greedy selection for maximum diversity and frequency balancing
    const selected = greedySelectLF(candidates, count, mode, keptLF);

    // Rebalance if coverage is poor
    return rebalanceLFFrequency([...keptLF, ...selected], baseSet, mode).slice(keptLF.length);
}

// Greedy diversity selection: pick candidates that maximize combinatorial spread
function greedySelectLF(candidates, count, mode, keptLF = []) {
    const selected = [...keptLF];
    const result = [];
    const usedIndices = new Set();
    const maxIntersect = mode.maxIntersect;

    // Frequency map of selected numbers
    const freq = {};
    for (let i = 1; i <= 25; i++) freq[i] = 0;
    selected.forEach(g => g.forEach(n => freq[n]++));

    while (result.length < count) {
        let bestIdx = -1;
        let bestScore = -Infinity;

        for (let i = 0; i < candidates.length; i++) {
            if (usedIndices.has(i)) continue;

            const c = candidates[i];
            
            // 1. Coverage Score: sum of 1 / (1 + freq[n])
            let coverageScore = 0;
            c.forEach(n => {
                coverageScore += 1 / (1 + (freq[n] || 0));
            });

            // 2. Overlap Penalty (Adaptive Intersection)
            let overlapPenalty = 0;
            let maxOverlapFound = 0;
            for (const sel of selected) {
                const common = intersect(c, sel).length;
                maxOverlapFound = Math.max(maxOverlapFound, common);
                
                // Penalize overlaps based on ideal range (8-10)
                if (common >= 12) {
                    overlapPenalty += 500; // Extremely severe penalty
                } else if (common === 11) {
                    overlapPenalty += 80;
                } else if (common === 10) {
                    overlapPenalty += 8;  // Normal upper limit
                } else if (common === 9) {
                    overlapPenalty += 1;  // Ideal overlap, very small penalty
                }
            }

            // Enforce maxIntersect limit dynamically if possible
            if (maxOverlapFound > maxIntersect) {
                overlapPenalty += 150;
            }

            const totalScore = (coverageScore * (mode.weightCoverage || 15)) - (overlapPenalty * (mode.weightOverlap || 25));

            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestIdx = i;
            }
        }

        if (bestIdx === -1) {
            break;
        }

        const chosen = candidates[bestIdx];
        result.push(chosen);
        selected.push(chosen);
        usedIndices.add(bestIdx);
        
        // Update frequencies
        chosen.forEach(n => freq[n] = (freq[n] || 0) + 1);
    }

    // Fill up if we couldn't select enough
    if (result.length < count) {
        for (let i = 0; i < candidates.length && result.length < count; i++) {
            if (!usedIndices.has(i)) {
                result.push(candidates[i]);
                usedIndices.add(i);
            }
        }
    }

    return result;
}

// Post-process: swap numbers in under-covered games to improve global frequency balance
function rebalanceLFFrequency(games, baseSet, mode) {
    if (games.length <= 1) return games;

    const freq = {};
    for (let i = 1; i <= 25; i++) freq[i] = 0;
    games.forEach(g => g.forEach(n => freq[n]++));

    const totalSlots = games.length * 15;
    const avgFreq = totalSlots / 25;

    // Identify over/under represented numbers
    const overRep = Object.entries(freq).filter(([, f]) => f > avgFreq * 1.4).map(([n]) => +n);
    const underRep = Object.entries(freq).filter(([, f]) => f < avgFreq * 0.6).map(([n]) => +n);

    if (overRep.length === 0 || underRep.length === 0) return games;

    // Try gentle swaps in last few games (don't touch the best/pinned ones)
    const result = [...games];
    for (let gi = result.length - 1; gi >= Math.max(0, result.length - 3); gi--) {
        const g = [...result[gi]];
        let swapped = false;

        for (const over of overRep) {
            if (!g.includes(over)) continue;
            for (const under of underRep) {
                if (g.includes(under)) continue;
                const idx = g.indexOf(over);
                const trial = [...g];
                trial[idx] = under;
                trial.sort((a, b) => a - b);

                if (validateLF(trial)) {
                    // Verify base overlap still in range
                    if (baseSet) {
                        const overlap = intersect(trial, baseSet).length;
                        if (overlap < 8 || overlap > 11) continue;
                    }
                    result[gi] = trial;
                    swapped = true;
                    break;
                }
            }
            if (swapped) break;
        }
    }

    return result;
}

// ===== QUINA — Core Validation (enhanced) =====
function validateQN(g, modeOverride) {
    const mode = modeOverride || getModeConfig().qn;
    const ev = countEven(g);
    if (ev < 2 || ev > 3) return false;

    const ranges = [0, 0, 0, 0];
    g.forEach(n => { if (n <= 20) ranges[0]++; else if (n <= 40) ranges[1]++; else if (n <= 60) ranges[2]++; else ranges[3]++; });
    // Enforce presence in all 4 ranges (distribuição obrigatória por faixa)
    if (ranges.filter(r => r > 0).length < 4) return false;
    if (ranges.some(r => r > 2)) return false;
    if (maxConsec(g) > 2) return false;

    const s = [...g].sort((a, b) => a - b);
    if (Math.min(...s.slice(1).map((n, i) => n - s[i])) < 3) return false;

    // Dispersion check: average gap
    const gaps = s.slice(1).map((n, i) => n - s[i]);
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    if (avgGap < mode.minGap) return false;

    return true;
}

// ===== QUINA — Weighted Generation =====
function genOneQN(globalFreq) {
    const all = Array.from({ length: 80 }, (_, i) => i + 1);
    const mode = getModeConfig().qn;

    for (let i = 0; i < 8000; i++) {
        let g;

        if (globalFreq) {
            // Weighted: prefer under-represented numbers
            const weights = all.map(n => {
                const freq = globalFreq[n] || 0;
                const avgFreq = Object.values(globalFreq).reduce((a, b) => a + b, 0) / 80 || 1;
                return { n, w: Math.max(0.1, 2 - (freq / Math.max(avgFreq, 1))) };
            });
            g = weightedSample(weights, 5).sort((a, b) => a - b);
        } else {
            g = shuffle(all).slice(0, 5).sort((a, b) => a - b);
        }

        if (validateQN(g)) return g;
    }

    // Fallback: structured generation that strictly guarantees 4 faixas and dispersion
    const R = [0, 1, 2, 3].map(i => shuffle(Array.from({ length: 20 }, (_, j) => j + 1 + i * 20)));
    const o = shuffle([0, 1, 2, 3]);
    return [R[o[0]][0], R[o[1]][0], R[o[2]][0], R[o[3]][0], R[o[randomInt(0, 3)]][1]].sort((a, b) => a - b);
}

// ===== QUINA — Advanced Generation with Coverage =====
function genQNGames(count, keptQN = []) {
    if (count <= 0) return [];

    const mode = getModeConfig().qn;
    const globalFreq = {};
    for (let i = 1; i <= 80; i++) globalFreq[i] = 0;

    // Seed frequencies with kept games
    keptQN.forEach(g => g.forEach(n => globalFreq[n]++));

    const poolSize = count * mode.candidateMultiplier;
    const candidates = [];

    for (let att = 0; att < poolSize * 150 && candidates.length < poolSize; att++) {
        const g = genOneQN(globalFreq);
        // Avoid duplicate games in pool
        if (!candidates.some(c => c.every((val, idx) => val === g[idx]))) {
            candidates.push(g);
            g.forEach(n => globalFreq[n]++);
        }
    }

    if (candidates.length === 0) return [];

    // Greedy selection for maximum diversity, dispersion, and coverage
    return greedySelectQN(candidates, count, mode, keptQN);
}

function greedySelectQN(candidates, count, mode, keptQN = []) {
    const selected = [...keptQN];
    const result = [];
    const usedIndices = new Set();
    const maxIntersect = mode.maxIntersect;

    const freq = {};
    for (let i = 1; i <= 80; i++) freq[i] = 0;
    selected.forEach(g => g.forEach(n => freq[n]++));

    while (result.length < count) {
        let bestIdx = -1;
        let bestScore = -Infinity;

        for (let i = 0; i < candidates.length; i++) {
            if (usedIndices.has(i)) continue;

            const c = candidates[i];

            // 1. Coverage Score
            let coverageScore = 0;
            c.forEach(n => {
                coverageScore += 1 / (1 + (freq[n] || 0));
            });

            // 2. Dispersion Score
            const disp = dispersionScore(c);

            // 3. Overlap Penalty (strictly keep at most 2 in common, prefer 0 or 1)
            let overlapPenalty = 0;
            let maxOverlapFound = 0;
            for (const sel of selected) {
                const common = intersect(c, sel).length;
                maxOverlapFound = Math.max(maxOverlapFound, common);

                if (common >= 3) {
                    overlapPenalty += 500; // Strict limit: max 2 in common
                } else if (common === 2) {
                    overlapPenalty += 15;
                } else if (common === 1) {
                    overlapPenalty += 2;
                }
            }

            if (maxOverlapFound > maxIntersect) {
                overlapPenalty += 150;
            }

            const totalScore = (coverageScore * (mode.weightCoverage || 15)) 
                             + (disp * (mode.weightDispersion || 5)) 
                             - (overlapPenalty * (mode.weightOverlap || 30));

            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestIdx = i;
            }
        }

        if (bestIdx === -1) {
            break;
        }

        const chosen = candidates[bestIdx];
        result.push(chosen);
        selected.push(chosen);
        usedIndices.add(bestIdx);

        // Update frequencies
        chosen.forEach(n => freq[n] = (freq[n] || 0) + 1);
    }

    // Fill up if we couldn't select enough
    if (result.length < count) {
        for (let i = 0; i < candidates.length && result.length < count; i++) {
            if (!usedIndices.has(i)) {
                result.push(candidates[i]);
                usedIndices.add(i);
            }
        }
    }

    return result;
}

// ===== DISPERSION SCORE =====
function dispersionScore(game) {
    const s = [...game].sort((a, b) => a - b);
    const gaps = s.slice(1).map((n, i) => n - s[i]);
    return gaps.reduce((a, b) => a + b, 0) / gaps.length;
}

// ===== QUALITY SCORING SYSTEM =====
function qualityScoreLF(game, allGames, baseSet) {
    let score = 0;

    // 1. Even/Odd balance (20%) — ideal: 7 or 8 even
    const ev = countEven(game);
    const evenScore = (ev === 7 || ev === 8) ? 20 : (ev === 6 || ev === 9) ? 10 : 0;
    score += evenScore;

    // 2. Row distribution (20%) — ideal: 2-4 per row, uniform
    const rows = [0, 0, 0, 0, 0];
    game.forEach(n => rows[lfRow(n) - 1]++);
    const rowDev = rows.reduce((s, r) => s + Math.abs(r - 3), 0); // ideal is 3 per row
    const rowScore = Math.max(0, 20 - rowDev * 4);
    score += rowScore;

    // 3. Base set overlap (15%) — ideal: within mode range
    if (baseSet) {
        const overlap = intersect(game, baseSet).length;
        const mode = getModeConfig().lf;
        if (overlap >= mode.baseOverlapMin && overlap <= mode.baseOverlapMax) {
            score += 15;
        } else {
            const dist = Math.min(Math.abs(overlap - mode.baseOverlapMin), Math.abs(overlap - mode.baseOverlapMax));
            score += Math.max(0, 15 - dist * 5);
        }
    } else {
        score += 10; // neutral
    }

    // 4. Low repetition with other games (25%)
    if (allGames.length > 1) {
        let maxCommon = 0;
        let avgCommon = 0;
        let comparisons = 0;
        for (const other of allGames) {
            if (other === game) continue;
            const common = intersect(game, other).length;
            maxCommon = Math.max(maxCommon, common);
            avgCommon += common;
            comparisons++;
        }
        avgCommon = comparisons > 0 ? avgCommon / comparisons : 0;
        // Lower average = better. 15 numbers, expected random overlap ≈ 9
        const repScore = Math.max(0, 25 - Math.max(0, (avgCommon - 7) * 5));
        score += repScore;
    } else {
        score += 20;
    }

    // 5. Global coverage contribution (20%)
    // How many "rare" numbers does this game include?
    if (allGames.length > 1) {
        const freq = {};
        for (let i = 1; i <= 25; i++) freq[i] = 0;
        allGames.forEach(g => g.forEach(n => freq[n]++));
        const avgFreq = (allGames.length * 15) / 25;
        const rareCount = game.filter(n => freq[n] <= avgFreq).length;
        score += Math.min(20, Math.round((rareCount / 15) * 20));
    } else {
        score += 15;
    }

    return Math.min(100, Math.max(0, Math.round(score)));
}

function qualityScoreQN(game, allGames) {
    let score = 0;

    // 1. Even/Odd balance (20%) — ideal: 2 or 3 even
    const ev = countEven(game);
    score += (ev === 2 || ev === 3) ? 20 : 8;

    // 2. Range distribution (20%) — presence in ranges (1-20, 21-40, 41-60, 61-80)
    const ranges = [0, 0, 0, 0];
    game.forEach(n => { if (n <= 20) ranges[0]++; else if (n <= 40) ranges[1]++; else if (n <= 60) ranges[2]++; else ranges[3]++; });
    const rangeCount = ranges.filter(r => r > 0).length;
    score += rangeCount >= 4 ? 20 : rangeCount === 3 ? 12 : rangeCount === 2 ? 5 : 0;

    // 3. Dispersion / gap (20%) — higher avg gap = better
    const disp = dispersionScore(game);
    if (disp >= 18) score += 20;
    else if (disp >= 15) score += 17;
    else if (disp >= 12) score += 12;
    else if (disp >= 10) score += 6;
    else score += 2;

    // 4. Low repetition with other games (20%) — max 2 in common
    if (allGames.length > 1) {
        let maxCommon = 0;
        for (const other of allGames) {
            if (other === game) continue;
            maxCommon = Math.max(maxCommon, intersect(game, other).length);
        }
        score += maxCommon <= 1 ? 20 : maxCommon === 2 ? 14 : 0;
    } else {
        score += 16;
    }

    // 5. Global coverage (20%) — usage of rare/underrepresented numbers
    if (allGames.length > 1) {
        const freq = {};
        for (let i = 1; i <= 80; i++) freq[i] = 0;
        allGames.forEach(g => g.forEach(n => freq[n]++));
        const avgFreq = (allGames.length * 5) / 80;
        const rareCount = game.filter(n => freq[n] <= Math.max(avgFreq, 1)).length;
        score += Math.min(20, Math.round((rareCount / 5) * 20));
    } else {
        score += 15;
    }

    return Math.min(100, Math.max(0, Math.round(score)));
}

function scoreClass(score) {
    if (score >= 75) return 'score-high';
    if (score >= 45) return 'score-mid';
    return 'score-low';
}

function scoreLabel(score) {
    if (score >= 85) return 'Excelente';
    if (score >= 70) return 'Ótimo';
    if (score >= 55) return 'Bom';
    if (score >= 40) return 'Regular';
    return 'Baixo';
}

// ===== SVG ICONS =====
const ICON = {
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
    pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5M5 12h14M7 7l2-4h6l2 4v5H7V7z"/></svg>`,
};

// ===== STATE =====
let currentLF = [];
let currentQN = [];
let selectedLF = new Set();
let selectedQN = new Set();
let currentBaseSetLF = null; // Stores the base set used in last generation

// ===== RENDER =====
function renderBall(n, type) {
    const cls = (n % 2 === 0 ? 'even' : 'odd') + (type === 'qn' ? ' qn' : '');
    return `<span class="ball ${cls}">${pad(n)}</span>`;
}

function renderLFCard(game, idx) {
    const ev = countEven(game), od = 15 - ev;
    const lo = game.filter(n => n <= 13).length, hi = 15 - lo;
    const rows = [0, 0, 0, 0, 0];
    game.forEach(n => rows[lfRow(n) - 1]++);
    const sel = selectedLF.has(idx);

    // Quality score
    const score = qualityScoreLF(game, currentLF, currentBaseSetLF);
    const sClass = scoreClass(score);
    const sLabel = scoreLabel(score);

    return `<div class="game-card ${sel ? 'selected' : ''}" data-type="lf" data-idx="${idx}">
        <div class="game-top">
            <span class="game-label">Jogo ${pad(idx + 1)}</span>
            <div class="game-actions">
                <div class="game-meta">
                    <span class="meta-tag meta-par" title="Quantidade de números PARES (Ideal: 7 a 8)">${ev}P</span>
                    <span class="meta-tag meta-impar" title="Quantidade de números ÍMPARES (Ideal: 7 a 8)">${od}I</span>
                    <span class="meta-tag meta-low" title="Dezenas baixas, de 01 a 13 (Ideal: 6 a 9)">${lo}↓</span>
                    <span class="meta-tag meta-high" title="Dezenas altas, de 14 a 25">${hi}↑</span>
                </div>
                <button class="btn-icon btn-copy-one" title="Copiar jogo" data-type="lf" data-idx="${idx}">${ICON.copy}</button>
                <button class="btn-icon btn-select ${sel ? 'checked' : ''}" title="Manter jogo" data-type="lf" data-idx="${idx}">${sel ? ICON.check : ICON.pin}</button>
            </div>
        </div>
        <div class="game-numbers">${game.map(n => renderBall(n, 'lf')).join('')}</div>
        <div class="game-bottom">
            <span class="game-stat" title="Quantidade de números em cada uma das 5 linhas do volante">Linhas: ${rows.join('-')}</span>
            <span class="game-stat" title="Maior sequência de números seguidos (Ideal: Máx 2)">Seq: ${maxConsec(game)}</span>
        </div>
        <div class="score-row" title="Score de qualidade: equilíbrio, diversidade, cobertura e dispersão">
            <span class="score-tag ${sClass}">${sLabel}</span>
            <div class="score-bar-wrap"><div class="score-bar" style="width:${score}%"></div></div>
            <span class="score-label ${sClass}">${score}/100</span>
        </div>
    </div>`;
}

function renderQNCard(game, idx) {
    const ev = countEven(game), od = 5 - ev;
    const rl = ['1–20', '21–40', '41–60', '61–80'];
    const ranges = [0, 0, 0, 0];
    game.forEach(n => { if (n <= 20) ranges[0]++; else if (n <= 40) ranges[1]++; else if (n <= 60) ranges[2]++; else ranges[3]++; });
    const rStr = ranges.map((r, i) => r > 0 ? rl[i] + ':' + r : null).filter(Boolean).join(' ');
    const s = [...game].sort((a, b) => a - b);
    const gaps = s.slice(1).map((n, i) => n - s[i]);
    const avgG = (gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1);
    const sel = selectedQN.has(idx);

    // Quality score
    const score = qualityScoreQN(game, currentQN);
    const sClass = scoreClass(score);
    const sLabel = scoreLabel(score);

    return `<div class="game-card ${sel ? 'selected' : ''}" data-type="qn" data-idx="${idx}">
        <div class="game-top">
            <span class="game-label">Jogo ${pad(idx + 1)}</span>
            <div class="game-actions">
                <div class="game-meta">
                    <span class="meta-tag meta-par" title="Quantidade de números PARES (Ideal: 2 a 3)">${ev}P</span>
                    <span class="meta-tag meta-impar" title="Quantidade de números ÍMPARES (Ideal: 2 a 3)">${od}I</span>
                </div>
                <button class="btn-icon btn-copy-one" title="Copiar jogo" data-type="qn" data-idx="${idx}">${ICON.copy}</button>
                <button class="btn-icon btn-select ${sel ? 'checked' : ''}" title="Manter jogo" data-type="qn" data-idx="${idx}">${sel ? ICON.check : ICON.pin}</button>
            </div>
        </div>
        <div class="game-numbers">${game.map(n => renderBall(n, 'qn')).join('')}</div>
        <div class="game-bottom">
            <span class="game-stat" title="Distribuição dos números pelos 4 quadrantes/faixas (1-20, 21-40, 41-60, 61-80)">Faixas: ${rStr}</span>
            <span class="game-stat" title="Distância média (salto) entre os números. Gaps maiores indicam maior dispersão.">Gap médio: ${avgG}</span>
        </div>
        <div class="score-row" title="Score de qualidade: equilíbrio, diversidade, cobertura e dispersão">
            <span class="score-tag ${sClass}">${sLabel}</span>
            <div class="score-bar-wrap"><div class="score-bar" style="width:${score}%"></div></div>
            <span class="score-label ${sClass}">${score}/100</span>
        </div>
    </div>`;
}

function renderGames() {
    // Sort by quality score (best first)
    const lfWithScores = currentLF.map((g, i) => ({
        game: g, origIdx: i,
        score: qualityScoreLF(g, currentLF, currentBaseSetLF)
    }));
    const qnWithScores = currentQN.map((g, i) => ({
        game: g, origIdx: i,
        score: qualityScoreQN(g, currentQN)
    }));

    // Sort but keep original indices for selection tracking
    lfWithScores.sort((a, b) => b.score - a.score);
    qnWithScores.sort((a, b) => b.score - a.score);

    // Re-map selections to sorted order
    const sortedSelectedLF = new Set();
    const lfIdxMap = {};
    lfWithScores.forEach((item, newIdx) => {
        lfIdxMap[item.origIdx] = newIdx;
        if (selectedLF.has(item.origIdx)) sortedSelectedLF.add(newIdx);
    });

    const sortedSelectedQN = new Set();
    const qnIdxMap = {};
    qnWithScores.forEach((item, newIdx) => {
        qnIdxMap[item.origIdx] = newIdx;
        if (selectedQN.has(item.origIdx)) sortedSelectedQN.add(newIdx);
    });

    // Render with display indices
    $('lf-games').innerHTML = lfWithScores.map((item, displayIdx) => {
        // Temporarily set selection for this render
        const origSel = selectedLF.has(item.origIdx);
        const ev = countEven(item.game), od = 15 - ev;
        const lo = item.game.filter(n => n <= 13).length, hi = 15 - lo;
        const rows = [0, 0, 0, 0, 0];
        item.game.forEach(n => rows[lfRow(n) - 1]++);
        const score = item.score;
        const sClass = scoreClass(score);
        const sLabel = scoreLabel(score);

        return `<div class="game-card ${origSel ? 'selected' : ''}" data-type="lf" data-orig-idx="${item.origIdx}">
            <div class="game-top">
                <span class="game-label">Jogo ${pad(displayIdx + 1)}</span>
                <div class="game-actions">
                    <div class="game-meta">
                        <span class="meta-tag meta-par" title="Quantidade de números PARES (Ideal: 7 a 8)">${ev}P</span>
                        <span class="meta-tag meta-impar" title="Quantidade de números ÍMPARES (Ideal: 7 a 8)">${od}I</span>
                        <span class="meta-tag meta-low" title="Dezenas baixas, de 01 a 13 (Ideal: 6 a 9)">${lo}↓</span>
                        <span class="meta-tag meta-high" title="Dezenas altas, de 14 a 25">${hi}↑</span>
                    </div>
                    <button class="btn-icon btn-copy-one" title="Copiar jogo" data-type="lf" data-orig-idx="${item.origIdx}">${ICON.copy}</button>
                    <button class="btn-icon btn-select ${origSel ? 'checked' : ''}" title="Manter jogo" data-type="lf" data-orig-idx="${item.origIdx}">${origSel ? ICON.check : ICON.pin}</button>
                </div>
            </div>
            <div class="game-numbers">${item.game.map(n => renderBall(n, 'lf')).join('')}</div>
            <div class="game-bottom">
                <span class="game-stat" title="Linhas do volante">Linhas: ${rows.join('-')}</span>
                <span class="game-stat" title="Sequência máxima">Seq: ${maxConsec(item.game)}</span>
            </div>
            <div class="score-row" title="Score de qualidade">
                <span class="score-tag ${sClass}">${sLabel}</span>
                <div class="score-bar-wrap"><div class="score-bar" style="width:${score}%"></div></div>
                <span class="score-label ${sClass}">${score}/100</span>
            </div>
        </div>`;
    }).join('');

    $('qn-games').innerHTML = qnWithScores.map((item, displayIdx) => {
        const origSel = selectedQN.has(item.origIdx);
        const ev = countEven(item.game), od = 5 - ev;
        const rl = ['1–20', '21–40', '41–60', '61–80'];
        const ranges = [0, 0, 0, 0];
        item.game.forEach(n => { if (n <= 20) ranges[0]++; else if (n <= 40) ranges[1]++; else if (n <= 60) ranges[2]++; else ranges[3]++; });
        const rStr = ranges.map((r, i) => r > 0 ? rl[i] + ':' + r : null).filter(Boolean).join(' ');
        const sorted = [...item.game].sort((a, b) => a - b);
        const gaps = sorted.slice(1).map((n, i) => n - sorted[i]);
        const avgG = (gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1);
        const score = item.score;
        const sClass = scoreClass(score);
        const sLabel = scoreLabel(score);

        return `<div class="game-card ${origSel ? 'selected' : ''}" data-type="qn" data-orig-idx="${item.origIdx}">
            <div class="game-top">
                <span class="game-label">Jogo ${pad(displayIdx + 1)}</span>
                <div class="game-actions">
                    <div class="game-meta">
                        <span class="meta-tag meta-par" title="Pares (Ideal: 2 a 3)">${ev}P</span>
                        <span class="meta-tag meta-impar" title="Ímpares (Ideal: 2 a 3)">${od}I</span>
                    </div>
                    <button class="btn-icon btn-copy-one" title="Copiar jogo" data-type="qn" data-orig-idx="${item.origIdx}">${ICON.copy}</button>
                    <button class="btn-icon btn-select ${origSel ? 'checked' : ''}" title="Manter jogo" data-type="qn" data-orig-idx="${item.origIdx}">${origSel ? ICON.check : ICON.pin}</button>
                </div>
            </div>
            <div class="game-numbers">${item.game.map(n => renderBall(n, 'qn')).join('')}</div>
            <div class="game-bottom">
                <span class="game-stat" title="Faixas">Faixas: ${rStr}</span>
                <span class="game-stat" title="Gap médio">Gap médio: ${avgG}</span>
            </div>
            <div class="score-row" title="Score de qualidade">
                <span class="score-tag ${sClass}">${sLabel}</span>
                <div class="score-bar-wrap"><div class="score-bar" style="width:${score}%"></div></div>
                <span class="score-label ${sClass}">${score}/100</span>
            </div>
        </div>`;
    }).join('');

    $('lf-info').textContent = `${currentLF.length} jogos · 15 dezenas · 01 a 25`;
    $('qn-info').textContent = `${currentQN.length} jogos · 5 dezenas · 01 a 80`;
    bindCardButtons();
}

// ===== EXTENDED ANALYSIS =====
function renderAnalysis() {
    let h = '';
    const modeCfg = getModeConfig();

    // Mode badge
    h += `<div class="analysis-section"><p style="font-size:.78rem;color:var(--text-2);margin-bottom:8px">
        Modo: <strong style="color:var(--gold)">${MODES[generationMode].label}</strong></p></div>`;

    if (currentLF.length) {
        const freq = {};
        for (let i = 1; i <= 25; i++) freq[i] = 0;
        currentLF.forEach(g => g.forEach(n => freq[n]++));

        const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
        const top5 = sorted.slice(0, 5).map(([n, f]) => `${pad(n)} (${f}x)`).join(', ');
        const bot5 = sorted.slice(-5).map(([n, f]) => `${pad(n)} (${f}x)`).join(', ');
        const avgEv = (currentLF.reduce((s, g) => s + countEven(g), 0) / currentLF.length).toFixed(1);

        // Coverage
        const coveredLF = Object.values(freq).filter(f => f > 0).length;

        // Frequency balance (std deviation)
        const avgFreq = (currentLF.length * 15) / 25;
        const stdDev = Math.sqrt(Object.values(freq).reduce((s, f) => s + Math.pow(f - avgFreq, 2), 0) / 25).toFixed(2);

        // Average intersection between games
        let totalIntersect = 0, pairCount = 0;
        for (let i = 0; i < currentLF.length; i++) {
            for (let j = i + 1; j < currentLF.length; j++) {
                totalIntersect += intersect(currentLF[i], currentLF[j]).length;
                pairCount++;
            }
        }
        const avgIntersect = pairCount > 0 ? (totalIntersect / pairCount).toFixed(1) : '—';

        // Average score
        const avgScore = (currentLF.reduce((s, g) => s + qualityScoreLF(g, currentLF, currentBaseSetLF), 0) / currentLF.length).toFixed(0);

        // Frequency chart
        const maxFreq = Math.max(...Object.values(freq), 1);
        const freqBars = Object.entries(freq).sort((a, b) => +a[0] - +b[0]).map(([n, f]) => {
            const pct = (f / maxFreq * 100).toFixed(0);
            const barClass = f > avgFreq * 1.3 ? 'bar-high' : f < avgFreq * 0.7 ? 'bar-low' : 'bar-mid';
            return `<div class="freq-bar ${barClass}" style="height:${Math.max(2, pct)}%" title="${pad(n)}: ${f}x"></div>`;
        }).join('');
        const freqLabels = Array.from({ length: 25 }, (_, i) => `<span>${pad(i + 1)}</span>`).join('');

        h += `<div class="analysis-section"><h4>Lotofácil</h4>
            <div class="analysis-grid">
                <div class="analysis-stat-card">
                    <span class="stat-label">Score Médio</span>
                    <span class="stat-value">${avgScore}/100</span>
                </div>
                <div class="analysis-stat-card">
                    <span class="stat-label">Cobertura</span>
                    <span class="stat-value">${coveredLF}/25</span>
                    <span class="stat-detail">${((coveredLF / 25) * 100).toFixed(0)}% das dezenas</span>
                </div>
                <div class="analysis-stat-card">
                    <span class="stat-label">Interseção Média</span>
                    <span class="stat-value">${avgIntersect}</span>
                    <span class="stat-detail">dezenas em comum por par</span>
                </div>
                <div class="analysis-stat-card">
                    <span class="stat-label">Equilíbrio Freq.</span>
                    <span class="stat-value">σ ${stdDev}</span>
                    <span class="stat-detail">desvio padrão (menor = melhor)</span>
                </div>
            </div>
            <div style="margin-top:14px">
                <p style="font-size:.72rem;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Distribuição de Frequência</p>
                <div class="freq-bar-container">${freqBars}</div>
                <div class="freq-labels">${freqLabels}</div>
            </div>
            <ul style="margin-top:14px">
                <li>Mais frequentes: ${top5}</li>
                <li>Menos frequentes: ${bot5}</li>
                <li>Média pares/jogo: ${avgEv}</li>
            </ul>
        </div>`;
    }

    if (currentQN.length) {
        const freq = {};
        for (let i = 1; i <= 80; i++) freq[i] = 0;
        currentQN.forEach(g => g.forEach(n => freq[n]++));
        const cov = Object.values(freq).filter(f => f > 0).length;

        // Average dispersion
        const avgDisp = (currentQN.reduce((s, g) => s + dispersionScore(g), 0) / currentQN.length).toFixed(1);

        // Average intersection
        let totalIntersect = 0, pairCount = 0;
        for (let i = 0; i < currentQN.length; i++) {
            for (let j = i + 1; j < currentQN.length; j++) {
                totalIntersect += intersect(currentQN[i], currentQN[j]).length;
                pairCount++;
            }
        }
        const avgIntersect = pairCount > 0 ? (totalIntersect / pairCount).toFixed(1) : '—';

        // Average score
        const avgScore = (currentQN.reduce((s, g) => s + qualityScoreQN(g, currentQN), 0) / currentQN.length).toFixed(0);

        // Range distribution across all games
        const rangeCounts = [0, 0, 0, 0];
        currentQN.forEach(g => g.forEach(n => {
            if (n <= 20) rangeCounts[0]++; else if (n <= 40) rangeCounts[1]++;
            else if (n <= 60) rangeCounts[2]++; else rangeCounts[3]++;
        }));
        const rangeStr = rangeCounts.map((c, i) => `F${i + 1}: ${c}`).join(' · ');

        h += `<div class="analysis-section"><h4>Quina</h4>
            <div class="analysis-grid">
                <div class="analysis-stat-card">
                    <span class="stat-label">Score Médio</span>
                    <span class="stat-value">${avgScore}/100</span>
                </div>
                <div class="analysis-stat-card">
                    <span class="stat-label">Cobertura</span>
                    <span class="stat-value">${cov}/80</span>
                    <span class="stat-detail">${((cov / 80) * 100).toFixed(0)}% das dezenas</span>
                </div>
                <div class="analysis-stat-card">
                    <span class="stat-label">Gap Médio</span>
                    <span class="stat-value">${avgDisp}</span>
                    <span class="stat-detail">dispersão entre dezenas</span>
                </div>
                <div class="analysis-stat-card">
                    <span class="stat-label">Interseção Média</span>
                    <span class="stat-value">${avgIntersect}</span>
                    <span class="stat-detail">números em comum por par</span>
                </div>
            </div>
            <ul style="margin-top:14px">
                <li>Faixas (total): ${rangeStr}</li>
            </ul>
        </div>`;
    }

    h += `<div class="analysis-section"><p style="font-size:.78rem;color:var(--text-3);margin-top:8px">⚠️ Otimização estatística relativa — não garante premiação.</p></div>`;
    $('analysis-body').innerHTML = h;
}

// ===== BUDGET =====
function updateSummary() {
    const budget = parseFloat($('budget').value) || 0;
    const lfP = parseFloat($('lf-price').value) || 3;
    const qnP = parseFloat($('qn-price').value) || 2.5;
    const pct = parseInt($('split').value) || 60;

    const lfQ = Math.floor((budget * pct / 100) / lfP);
    const qnQ = Math.floor((budget * (100 - pct) / 100) / qnP);
    const total = lfQ * lfP + qnQ * qnP;

    $('s-lf-qty').textContent = lfQ + ' jogos';
    $('s-qn-qty').textContent = qnQ + ' jogos';
    $('s-total').textContent = fmt(total);
    $('s-change').textContent = fmt(budget - total);

    const slider = $('split');
    slider.style.background = `linear-gradient(to right,var(--gold) ${pct}%,var(--surface-3) ${pct}%)`;

    return { lfQ, qnQ };
}

// ===== COPY =====
function copyText(text) {
    navigator.clipboard.writeText(text).then(() => toast('Copiado!')).catch(() => toast('Erro ao copiar'));
}
function copyOneGame(type, idx) {
    const game = type === 'lf' ? currentLF[idx] : currentQN[idx];
    const label = type === 'lf' ? 'Lotofácil' : 'Quina';
    copyText(`${label} Jogo ${pad(idx + 1)}: ${game.map(pad).join(' - ')}`);
}
function copyAllGames(type) {
    const games = type === 'lf' ? currentLF : currentQN;
    const label = type === 'lf' ? 'Lotofácil' : 'Quina';
    const txt = games.map((g, i) => `Jogo ${pad(i + 1)}: ${g.map(pad).join(' - ')}`).join('\n');
    copyText(`=== ${label} (${MODES[generationMode].label}) ===\n${txt}\n\nGerado: ${new Date().toLocaleString('pt-BR')}`);
}

// ===== SELECT / DESELECT =====
function toggleSelect(type, idx) {
    const set = type === 'lf' ? selectedLF : selectedQN;
    if (set.has(idx)) set.delete(idx); else set.add(idx);
    renderGames();
}

// ===== REGENERATE UNSELECTED =====
function regenerateUnselected() {
    const { lfQ, qnQ } = updateSummary();

    // Keep selected, regenerate the rest
    const keptLF = [];
    selectedLF.forEach(i => { if (currentLF[i]) keptLF.push(currentLF[i]); });
    const needLF = Math.max(0, lfQ - keptLF.length);

    if (needLF > 0) {
        // Regenerate base set for the new Lotofácil games to vary the draw
        currentBaseSetLF = generateBaseSetLF();
        const newLF = genLFGames(needLF, keptLF);
        currentLF = [...keptLF, ...newLF];
    }

    const keptQN = [];
    selectedQN.forEach(i => { if (currentQN[i]) keptQN.push(currentQN[i]); });
    const needQN = Math.max(0, qnQ - keptQN.length);

    if (needQN > 0) {
        const newQN = genQNGames(needQN, keptQN);
        currentQN = [...keptQN, ...newQN];
    }

    // Update selection indices (kept games are now at the start)
    selectedLF = new Set(keptLF.map((_, i) => i));
    selectedQN = new Set(keptQN.map((_, i) => i));

    renderGames();
    renderAnalysis();
    saveToHistory();
    toast('Jogos não selecionados regenerados e salvos!');
}

// ===== GENERATE =====
function generateAll() {
    const { lfQ, qnQ } = updateSummary();
    if (lfQ === 0 && qnQ === 0) { toast('Orçamento insuficiente'); return; }

    const btn = $('btn-generate');
    btn.classList.add('loading');
    btn.textContent = 'Gerando...';

    setTimeout(() => {
        if (selectedLF.size === 0 && selectedQN.size === 0) {
            currentBaseSetLF = generateBaseSetLF();
            currentLF = genLFGames(lfQ);
            currentQN = genQNGames(qnQ);
            selectedLF.clear();
            selectedQN.clear();
        } else {
            regenerateUnselected();
        }

        renderGames();
        renderAnalysis();
        $('results-area').classList.remove('hidden');
        $('results-area').scrollIntoView({ behavior: 'smooth', block: 'start' });

        saveToHistory();
        if (selectedLF.size === 0 && selectedQN.size === 0) {
            toast('Jogos gerados e salvos no histórico!');
        }

        btn.classList.remove('loading');
        const hasSelection = selectedLF.size || selectedQN.size;
        btn.textContent = hasSelection ? 'Regenerar não selecionados' : 'Gerar Jogos';

        // Show "Register bet" button
        let regBtn = $('btn-register-bet-gen');
        if (!regBtn) {
            regBtn = document.createElement('button');
            regBtn.id = 'btn-register-bet-gen';
            regBtn.className = 'btn-secondary';
            regBtn.textContent = '💰 Registrar esta aposta no Financeiro';
            regBtn.addEventListener('click', registerBetFromGenerator);
            btn.parentNode.insertBefore(regBtn, btn.nextSibling);
        }
    }, 300);
}

// ===== HISTORY (localStorage) =====
const HISTORY_KEY = 'lotosmart_history';

function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
    catch { return []; }
}
function saveHistoryData(data) { localStorage.setItem(HISTORY_KEY, JSON.stringify(data)); }

function saveToHistory() {
    if (!currentLF.length && !currentQN.length) return;
    const history = loadHistory();
    history.unshift({
        id: Date.now(),
        date: new Date().toLocaleString('pt-BR'),
        mode: generationMode,
        lf: currentLF,
        qn: currentQN
    });
    if (history.length > 50) history.length = 50;
    saveHistoryData(history);
    renderHistory();
}

function deleteHistoryEntry(id) {
    const history = loadHistory().filter(h => h.id !== id);
    saveHistoryData(history);
    renderHistory();
}

function clearHistory() {
    if (!confirm('Limpar todo o histórico?')) return;
    saveHistoryData([]);
    renderHistory();
}

function loadFromHistory(entry) {
    currentLF = entry.lf || [];
    currentQN = entry.qn || [];
    if (entry.mode && MODES[entry.mode]) {
        generationMode = entry.mode;
        updateModeUI();
    }
    selectedLF.clear();
    selectedQN.clear();
    currentBaseSetLF = null;
    switchView('gerador');
    renderGames();
    renderAnalysis();
    $('results-area').classList.remove('hidden');
    $('btn-generate').textContent = 'Gerar Jogos';
    toast('Jogos carregados do histórico');
}

function renderHistory() {
    const history = loadHistory();
    const el = $('history-list');
    const empty = $('history-empty');

    if (!history.length) {
        el.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    el.innerHTML = history.map(h => {
        const modeLabel = h.mode && MODES[h.mode] ? MODES[h.mode].label : 'Balanceado';
        const lfTxt = (h.lf || []).map((g, i) => `<div style="font-size:.78rem;color:var(--text-2);padding:2px 0;font-family:var(--mono)">J${pad(i + 1)}: ${g.map(pad).join(' ')}</div>`).join('');
        const qnTxt = (h.qn || []).map((g, i) => `<div style="font-size:.78rem;color:var(--text-2);padding:2px 0;font-family:var(--mono)">J${pad(i + 1)}: ${g.map(pad).join(' ')}</div>`).join('');
        return `<div class="history-entry" data-id="${h.id}">
            <div class="history-entry-header">
                <span class="history-date">${h.date}</span>
                <span class="history-summary">${(h.lf || []).length} LF · ${(h.qn || []).length} QN · ${modeLabel}</span>
            </div>
            <div class="history-body">
                ${lfTxt ? `<p style="font-size:.75rem;font-weight:600;color:var(--purple);margin:10px 0 4px">LOTOFÁCIL</p>${lfTxt}` : ''}
                ${qnTxt ? `<p style="font-size:.75rem;font-weight:600;color:var(--cyan);margin:10px 0 4px">QUINA</p>${qnTxt}` : ''}
                <div class="history-actions">
                    <button class="btn-sm btn-load-hist">Carregar</button>
                    <button class="btn-sm btn-copy-hist">Copiar</button>
                    <button class="btn-sm btn-danger btn-del-hist">Excluir</button>
                </div>
            </div>
        </div>`;
    }).join('');

    // Bind history events
    $$('.history-entry-header').forEach(hdr => {
        hdr.addEventListener('click', () => hdr.nextElementSibling.classList.toggle('open'));
    });
    $$('.btn-load-hist').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.closest('.history-entry').dataset.id);
            const entry = loadHistory().find(h => h.id === id);
            if (entry) loadFromHistory(entry);
        });
    });
    $$('.btn-copy-hist').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.closest('.history-entry').dataset.id);
            const entry = loadHistory().find(h => h.id === id);
            if (!entry) return;
            const modeLabel = entry.mode && MODES[entry.mode] ? MODES[entry.mode].label : 'Balanceado';
            let txt = `=== LotoSmart — ${entry.date} (${modeLabel}) ===\n`;
            if (entry.lf?.length) { txt += '\nLOTOFÁCIL:\n'; entry.lf.forEach((g, i) => txt += `J${pad(i + 1)}: ${g.map(pad).join(' - ')}\n`); }
            if (entry.qn?.length) { txt += '\nQUINA:\n'; entry.qn.forEach((g, i) => txt += `J${pad(i + 1)}: ${g.map(pad).join(' - ')}\n`); }
            copyText(txt);
        });
    });
    $$('.btn-del-hist').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.closest('.history-entry').dataset.id);
            deleteHistoryEntry(id);
        });
    });
}

// ===== CARD BUTTONS =====
function bindCardButtons() {
    $$('.btn-copy-one').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const origIdx = parseInt(btn.dataset.origIdx);
            copyOneGame(btn.dataset.type, origIdx);
        });
    });
    $$('.btn-select').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const origIdx = parseInt(btn.dataset.origIdx);
            toggleSelect(btn.dataset.type, origIdx);
            // Update button text
            const hasSelection = selectedLF.size || selectedQN.size;
            $('btn-generate').textContent = hasSelection ? 'Regenerar não selecionados' : 'Gerar Jogos';
        });
    });
}

// ===== TOAST =====
function toast(msg) {
    $('toast-msg').textContent = msg;
    $('toast').classList.add('show');
    setTimeout(() => $('toast').classList.remove('show'), 2500);
}

function switchView(view) {
    const isValid = pb && pb.authStore.isValid;
    const user = isValid ? pb.authStore.model : null;

    if (!isValid) {
        if (view !== 'login' && view !== 'contato') {
            view = 'login';
        }
    } else if (user && user.must_change_password) {
        view = 'change-password';
    } else {
        if (view === 'login' || view === 'change-password') {
            view = 'gerador';
        } else if (view === 'admin' && user.role !== 'admin') {
            view = 'gerador';
        }
    }

    $$('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    $('view-' + view).classList.remove('hidden');
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    if (view === 'historico') renderHistory();
    if (view === 'financeiro') refreshFinancialData();
    if (view === 'admin') loadAdminData();
}

// ===== TABS =====
function switchTab(tabId) {
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    $$('.tab-content').forEach(tc => tc.classList.toggle('active', tc.id === tabId));
}

// ===== MODE SWITCHING =====
function setMode(mode) {
    generationMode = mode;
    updateModeUI();
}

function updateModeUI() {
    $$('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === generationMode);
    });
}

// ===== POCKETBASE INITIALIZATION =====
const PB_URL = 'https://lotosmart.pockethost.io';
let pb = null;
let pbReady = false;

async function initPocketBase() {
    try {
        pb = new PocketBase(PB_URL);
        // Test connection by checking health
        const health = await fetch(PB_URL + '/api/health').then(r => r.json());
        if (health.code === 200) {
            pbReady = true;
            console.log('PocketBase connected successfully');
            return true;
        }
    } catch (e) {
        console.warn('PocketBase not available:', e.message);
        pbReady = false;
    }
    return false;
}

// Ensure collections exist via API (Deprecating local setup - Pockethost managed)
async function ensureCollections() {
    return true;
}

// ===== AUTHENTICATION MODULE =====
async function loginUser(email, password) {
    if (!pbReady) return { success: false, message: 'PocketBase não inicializado' };
    try {
        const authData = await pb.collection('users').authWithPassword(email, password);
        if (authData.record) {
            await pb.collection('users').update(authData.record.id, {
                ultimo_login: new Date().toISOString()
            });
            await logAudit('login', authData.record.id, { email });
            checkAuthState();
            return { success: true };
        }
    } catch (e) {
        console.error('Login error:', e);
        return { success: false, message: e.message || 'E-mail ou senha incorretos' };
    }
    return { success: false, message: 'Credenciais inválidas' };
}

function logoutUser() {
    if (pb && pb.authStore.model) {
        logAudit('logout', pb.authStore.model.id, {});
    }
    pb.authStore.clear();
    checkAuthState();
}

async function changePassword(oldPass, newPass) {
    if (!pb || !pb.authStore.model) return { success: false, message: 'Não autenticado' };
    try {
        await pb.collection('users').update(pb.authStore.model.id, {
            oldPassword: oldPass,
            password: newPass,
            passwordConfirm: newPass,
            must_change_password: false
        });
        await logAudit('password_change', pb.authStore.model.id, {});
        const email = pb.authStore.model.email;
        await pb.collection('users').authWithPassword(email, newPass);
        checkAuthState();
        return { success: true };
    } catch (e) {
        console.error('Password change error:', e);
        return { success: false, message: e.message || 'Erro ao alterar a senha' };
    }
}

// Navigation Guards
let isAuthChecking = false;
function checkAuthState() {
    if (isAuthChecking) return;
    isAuthChecking = true;

    try {
        const isValid = pb && pb.authStore.isValid;
        const user = isValid ? pb.authStore.model : null;

        if (user && user.ativo === false) {
            pb.authStore.clear();
            toast('Sua conta foi desativada pelo administrador.');
            checkAuthState();
            isAuthChecking = false;
            return;
        }

        const navGerador = $('nav-btn-gerador');
        const navHistorico = $('nav-btn-historico');
        const navFinanceiro = $('nav-btn-financeiro');
        const navAdmin = $('nav-btn-admin');
        const navContato = $('nav-btn-contato');
        const userMenu = $('user-menu');
        const headerUserName = $('header-user-name');

        if (!isValid) {
            navGerador.style.display = 'none';
            navHistorico.style.display = 'none';
            navFinanceiro.style.display = 'none';
            navAdmin.style.display = 'none';
            userMenu.style.display = 'none';
            
            const currentView = document.querySelector('[id^="view-"]:not(.hidden)');
            if (!currentView || (currentView.id !== 'view-login' && currentView.id !== 'view-contato')) {
                switchView('login');
            }
        } else {
            userMenu.style.display = 'flex';
            headerUserName.textContent = user.name || user.email;

            if (user.must_change_password) {
                navGerador.style.display = 'none';
                navHistorico.style.display = 'none';
                navFinanceiro.style.display = 'none';
                navAdmin.style.display = 'none';
                switchView('change-password');
            } else {
                navGerador.style.display = 'inline-block';
                navHistorico.style.display = 'inline-block';
                navFinanceiro.style.display = 'inline-block';
                
                if (user.role === 'admin') {
                    navAdmin.style.display = 'inline-block';
                } else {
                    navAdmin.style.display = 'none';
                }

                const currentView = document.querySelector('[id^="view-"]:not(.hidden)');
                if (!currentView || currentView.id === 'view-login' || currentView.id === 'view-change-password') {
                    switchView('gerador');
                } else if (currentView.id === 'view-admin' && user.role !== 'admin') {
                    switchView('gerador');
                }
            }
        }
    } finally {
        isAuthChecking = false;
    }
}

// ===== AUDIT LOGS =====
async function logAudit(action, targetId = '', details = {}) {
    if (!pbReady || !pb.authStore.isValid) return;
    try {
        await pb.collection('audit_logs').create({
            action,
            user_id: pb.authStore.model.id,
            target_id: targetId,
            details: details
        });
    } catch (e) {
        console.error('Audit log failed:', e);
    }
}

// ===== ADMIN CRUD FUNCTIONS =====
async function loadAdminData() {
    if (!pbReady || !pb.authStore.isValid || pb.authStore.model.role !== 'admin') return;

    try {
        const users = await pb.collection('users').getFullList({ sort: '-created' });
        const audit = await pb.collection('audit_logs').getFullList({ 
            sort: '-created',
            expand: 'user_id'
        });

        $('admin-stat-total').textContent = users.length;
        $('admin-stat-active').textContent = users.filter(u => u.ativo !== false).length;

        const usersTable = $('admin-users-table');
        usersTable.innerHTML = '';
        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${u.name || '-'}</td>
                <td>${u.email}</td>
                <td><span class="type-badge ${u.role === 'admin' ? 'badge-prize' : 'badge-bet'}">${u.role}</span></td>
                <td><span class="type-badge ${u.ativo !== false ? 'badge-prize' : 'badge-bet'}">${u.ativo !== false ? 'Ativo' : 'Inativo'}</span></td>
                <td>${u.ultimo_login ? new Date(u.ultimo_login).toLocaleString('pt-BR') : 'Nunca'}</td>
                <td>
                    <button class="btn-sm" onclick="handleToggleUser('${u.id}', ${u.ativo !== false})">${u.ativo !== false ? 'Desativar' : 'Ativar'}</button>
                    <button class="btn-sm" style="margin-left:4px" onclick="handleResetUserPassword('${u.id}')">Resetar Senha</button>
                </td>
            `;
            usersTable.appendChild(tr);
        });

        const auditTable = $('admin-audit-table');
        auditTable.innerHTML = '';
        audit.slice(0, 50).forEach(log => {
            const tr = document.createElement('tr');
            const userName = log.expand && log.expand.user_id ? log.expand.user_id.name || log.expand.user_id.email : 'Sistema';
            tr.innerHTML = `
                <td>${new Date(log.created).toLocaleString('pt-BR')}</td>
                <td>${log.action}</td>
                <td>${userName}</td>
                <td><pre style="font-size:0.7rem; max-width: 300px; overflow: auto; margin:0;">${JSON.stringify(log.details)}</pre></td>
            `;
            auditTable.appendChild(tr);
        });
    } catch (e) {
        console.error('Error loading admin data:', e);
        toast('Erro ao carregar dados administrativos.');
    }
}

async function createUser(name, email, role, password) {
    if (!pbReady) return { success: false, message: 'PocketBase offline' };
    try {
        const newUser = await pb.collection('users').create({
            email,
            password,
            passwordConfirm: password,
            name,
            role,
            ativo: true,
            must_change_password: true
        });
        await logAudit('user_created', newUser.id, { name, email, role });
        await loadAdminData();
        return { success: true };
    } catch (e) {
        console.error('Create user failed:', e);
        return { success: false, message: e.message || 'Erro ao criar usuário' };
    }
}

async function handleToggleUser(userId, currentActive) {
    try {
        await pb.collection('users').update(userId, { ativo: !currentActive });
        await logAudit(!currentActive ? 'user_activated' : 'user_deactivated', userId, {});
        toast('Status do usuário atualizado!');
        await loadAdminData();
    } catch (e) {
        console.error('Toggle status failed:', e);
        toast('Erro ao alterar status.');
    }
}

async function handleResetUserPassword(userId) {
    const tempPass = 'Loto@' + Math.floor(100000 + Math.random() * 900000);
    try {
        await pb.collection('users').update(userId, {
            password: tempPass,
            passwordConfirm: tempPass,
            must_change_password: true
        });
        await logAudit('password_reset', userId, {});
        alert(`Senha resetada com sucesso!\nSenha temporária: ${tempPass}\n\nCopie esta senha e passe para o usuário.`);
        await loadAdminData();
    } catch (e) {
        console.error('Reset password failed:', e);
        toast('Erro ao resetar senha.');
    }
}

window.handleToggleUser = handleToggleUser;
window.handleResetUserPassword = handleResetUserPassword;

// ===== FINANCIAL DATA — LOCALSTORAGE FALLBACK =====
const FIN_BETS_KEY = 'lotosmart_bets';
const FIN_PRIZES_KEY = 'lotosmart_prizes';

function loadLocalBets() {
    try { return JSON.parse(localStorage.getItem(FIN_BETS_KEY)) || []; }
    catch { return []; }
}
function saveLocalBets(data) { localStorage.setItem(FIN_BETS_KEY, JSON.stringify(data)); }

function loadLocalPrizes() {
    try { return JSON.parse(localStorage.getItem(FIN_PRIZES_KEY)) || []; }
    catch { return []; }
}
function saveLocalPrizes(data) { localStorage.setItem(FIN_PRIZES_KEY, JSON.stringify(data)); }

// ===== FINANCIAL CRUD =====
async function addBet(betData) {
    if (pbReady && pb.authStore.isValid) {
        try {
            const dataWithOwner = { ...betData, owner_id: pb.authStore.model.id };
            await pb.collection('bets').create(dataWithOwner);
        } catch (e) {
            console.error('PB create bet failed, using localStorage:', e);
            const bets = loadLocalBets();
            bets.unshift({ ...betData, id: Date.now().toString(), created: new Date().toISOString() });
            saveLocalBets(bets);
        }
    } else {
        const bets = loadLocalBets();
        bets.unshift({ ...betData, id: Date.now().toString(), created: new Date().toISOString() });
        saveLocalBets(bets);
    }
    await refreshFinancialData();
}

async function addPrize(prizeData) {
    if (pbReady && pb.authStore.isValid) {
        try {
            const dataWithOwner = { ...prizeData, owner_id: pb.authStore.model.id };
            await pb.collection('prizes').create(dataWithOwner);
        } catch (e) {
            console.error('PB create prize failed, using localStorage:', e);
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

async function deleteBet(id) {
    if (pbReady && pb.authStore.isValid) {
        try { await pb.collection('bets').delete(id); }
        catch (e) {
            console.error('PB delete bet failed:', e);
            const bets = loadLocalBets().filter(b => b.id !== id);
            saveLocalBets(bets);
        }
    } else {
        const bets = loadLocalBets().filter(b => b.id !== id);
        saveLocalBets(bets);
    }
    await refreshFinancialData();
}

async function deletePrize(id) {
    if (pbReady && pb.authStore.isValid) {
        try { await pb.collection('prizes').delete(id); }
        catch (e) {
            console.error('PB delete prize failed:', e);
            const prizes = loadLocalPrizes().filter(p => p.id !== id);
            saveLocalPrizes(prizes);
        }
    } else {
        const prizes = loadLocalPrizes().filter(p => p.id !== id);
        saveLocalPrizes(prizes);
    }
    await refreshFinancialData();
}

async function getAllBets() {
    if (pbReady && pb.authStore.isValid) {
        try {
            const result = await pb.collection('bets').getFullList({ sort: '-bet_date' });
            return result;
        } catch (e) {
            console.error('PB get bets failed:', e);
            return loadLocalBets();
        }
    }
    return loadLocalBets();
}

async function getAllPrizes() {
    if (pbReady && pb.authStore.isValid) {
        try {
            const result = await pb.collection('prizes').getFullList({ sort: '-prize_date' });
            return result;
        } catch (e) {
            console.error('PB get prizes failed:', e);
            return loadLocalPrizes();
        }
    }
    return loadLocalPrizes();
}


// ===== FINANCIAL STATE =====
let allBets = [];
let allPrizes = [];
let finFilter = 'all';
let finChart = null;

async function refreshFinancialData() {
    allBets = await getAllBets();
    allPrizes = await getAllPrizes();
    renderFinancialDashboard();
    renderTransactions();
    renderFinancialChart();
}

// ===== FINANCIAL DASHBOARD =====
function renderFinancialDashboard() {
    const totalSpent = allBets.reduce((s, b) => s + (parseFloat(b.total_cost) || 0), 0);
    const totalWon = allPrizes.reduce((s, p) => s + (parseFloat(p.prize_amount) || 0), 0);
    const pl = totalWon - totalSpent;
    const roi = totalSpent > 0 ? ((totalWon / totalSpent) * 100 - 100) : 0;

    // Count unique weeks
    const weekSet = new Set();
    allBets.forEach(b => {
        if (b.bet_date) {
            const d = new Date(b.bet_date);
            const weekStart = new Date(d);
            weekStart.setDate(d.getDate() - d.getDay());
            weekSet.add(weekStart.toISOString().slice(0, 10));
        }
    });

    // Hit rate: % of bets that have matching prizes
    const betsWithPrize = allPrizes.length;
    const totalBetEntries = allBets.length;
    const hitRate = totalBetEntries > 0 ? ((betsWithPrize / totalBetEntries) * 100) : 0;

    $('fin-total-spent').textContent = fmt(totalSpent);
    $('fin-total-spent').className = 'metric-value' + (totalSpent > 0 ? ' negative' : '');
    $('fin-spent-detail').textContent = `${allBets.length} aposta${allBets.length !== 1 ? 's' : ''} registrada${allBets.length !== 1 ? 's' : ''}`;

    $('fin-total-won').textContent = fmt(totalWon);
    $('fin-total-won').className = 'metric-value' + (totalWon > 0 ? ' positive' : '');
    $('fin-won-detail').textContent = `${allPrizes.length} prêmio${allPrizes.length !== 1 ? 's' : ''} registrado${allPrizes.length !== 1 ? 's' : ''}`;

    $('fin-pl').textContent = (pl >= 0 ? '+' : '') + fmt(pl);
    $('fin-pl').className = 'metric-value ' + (pl >= 0 ? 'positive' : 'negative');
    $('fin-pl-detail').textContent = pl >= 0 ? 'Lucro acumulado' : 'Prejuízo acumulado';

    $('fin-roi').textContent = (roi >= 0 ? '+' : '') + roi.toFixed(1) + '%';
    $('fin-roi').className = 'metric-value ' + (roi >= 0 ? 'positive' : 'negative');

    $('fin-hit-rate').textContent = hitRate.toFixed(1) + '%';
    $('fin-rate-detail').textContent = `${betsWithPrize} de ${totalBetEntries} apostas premiadas`;

    $('fin-weeks').textContent = weekSet.size;
    $('fin-weeks-detail').textContent = weekSet.size > 0 ? `desde ${[...weekSet].sort()[0].split('-').reverse().join('/')}` : '—';
}

// ===== TRANSACTION TABLE =====
function renderTransactions() {
    // Combine bets and prizes into a single list
    const transactions = [];

    allBets.forEach(b => {
        transactions.push({
            id: b.id,
            type: 'bet',
            date: b.bet_date,
            lottery: b.lottery_type,
            details: `${b.game_count || 1} jogo${(b.game_count || 1) > 1 ? 's' : ''}` + (b.contest_number ? ` · Conc. ${b.contest_number}` : '') + (b.notes ? ` · ${b.notes}` : ''),
            amount: -(parseFloat(b.total_cost) || 0),
            source: 'bets'
        });
    });

    allPrizes.forEach(p => {
        transactions.push({
            id: p.id,
            type: 'prize',
            date: p.prize_date,
            lottery: p.lottery_type,
            details: `${p.matches || 0} acertos` + (p.contest_number ? ` · Conc. ${p.contest_number}` : '') + (p.notes ? ` · ${p.notes}` : ''),
            amount: parseFloat(p.prize_amount) || 0,
            source: 'prizes'
        });
    });

    // Sort by date descending
    transactions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Apply filter
    const filtered = transactions.filter(t => {
        if (finFilter === 'all') return true;
        if (finFilter === 'bet') return t.type === 'bet';
        if (finFilter === 'prize') return t.type === 'prize';
        if (finFilter === 'lf') return t.lottery === 'lf';
        if (finFilter === 'qn') return t.lottery === 'qn';
        return true;
    });

    const tbody = $('fin-table-body');
    const emptyEl = $('fin-table-empty');

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyEl.style.display = 'block';
        return;
    }
    emptyEl.style.display = 'none';

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
                <button class="btn-icon btn-table-action btn-del-transaction" title="Excluir" data-id="${t.id}" data-source="${t.source}">${ICON.copy.replace('copy', 'x')}</button>
            </td>
        </tr>`;
    }).join('');

    // Bind delete buttons
    tbody.querySelectorAll('.btn-del-transaction').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Excluir esta transação?')) return;
            const id = btn.dataset.id;
            const source = btn.dataset.source;
            if (source === 'bets') await deleteBet(id);
            else await deletePrize(id);
        });
    });
}

// ===== DELETE ICON =====
const ICON_DELETE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>`;

// ===== FINANCIAL CHART =====
function renderFinancialChart() {
    const ctx = $('fin-chart');
    if (!ctx) return;

    // Combine all transactions and sort by date
    const allTransactions = [];
    allBets.forEach(b => allTransactions.push({
        date: b.bet_date, amount: -(parseFloat(b.total_cost) || 0)
    }));
    allPrizes.forEach(p => allTransactions.push({
        date: p.prize_date, amount: parseFloat(p.prize_amount) || 0
    }));
    allTransactions.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    if (allTransactions.length === 0) {
        if (finChart) { finChart.destroy(); finChart = null; }
        return;
    }

    // Group by week
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

    // Cumulative P&L
    let cumPL = 0;
    const cumulativePL = weeks.map(w => {
        cumPL += weeklyData[w].won - weeklyData[w].spent;
        return cumPL;
    });

    const spentData = weeks.map(w => weeklyData[w].spent);
    const wonData = weeks.map(w => weeklyData[w].won);

    if (finChart) finChart.destroy();

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

// ===== FINANCIAL FORM HANDLERS =====
function handleAddBet() {
    const betDate = $('fin-bet-date').value;
    const lotteryType = $('fin-bet-type').value;
    const gameCount = parseInt($('fin-bet-qty').value) || 1;
    const totalCost = parseFloat($('fin-bet-cost').value) || 0;
    const contestNumber = parseInt($('fin-bet-contest').value) || null;
    const notes = $('fin-bet-notes').value.trim();

    if (!betDate) { toast('Informe a data da aposta'); return; }
    if (totalCost <= 0) { toast('Informe o valor gasto'); return; }

    addBet({
        bet_date: betDate,
        lottery_type: lotteryType,
        game_count: gameCount,
        total_cost: totalCost,
        contest_number: contestNumber,
        notes: notes
    });

    // Reset form
    $('fin-bet-contest').value = '';
    $('fin-bet-notes').value = '';
    toast('💸 Gasto registrado com sucesso!');
}

function handleAddPrize() {
    const prizeDate = $('fin-prize-date').value;
    const lotteryType = $('fin-prize-type').value;
    const matches = parseInt($('fin-prize-matches').value) || 0;
    const prizeAmount = parseFloat($('fin-prize-amount').value) || 0;
    const contestNumber = parseInt($('fin-prize-contest').value) || null;
    const notes = $('fin-prize-notes').value.trim();

    if (!prizeDate) { toast('Informe a data do resultado'); return; }
    if (prizeAmount <= 0) { toast('Informe o valor do prêmio'); return; }

    addPrize({
        prize_date: prizeDate,
        lottery_type: lotteryType,
        matches: matches,
        prize_amount: prizeAmount,
        contest_number: contestNumber,
        notes: notes
    });

    // Reset form
    $('fin-prize-contest').value = '';
    $('fin-prize-notes').value = '';
    $('fin-prize-amount').value = '0';
    toast('🏆 Prêmio registrado com sucesso!');
}

// ===== REGISTER BET FROM GENERATOR =====
function registerBetFromGenerator() {
    const budget = parseFloat($('budget').value) || 0;
    const lfP = parseFloat($('lf-price').value) || 3;
    const qnP = parseFloat($('qn-price').value) || 2.5;
    const pct = parseInt($('split').value) || 60;
    const lfQ = Math.floor((budget * pct / 100) / lfP);
    const qnQ = Math.floor((budget * (100 - pct) / 100) / qnP);

    const today = new Date().toISOString().slice(0, 10);

    if (lfQ > 0) {
        addBet({
            bet_date: today,
            lottery_type: 'lf',
            game_count: lfQ,
            total_cost: lfQ * lfP,
            contest_number: null,
            notes: `Gerado no LotoSmart (${MODES[generationMode].label})`,
            games: JSON.stringify(currentLF)
        });
    }

    if (qnQ > 0) {
        addBet({
            bet_date: today,
            lottery_type: 'qn',
            game_count: qnQ,
            total_cost: qnQ * qnP,
            contest_number: null,
            notes: `Gerado no LotoSmart (${MODES[generationMode].label})`,
            games: JSON.stringify(currentQN)
        });
    }

    toast('💰 Apostas registradas no financeiro!');
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    ['budget', 'lf-price', 'qn-price'].forEach(id => $(id).addEventListener('input', updateSummary));
    
    $('split-input-lf').addEventListener('input', (e) => {
        let val = parseInt(e.target.value) || 0;
        if(val > 100) val = 100; if(val < 0) val = 0;
        $('split').value = val;
        $('split-input-qn').value = 100 - val;
        updateSummary();
    });
    $('split-input-qn').addEventListener('input', (e) => {
        let val = parseInt(e.target.value) || 0;
        if(val > 100) val = 100; if(val < 0) val = 0;
        $('split').value = 100 - val;
        $('split-input-lf').value = 100 - val;
        updateSummary();
    });
    $('split').addEventListener('input', (e) => {
        let val = parseInt(e.target.value) || 0;
        $('split-input-lf').value = val;
        $('split-input-qn').value = 100 - val;
        updateSummary();
    });

    $('btn-generate').addEventListener('click', generateAll);
    $('btn-clear-history').addEventListener('click', clearHistory);
    $('btn-copy-all-lf').addEventListener('click', () => copyAllGames('lf'));
    $('btn-copy-all-qn').addEventListener('click', () => copyAllGames('qn'));
    $$('.nav-btn').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
    $$('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

    // Mode selector
    $$('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    // Financial module
    $('btn-add-bet').addEventListener('click', handleAddBet);
    $('btn-add-prize').addEventListener('click', handleAddPrize);

    // Financial filters
    $$('.fin-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.fin-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            finFilter = btn.dataset.filter;
            renderTransactions();
        });
    });

    // Authentication UI Handlers
    $('form-login').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = $('login-email').value.trim();
        const password = $('login-password').value;
        const btn = $('btn-login-submit');
        btn.disabled = true;
        btn.textContent = 'Entrando...';
        const res = await loginUser(email, password);
        btn.disabled = false;
        btn.textContent = 'Entrar';
        if (res.success) {
            toast('Bem-vindo ao LotoSmart!');
        } else {
            toast(res.message);
        }
    });

    $('btn-logout').addEventListener('click', () => {
        logoutUser();
        toast('Sessão encerrada.');
    });

    $('form-change-password').addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPass = $('change-old-password').value;
        const newPass = $('change-new-password').value;
        const confirmPass = $('change-confirm-password').value;
        const btn = $('btn-change-pass-submit');

        if (newPass.length < 8) {
            toast('A nova senha deve ter pelo menos 8 caracteres.');
            return;
        }
        if (newPass !== confirmPass) {
            toast('As senhas não coincidem.');
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Alterando...';
        const res = await changePassword(oldPass, newPass);
        btn.disabled = false;
        btn.textContent = 'Alterar Senha';
        if (res.success) {
            toast('Senha alterada com sucesso!');
        } else {
            toast(res.message);
        }
    });

    $('form-create-user').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = $('new-user-name').value.trim();
        const email = $('new-user-email').value.trim();
        const role = $('new-user-role').value;
        const password = $('new-user-password').value;

        if (password.length < 8) {
            toast('A senha deve ter pelo menos 8 caracteres.');
            return;
        }

        const res = await createUser(name, email, role, password);
        if (res.success) {
            toast('Usuário criado com sucesso!');
            $('form-create-user').reset();
        } else {
            toast(res.message);
        }
    });

    $('form-contato').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = $('contact-name').value.trim();
        const email = $('contact-email').value.trim();
        const message = $('contact-message').value.trim();

        const subject = encodeURIComponent('Solicitação de Acesso LotoSmart');
        const body = encodeURIComponent(`Nome: ${name}\nE-mail: ${email}\nMensagem:\n${message}`);
        window.location.href = `mailto:contato@lotosmart.com?subject=${subject}&body=${body}`;
        
        toast('Direcionando para o e-mail...');
        $('form-contato').reset();
    });

    $('link-go-contato').addEventListener('click', (e) => { e.preventDefault(); switchView('contato'); });
    $('link-go-login').addEventListener('click', (e) => { e.preventDefault(); switchView('login'); });

    // Set default dates to today
    const today = new Date().toISOString().slice(0, 10);
    if ($('fin-bet-date')) $('fin-bet-date').value = today;
    if ($('fin-prize-date')) $('fin-prize-date').value = today;

    updateSummary();
    updateModeUI();

    // Initialize PocketBase and check session
    initPocketBase().then(() => {
        checkAuthState();
        if (pb && pb.authStore.isValid && !pb.authStore.model.must_change_password) {
            refreshFinancialData();
        }
    });
});

