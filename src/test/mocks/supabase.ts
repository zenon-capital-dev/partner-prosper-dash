/**
 * Mock leve do cliente Supabase para testes de formulários e fluxos de vínculo.
 *
 * Suporta os métodos usados nos testes:
 *   supabase.from(table).select(cols).eq(col,val).or(...).order(...).maybeSingle()
 *   supabase.from(table).insert(payload).select(...).single()
 *   supabase.from(table).update(payload).eq(...).is(col, null)
 *   supabase.from(table).delete().eq(...)
 *   supabase.functions.invoke(name, opts)
 *
 * As tabelas vivem em memória; gatilhos do banco são reproduzidos manualmente
 * via callbacks `triggers` que reagem a INSERT/UPDATE.
 */

type Row = Record<string, any>;
type TriggerHook = (event: "insert" | "update", row: Row, oldRow: Row | null) => void | Row;

export type MockDB = Record<string, Row[]>;

export interface MockSupabaseOptions {
  tables?: MockDB;
  triggers?: Record<string, TriggerHook[]>;
  functionInvoke?: (name: string, opts: any) => Promise<{ data?: any; error?: any }>;
  authUserId?: string;
}

let _autoId = 0;
const uid = () => `mock-id-${++_autoId}`;

function matchFilters(row: Row, filters: Array<(r: Row) => boolean>) {
  return filters.every((f) => f(row));
}

function applySelect(row: Row, _cols: string, db: MockDB): Row {
  // simplificação: retorna a linha inteira; relacionamentos não são resolvidos.
  return { ...row };
}

class Query implements PromiseLike<{ data: any; error: any }> {
  private filters: Array<(r: Row) => boolean> = [];
  private _orderKey?: string;
  private _orderAsc = true;
  private _single = false;
  private _maybeSingle = false;
  private _selectCols = "*";
  private _action: "select" | "insert" | "update" | "delete" = "select";
  private _payload: any = null;

  constructor(private table: string, private db: MockDB, private triggers: Record<string, TriggerHook[]>) {}

  select(cols = "*") { this._selectCols = cols; if (this._action === "select") { /* keep */ } return this; }
  insert(payload: any) { this._action = "insert"; this._payload = payload; return this; }
  update(payload: any) { this._action = "update"; this._payload = payload; return this; }
  delete() { this._action = "delete"; return this; }
  eq(col: string, val: any) { this.filters.push((r) => r[col] === val); return this; }
  neq(col: string, val: any) { this.filters.push((r) => r[col] !== val); return this; }
  is(col: string, val: any) { this.filters.push((r) => r[col] === val); return this; }
  in(col: string, vals: any[]) { this.filters.push((r) => vals.includes(r[col])); return this; }
  ilike(col: string, val: string) {
    const needle = val.toLowerCase().replace(/%/g, "");
    this.filters.push((r) => String(r[col] ?? "").toLowerCase().includes(needle));
    return this;
  }
  or(expr: string) {
    // Suporta apenas "col.eq.val,col.eq.val"
    const parts = expr.split(",").map((p) => p.trim());
    const checks = parts.map((p) => {
      const [col, op, val] = p.split(".");
      return (r: Row) => (op === "eq" ? r[col] === val : true);
    });
    this.filters.push((r) => checks.some((c) => c(r)));
    return this;
  }
  order(key: string, opts?: { ascending?: boolean }) { this._orderKey = key; this._orderAsc = opts?.ascending !== false; return this; }
  single() { this._single = true; return this.run(); }
  maybeSingle() { this._maybeSingle = true; return this.run(); }
  then<T1 = { data: any; error: any }, T2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: any) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> { return this.run().then(onfulfilled!, onrejected!); }

  private fireTriggers(event: "insert" | "update", row: Row, oldRow: Row | null) {
    const hooks = this.triggers[this.table] ?? [];
    hooks.forEach((h) => { try { h(event, row, oldRow); } catch {} });
  }

  private async run(): Promise<{ data: any; error: any }> {
    if (!this.db[this.table]) this.db[this.table] = [];
    const rows = this.db[this.table];

    if (this._action === "insert") {
      const items = Array.isArray(this._payload) ? this._payload : [this._payload];
      const inserted: Row[] = items.map((p) => {
        const row = { id: p.id ?? uid(), created_at: new Date().toISOString(), ...p };
        rows.push(row);
        this.fireTriggers("insert", row, null);
        return row;
      });
      if (this._single) return { data: inserted[0], error: null };
      return { data: inserted, error: null };
    }

    if (this._action === "update") {
      const updated: Row[] = [];
      for (const row of rows) {
        if (matchFilters(row, this.filters)) {
          const old = { ...row };
          Object.assign(row, this._payload);
          this.fireTriggers("update", row, old);
          updated.push(row);
        }
      }
      if (this._single) return { data: updated[0] ?? null, error: null };
      return { data: updated, error: null };
    }

    if (this._action === "delete") {
      const keep: Row[] = [];
      const removed: Row[] = [];
      for (const r of rows) {
        if (matchFilters(r, this.filters)) removed.push(r); else keep.push(r);
      }
      this.db[this.table] = keep;
      return { data: removed, error: null };
    }

    // select
    let result = rows.filter((r) => matchFilters(r, this.filters)).map((r) => applySelect(r, this._selectCols, this.db));
    if (this._orderKey) {
      const k = this._orderKey;
      result.sort((a, b) => (a[k] > b[k] ? 1 : -1) * (this._orderAsc ? 1 : -1));
    }
    if (this._single) return { data: result[0] ?? null, error: result[0] ? null : { message: "not found" } };
    if (this._maybeSingle) return { data: result[0] ?? null, error: null };
    return { data: result, error: null };
  }
}

export function createMockSupabase(opts: MockSupabaseOptions = {}) {
  const db: MockDB = opts.tables ?? {};
  const triggers = opts.triggers ?? {};
  const authUserId = opts.authUserId ?? "mock-user";

  const supabase = {
    from(table: string) { return new Query(table, db, triggers); },
    functions: {
      invoke: opts.functionInvoke ?? (async () => ({ data: { ok: true }, error: null })),
    },
    auth: {
      getUser: async () => ({ data: { user: { id: authUserId } }, error: null }),
      getSession: async () => ({ data: { session: { user: { id: authUserId } } }, error: null }),
    },
  };

  return { supabase, db };
}

/* ---------------- gatilhos reproduzidos do banco ---------------- */
export function defaultTriggers(): Record<string, TriggerHook[]> {
  return {
    clients: [
      // propagate_client_provider
      (event, row, old) => {
        if (event === "update" && old && row.service_provider_id !== old.service_provider_id) {
          (globalThis as any).__mock_db?.client_products?.forEach((cp: Row) => {
            if (cp.client_id === row.id && (cp.service_provider_id == null || cp.service_provider_id === old.service_provider_id)) {
              cp.service_provider_id = row.service_provider_id;
            }
          });
        }
        // propagate_client_collaborator
        if (event === "update" && old && row.collaborator_id !== old.collaborator_id) {
          (globalThis as any).__mock_db?.client_products?.forEach((cp: Row) => {
            if (cp.client_id === row.id && (cp.responsible_employee_id == null || cp.responsible_employee_id === old.collaborator_id)) {
              cp.responsible_employee_id = row.collaborator_id;
            }
          });
        }
      },
    ],
    client_products: [
      // fill_client_product_provider + fill_client_product_responsible
      (event, row) => {
        if (event === "insert") {
          const db: MockDB = (globalThis as any).__mock_db;
          const client = db?.clients?.find((c) => c.id === row.client_id);
          if (client) {
            if (row.service_provider_id == null) row.service_provider_id = client.service_provider_id ?? null;
            if (row.responsible_employee_id == null) row.responsible_employee_id = client.collaborator_id ?? null;
          }
        }
      },
    ],
    tasks: [
      // fill_task_assigned_from_demand
      (event, row) => {
        if (event === "insert" && row.assigned_to == null) {
          const db: MockDB = (globalThis as any).__mock_db;
          if (row.client_product_id) {
            const cp = db?.client_products?.find((x) => x.id === row.client_product_id);
            if (cp) row.assigned_to = cp.responsible_employee_id ?? null;
          }
          if (row.assigned_to == null && row.client_id) {
            const c = db?.clients?.find((x) => x.id === row.client_id);
            if (c) row.assigned_to = c.collaborator_id ?? null;
          }
        }
      },
    ],
  };
}
