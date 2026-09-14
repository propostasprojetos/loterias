# Auditoria Financeira: Apostas, Bolões e Caixa

## 1. Estrutura de Banco de Dados Atual (PostgreSQL / Supabase)
A arquitetura financeira baseia-se em tabelas distintas que convergem via chaves estrangeiras:

### `bets` (Apostas / Saídas)
* **Chaves:** `id`, `owner_id` (Auth), `bolao_id` (nullable).
* **Campos Financeiros:** `total_cost` (NUMERIC), `manter_em_caixa` (BOOLEAN - flag de controle).
* **Status:** O valor da aposta sai do bolso do apostador, a não ser que `manter_em_caixa` seja `true`. Se for `true`, 100% de `total_cost` é considerado "pago pelo Caixa". 

### `prizes` (Prêmios / Entradas)
* **Chaves:** `id`, `owner_id`, `bet_id` (nullable), `bolao_id` (nullable).
* **Campos Financeiros:** `prize_amount` (NUMERIC), `manter_em_caixa` (BOOLEAN).
* **Status:** Se a flag for `true`, 100% de `prize_amount` compõe o Caixa.

### `jogo_participantes` (Rateio de Cotas)
* **Campos:** `bet_id`, `participante_id`, `percentual`.
* **Triggers:** O banco valida nativamente (`fn_validar_percentual_bolao`) que a soma não exceda 100%. Garante a divisão justa do investimento individual.

### Como o Saldo do Caixa é calculado?
Não há uma tabela de consolidação `saldos_caixa`. A arquitetura atual calcula o caixa em "tempo de execução" através da soma/subtração dinâmica:
* **Entradas no Caixa:** Soma de todos os `prizes.prize_amount` vinculados ao bolão onde `manter_em_caixa = true`.
* **Saídas do Caixa:** Soma de todos os `bets.total_cost` vinculados ao bolão onde `manter_em_caixa = true`.
* **Saldo:** Entradas - Saídas.

---

## 2. Gaps e Limitações na Implementação Atual

O pedido para *"Permitir informar o valor efetivamente utilizado do caixa"* expõe os seguintes gaps no modelo de BOOLEAN:
1. **Inflexibilidade do Booleano:** Se uma aposta custa R$ 100,00 e há apenas R$ 40,00 em caixa, hoje o sistema não permite usar os R$ 40 e interar com R$ 60 de "dinheiro novo" (ou é tudo pago pelo caixa, ou nada).
2. **Duplicidade:** Se o usuário pagar parte, não há onde armazenar esse valor parcial.
3. **Ausência de Trava Transacional:** Atualmente o banco não impede o "Saldo Negativo" do caixa (é apenas calculado).
4. **Falta de Edição Direta:** A função `handleEditBet` hoje não permite ajustar a flag de caixa de uma aposta já criada sem recriar os vínculos.

---

## 3. Plano de Implementação (Arquitetura)

Respeitando a diretriz *"Não crie uma segunda estrutura financeira paralela se já existir uma estrutura adequada"*, expandiremos as tabelas `bets` e `prizes` de forma retrocompatível.

### A. Ajuste de Banco (Migration SQL)
Criaremos um arquivo `08_financeiro_caixa_parcial.sql` contendo:
1. Adição das colunas:
   * `ALTER TABLE public.bets ADD COLUMN valor_utilizado_caixa NUMERIC(15,2) DEFAULT 0;`
   * `ALTER TABLE public.prizes ADD COLUMN valor_retido_caixa NUMERIC(15,2) DEFAULT 0;`
2. **Backfill Retrocompatível:** Todo registro existente com `manter_em_caixa = true` terá o valor total copiado para as novas colunas.
3. **Trigger de Validação Atômica:** Uma trigger de banco executada `BEFORE INSERT OR UPDATE` na tabela `bets` que:
   * Soma as entradas de caixa do respectivo bolão (ou usuário se for aposta individual).
   * Soma as saídas de caixa anteriores.
   * Valida se `Novo Saldo Disponível - NEW.valor_utilizado_caixa >= 0`. Caso seja negativo, a transação é revertida com erro (`RAISE EXCEPTION`), satisfazendo o bloqueio de segurança exigido ("nunca superior ao disponível").

### B. Relatórios e Bolão
No relatório (`bolao.service.js` e RPC), o campo "Arrecadado dos Participantes" passará a ser matematicamente deduzido:
* Total Investido = `bets.total_cost`
* Gasto do Caixa = `bets.valor_utilizado_caixa`
* Dinheiro Novo (Participantes) = `Total Investido - Gasto do Caixa`.

O relatório do bolão ficará:
* **Arrecadado Externo:** X
* **Reinvestido do Caixa:** Y
* **Total em Apostas:** X+Y

### C. Fluxos no Frontend (Interface e Fila)
1. **Ao Registrar Aposta Individual:** Substituir o Checkbox por um Toggle + Input monetário (R$). O Input fica validado pelo JS para não passar do custo da aposta nem do caixa exibido.
2. **Geração/Automação (Queue):** O robô de apostas enviará o novo parâmetro `valor_utilizado_caixa` direto na API, distribuindo o saldo disponível entre os jogos gerados se assim for comandado.
3. **Edição de Aposta:** O Modal de edição será atualizado para exibir um campo "Ajustar Caixa Utilizado", e as rotas serão alteradas para permitir essa edição sem perder a ligação do bolão.

### ⚠️ Próximo Passo
Caso você concorde com a evolução deste diagrama para a base de dados via script `08` e com as atualizações correspondentes no frontend, me informe para eu iniciar as alterações de código e de SQL.
