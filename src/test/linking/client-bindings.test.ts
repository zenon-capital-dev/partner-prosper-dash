import { describe, it, expect, beforeEach } from "vitest";
import { createMockSupabase, defaultTriggers } from "../mocks/supabase";

/**
 * Reproduz, em memória, o fluxo:
 *   1. Admin cria parceiro, indicador (referrer), colaborador (profile) e prestador.
 *   2. Admin cria um cliente vinculado aos 4.
 *   3. Cria uma demanda (client_product) sem informar responsável nem prestador.
 *   4. Verifica que os triggers do banco preenchem corretamente.
 *   5. Verifica que cada painel (admin, colaborador, prestador, indicador) "vê" o cliente.
 */
describe("Vinculação cliente → parceiro / indicador / colaborador / prestador", () => {
  let supabase: ReturnType<typeof createMockSupabase>["supabase"];
  let db: ReturnType<typeof createMockSupabase>["db"];

  beforeEach(() => {
    const created = createMockSupabase({ triggers: defaultTriggers() });
    supabase = created.supabase;
    db = created.db;
    // Disponibiliza o db para os triggers reproduzirem propagações cross-table.
    (globalThis as any).__mock_db = db;
  });

  it("propaga prestador e colaborador para demandas criadas depois", async () => {
    // Cadastros auxiliares
    const { data: partner } = await supabase.from("partners").insert({ full_name: "Parceiro X" }).select().single();
    const { data: referrer } = await supabase.from("referrers").insert({ full_name: "Indicador Y", user_id: "user-ref" }).select().single();
    const { data: collabProfile } = await supabase.from("profiles").insert({ id: "user-collab", full_name: "Colaborador K" }).select().single();
    const { data: provider } = await supabase.from("service_providers").insert({ name: "Prestador Z", user_id: "user-prov" }).select().single();

    // Cria cliente vinculado aos 4
    const { data: client } = await supabase.from("clients").insert({
      full_name: "Cliente Teste",
      email: "cliente@x.com",
      partner_id: partner.id,
      referrer_id: referrer.id,
      collaborator_id: collabProfile.id,
      service_provider_id: provider.id,
    }).select().single();

    expect(client.partner_id).toBe(partner.id);
    expect(client.referrer_id).toBe(referrer.id);
    expect(client.collaborator_id).toBe(collabProfile.id);
    expect(client.service_provider_id).toBe(provider.id);

    // Cria demanda sem responsável nem prestador → gatilho preenche
    const { data: cp } = await supabase.from("client_products").insert({
      client_id: client.id,
      product_id: "prod-1",
      status: "em_execucao",
    }).select().single();

    expect(cp.responsible_employee_id).toBe(collabProfile.id);
    expect(cp.service_provider_id).toBe(provider.id);

    // Cria tarefa sem assigned_to → gatilho preenche a partir da demanda
    const { data: task } = await supabase.from("tasks").insert({
      client_product_id: cp.id,
      client_id: client.id,
      title: "T1",
    }).select().single();

    expect(task.assigned_to).toBe(collabProfile.id);
  });

  it("aparece nos painéis do colaborador, prestador e indicador", async () => {
    // Setup
    await supabase.from("profiles").insert({ id: "user-collab", full_name: "Colab" });
    await supabase.from("referrers").insert({ id: "ref-1", full_name: "Ind", user_id: "user-ref" });
    await supabase.from("service_providers").insert({ id: "prov-1", name: "Prest", user_id: "user-prov" });

    const { data: client } = await supabase.from("clients").insert({
      full_name: "Cliente Vinculado",
      collaborator_id: "user-collab",
      service_provider_id: "prov-1",
      referrer_id: "ref-1",
    }).select().single();

    await supabase.from("client_products").insert({
      client_id: client.id,
      product_id: "prod-1",
      status: "em_execucao",
    });

    // Query do CollaboratorPanel: assignedClients
    const { data: collabClients } = await supabase.from("clients")
      .select("id, full_name")
      .or(`collaborator_id.eq.user-collab,responsible_id.eq.user-collab`);
    expect(collabClients.map((c: any) => c.id)).toContain(client.id);

    // Query do ProviderPanel: clientProducts via service_provider_id
    const { data: providerCPs } = await supabase.from("client_products").select("*").eq("service_provider_id", "prov-1");
    expect(providerCPs.length).toBe(1);
    expect(providerCPs[0].client_id).toBe(client.id);

    // Query do ReferrerPanel: clientes por referrer_id
    const { data: refClients } = await supabase.from("clients").select("id").eq("referrer_id", "ref-1");
    expect(refClients.map((c: any) => c.id)).toContain(client.id);
  });

  it("trocar o prestador padrão do cliente atualiza demandas existentes", async () => {
    await supabase.from("service_providers").insert({ id: "prov-A", name: "A" });
    await supabase.from("service_providers").insert({ id: "prov-B", name: "B" });
    const { data: client } = await supabase.from("clients").insert({
      full_name: "Cliente Troca",
      service_provider_id: "prov-A",
    }).select().single();
    await supabase.from("client_products").insert({ client_id: client.id, product_id: "p1" });

    // Troca o prestador
    await supabase.from("clients").update({ service_provider_id: "prov-B" }).eq("id", client.id);

    const { data: cps } = await supabase.from("client_products").select("*").eq("client_id", client.id);
    expect(cps[0].service_provider_id).toBe("prov-B");
  });

  it("trocar o colaborador padrão do cliente atualiza demandas existentes", async () => {
    await supabase.from("profiles").insert({ id: "user-old", full_name: "Old" });
    await supabase.from("profiles").insert({ id: "user-new", full_name: "New" });
    const { data: client } = await supabase.from("clients").insert({
      full_name: "Cliente Troca",
      collaborator_id: "user-old",
    }).select().single();
    await supabase.from("client_products").insert({ client_id: client.id, product_id: "p1" });

    await supabase.from("clients").update({ collaborator_id: "user-new" }).eq("id", client.id);

    const { data: cps } = await supabase.from("client_products").select("*").eq("client_id", client.id);
    expect(cps[0].responsible_employee_id).toBe("user-new");
  });
});
