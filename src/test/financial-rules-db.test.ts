// @vitest-environment node
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

// PostgreSQL real (WASM), fixture mínima dos contratos tocados por estas migrations.
// Não substitui um reset completo do Supabase com todas as migrations históricas.
let db: PGlite;
const migration = (name: string) => readFileSync(`supabase/migrations/${name}`, "utf8");
const sid = '00000000-0000-0000-0000-000000000001';
const pid = '00000000-0000-0000-0000-000000000002';
const next = '00000000-0000-0000-0000-000000000003';
const beneficiary = '00000000-0000-0000-0000-000000000009';
async function row(sql: string) { return (await db.query<Record<string, any>>(sql)).rows[0]; }
async function reset() {
  await db.exec(`TRUNCATE sales, payments, commission_splits, commissions, sales_goals;
    INSERT INTO sales(id,amount,status,sale_date,closed_at) VALUES ('${sid}',2000,'concluida','2025-01-10','2025-02-10');
    INSERT INTO payments(id,sale_id,amount,amount_paid,status,due_date) VALUES
    ('${pid}','${sid}',1000,0,'pendente','2025-01-10'),('${next}','${sid}',1000,0,'pendente','2025-02-10');`);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE SCHEMA private; CREATE SCHEMA auth;
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
    CREATE FUNCTION private.is_admin(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE TYPE split_status AS ENUM ('pendente','pago','cancelado');
    CREATE TYPE payment_status AS ENUM ('pendente','em_aberto','parcial','parcialmente_pago','atrasado','vencido','pago','cancelado','reembolsado','estornado');
    CREATE TABLE sales(id uuid PRIMARY KEY, amount numeric, status text, sale_date date, closed_at timestamptz, revenue_type text, recurrence_months int, stage_id_at_sale uuid);
    CREATE TABLE payments(id uuid PRIMARY KEY, sale_id uuid, amount numeric, amount_paid numeric, status payment_status, paid_at timestamptz, due_date date, competence_month date);
    CREATE TABLE commission_splits(id uuid PRIMARY KEY, sale_id uuid, amount numeric, released_amount numeric DEFAULT 0, status split_status, paid_at timestamptz, updated_at timestamptz, beneficiary_type text, beneficiary_id uuid);
    CREATE TABLE commissions(id uuid PRIMARY KEY, sale_id uuid, payment_id uuid, amount numeric, released_amount numeric DEFAULT 0, status text, workflow_status text, paid_at timestamptz, payment_date date, updated_at timestamptz, partner_id uuid, referrer_id uuid, collaborator_id uuid, service_provider_id uuid);
    CREATE TABLE leads(created_at timestamptz, updated_at timestamptz, status text);
    CREATE TABLE proposals(created_at timestamptz);
    CREATE TABLE client_timeline(created_at timestamptz,event_type text);
    CREATE TABLE clients(id uuid, journey_stage_id uuid, stage_changed_at timestamptz);
    CREATE TABLE client_journey_stages(id uuid, is_terminal boolean, is_captation boolean);
    CREATE TABLE sales_goals(period_month date, goal_type text, actual_value numeric);
  `);
  const releaseOld = migration('20261103240000_base_liquida_liberacao_provisoes.sql');
  await db.exec(releaseOld.slice(releaseOld.indexOf('CREATE OR REPLACE FUNCTION private.sale_received'), releaseOld.indexOf('CREATE OR REPLACE FUNCTION private.recompute_sale_release')));
  const goalsOld = migration('20261103260000_numero_unico_parcelas_metas.sql');
  await db.exec(goalsOld.slice(goalsOld.indexOf('CREATE OR REPLACE FUNCTION public.recompute_sales_goals_for_month'),goalsOld.indexOf('-- Recalcula o mês antigo')));
  await db.exec(migration('20261103270000_release_status.sql'));
  await db.exec(migration('20261103280000_financial_rules.sql'));
  await db.exec(releaseOld.slice(releaseOld.indexOf('CREATE OR REPLACE FUNCTION public.maybe_release_commission'),releaseOld.indexOf('-- Comissões recalculadas')));
}, 30000);
afterAll(async () => { await db?.close(); });

describe('regras financeiras no PostgreSQL', () => {
  it('venda em janeiro, conclusão em fevereiro: conta em janeiro', async () => {
    await reset();
    expect((await row(`SELECT private.goal_actuals('2025-01-01')->>'sales_count' AS n`)).n).toBe('1');
    expect((await row(`SELECT private.goal_actuals('2025-02-01')->>'sales_count' AS n`)).n).toBe('0');
  });
  it('caixa ignora competência e vencimento, respeita Brasília e recalcula mês antigo', async () => {
    await reset();
    await db.exec(`INSERT INTO sales_goals VALUES ('2025-01-01','revenue',0),('2025-02-01','revenue',0);
      UPDATE payments SET amount_paid=500, status='parcialmente_pago', paid_at='2025-02-01T02:00:00Z', competence_month='2025-03-01' WHERE id='${pid}';`);
    expect((await row(`SELECT actual_value::float AS v FROM sales_goals WHERE period_month='2025-01-01'`)).v).toBe(500);
    await db.exec(`UPDATE payments SET paid_at='2025-02-02T12:00:00Z' WHERE id='${pid}'`);
    expect((await row(`SELECT actual_value::float AS v FROM sales_goals WHERE period_month='2025-01-01'`)).v).toBe(0);
    expect((await row(`SELECT actual_value::float AS v FROM sales_goals WHERE period_month='2025-02-01'`)).v).toBe(500);
  });
  it('100% recebido libera; só ação manual paga, estorno não apaga repasse real', async () => {
    await reset();
    await db.exec(`INSERT INTO commission_splits(id,sale_id,amount,status,beneficiary_type,beneficiary_id) VALUES ('${pid}','${sid}',200,'pendente','partner','${beneficiary}');
      INSERT INTO commissions(id,sale_id,amount,status,partner_id) VALUES ('${pid}','${sid}',200,'pendente','${beneficiary}');
      UPDATE payments SET amount_paid=1000,status='pago',paid_at='2025-02-10' WHERE sale_id='${sid}';`);
    expect(await row(`SELECT status,paid_at,released_amount::float AS released FROM commission_splits`)).toEqual({status:'liberada',paid_at:null,released:200});
    expect(await row(`SELECT status,workflow_status,paid_at FROM commissions`)).toEqual({status:'pendente',workflow_status:'liberada',paid_at:null});
    await db.exec(`UPDATE payments SET amount_paid=500,status='parcialmente_pago' WHERE id='${pid}'`);
    expect((await row(`SELECT status FROM commission_splits`)).status).toBe('pendente');
    await db.exec(`UPDATE commission_splits SET status='pago',paid_at='2025-02-11';
      UPDATE payments SET amount_paid=0,status='estornado' WHERE id='${pid}'`);
    expect((await row(`SELECT status,paid_at IS NOT NULL AS has_date FROM commission_splits`))).toEqual({status:'pago',has_date:true});
  });
  it('adiantamento abate próximos vencimentos, mantém contrato e caixa sem duplicidade', async () => {
    await reset();
    await db.exec(`UPDATE payments SET amount_paid=1500,status='pago',paid_at='2025-01-20' WHERE id='${pid}'`);
    expect((await row(`SELECT amount::float AS amount,amount_paid::float AS paid FROM payments WHERE id='${next}'`))).toEqual({amount:500,paid:0});
    expect((await row(`SELECT SUM(amount)::float AS scheduled,SUM(amount_paid)::float AS received FROM payments`))).toEqual({scheduled:2000,received:1500});
    // Salvar o mesmo valor não abate novamente.
    await db.exec(`UPDATE payments SET amount_paid=1500 WHERE id='${pid}'`);
    expect((await row(`SELECT amount::float AS amount FROM payments WHERE id='${next}'`)).amount).toBe(500);
    expect((await row(`SELECT private.goal_actuals('2025-01-01')->>'revenue' AS revenue`)).revenue).toBe('1500');
  });
  it('preserva recebimento anterior de parcela parcial e mantém crédito além do contrato', async () => {
    await reset();
    await db.exec(`UPDATE payments SET amount_paid=200,status='parcialmente_pago',paid_at='2025-02-03' WHERE id='${next}';
      UPDATE payments SET amount_paid=2500,status='pago',paid_at='2025-03-03' WHERE id='${pid}'`);
    expect(await row(`SELECT amount::float AS amount,amount_paid::float AS paid,paid_at::date::text AS day FROM payments WHERE id='${next}'`)).toEqual({amount:200,paid:200,day:'2025-02-03'});
    expect(await row(`SELECT SUM(amount)::float AS scheduled,SUM(amount_paid)::float AS received FROM payments`)).toEqual({scheduled:2000,received:2700});
  });
  it('bloqueia retorno com recebimento, inclusive passando por cancelada; sem caixa permite', async () => {
    await reset();
    await db.exec(`UPDATE payments SET amount_paid=1,paid_at='2025-01-11' WHERE id='${pid}'`);
    await expect(db.exec(`UPDATE sales SET status='pendente' WHERE id='${sid}'`)).rejects.toThrow(/valor pago/);
    await db.exec(`UPDATE sales SET status='cancelada' WHERE id='${sid}'`);
    await expect(db.exec(`UPDATE sales SET status='em_andamento' WHERE id='${sid}'`)).rejects.toThrow(/valor pago/);
    await reset();
    await db.exec(`UPDATE sales SET status='pendente' WHERE id='${sid}'`);
    await expect(db.exec(`UPDATE payments SET amount_paid=10,paid_at='2025-01-11' WHERE id='${pid}'`)).rejects.toThrow(/Conclua/);
  });
  it('não abate outra venda nem vencimento anterior e conserva centavos', async () => {
    await reset();
    await db.exec(`INSERT INTO payments(id,sale_id,amount,amount_paid,status,due_date) VALUES
      ('00000000-0000-0000-0000-000000000010',null,100,0,'pendente','2025-03-01'),
      ('00000000-0000-0000-0000-000000000011','${sid}',100,0,'pendente','2024-12-01');
      UPDATE payments SET amount_paid=1000.01,status='pago',paid_at='2025-01-20' WHERE id='${pid}'`);
    expect((await row(`SELECT amount::float AS v FROM payments WHERE id='${next}'`)).v).toBe(999.99);
    expect((await row(`SELECT SUM(amount)::float AS v FROM payments WHERE id IN ('00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000011')`)).v).toBe(200);
  });
  it('pagamento futuro não entra no caixa nem antecipa abatimento', async () => {
    await reset();
    await db.exec(`UPDATE payments SET amount_paid=1500,status='pago',paid_at='2999-01-20' WHERE id='${pid}'`);
    expect((await row(`SELECT amount::float AS v FROM payments WHERE id='${next}'`)).v).toBe(1000);
    expect((await row(`SELECT private.goal_actuals('2999-01-01')->>'revenue' AS v`)).v).toBe('0');
  });
  it('helpers privados não são executáveis pelos perfis externos', async () => {
    expect(await row(`SELECT has_function_privilege('authenticated','private.apply_payment_advance()','EXECUTE') AS allowed`)).toEqual({allowed:false});
  });
});
