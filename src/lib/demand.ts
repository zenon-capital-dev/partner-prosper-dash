import { supabase } from "@/integrations/supabase/client";

/**
 * Demanda = client_products. Esta é a entidade central operacional do sistema.
 * Tudo (documentos, checklist, prestador, status, reportes, tarefas, comentários,
 * pagamentos, comissão, contratos, histórico) deve referenciar uma demanda específica.
 *
 * Use estes helpers em vez de consultas soltas por client_id.
 */

export type DemandId = string;

export const demand = {
  /** Busca a demanda + cliente + produto + prestador. */
  async get(demandId: DemandId) {
    const { data, error } = await supabase
      .from("client_products")
      .select(
        `*,
         client:clients(id, full_name, company, email, phone),
         product:products(id, name, category),
         provider:service_providers(id, full_name, specialty)`
      )
      .eq("id", demandId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  /** Documentos da demanda. */
  async documents(demandId: DemandId) {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("client_product_id", demandId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /** Checklist (steps) da demanda. */
  async steps(demandId: DemandId) {
    const { data, error } = await supabase
      .from("client_product_steps")
      .select("*")
      .eq("client_product_id", demandId)
      .order("position", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  /** Reportes do prestador para a demanda. */
  async reports(demandId: DemandId) {
    const { data, error } = await supabase
      .from("client_product_status_reports")
      .select("*")
      .eq("client_product_id", demandId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /** Tarefas da demanda. */
  async tasks(demandId: DemandId) {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("client_product_id", demandId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /** Comentários da demanda. */
  async comments(demandId: DemandId) {
    const { data, error } = await supabase
      .from("demand_comments")
      .select("*")
      .eq("client_product_id", demandId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  /** Pagamentos vinculados à demanda. */
  async payments(demandId: DemandId) {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("client_product_id", demandId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /** Comissões da demanda. */
  async commissions(demandId: DemandId) {
    const { data, error } = await supabase
      .from("commissions")
      .select("*")
      .eq("client_product_id", demandId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /** Contratos da demanda. */
  async contracts(demandId: DemandId) {
    const { data, error } = await supabase
      .from("contracts")
      .select("*")
      .eq("client_product_id", demandId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /** Histórico/atividades da demanda. */
  async history(demandId: DemandId) {
    const { data, error } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("entity_type", "client_product")
      .eq("entity_id", demandId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  },

  /** Registra evento na timeline da demanda. */
  async log(demandId: DemandId, action: string, description?: string, metadata?: Record<string, unknown>) {
    const { error } = await supabase.rpc("log_demand_activity", {
      _client_product_id: demandId,
      _action: action,
      _description: description ?? null,
      _metadata: (metadata ?? {}) as never,
    });
    if (error) throw error;
  },

  /** Carrega tudo da demanda em paralelo (para a página da demanda). */
  async loadAll(demandId: DemandId) {
    const [info, documents, steps, reports, tasks, comments, payments, commissions, contracts, history] =
      await Promise.all([
        this.get(demandId),
        this.documents(demandId),
        this.steps(demandId),
        this.reports(demandId),
        this.tasks(demandId),
        this.comments(demandId),
        this.payments(demandId),
        this.commissions(demandId),
        this.contracts(demandId),
        this.history(demandId),
      ]);
    return { info, documents, steps, reports, tasks, comments, payments, commissions, contracts, history };
  },
};
