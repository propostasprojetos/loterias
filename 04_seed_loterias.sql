-- ==============================================================================
-- 04_seed_loterias.sql
-- Este script insere todos os jogos da Caixa com seus preços e regras básicas.
-- ==============================================================================

INSERT INTO public.jogos (nome, slug, status, ordem, parametros)
VALUES
-- MEGA-SENA
(
  'Mega-Sena',
  'megasena',
  'ativo',
  10,
  '{
    "range_min": 1,
    "range_max": 60,
    "pick_size": 6,
    "cost": 6.00,
    "prices": {
      "6": 6.00, "7": 42.00, "8": 168.00, "9": 504.00, "10": 1260.00,
      "11": 2772.00, "12": 5544.00, "13": 10296.00, "14": 18018.00, "15": 30030.00,
      "16": 48048.00, "17": 74484.00, "18": 111726.00, "19": 162414.00, "20": 232560.00
    }
  }'::jsonb
),

-- LOTOFÁCIL
(
  'Lotofácil',
  'lotofacil',
  'ativo',
  20,
  '{
    "range_min": 1,
    "range_max": 25,
    "pick_size": 15,
    "cost": 3.50,
    "prices": {
      "15": 3.50, "16": 56.00, "17": 476.00, "18": 2856.00, "19": 13566.00, "20": 54264.00
    }
  }'::jsonb
),

-- QUINA
(
  'Quina',
  'quina',
  'ativo',
  30,
  '{
    "range_min": 1,
    "range_max": 80,
    "pick_size": 5,
    "cost": 3.00,
    "prices": {
      "5": 3.00, "6": 18.00, "7": 63.00, "8": 168.00, "9": 378.00,
      "10": 756.00, "11": 1386.00, "12": 2376.00, "13": 3861.00, "14": 6006.00, "15": 9009.00
    }
  }'::jsonb
),

-- +MILIONÁRIA
(
  '+Milionária',
  'maismilionaria',
  'ativo',
  40,
  '{
    "range_min": 1,
    "range_max": 50,
    "pick_size": 6,
    "cost": 6.00,
    "prices": {
      "6": 6.00, "7": 42.00, "8": 168.00, "12": 83160.00
    },
    "notes": "Requer lógica especial para Trevos"
  }'::jsonb
),

-- DIA DE SORTE
(
  'Dia de Sorte',
  'diadesorte',
  'ativo',
  50,
  '{
    "range_min": 1,
    "range_max": 31,
    "pick_size": 7,
    "cost": 2.50,
    "prices": {
      "7": 2.50, "8": 20.00, "9": 90.00, "10": 300.00, "11": 825.00, "12": 1980.00,
      "13": 4290.00, "14": 8580.00, "15": 16087.50
    },
    "notes": "Requer lógica especial para Mês da Sorte"
  }'::jsonb
),

-- DUPLA SENA
(
  'Dupla Sena',
  'duplasena',
  'ativo',
  60,
  '{
    "range_min": 1,
    "range_max": 50,
    "pick_size": 6,
    "cost": 3.00,
    "prices": {
      "6": 3.00, "7": 21.00, "8": 84.00, "9": 252.00, "10": 630.00,
      "11": 1386.00, "12": 2772.00, "13": 5148.00, "14": 9009.00, "15": 15015.00
    }
  }'::jsonb
),

-- SUPER SETE
(
  'Super Sete',
  'supersete',
  'ativo',
  70,
  '{
    "range_min": 0,
    "range_max": 9,
    "pick_size": 7,
    "cost": 3.00,
    "prices": {
      "7": 3.00, "8": 6.00, "9": 12.00, "10": 24.00, "11": 48.00, "12": 96.00,
      "13": 192.00, "14": 384.00, "21": 6561.00
    },
    "notes": "Requer lógica especial de repetição e colunas"
  }'::jsonb
),

-- TIMEMANIA
(
  'Timemania',
  'timemania',
  'ativo',
  80,
  '{
    "range_min": 1,
    "range_max": 80,
    "pick_size": 10,
    "cost": 3.50,
    "prices": { "10": 3.50 },
    "notes": "Aposta única de 10 dezenas, mais Time do Coração"
  }'::jsonb
),

-- LOTOMANIA
(
  'Lotomania',
  'lotomania',
  'ativo',
  90,
  '{
    "range_min": 0,
    "range_max": 99,
    "pick_size": 50,
    "cost": 3.00,
    "prices": { "50": 3.00 },
    "notes": "Aposta única de 50 dezenas"
  }'::jsonb
)

ON CONFLICT (slug) DO UPDATE SET
  nome = EXCLUDED.nome,
  parametros = EXCLUDED.parametros,
  ordem = EXCLUDED.ordem;
