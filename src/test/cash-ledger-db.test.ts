// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

/**
 * Roda TODAS as migrations do repositório em um PostgreSQL real (PGlite) e testa o
 * livro de caixa com os gatilhos de verdade. Só `auth`, `storage` e `pgcrypto` são simulados.
 * A concorrência entre sessões não é coberta: o PGlite tem uma conexão só.
 *
 * Para rodar: npm i --no-save --legacy-peer-deps @electric-sql/pglite@0.2.17
 */
const NEW_MIGRATION = "20261104120000_fluxo_de_caixa.sql";
const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const SECONDARY = "aaaaaaaa-0000-4000-8000-000000000002";
const OUTSIDER = "aaaaaaaa-0000-4000-8000-000000000003";
const CLIENT = "cccccccc-0000-4000-8000-000000000001";
const PRODUCT = "dddddddd-0000-4000-8000-000000000001";
const PARTNER = "eeeeeeee-0000-4000-8000-000000000001";

const pgliteName = "@electric-sql/pglite";
const trgmName = "@electric-sql/pglite/contrib/pg_trgm";
const PGlite = await import(/* @vite-ignore */ pgliteName).then((m) => m.PGlite).catch(() => null);

let db: any;
let seq = 0;
const key = () => `teste-${++seq}`;

async function q(sql: string, params: unknown[] = []) {
  return (await db.query(sql, params)).rows as any[];
}
async function one(sql: string, params: unknown[] = []) {
  return (await q(sql, params))[0];
}
const today = (d: string) => db.exec(`SELECT set_config('test.today', '${d}', false);`);
const asUser = (id: string) => db.exec(`SELECT set_config('test.uid', '${id}', false);`);
const num = (v: unknown) => Number(v);

async function month(m: string, overdue = false) {
  return (await one(`SELECT public.cash_month($1::date, $2) AS r`, [`${m}-01`, overdue])).r;
}
async function resetData() {
  await db.exec(`
    SET session_replication_role = replica;
    TRUNCATE public.cash_sale_adjustments, public.cash_settlements, public.cash_opening_balances, public.cash_other_income,
             public.commission_splits, public.commissions, public.expenses, public.payments,
             public.client_products, public.sales CASCADE;
    SET session_replication_role = DEFAULT;
  `);
}
async function newSale(opts: { amount: number; n?: number; first?: string; date?: string; pct?: number; status?: string; recurring?: number }) {
  const row = await one(
    `INSERT INTO public.sales (client_id, product_id, partner_id, amount, commission_percent, status, sale_date, closed_at,
                               installments_count, first_due_date, revenue_type, recurrence_months)
     VALUES ($1,$2,$3,$4,$5,$6::sale_status,$7::date,$7::timestamptz,$8,$9::date,$10,$11) RETURNING id`,
    [CLIENT, PRODUCT, opts.pct ? PARTNER : null, opts.amount, opts.pct ?? 0, opts.status ?? "concluida",
     opts.date ?? "2025-11-10", opts.recurring ? null : opts.n ?? 1, opts.first ?? "2025-12-10",
     opts.recurring ? "recorrente" : "avulso", opts.recurring ?? null],
  );
  return row.id as string;
}
const parcels = (saleId: string) =>
  q(`SELECT id, amount, amount_paid, status::text AS status, due_date::text AS due_date FROM public.payments WHERE sale_id = $1 ORDER BY due_date`, [saleId]);
const settle = (type: string, id: string, amount: number, date: string, k = key()) =>
  one(`SELECT public.cash_settle($1,$2,$3,$4::date,NULL,NULL,$5) AS id`, [type, id, amount, date, k]);
const reverse = (id: string, amount: number, date: string, kind = "estorno") =>
  one(`SELECT public.cash_reverse($1,$2,'Motivo do teste',$3::date,$4,$5) AS id`, [id, amount, date, kind, key()]);
const expense = async (amount: number, due: string) =>
  (await one(`SELECT public.cash_create_entry('saida','Despesa teste',$1,$2::date,false) AS id`, [amount, due])).id as string;
// Reconciliação independente: soma direto do livro, sem passar pelas funções do caixa.
const ledgerNet = async (direction: string, from: string, to: string) =>
  num((await one(
    `SELECT COALESCE(SUM(CASE WHEN kind='liquidacao' THEN amount ELSE -amount END),0) AS v FROM public.cash_settlements
      WHERE direction=$1 AND effective_date BETWEEN $2::date AND $3::date`, [direction, from, to])).v);

describe.skipIf(!PGlite)("livro de caixa no PostgreSQL com todas as migrations", () => {
  beforeAll(async () => {
    const { pg_trgm } = await import(/* @vite-ignore */ trgmName);
    db = new PGlite({ extensions: { pg_trgm } });
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE supabase_auth_admin; CREATE ROLE authenticator;
      CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions;
      CREATE TABLE auth.users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, raw_user_meta_data jsonb DEFAULT '{}', raw_app_meta_data jsonb DEFAULT '{}', created_at timestamptz DEFAULT now(), last_sign_in_at timestamptz, encrypted_password text, email_confirmed_at timestamptz, updated_at timestamptz, aud text, role text, instance_id uuid, confirmation_token text, recovery_token text, email_change_token_new text, email_change text, phone text, banned_until timestamptz, deleted_at timestamptz);
      CREATE TABLE auth.identities(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, provider text, provider_id text, identity_data jsonb, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('test.uid', true), '')::uuid $$;
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'authenticated'::text $$;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
      CREATE TABLE storage.buckets(id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), owner uuid);
      CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
      CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1,'/') $$;
      CREATE PUBLICATION supabase_realtime;
      CREATE FUNCTION public.gen_salt(text) RETURNS text LANGUAGE sql AS $$ SELECT 'salt'::text $$;
      CREATE FUNCTION public.crypt(text,text) RETURNS text LANGUAGE sql AS $$ SELECT md5($1)::text $$;
      INSERT INTO auth.users(id,email) VALUES ('dbebc38a-8691-4dc4-a644-869cac299c46','seed@test.local');
    `);
    const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
    for (const f of files) {
      if (f === NEW_MIGRATION) continue;
      // Esta migration antiga recria uma política que outra já criou; no banco real o histórico foi outro.
      if (f.startsWith("20260703220844")) await db.exec(`DROP POLICY IF EXISTS "Partners update related documents" ON public.documents;`);
      // document_shares existe no banco real, mas nenhuma migration do repositório cria essa tabela.
      if (f.startsWith("20261024160000")) await db.exec(`CREATE TABLE IF NOT EXISTS public.document_shares(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid, provider_id uuid, shared_by uuid, message text, can_download boolean DEFAULT true, expires_at timestamptz, viewed_at timestamptz, created_at timestamptz DEFAULT now());`);
      await db.exec(readFileSync(`supabase/migrations/${f}`, "utf8"));
    }

    // Cliente e histórico gravados ANTES do livro existir
    await db.exec(`
      INSERT INTO auth.users(id,email) VALUES ('${ADMIN}','a@t.local'),('${SECONDARY}','b@t.local'),('${OUTSIDER}','c@t.local') ON CONFLICT DO NOTHING;
      INSERT INTO public.user_roles(user_id,role) VALUES ('${ADMIN}','admin'),('${SECONDARY}','admin_secondary'),('${OUTSIDER}','parceiro') ON CONFLICT DO NOTHING;
      INSERT INTO public.clients(id, full_name) VALUES ('${CLIENT}','Cliente Teste');
      INSERT INTO public.products(id, name) VALUES ('${PRODUCT}','Produto Teste');
      INSERT INTO public.partners(id, full_name, email) VALUES ('${PARTNER}','Parceiro Teste','p@t.local');
    `);
    await asUser(ADMIN);
    const sid = await newSale({ amount: 900, n: 3, first: "2025-01-10", date: "2025-01-05", pct: 10 });
    const ps = await parcels(sid);
    await db.exec(`
      UPDATE public.payments SET status='pago', amount_paid=300, paid_at='2025-01-10T12:00:00-03' WHERE id='${ps[0].id}';
      UPDATE public.payments SET status='pendente', amount_paid=50, paid_at='2025-02-10T12:00:00-03' WHERE id='${ps[1].id}';
      UPDATE public.commission_splits SET status='pago', paid_at='2025-01-11T12:00:00-03' WHERE sale_id='${sid}';
      INSERT INTO public.expenses(id, description, category, amount, expense_date, paid, paid_at)
      VALUES ('bbbbbbbb-0000-4000-8000-000000000001','Despesa antiga','Outros',70,'2025-01-15',true,'2025-01-15T12:00:00-03');
    `);
    (globalThis as any).__historicSale = sid;
    (globalThis as any).__historicPs = ps;

    await db.exec(readFileSync(`supabase/migrations/${NEW_MIGRATION}`, "utf8"));
    await db.exec(`
      CREATE OR REPLACE FUNCTION private.cash_today() RETURNS date LANGUAGE sql STABLE AS
      $$ SELECT COALESCE(NULLIF(current_setting('test.today', true), '')::date, (now() AT TIME ZONE 'America/Sao_Paulo')::date) $$;
    `);
  }, 240_000);
  afterAll(async () => { await db?.close(); });

  it("histórico: entra no livro sem mudar valores e sinaliza o que é duvidoso", async () => {
    const ps = (globalThis as any).__historicPs;
    const rows = await q(`SELECT source_type, source_id, amount, effective_date::text AS d, verified, origin FROM public.cash_settlements WHERE origin='historico'`);
    const paid = rows.find((r) => r.source_id === ps[0].id);
    expect([num(paid.amount), paid.d, paid.verified]).toEqual([300, "2025-01-10", true]);
    const contradictory = rows.find((r) => r.source_id === ps[1].id);
    expect([num(contradictory.amount), contradictory.verified]).toEqual([50, false]);
    const split = rows.find((r) => r.source_type === "commission_split");
    expect(split.verified).toBe(false);
    expect(rows.find((r) => r.source_type === "expense").d).toBe("2025-01-15");
    const p = await one(`SELECT amount_paid, status::text AS status FROM public.payments WHERE id=$1`, [ps[1].id]);
    expect([num(p.amount_paid), p.status]).toEqual([50, "pendente"]);
    // Repasse histórico não confirmado fica fora do saldo
    const jan = await month("2025-01");
    expect(num(jan.saidas_realizadas)).toBe(70);
    expect(num(jan.nao_confirmado)).toBeGreaterThan(0);
    // Reexecutar o histórico não duplica
    const before = (await q(`SELECT id FROM public.cash_settlements`)).length;
    const mig = readFileSync(`supabase/migrations/${NEW_MIGRATION}`, "utf8");
    const part = mig.slice(mig.indexOf("-- 5) Histórico"), mig.indexOf("CREATE TRIGGER trg_cash_settlements_append_only"));
    await db.exec(part);
    expect((await q(`SELECT id FROM public.cash_settlements`)).length).toBe(before);
  });

  describe("cenário numérico obrigatório", () => {
    let sale: string;
    let first: string;
    let received: string;
    beforeAll(async () => {
      await resetData();
      await asUser(ADMIN);
      await today("2025-11-30");
      await one(`SELECT public.cash_set_opening_balance('2025-10-31', 10000, 'Saldo real do banco')`);
      sale = await newSale({ amount: 12000, n: 3, first: "2025-12-10", date: "2025-11-10" });
      first = (await parcels(sale))[0].id;
      const old = await newSale({ amount: 3000, n: 1, first: "2025-11-15", date: "2025-09-10" });
      await settle("payment", (await parcels(old))[0].id, 3000, "2025-11-15");
      await settle("expense", await expense(2000, "2025-11-05"), 2000, "2025-11-05");
      await expense(1000, "2025-11-20");
    });

    it("novembro fecha com os valores esperados", async () => {
      const m = await month("2025-11");
      expect(num(m.vendido_mes)).toBe(12000);
      expect(num(m.opening)).toBe(10000);
      expect(num(m.entradas_realizadas)).toBe(3000);
      expect(num(m.saidas_realizadas)).toBe(2000);
      expect(num(m.saldo_realizado)).toBe(11000);
      expect(num(m.saidas_pendentes)).toBe(1000);
      expect(num(m.saldo_projetado)).toBe(10000);
    });
    it("dezembro prevê R$ 4.000, sem contar de novo o que já entrou", async () => {
      const d = await month("2025-12");
      expect(num(d.entradas_pendentes)).toBe(4000);
      expect(d.opening_projected).toBe(true);
      expect(num(d.opening)).toBe(10000);
      expect(num(d.saldo_projetado)).toBe(14000);
    });
    it("recebimento parcial de R$ 1.500 não cria parcela e mantém a venda concluída", async () => {
      await today("2025-12-10");
      const before = (await parcels(sale)).length;
      received = (await settle("payment", first, 1500, "2025-12-10")).id;
      const ps = await parcels(sale);
      expect(ps.length).toBe(before);
      const p = ps.find((x) => x.id === first);
      expect([num(p.amount), num(p.amount_paid), p.status]).toEqual([4000, 1500, "parcialmente_pago"]);
      const line = (await month("2025-12")).lines.find((l: any) => l.source_id === first);
      expect([num(line.balance), line.situation]).toEqual([2500, "parcial"]);
      expect(num((await month("2025-12")).entradas_realizadas)).toBe(1500);
      expect((await one(`SELECT status::text AS s FROM public.sales WHERE id=$1`, [sale])).s).toBe("concluida");
    });
    it("estorno devolve o saldo, zera o efeito e preserva o histórico", async () => {
      await today("2025-12-11");
      await reverse(received, 1500, "2025-12-11");
      const p = (await parcels(sale)).find((x) => x.id === first);
      expect([num(p.amount_paid), p.status]).toEqual([0, "pendente"]);
      const d = await month("2025-12");
      expect(num(d.entradas_realizadas)).toBe(0);
      expect(d.lines.find((l: any) => l.source_id === first).balance).toBe(4000);
      const hist = await q(`SELECT kind FROM public.cash_settlements WHERE source_id=$1 ORDER BY created_at`, [first]);
      expect(hist.map((h) => h.kind)).toEqual(["liquidacao", "estorno"]);
    });
    it("reconciliação independente: o resumo bate com a soma direta do livro", async () => {
      const m = await month("2025-11");
      expect(num(m.entradas_realizadas)).toBe(await ledgerNet("entrada", "2025-11-01", "2025-11-30"));
      expect(num(m.saidas_realizadas)).toBe(await ledgerNet("saida", "2025-11-01", "2025-11-30"));
    });
  });

  describe("comissão", () => {
    let sale: string;
    let ps: any[];
    const split = () => one(`SELECT id, amount, released_amount, status::text AS status, paid_at FROM public.commission_splits WHERE sale_id=$1`, [sale]);
    const commission = () => one(`SELECT status::text AS status, released_amount FROM public.commissions WHERE sale_id=$1 AND payment_id IS NULL AND status::text NOT IN ('cancelado','cancelada')`, [sale]);
    beforeAll(async () => {
      await resetData();
      await today("2025-12-31");
      sale = await newSale({ amount: 1000, n: 2, first: "2025-11-10", date: "2025-11-01", pct: 10 });
      ps = await parcels(sale);
    });
    it("receber do cliente libera, mas não marca como paga", async () => {
      await settle("payment", ps[0].id, 500, "2025-11-10");
      const s = await split();
      expect([num(s.released_amount), s.status, s.paid_at]).toEqual([50, "pendente", null]);
      expect((await commission()).status).not.toBe("pago");
    });
    it("nem 100% recebido marca como paga", async () => {
      await settle("payment", ps[1].id, 500, "2025-12-10");
      const s = await split();
      expect([num(s.released_amount), s.status]).toEqual([100, "pendente"]);
      expect((await commission()).status).not.toBe("pago");
    });
    it("o repasse devido aparece como saída pendente", async () => {
      const d = await month("2025-12");
      const l = d.lines.find((x: any) => x.source_type === "commission_split");
      expect([num(l.balance), l.direction]).toEqual([100, "saida"]);
    });
    it("pagar o parceiro em outra data vira saída real e reflete nas duas tabelas", async () => {
      const s = await split();
      const pay = await settle("commission_split", s.id, 100, "2025-12-20");
      expect((await split()).status).toBe("pago");
      expect((await commission()).status).toBe("pago");
      expect(num((await month("2025-12")).saidas_realizadas)).toBe(100);
      (globalThis as any).__pay = pay.id;
    });
    it("estorno do cliente depois da comissão paga não desfaz o pagamento ao parceiro", async () => {
      const r = await one(`SELECT id FROM public.cash_settlements WHERE source_id=$1 AND kind='liquidacao'`, [ps[1].id]);
      await reverse(r.id, 500, "2025-12-21");
      const s = await split();
      expect([num(s.released_amount), s.status]).toEqual([50, "pago"]);
    });
    it("estornar o pagamento ao parceiro reabre o repasse", async () => {
      await reverse((globalThis as any).__pay, 100, "2025-12-22");
      expect((await split()).status).toBe("pendente");
      expect((await commission()).status).toBe("pendente");
      expect(num((await month("2025-12")).saidas_realizadas)).toBe(0);
    });
  });

  describe("outras telas gravando direto", () => {
    let sale: string;
    let ps: any[];
    beforeAll(async () => {
      await resetData();
      await today("2025-12-31");
      sale = await newSale({ amount: 300, n: 3, first: "2025-11-10", date: "2025-11-01" });
      ps = await parcels(sale);
    });
    it("baixa direta na parcela entra no livro uma vez", async () => {
      await db.exec(`UPDATE public.payments SET status='pago', amount_paid=100, paid_at='2025-11-10T12:00:00-03' WHERE id='${ps[0].id}'`);
      const rows = await q(`SELECT amount, origin, effective_date::text AS d FROM public.cash_settlements WHERE source_id=$1`, [ps[0].id]);
      expect(rows.length).toBe(1);
      expect([num(rows[0].amount), rows[0].origin, rows[0].d]).toEqual([100, "captura", "2025-11-10"]);
      await db.exec(`UPDATE public.payments SET status='pago', amount_paid=100 WHERE id='${ps[0].id}'`);
      expect((await q(`SELECT id FROM public.cash_settlements WHERE source_id=$1`, [ps[0].id])).length).toBe(1);
    });
    it("desfazer direto vira estorno, sem apagar", async () => {
      await db.exec(`UPDATE public.payments SET status='pendente', amount_paid=0, paid_at=NULL WHERE id='${ps[0].id}'`);
      const rows = await q(`SELECT kind FROM public.cash_settlements WHERE source_id=$1 ORDER BY created_at`, [ps[0].id]);
      expect(rows.map((r) => r.kind)).toEqual(["liquidacao", "estorno"]);
    });
    it("despesa marcada como paga em outra tela vira saída", async () => {
      const id = await expense(80, "2025-11-05");
      await db.exec(`UPDATE public.expenses SET paid=true, paid_at='2025-11-06T12:00:00-03' WHERE id='${id}'`);
      expect(num((await month("2025-11")).saidas_realizadas)).toBe(80);
      await db.exec(`UPDATE public.expenses SET paid=false, paid_at=NULL WHERE id='${id}'`);
      expect(num((await month("2025-11")).saidas_realizadas)).toBe(80);
      expect(num((await month("2025-12")).saidas_realizadas)).toBe(-80);
    });
    it("recebimento pela venda abate parcelas, sem criar linha", async () => {
      await one(`SELECT public.cash_receive_for_sale($1,150,'2025-12-01'::date,NULL,NULL,$2)`, [sale, key()]);
      const after = await parcels(sale);
      expect(after.length).toBe(3);
      expect(after.map((p) => num(p.amount_paid))).toEqual([100, 50, 0]);
    });
  });

  describe("recorrente antiga com valor mensal", () => {
    let sale: string;
    const split = () => one(`SELECT amount, released_amount, status::text AS status FROM public.commission_splits WHERE sale_id=$1 AND status::text <> 'cancelado'`, [sale]);
    beforeAll(async () => {
      await resetData();
      await asUser(ADMIN);
      await today("2025-12-31");
      sale = await newSale({ amount: 2500, date: "2025-06-01", first: "2025-06-10", pct: 10, status: "pendente", recurring: 12 });
      for (let i = 1; i <= 12; i++) {
        await q(`INSERT INTO public.payments (sale_id, client_id, product_id, amount, due_date, status, installment_number, installments_count)
                 VALUES ($1,$2,$3,2500,$4::date,'pendente',$5,12)`, [sale, CLIENT, PRODUCT, `${2025 + Math.floor((5 + i - 1) / 12)}-${String(((5 + i - 1) % 12) + 1).padStart(2, "0")}-10`, i]);
      }
      await db.exec(`UPDATE public.sales SET status='concluida' WHERE id='${sale}'`);
    });
    it("antes da conversão a comissão fica errada, sobre uma mensalidade", async () => {
      expect(num((await split()).amount)).toBe(250);
    });
    it("a conversão leva o valor e a comissão ao contrato inteiro, sem mexer nas parcelas", async () => {
      const r = await one(`SELECT public.cash_convert_monthly_sale($1,'Confirmado pelo usuário') AS v`, [sale]);
      expect(num(r.v)).toBe(30000);
      expect(num((await split()).amount)).toBe(3000);
      const ps = await parcels(sale);
      expect(ps.length).toBe(12);
      expect(ps.every((p) => num(p.amount) === 2500)).toBe(true);
    });
    it("cada mensalidade recebida libera a parte proporcional da comissão", async () => {
      await settle("payment", (await parcels(sale))[0].id, 2500, "2025-06-10");
      const s = await split();
      expect([num(s.released_amount), s.status]).toEqual([250, "pendente"]);
    });
    it("não converte duas vezes e registra o valor anterior", async () => {
      await expect(one(`SELECT public.cash_convert_monthly_sale($1,'De novo')`, [sale])).rejects.toThrow(/já foi convertida/);
      const a = await one(`SELECT old_amount, new_amount FROM public.cash_sale_adjustments WHERE sale_id=$1`, [sale]);
      expect([num(a.old_amount), num(a.new_amount)]).toEqual([2500, 30000]);
    });
  });

  describe("formatos de contrato", () => {
    beforeAll(async () => { await resetData(); await asUser(ADMIN); await today("2026-11-04"); });
    it("mensal com um recebimento: converte e gera os meses que faltam, até o total", async () => {
      const sale = await newSale({ amount: 1500, date: "2026-06-15", first: "2026-06-15", status: "pendente", recurring: 12, pct: 8 });
      await q(`INSERT INTO public.payments (sale_id, client_id, product_id, amount, amount_paid, paid_at, due_date, status, description)
               VALUES ($1,$2,$3,1500,1500,'2026-06-15T12:00:00-03','2026-06-15','pago','Recebimento parcial')`, [sale, CLIENT, PRODUCT]);
      await db.exec(`UPDATE public.sales SET status='concluida' WHERE id='${sale}'`);
      await one(`SELECT public.cash_convert_monthly_sale($1,'Confirmado: 12 x 1.500')`, [sale]);
      await one(`SELECT private.generate_sale_payments($1)`, [sale]);
      const ps = await parcels(sale);
      expect(ps.length).toBe(12);
      expect(ps.reduce((t, p) => t + num(p.amount), 0)).toBeCloseTo(18000, 2);
      expect(ps.every((p) => num(p.amount) === 1500)).toBe(true);
      const c = await one(`SELECT amount, released_amount FROM public.commission_splits WHERE sale_id=$1 AND status::text <> 'cancelado'`, [sale]);
      expect(num(c.amount)).toBeCloseTo(1440, 2);
      expect(num(c.released_amount)).toBeCloseTo(120, 2);
    });
    it("valor estimado com recebimentos variáveis: registra até o total, sem inventar datas", async () => {
      const sale = await newSale({ amount: 40000, date: "2026-06-01", first: "2026-06-10", status: "pendente", recurring: 12, pct: 10 });
      await db.exec(`DELETE FROM public.payments WHERE sale_id='${sale}'`);
      await db.exec(`SET session_replication_role = replica; UPDATE public.sales SET status='concluida' WHERE id='${sale}'; SET session_replication_role = DEFAULT;`);
      expect(num((await month("2026-11")).saldo_sem_cronograma)).toBeGreaterThanOrEqual(40000);
      await one(`SELECT public.cash_receive_for_sale($1,5000,'2026-07-10'::date,NULL,NULL,$2)`, [sale, key()]);
      await one(`SELECT public.cash_receive_for_sale($1,10000,'2026-08-10'::date,NULL,NULL,$2)`, [sale, key()]);
      const ps = await parcels(sale);
      expect(ps.map((p) => [num(p.amount), p.status, p.due_date])).toEqual([[5000, "pago", "2026-07-10"], [10000, "pago", "2026-08-10"]]);
      await expect(one(`SELECT public.cash_receive_for_sale($1,25001,'2026-09-10'::date,NULL,NULL,$2)`, [sale, key()])).rejects.toThrow(/saldo do contrato/);
      await one(`SELECT public.cash_receive_for_sale($1,25000,'2026-09-10'::date,NULL,NULL,$2)`, [sale, key()]);
      expect((await parcels(sale)).reduce((t, p) => t + num(p.amount_paid), 0)).toBe(40000);
    });
    it("comissão sobre o líquido de cada parcela: custo proporcional no que entra", async () => {
      await db.exec(`DELETE FROM public.commission_splits WHERE true`);
      const sale = await newSale({ amount: 12000, n: 3, first: "2026-01-10", date: "2026-01-01", pct: 10 });
      await db.exec(`UPDATE public.sales SET zenon_cost=3000 WHERE id='${sale}'`);
      const p = (await parcels(sale))[0];
      await settle("payment", p.id, 4000, "2026-01-10");
      const c = await one(`SELECT amount, released_amount FROM public.commission_splits WHERE sale_id=$1 AND status::text <> 'cancelado'`, [sale]);
      // Parcela 4.000 menos custo proporcional 1.000 = líquido 3.000; 10% = 300
      expect([num(c.amount), num(c.released_amount)]).toEqual([900, 300]);
    });
  });

  describe("estorno pela venda e devolução", () => {
    it("linha antiga de recebimento é cancelada ao estornar; parcela normal volta a aberta", async () => {
      await resetData();
      await asUser(ADMIN);
      await today("2025-12-31");
      const sale = await newSale({ amount: 300, n: 1, first: "2025-11-10", date: "2025-11-01" });
      const parcel = (await parcels(sale))[0];
      const old = await one(
        `INSERT INTO public.payments (sale_id, client_id, product_id, amount, amount_paid, paid_at, due_date, status, description)
         VALUES ($1,$2,$3,50,50,'2025-11-12T12:00:00-03','2025-11-12','pago','Recebimento parcial — Venda teste') RETURNING id`,
        [sale, CLIENT, PRODUCT]);
      await settle("payment", parcel.id, 100, "2025-11-15");
      await one(`SELECT public.cash_reverse_source('payment',$1,'Lançado errado')`, [old.id]);
      await one(`SELECT public.cash_reverse_source('payment',$1,'Lançado errado')`, [parcel.id]);
      const a = await one(`SELECT status::text AS s, amount_paid FROM public.payments WHERE id=$1`, [old.id]);
      const b = await one(`SELECT status::text AS s, amount_paid FROM public.payments WHERE id=$1`, [parcel.id]);
      expect([a.s, num(a.amount_paid)]).toEqual(["cancelado", 0]);
      expect([b.s, num(b.amount_paid)]).toEqual(["pendente", 0]);
    });
    it("devolução total encerra a parcela; a parcial mantém o saldo pago", async () => {
      await resetData();
      await today("2025-12-31");
      const sale = await newSale({ amount: 200, n: 2, first: "2025-11-10", date: "2025-11-01" });
      const ps = await parcels(sale);
      await settle("payment", ps[0].id, 100, "2025-11-10");
      await settle("payment", ps[1].id, 100, "2025-12-10");
      await one(`SELECT public.cash_refund_payment($1,100,'Cliente desistiu')`, [ps[0].id]);
      await one(`SELECT public.cash_refund_payment($1,30,'Abatimento')`, [ps[1].id]);
      const a = await one(`SELECT status::text AS s, refund_amount FROM public.payments WHERE id=$1`, [ps[0].id]);
      const b = await one(`SELECT status::text AS s, amount_paid FROM public.payments WHERE id=$1`, [ps[1].id]);
      expect([a.s, num(a.refund_amount)]).toEqual(["reembolsado", 100]);
      expect([b.s, num(b.amount_paid)]).toEqual(["parcialmente_pago", 70]);
      await expect(one(`SELECT public.cash_refund_payment($1,71,'Mais do que recebeu')`, [ps[1].id])).rejects.toThrow(/até R\$/);
    });
  });

  describe("proteções", () => {
    let ps: any[];
    let settlement: string;
    beforeAll(async () => {
      await resetData();
      await asUser(ADMIN);
      await today("2025-12-31");
      const sale = await newSale({ amount: 100, n: 1, first: "2025-11-10", date: "2025-11-01" });
      ps = await parcels(sale);
      settlement = (await settle("payment", ps[0].id, 40, "2025-11-10")).id;
    });
    it("repetir a mesma chave não paga duas vezes", async () => {
      const k = key();
      const a = await settle("payment", ps[0].id, 10, "2025-11-11", k);
      const b = await settle("payment", ps[0].id, 10, "2025-11-11", k);
      expect(a.id).toBe(b.id);
      expect(num((await parcels((await one(`SELECT sale_id FROM public.payments WHERE id=$1`, [ps[0].id])).sale_id))[0].amount_paid)).toBe(50);
    });
    it("recusa pagamento acima do saldo", async () => {
      await expect(settle("payment", ps[0].id, 51, "2025-11-12")).rejects.toThrow(/excede o saldo/);
    });
    it("recusa data futura e centavos inválidos", async () => {
      await expect(settle("payment", ps[0].id, 1, "2026-01-01")).rejects.toThrow(/futura/);
      await expect(settle("payment", ps[0].id, 1.005, "2025-11-12")).rejects.toThrow(/casas decimais/);
    });
    it("recusa reduzir o valor abaixo do liquidado, cancelar ou excluir com pagamento", async () => {
      await expect(db.exec(`UPDATE public.payments SET amount=10 WHERE id='${ps[0].id}'`)).rejects.toThrow(/abaixo/);
      await expect(db.exec(`UPDATE public.payments SET status='cancelado' WHERE id='${ps[0].id}'`)).rejects.toThrow(/Estorne/);
      await expect(db.exec(`DELETE FROM public.payments WHERE id='${ps[0].id}'`)).rejects.toThrow(/Estorne/);
    });
    it("o livro não aceita alteração nem exclusão", async () => {
      await expect(db.exec(`UPDATE public.cash_settlements SET amount=1 WHERE id='${settlement}'`)).rejects.toThrow(/não aceita/);
      await expect(db.exec(`DELETE FROM public.cash_settlements WHERE id='${settlement}'`)).rejects.toThrow(/não aceita/);
    });
    it("estorno exige motivo e não passa do valor", async () => {
      await expect(one(`SELECT public.cash_reverse($1,1,'   ',NULL,'estorno',NULL)`, [settlement])).rejects.toThrow(/motivo/);
      await expect(reverse(settlement, 41, "2025-12-01")).rejects.toThrow(/até R\$/);
    });
    it("permissão: só admin, ou admin secundário liberado", async () => {
      await asUser(SECONDARY);
      await expect(month("2025-11")).rejects.toThrow(/Sem permissão/);
      await asUser(OUTSIDER);
      await expect(settle("payment", ps[0].id, 1, "2025-11-12")).rejects.toThrow(/Sem permissão/);
      await asUser(SECONDARY);
      expect((await settle("payment", ps[0].id, 1, "2025-11-12")).id).toBeTruthy(); // operar a baixa continua permitido
            await db.exec(`INSERT INTO public.cash_permissions(user_id) VALUES ('${SECONDARY}')`);
      await asUser(SECONDARY);
      expect((await month("2025-11")).month).toBe("2025-11");
      await asUser(ADMIN);
    });
    it("acesso pela API: quem não tem permissão não lê o livro", async () => {
      await asUser(OUTSIDER);
      await db.exec(`SET ROLE authenticated`);
      expect((await q(`SELECT id FROM public.cash_settlements`)).length).toBe(0);
      await expect(db.exec(`INSERT INTO public.cash_settlements(direction,source_type,source_id,amount,effective_date,account_id)
        VALUES ('entrada','payment','${ps[0].id}',1,'2025-11-12',(SELECT '00000000-0000-0000-0000-000000000000'::uuid))`)).rejects.toThrow();
      await db.exec(`RESET ROLE`);
      await asUser(ADMIN);
    });
  });

  describe("datas e centavos", () => {
    beforeAll(async () => { await resetData(); await asUser(ADMIN); await today("2026-03-31"); });
    it("parcelamento atravessa o ano e preserva o total", async () => {
      const s = await newSale({ amount: 100, n: 3, first: "2025-12-31", date: "2025-12-01" });
      const ps = await parcels(s);
      expect(ps.reduce((t, p) => t + num(p.amount), 0)).toBeCloseTo(100, 2);
      expect(ps.map((p) => p.due_date)).toEqual(["2025-12-31", "2026-01-31", "2026-02-28"]);
    });
    it("pagamento às 23h em Brasília fica no mês certo", async () => {
      const s = await newSale({ amount: 10, n: 1, first: "2026-01-31", date: "2026-01-01" });
      const p = (await parcels(s))[0];
      await db.exec(`UPDATE public.payments SET status='pago', amount_paid=10, paid_at='2026-02-01T02:00:00Z' WHERE id='${p.id}'`);
      const r = await one(`SELECT effective_date::text AS d FROM public.cash_settlements WHERE source_id=$1`, [p.id]);
      expect(r.d).toBe("2026-01-31");
    });
    it("venda em negociação não entra na previsão", async () => {
      await newSale({ amount: 500, n: 1, first: "2026-04-10", date: "2026-03-01", status: "em_andamento" });
      expect(num((await month("2026-04")).entradas_pendentes)).toBe(0);
    });
    it("saldo não configurado não vira zero", async () => {
      const m = await month("2026-02");
      expect(m.opening_configured).toBe(false);
      expect(m.saldo_realizado).toBeNull();
      expect(m.saldo_projetado).toBeNull();
    });
    it("atrasados só entram na projeção quando pedido", async () => {
      await one(`SELECT public.cash_set_opening_balance('2026-01-01', 0, 'Teste')`);
      await today("2026-04-15");
      await expense(50, "2026-02-10");
      const a = await month("2026-04");
      const b = await month("2026-04", true);
      expect(num(a.atrasados_pagar)).toBeGreaterThanOrEqual(50);
      expect(num(b.saldo_projetado) - num(a.saldo_projetado)).toBe(num(a.atrasados_receber) - num(a.atrasados_pagar));
    });
    it("entrada avulsa realizada entra no caixa, sem gerar repasse", async () => {
      await today("2026-05-20");
      await one(`SELECT public.cash_create_entry('entrada','Aporte',1000,'2026-05-20'::date,true,'aporte')`);
      expect(num((await month("2026-05")).entradas_realizadas)).toBe(1000);
      expect((await q(`SELECT id FROM public.commission_splits WHERE amount=1000`)).length).toBe(0);
    });
  });
});
