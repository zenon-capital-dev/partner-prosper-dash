import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package, FileText, Download, CheckCircle2, Clock, AlertCircle,
  Calendar, Receipt, Inbox, ClipboardList, ArrowRight,
  FileSignature, ShieldCheck, ChevronLeft, Sparkles, MessageSquare,
  LayoutDashboard, Bell, Activity, ListChecks, Loader2,
} from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ClientDocumentsTab } from "@/components/client/ClientDocumentsTab";
import { ClientContractsTab } from "@/components/client/ClientContractsTab";
import { ClientProductSteps } from "@/components/clients/tabs/ClientProductSteps";
import { useSystemSettings, buildWhatsAppLink } from "@/hooks/useSystemSettings";

const CLIENT_PATH_TO_TAB: Record<string, string> = {
  produtos: "servicos", documentos: "checklist", financeiro: "financeiro",
  contratos: "contratos", biblioteca: "docs", descobrir: "descobrir",
};
const CLIENT_TAB_TO_PATH: Record<string, string> = {
  servicos: "produtos", checklist: "documentos", financeiro: "financeiro",
  contratos: "contratos", docs: "biblioteca", descobrir: "descobrir",
};

const DONE_STATUSES = new Set(["concluido", "concluida", "finalizado", "finalizada", "assinado", "pago", "aprovado"]);

const statusLabel = (status?: string | null) => (status || "Em definição")
  .replace(/_/g, " ")
  .replace(/\b\w/g, (m) => m.toUpperCase());

const isPendingDoc = (status?: string | null) => ["solicitado", "pendente", "reprovado", "pendente_correcao", "pending", "rejected"].includes(status || "");
const isOpenPayment = (status?: string | null) => !["pago", "paid", "cancelado", "cancelled"].includes(status || "");
const isContractPending = (status?: string | null) => ["enviado", "aguardando_assinatura", "pendente", "criado"].includes(status || "");

export default function ClientPanel() {
  const { user } = useAuth();
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const settings = useSystemSettings();
  const queryClient = useQueryClient();
  const wa = (msg?: string) => buildWhatsAppLink(settings.support_whatsapp, msg);
  const activeTab = tabParam && CLIENT_PATH_TO_TAB[tabParam] ? CLIENT_PATH_TO_TAB[tabParam] : "home";
  const setActiveTab = (v: string) => navigate(v === "home" ? "/portal-cliente" : `/portal-cliente/${CLIENT_TAB_TO_PATH[v] || v}`);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all");

  // Portal do cliente é sempre light mode — remove .dark do <html> enquanto montado
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    html.classList.remove("dark");
    return () => { if (wasDark) html.classList.add("dark"); };
  }, []);

  const downloadDoc = async (path?: string | null, name?: string) => {
    if (!path) return toast.error("Arquivo indisponível");
    if (path.startsWith("http")) return window.open(path, "_blank");
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
    if (error || !data) return toast.error("Não foi possível baixar");
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name || "documento";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["client-panel", user?.id],
    queryFn: async () => {
      const { data: client, error: clientErr } = await supabase
        .from("clients")
        .select(`
          id, full_name, email, phone, company, status, created_at, onboarding_status, onboarding_progress,
          companies(id, name, trade_name)
        `)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (clientErr) throw clientErr;
      if (!client) return null;

      const { data: productIdRows } = await supabase
        .from("client_products")
        .select("id")
        .eq("client_id", client.id);
      const productIds = (productIdRows ?? []).map((p: any) => p.id);

      const safe = async (builder: any): Promise<any[]> => {
        try { const r = await builder; return (r?.data ?? []) as any[]; }
        catch (e) { console.error("[ClientPanel] sub-query falhou:", e); return []; }
      };

      const [docs, catalog, requests, contracts, payments, granularProducts, reports, formalDeliveries] = await Promise.all([
        safe(supabase.from("documents").select("*, products(name)").eq("client_id", client.id).order("created_at", { ascending: false })),
        safe(supabase.from("products").select("id, name, description, base_price, recurring, product_categories(name, color)").eq("active", true)),
        safe(supabase.from("client_document_requests").select("id, client_id, client_product_id, title, description, status, due_date, file_url, reviewed_at, created_at, updated_at").eq("client_id", client.id).order("created_at", { ascending: false })),
        safe(supabase.from("contracts").select("id, name, status, amount, signed_at, sent_at, file_path, created_at, products(name)").eq("client_id", client.id).order("created_at", { ascending: false })),
        safe(supabase.from("payments").select("id, amount, due_date, status, paid_at, payment_method, installment_number, installments_count").eq("client_id", client.id).order("due_date", { ascending: false })),
        safe(supabase.from("client_products").select("id, client_id, product_id, custom_product_name, status, value, custom_value, discount, priority, sla_start_date, sla_due_date, sla_status, is_sla_frozen, deadline, start_date, end_date, current_step_id, current_steps, notes, adjustment_description, adjustment_due_date, delay_reason, created_at, updated_at, company_id, service_provider_id, responsible_provider_id, products(name, description), companies(id, name, trade_name)").eq("client_id", client.id).order("created_at", { ascending: false })),
        productIds.length > 0 ? safe(supabase.from("client_product_status_reports").select("*, service_providers(name)").in("client_product_id", productIds).order("created_at", { ascending: false })) : Promise.resolve([] as any[]),
        productIds.length > 0 ? safe(supabase.from("demand_deliveries").select("*, client_products(id, products(name))").in("client_product_id", productIds).order("created_at", { ascending: false })) : Promise.resolve([] as any[]),
      ]);

      return { client, docs, catalog, requests, contracts, payments, granularProducts, reports, formalDeliveries };
    },
    enabled: !!user,
    retry: 1,
  });

  if (isLoading) return <ClientPanelLoading />;

  if (error) {
    console.error("[ClientPanel] Render error:", error);
    return (
      <ClientPanelShell>
        <EmptyState
          icon={AlertCircle}
          title="Não foi possível carregar seu portal"
          description="Atualize a página. Se continuar acontecendo, nossa equipe consegue revisar seu acesso rapidamente."
          action={<Button onClick={() => { queryClient.invalidateQueries({ queryKey: ["client-panel"] }); }} className="h-11 rounded-xl bg-[#0f1b3d] hover:bg-[#1e3a5f] text-white font-semibold">Tentar novamente</Button>}
          tone="danger"
        />
      </ClientPanelShell>
    );
  }

  if (!data) return (
    <ClientPanelShell>
      <EmptyState
        icon={Inbox}
        title="Acesso ainda não vinculado"
        description="Seu login existe, mas ainda não encontramos um cadastro de cliente conectado a ele. Fale com a equipe para vincular o acesso."
        action={<Button onClick={() => window.open(wa("Olá, meu acesso ao portal do cliente ainda não está vinculado."), "_blank")} className="h-11 rounded-xl bg-[#0f1b3d] hover:bg-[#1e3a5f] text-white font-semibold"><MessageSquare className="size-4 mr-2" /> Falar com a equipe</Button>}
      />
    </ClientPanelShell>
  );

  const { client, docs: allDocs, catalog, requests, contracts, payments, granularProducts: allProducts, reports: allReports, formalDeliveries: allFormalDeliveries } = data;
  const allDocumentItems = [
    ...allDocs.map((d: any) => ({ ...d, source: "documents" })),
    ...requests.map((r: any) => ({
      ...r, source: "document_requests", name: r.title, file_path: r.file_url,
      due_date: r.due_date, uploaded_at: r.file_url ? r.updated_at : null, reviewed_at: r.reviewed_at, created_at: r.created_at,
    })),
  ];

  const companies = Array.isArray((client as any).companies) ? (client as any).companies : ((client as any).companies ? [(client as any).companies] : []);
  const hasMultipleCompanies = companies.length > 1;
  const granularProducts = selectedCompanyId === "all" ? allProducts : allProducts.filter((p: any) => p.company_id === selectedCompanyId);
  const filteredProductIds = new Set(granularProducts.map((p: any) => p.id));
  const docs = selectedCompanyId === "all" ? allDocumentItems : allDocumentItems.filter((d: any) => !d.client_product_id || filteredProductIds.has(d.client_product_id));
  const reports = selectedCompanyId === "all" ? allReports : allReports.filter((r: any) => filteredProductIds.has(r.client_product_id));
  const formalDeliveries = selectedCompanyId === "all" ? allFormalDeliveries : allFormalDeliveries.filter((d: any) => filteredProductIds.has(d.client_product_id));

  const activeProducts = granularProducts.filter((p: any) => !["cancelado", "finalizado", "concluido", "concluida"].includes(p.status));
  const completedProducts = granularProducts.filter((p: any) => DONE_STATUSES.has(p.status));
  const monthlyTotal = granularProducts.reduce((sum: number, p: any) => sum + Number(p.value || p.custom_value || 0), 0);
  const pendingDocs = docs.filter((d: any) => isPendingDoc(d.status)).length;
  const reviewDocs = docs.filter((d: any) => ["enviado", "em_analise", "submitted", "reviewing"].includes(d.status)).length;
  const pendingPayments = payments.filter((p: any) => isOpenPayment(p.status)).length;
  const pendingContracts = contracts.filter((c: any) => isContractPending(c.status)).length;
  const paidTotal = payments.filter((p: any) => !isOpenPayment(p.status)).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const openTotal = payments.filter((p: any) => isOpenPayment(p.status)).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  const nextDue = payments.filter((p: any) => isOpenPayment(p.status) && p.due_date).sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];
  const overduePayments = payments.filter((p: any) => isOpenPayment(p.status) && p.due_date && new Date(p.due_date) < new Date()).length;
  const selectedProduct = allProducts.find((p: any) => p.id === selectedProductId);
  const latestReports = reports.slice(0, 5);
  const deliveries = [
    ...docs.filter((d: any) => ["aprovado", "concluido", "approved"].includes(d.status)).map((d: any) => ({ ...d, type: "document" })),
    ...formalDeliveries.map((d: any) => ({ ...d, name: d.title, type: "delivery" })),
  ].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const criticalActions: Array<{ label: string; value: number; icon: any; tab: string; tone: "success" | "warning" | "danger" }> = [
    { label: "Documentos pendentes", value: pendingDocs, icon: FileText, tab: "checklist", tone: pendingDocs > 0 ? "warning" : "success" },
    { label: "Contratos aguardando", value: pendingContracts, icon: FileSignature, tab: "contratos", tone: pendingContracts > 0 ? "warning" : "success" },
    { label: "Pagamentos em aberto", value: pendingPayments, icon: Receipt, tab: "financeiro", tone: overduePayments > 0 ? "danger" : pendingPayments > 0 ? "warning" : "success" },
  ];

  const firstName = client.full_name?.split(" ")[0] || "Cliente";

  return (
    <div className="client-portal animate-fade-in min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 space-y-6 sm:space-y-8">
        {hasMultipleCompanies && activeTab === "home" && !selectedProductId && (
          <div className="flex justify-end">
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="h-10 rounded-xl border border-[#0f1b3d]/10 bg-white text-xs font-semibold text-[#0f1b3d] px-4 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3b6fa0]/30"
            >
              <option value="all">Todas as empresas</option>
              {companies.map((co: any) => <option key={co.id} value={co.id}>{co.trade_name || co.name}</option>)}
            </select>
          </div>
        )}

        {selectedProductId && selectedProduct ? (
          <ProductDetailView
            product={selectedProduct}
            docs={docs}
            reports={reports}
            onBack={() => setSelectedProductId(null)}
            onOpenDocs={() => { setSelectedProductId(null); setActiveTab("checklist"); }}
            onSupport={() => window.open(wa(`Gostaria de falar sobre a demanda ${selectedProduct.products?.name || selectedProduct.custom_product_name}`), "_blank")}
            onDownload={downloadDoc}
          />
        ) : (
          <>
            {/* ===== HERO — Navy gradient ===== */}
            <section className="relative overflow-hidden rounded-3xl shadow-[0_20px_60px_-20px_rgba(15,27,61,0.4)] border border-[#0f1b3d]/10">
              <div className="absolute inset-0 bg-gradient-to-br from-[#0a1430] via-[#0f1b3d] to-[#1e3a5f]" />
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#3b6fa0]/20 blur-[120px] -mt-48 -mr-48 rounded-full" />
              <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#c9a84c]/10 blur-[100px] -mb-32 -ml-32 rounded-full" />
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

              <div className="relative z-10 p-6 sm:p-8 lg:p-12">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 lg:gap-10">
                  <div className="flex-1 min-w-0 space-y-4 sm:space-y-5">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15">
                      <ShieldCheck className="size-3.5 text-[#c9a84c]" />
                      <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90">Portal Seguro · TLS 1.3</span>
                    </div>
                    <h1 className="font-display text-[28px] sm:text-[36px] lg:text-[48px] font-bold tracking-tight text-white leading-[1.05]">
                      Olá, {firstName}.<br />
                      <span className="text-[#e8edf3]/85 font-light">Sua operação,</span>{" "}
                      <span className="text-[#c9a84c]">sob controle.</span>
                    </h1>
                    <p className="text-sm sm:text-[15px] text-white/65 leading-relaxed max-w-xl">
                      Acompanhe demandas, documentos, contratos e pagamentos com transparência completa e suporte prioritário da equipe Prosper.
                    </p>
                  </div>
                  <div className="shrink-0 bg-white/[0.07] backdrop-blur-md rounded-2xl p-5 border border-white/10 min-w-[200px]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">Status da conta</p>
                    <p className="text-xl font-bold text-white mt-1.5 tracking-tight">{statusLabel(client.status)}</p>
                    <div className="h-px bg-white/10 my-3" />
                    <p className="text-[11px] font-medium text-white/60">Cliente desde {formatDate(client.created_at)}</p>
                  </div>
                </div>

                {/* KPI grid — mobile-safe, no truncation */}
                <div className="mt-7 sm:mt-9 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                  <HeroKpi label="Serviços ativos" value={String(activeProducts.length)} sub={`${completedProducts.length} concluídos`} icon={Package} />
                  <HeroKpi label="Pendências" value={String(pendingDocs + pendingContracts)} sub="docs e contratos" icon={ListChecks} accent={(pendingDocs + pendingContracts) > 0 ? "warning" : "ok"} />
                  <HeroKpi label="Em aberto" value={formatBRL(openTotal)} sub={`${pendingPayments} título(s)`} icon={Receipt} accent={openTotal > 0 ? "warning" : "ok"} compact />
                  <HeroKpi label="Entregas" value={String(deliveries.length)} sub="arquivos disponíveis" icon={Download} accent="gold" />
                </div>
              </div>
            </section>

            {/* ===== Ações prioritárias ===== */}
            <section className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] gap-5 lg:gap-6">
              <PanelCard
                title="Demandas em andamento"
                eyebrow="Execução"
                action={activeProducts.length > 3 ? <button onClick={() => setActiveTab("servicos")} className="text-xs font-semibold text-[#3b6fa0] hover:text-[#0f1b3d] inline-flex items-center gap-1">Ver todas <ArrowRight className="size-3.5" /></button> : null}
              >
                <div className="space-y-3">
                  {activeProducts.length === 0 ? (
                    <MiniEmpty icon={Package} text="Nenhuma demanda em andamento no momento." />
                  ) : activeProducts.slice(0, 4).map((p: any) => {
                    const productDocs = docs.filter((d: any) => d.client_product_id === p.id && isPendingDoc(d.status)).length;
                    const latestReport = reports.find((r: any) => r.client_product_id === p.id);
                    return (
                      <button key={p.id} onClick={() => setSelectedProductId(p.id)} className="w-full text-left rounded-xl border border-[#0f1b3d]/8 bg-white hover:border-[#3b6fa0]/40 hover:shadow-md transition-all p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <span className="size-10 rounded-xl bg-[#0f1b3d] text-white flex items-center justify-center shrink-0"><Package className="size-5" /></span>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-[#0f1b3d] truncate text-[15px]">{p.products?.name || p.custom_product_name || "Solução contratada"}</p>
                              <p className="text-xs text-[#0f1b3d]/55 mt-1 line-clamp-1">{latestReport?.notes || `Status: ${statusLabel(p.status)}`}</p>
                            </div>
                          </div>
                          <StatusBadge status={p.status} />
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2">
                          <InfoCell label="Prazo" value={p.deadline ? formatDate(p.deadline) : "—"} />
                          <InfoCell label="Pendências" value={productDocs > 0 ? `${productDocs} doc.` : "Em dia"} tone={productDocs > 0 ? "warning" : "success"} />
                          <InfoCell label="Atualizado" value={formatDate(latestReport?.created_at || p.updated_at || p.created_at)} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </PanelCard>

              <PanelCard
                title="Ações prioritárias"
                eyebrow="Fluxo de trabalho"
                accent={<span className="size-9 rounded-xl bg-[#0f1b3d]/5 text-[#0f1b3d] flex items-center justify-center"><Bell className="size-4" /></span>}
              >
                <div className="space-y-3">
                  {criticalActions.map((item) => (
                    <ActionRow key={item.label} {...item} onClick={() => setActiveTab(item.tab)} />
                  ))}
                </div>
                <Button onClick={() => window.open(wa(), "_blank")} className="mt-5 h-11 w-full rounded-xl bg-[#0f1b3d] hover:bg-[#1e3a5f] text-white font-semibold shadow-sm">
                  <MessageSquare className="size-4 mr-2" /> Falar com a equipe
                </Button>
              </PanelCard>
            </section>

            {/* ===== Tabs ===== */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <div className="sticky top-14 z-30 -mx-4 sm:mx-0 px-4 sm:px-0 py-2 bg-gradient-to-b from-[#f6f8fc] via-[#f6f8fc]/95 to-[#f6f8fc]/70 backdrop-blur-md">
                <TabsList className="h-auto bg-white border border-[#0f1b3d]/8 rounded-2xl p-1.5 shadow-sm overflow-x-auto max-w-full justify-start w-full sm:w-auto scrollbar-none">
                  <PillTab value="home" label="Início" icon={LayoutDashboard} />
                  <PillTab value="servicos" label="Serviços" icon={Package} count={activeProducts.length} />
                  <PillTab value="checklist" label="Documentos" icon={FileText} count={pendingDocs} alert={pendingDocs > 0} />
                  <PillTab value="financeiro" label="Financeiro" icon={Receipt} count={pendingPayments} alert={pendingPayments > 0} />
                  <PillTab value="contratos" label="Contratos" icon={FileSignature} count={pendingContracts} alert={pendingContracts > 0} />
                  <PillTab value="docs" label="Biblioteca" icon={Inbox} count={deliveries.length} />
                  <PillTab value="descobrir" label="Soluções" icon={Sparkles} />
                </TabsList>
              </div>

              <TabsContent value="home" className="space-y-5 animate-fade-up">
                <div className="grid lg:grid-cols-2 gap-5">
                  <PanelCard title="Próximo vencimento" eyebrow="Financeiro">
                    {nextDue ? (
                      <div className="rounded-xl bg-gradient-to-br from-[#fdf6e3] to-[#fbeec6] border border-[#c9a84c]/30 p-5">
                        <div className="flex items-center gap-2">
                          <Calendar className="size-3.5 text-[#8a6d1f]" />
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8a6d1f]">{formatDate(nextDue.due_date)}</p>
                        </div>
                        <p className="num text-3xl sm:text-4xl font-bold text-[#0f1b3d] mt-2">{formatBRL(nextDue.amount)}</p>
                        <p className="text-sm text-[#0f1b3d]/65 mt-2">{overduePayments > 0 ? "Existe pagamento vencido — regularize para evitar bloqueios." : "Pagamento em aberto para acompanhamento."}</p>
                        <Button onClick={() => setActiveTab("financeiro")} className="mt-4 h-10 rounded-xl bg-[#0f1b3d] hover:bg-[#1e3a5f] text-white w-full font-semibold">Ver financeiro</Button>
                      </div>
                    ) : <MiniEmpty icon={CheckCircle2} text="Nenhuma cobrança pendente — você está em dia." tone="ok" />}
                  </PanelCard>

                  <PanelCard title="Atualizações recentes" eyebrow="Linha do tempo">
                    {latestReports.length === 0 ? <MiniEmpty icon={Activity} text="Ainda não há atualizações registradas." /> : (
                      <div className="space-y-4">
                        {latestReports.map((r: any) => (
                          <div key={r.id} className="flex gap-3">
                            <div className="flex flex-col items-center shrink-0">
                              <span className="size-2.5 rounded-full bg-[#3b6fa0] ring-4 ring-[#3b6fa0]/15 mt-1.5" />
                              <span className="w-px flex-1 bg-[#0f1b3d]/8 mt-1" />
                            </div>
                            <div className="min-w-0 pb-1">
                              <p className="text-sm font-semibold text-[#0f1b3d] leading-snug line-clamp-2">{r.notes || statusLabel(r.status)}</p>
                              <p className="text-[11px] text-[#0f1b3d]/50 mt-1">{formatDate(r.created_at)} · {r.service_providers?.name || "Equipe Prosper"}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </PanelCard>
                </div>
              </TabsContent>

              <TabsContent value="servicos" className="animate-fade-up">
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                  {granularProducts.length === 0 ? <div className="md:col-span-2 xl:col-span-3"><EmptyState icon={Package} title="Nenhum serviço contratado" description="Quando uma solução for vinculada ao seu cadastro, ela aparecerá aqui." /></div> : granularProducts.map((p: any) => {
                    const productPendingDocs = docs.filter((d: any) => d.client_product_id === p.id && isPendingDoc(d.status)).length;
                    const latestReport = reports.find((r: any) => r.client_product_id === p.id);
                    return <ServiceCard key={p.id} product={p} pendingDocs={productPendingDocs} latestReport={latestReport} onClick={() => setSelectedProductId(p.id)} />;
                  })}
                </div>
              </TabsContent>

              <TabsContent value="checklist" className="animate-fade-up">
                <SectionHeader title="Documentos" description="Envie pendências, acompanhe análise e visualize arquivos aprovados." counters={[`${pendingDocs} pendente(s)`, `${reviewDocs} em análise`]} />
                <ClientDocumentsTab clientId={client.id} requests={docs as any} products={catalog as any} />
              </TabsContent>

              <TabsContent value="financeiro" className="animate-fade-up space-y-5">
                <SectionHeader title="Financeiro" description="Extrato de cobranças, vencimentos e pagamentos registrados." counters={[formatBRL(openTotal), `${pendingPayments} aberto(s)`]} />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                  <FinanceTile label="Recorrência" value={formatBRL(monthlyTotal)} sub="base contratada" icon={Activity} />
                  <FinanceTile label="Total pago" value={formatBRL(paidTotal)} sub="histórico" icon={CheckCircle2} tone="success" />
                  <FinanceTile label="Em aberto" value={formatBRL(openTotal)} sub={`${pendingPayments} título(s)`} icon={Clock} tone={openTotal > 0 ? "warning" : "success"} />
                  <FinanceTile label="Próximo" value={nextDue ? formatDate(nextDue.due_date) : "—"} sub={nextDue ? formatBRL(nextDue.amount) : "sem pendência"} icon={Calendar} tone={nextDue ? "warning" : "success"} />
                </div>
                <PanelCard title="Extrato de pagamentos" eyebrow={`${payments.length} registros`}>
                  {payments.length === 0 ? <MiniEmpty icon={Receipt} text="Nenhum pagamento registrado ainda." /> : <PaymentTable payments={payments} />}
                </PanelCard>
              </TabsContent>

              <TabsContent value="contratos" className="animate-fade-up">
                <SectionHeader title="Contratos" description="Contratos disponíveis para consulta e assinatura digital." counters={[`${pendingContracts} aguardando`]} />
                <ClientContractsTab clientId={client.id} contracts={contracts as any} />
              </TabsContent>

              <TabsContent value="docs" className="animate-fade-up">
                <SectionHeader title="Biblioteca" description="Arquivos, entregas e documentos aprovados ficam centralizados aqui." counters={[`${deliveries.length} arquivo(s)`]} />
                <PanelCard title="Repositório de arquivos" eyebrow="Downloads">
                  {deliveries.length === 0 ? <MiniEmpty icon={Inbox} text="Sua biblioteca ainda está vazia." /> : (
                    <div className="divide-y divide-[#0f1b3d]/6">
                      {deliveries.map((d: any) => (
                        <div key={`${d.type}-${d.id}`} className="py-3.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="size-10 rounded-xl bg-[#0f1b3d]/5 text-[#3b6fa0] flex items-center justify-center shrink-0"><FileText className="size-5" /></span>
                            <div className="min-w-0">
                              <p className="font-semibold text-[#0f1b3d] truncate text-sm">{d.name}</p>
                              <p className="text-[11px] text-[#0f1b3d]/50 mt-0.5">{formatDate(d.created_at)}</p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" className="h-9 rounded-xl border-[#0f1b3d]/15 text-[#0f1b3d] hover:bg-[#0f1b3d] hover:text-white" onClick={() => downloadDoc(d.file_path || d.file_url, d.name)}><Download className="size-4 sm:mr-2" /><span className="hidden sm:inline">Baixar</span></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </PanelCard>
              </TabsContent>

              <TabsContent value="descobrir" className="animate-fade-up">
                <SectionHeader title="Novas soluções" description="Produtos disponíveis para ampliar sua operação." />
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                  {catalog.filter((c: any) => !granularProducts.some((p: any) => p.product_id === c.id)).map((p: any) => (
                    <div key={p.id} className="bg-white border border-[#0f1b3d]/8 rounded-2xl p-6 shadow-sm hover:border-[#3b6fa0]/40 hover:shadow-md transition-all flex flex-col">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        {p.product_categories?.name ? <Badge variant="outline" className="text-[10px] font-bold rounded-lg border-[#0f1b3d]/15 text-[#0f1b3d]/70">{p.product_categories.name}</Badge> : <span />}
                        {p.recurring && <Badge className="text-[10px] font-bold rounded-lg bg-[#0f1b3d] text-white hover:bg-[#0f1b3d]">Recorrente</Badge>}
                      </div>
                      <h3 className="text-xl font-bold text-[#0f1b3d] leading-tight">{p.name}</h3>
                      <p className="text-sm text-[#0f1b3d]/65 mt-2 line-clamp-3 flex-1">{p.description}</p>
                      <div className="mt-5 pt-4 border-t border-[#0f1b3d]/8 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0f1b3d]/45">Investimento</p>
                          <p className="num text-lg font-bold text-[#0f1b3d]">{formatBRL(p.base_price)}{p.recurring && <span className="text-[10px] text-[#0f1b3d]/50 font-normal">/mês</span>}</p>
                        </div>
                        <Button className="h-10 rounded-xl bg-[#0f1b3d] hover:bg-[#1e3a5f] text-white font-semibold" onClick={() => window.open(wa(`Tenho interesse em ${p.name}`), "_blank")}>Tenho interesse</Button>
                      </div>
                    </div>
                  ))}
                  {catalog.filter((c: any) => !granularProducts.some((p: any) => p.product_id === c.id)).length === 0 && <div className="md:col-span-2 xl:col-span-3"><EmptyState icon={Sparkles} title="Tudo liberado" description="Você já tem acesso a todas as soluções disponíveis no catálogo." /></div>}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================ */
/* Subcomponents */
/* ============================================================ */

function ClientPanelShell({ children }: { children: any }) {
  return <div className="client-portal min-h-screen flex items-center justify-center p-6">{children}</div>;
}

function ClientPanelLoading() {
  return (
    <div className="client-portal min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="size-14 rounded-2xl bg-[#0f1b3d] text-white mx-auto flex items-center justify-center shadow-lg">
          <Loader2 className="size-6 animate-spin" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0f1b3d]/50 mt-5">Carregando portal</p>
        <p className="text-base font-semibold text-[#0f1b3d] mt-1">Preparando suas informações…</p>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, action, tone = "default" }: { icon: any; title: string; description: string; action?: any; tone?: "default" | "danger" }) {
  return (
    <div className="bg-white border border-[#0f1b3d]/10 rounded-2xl shadow-sm p-8 sm:p-10 max-w-lg w-full text-center">
      <div className={cn("size-14 rounded-2xl mx-auto mb-5 flex items-center justify-center", tone === "danger" ? "bg-rose-50 text-rose-600" : "bg-[#0f1b3d] text-white")}>
        <Icon className="size-7" />
      </div>
      <h2 className="font-display text-2xl font-bold text-[#0f1b3d] tracking-tight">{title}</h2>
      <p className="text-sm text-[#0f1b3d]/65 leading-relaxed mt-3 mb-6">{description}</p>
      {action}
    </div>
  );
}

function HeroKpi({ label, value, sub, icon: Icon, accent, compact }: { label: string; value: string; sub?: string; icon: any; accent?: "ok" | "warning" | "gold"; compact?: boolean }) {
  const iconBg =
    accent === "warning" ? "bg-amber-400/20 text-amber-300" :
    accent === "ok" ? "bg-emerald-400/15 text-emerald-300" :
    accent === "gold" ? "bg-[#c9a84c]/20 text-[#c9a84c]" :
    "bg-white/10 text-white";
  return (
    <div className="rounded-2xl bg-white/[0.06] border border-white/10 backdrop-blur-md p-3.5 sm:p-4 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-white/65 leading-tight">{label}</p>
        <span className={cn("size-8 rounded-lg flex items-center justify-center shrink-0", iconBg)}><Icon className="size-4" /></span>
      </div>
      <p className={cn("num font-bold text-white mt-3 leading-none break-words", compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl")}>{value}</p>
      {sub && <p className="text-[10px] sm:text-[11px] font-medium text-white/50 mt-2 leading-tight">{sub}</p>}
    </div>
  );
}

function FinanceTile({ label, value, sub, icon: Icon, tone = "default" }: { label: string; value: string; sub?: string; icon: any; tone?: "default" | "success" | "warning" }) {
  const ring =
    tone === "warning" ? "bg-amber-50 text-amber-700" :
    tone === "success" ? "bg-emerald-50 text-emerald-700" :
    "bg-[#0f1b3d]/5 text-[#3b6fa0]";
  return (
    <div className="rounded-2xl border border-[#0f1b3d]/8 bg-white p-3.5 sm:p-4 shadow-sm min-w-0">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0f1b3d]/55 leading-tight">{label}</p>
        <span className={cn("size-8 rounded-lg flex items-center justify-center shrink-0", ring)}><Icon className="size-4" /></span>
      </div>
      <p className="num text-xl sm:text-2xl font-bold text-[#0f1b3d] mt-3 leading-none break-words">{value}</p>
      {sub && <p className="text-[10px] sm:text-[11px] font-medium text-[#0f1b3d]/50 mt-2">{sub}</p>}
    </div>
  );
}

function ActionRow({ label, value, icon: Icon, tone, onClick }: { label: string; value: number; icon: any; tone: "success" | "warning" | "danger"; onClick: () => void }) {
  const ok = value === 0;
  const iconCls = ok ? "bg-emerald-50 text-emerald-600" : tone === "danger" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600";
  return (
    <button onClick={onClick} className="w-full rounded-xl border border-[#0f1b3d]/8 bg-white hover:border-[#3b6fa0]/40 hover:shadow-sm transition-all p-3.5 text-left flex items-center justify-between gap-3 group">
      <div className="flex items-center gap-3 min-w-0">
        <span className={cn("size-10 rounded-xl flex items-center justify-center shrink-0", iconCls)}><Icon className="size-5" /></span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#0f1b3d] truncate">{label}</p>
          <p className="text-[11px] text-[#0f1b3d]/55 mt-0.5">{ok ? "Tudo certo" : `${value} item(ns) exigem atenção`}</p>
        </div>
      </div>
      <ArrowRight className="size-4 text-[#0f1b3d]/30 group-hover:text-[#3b6fa0] group-hover:translate-x-0.5 transition-all shrink-0" />
    </button>
  );
}

function PanelCard({ title, eyebrow, action, accent, children }: { title: string; eyebrow?: string; action?: any; accent?: any; children: any }) {
  return (
    <section className="bg-white border border-[#0f1b3d]/8 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-[#0f1b3d]/6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0f1b3d]/45">{eyebrow}</p>}
          <h2 className="font-display text-base sm:text-lg font-bold text-[#0f1b3d] mt-0.5 truncate">{title}</h2>
        </div>
        {accent || action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function MiniEmpty({ icon: Icon, text, tone }: { icon: any; text: string; tone?: "ok" }) {
  const cls = tone === "ok"
    ? "bg-emerald-50/60 border-emerald-200/60 text-emerald-700"
    : "bg-[#f6f8fc] border-[#0f1b3d]/8 text-[#0f1b3d]/55";
  return (
    <div className={cn("rounded-xl border border-dashed p-6 text-center", cls)}>
      <Icon className={cn("size-7 mx-auto mb-2.5", tone === "ok" ? "text-emerald-500" : "text-[#3b6fa0]/40")} />
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}

function InfoCell({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  const valueCls = tone === "success" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : "text-[#0f1b3d]";
  return (
    <div className="rounded-lg bg-[#f6f8fc] p-2.5 min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#0f1b3d]/45 truncate">{label}</p>
      <p className={cn("text-[11px] font-semibold mt-0.5 truncate", valueCls)}>{value}</p>
    </div>
  );
}

function ServiceCard({ product, pendingDocs, latestReport, onClick }: { product: any; pendingDocs: number; latestReport: any; onClick: () => void }) {
  return (
    <button onClick={onClick} className="bg-white border border-[#0f1b3d]/8 rounded-2xl p-5 sm:p-6 shadow-sm hover:border-[#3b6fa0]/40 hover:shadow-md transition-all text-left flex flex-col min-h-[240px] group">
      <div className="flex items-start justify-between gap-3 mb-5">
        <span className="size-12 rounded-xl bg-[#0f1b3d] text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform"><Package className="size-6" /></span>
        <StatusBadge status={product.status} />
      </div>
      <h3 className="font-display text-lg sm:text-xl font-bold text-[#0f1b3d] leading-tight">{product.products?.name || product.custom_product_name || "Solução contratada"}</h3>
      <p className="text-sm text-[#0f1b3d]/60 mt-2 line-clamp-2">{product.products?.description || latestReport?.notes || "Acompanhamento de execução e entregas."}</p>
      <div className="mt-auto pt-5 grid grid-cols-2 gap-2">
        <InfoCell label="Prazo" value={product.deadline ? formatDate(product.deadline) : "Em definição"} />
        <InfoCell label="Pendências" value={pendingDocs > 0 ? `${pendingDocs} doc.` : "Em dia"} tone={pendingDocs > 0 ? "warning" : "success"} />
        <div className="col-span-2 mt-3 pt-3 border-t border-[#0f1b3d]/8 flex items-center justify-between text-xs font-semibold text-[#3b6fa0]">
          <span>Ver detalhes da execução</span><ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </button>
  );
}

function SectionHeader({ title, description, counters = [] }: { title: string; description: string; counters?: string[] }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4 sm:mb-5">
      <div className="min-w-0">
        <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#0f1b3d]">{title}</h2>
        <p className="text-sm text-[#0f1b3d]/60 mt-1">{description}</p>
      </div>
      {counters.length > 0 && <div className="flex flex-wrap gap-2">{counters.map((c) => <Badge key={c} variant="outline" className="rounded-lg border-[#0f1b3d]/15 bg-white text-[#0f1b3d]/70 font-semibold">{c}</Badge>)}</div>}
    </div>
  );
}

function PaymentTable({ payments }: { payments: any[] }) {
  return (
    <>
      {/* Mobile cards */}
      <div className="sm:hidden space-y-2.5">
        {payments.map((p) => (
          <div key={p.id} className="rounded-xl border border-[#0f1b3d]/8 p-3.5 bg-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0f1b3d]/45">{formatDate(p.due_date)}</p>
                <p className="num text-lg font-bold text-[#0f1b3d] mt-1">{formatBRL(p.amount)}</p>
              </div>
              <StatusBadge status={p.status} />
            </div>
            {p.installment_number && p.installments_count && (
              <p className="text-[11px] text-[#0f1b3d]/50 mt-2">Parcela {p.installment_number}/{p.installments_count}</p>
            )}
          </div>
        ))}
      </div>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto -mx-5 sm:-mx-6">
        <table className="w-full text-sm min-w-[560px]">
          <thead><tr className="bg-[#f6f8fc] text-[10px] uppercase tracking-[0.16em] text-[#0f1b3d]/55"><th className="px-6 py-3.5 text-left font-bold">Vencimento</th><th className="px-6 py-3.5 text-left font-bold">Parcela</th><th className="px-6 py-3.5 text-left font-bold">Status</th><th className="px-6 py-3.5 text-right font-bold">Valor</th></tr></thead>
          <tbody className="divide-y divide-[#0f1b3d]/6">
            {payments.map((p) => <tr key={p.id} className="hover:bg-[#f6f8fc]/60"><td className="px-6 py-3.5 font-semibold text-[#0f1b3d]/80">{formatDate(p.due_date)}</td><td className="px-6 py-3.5 text-[#0f1b3d]/55">{p.installment_number && p.installments_count ? `${p.installment_number}/${p.installments_count}` : "—"}</td><td className="px-6 py-3.5"><StatusBadge status={p.status} /></td><td className="px-6 py-3.5 text-right num font-bold text-[#0f1b3d]">{formatBRL(p.amount)}</td></tr>)}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ProductDetailView({ product, docs, reports, onBack, onOpenDocs, onSupport, onDownload }: { product: any; docs: any[]; reports: any[]; onBack: () => void; onOpenDocs: () => void; onSupport: () => void; onDownload: (path?: string | null, name?: string) => void }) {
  const productDocs = docs.filter((d) => d.client_product_id === product.id);
  const productReports = reports.filter((r) => r.client_product_id === product.id);
  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-up">
      <Button variant="ghost" onClick={onBack} className="h-9 px-0 text-[#0f1b3d]/65 hover:text-[#0f1b3d] hover:bg-transparent"><ChevronLeft className="size-4 mr-1" /> Voltar ao painel</Button>
      <section className="relative overflow-hidden rounded-3xl shadow-[0_20px_60px_-20px_rgba(15,27,61,0.3)] border border-[#0f1b3d]/10">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f1b3d] to-[#1e3a5f]" />
        <div className="absolute top-0 right-0 size-72 bg-[#3b6fa0]/20 blur-[100px] -mt-32 -mr-32 rounded-full" />
        <div className="relative z-10 p-6 sm:p-8 lg:p-10 text-white">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            <div className="max-w-2xl min-w-0">
              <Badge className="bg-white/10 text-[#c9a84c] hover:bg-white/10 rounded-lg border border-white/10 mb-4 font-semibold">Solução em execução</Badge>
              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">{product.products?.name || product.custom_product_name || "Solução contratada"}</h1>
              <p className="text-sm text-white/70 leading-relaxed mt-3">{product.products?.description || "Acompanhe checklist, documentos e atualizações desta demanda."}</p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button variant="outline" className="h-10 rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white" onClick={onSupport}><MessageSquare className="size-4 mr-2" /> Suporte</Button>
              <StatusBadge status={product.status} />
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <HeroKpi label="Status" value={statusLabel(product.status)} sub="situação atual" icon={Activity} compact />
            <HeroKpi label="Prazo" value={product.deadline ? formatDate(product.deadline) : "Em definição"} sub="previsão de entrega" icon={Clock} accent="warning" compact />
            <HeroKpi label="Documentos" value={String(productDocs.length)} sub="vinculados" icon={FileText} accent="ok" />
          </div>
        </div>
      </section>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] gap-5 lg:gap-6">
        <PanelCard title="Checklist de execução" eyebrow="Etapas">
          <ClientProductSteps clientProductId={product.id} showDetails={true} />
        </PanelCard>
        <div className="space-y-5">
          <PanelCard title="Documentos da demanda" eyebrow={`${productDocs.length} arquivo(s)`}>
            {productDocs.length === 0 ? <MiniEmpty icon={FileText} text="Nenhum documento específico solicitado." /> : (
              <div className="space-y-2.5">
                {productDocs.map((d) => (
                  <div key={d.id} className="rounded-xl border border-[#0f1b3d]/8 p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#0f1b3d] truncate">{d.name}</p>
                      <p className="text-[11px] text-[#0f1b3d]/55">{statusLabel(d.status)}</p>
                    </div>
                    {d.file_path ? <Button variant="ghost" size="icon" className="size-9 rounded-lg text-[#3b6fa0] hover:bg-[#0f1b3d]/5" onClick={() => onDownload(d.file_path, d.name)}><Download className="size-4" /></Button> : <Button size="sm" className="h-9 rounded-lg bg-[#0f1b3d] hover:bg-[#1e3a5f]" onClick={onOpenDocs}>Enviar</Button>}
                  </div>
                ))}
              </div>
            )}
          </PanelCard>
          <PanelCard title="Atualizações" eyebrow="Equipe">
            {productReports.length === 0 ? <MiniEmpty icon={Activity} text="Nenhuma atualização registrada ainda." /> : (
              <div className="space-y-4">
                {productReports.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex gap-3">
                    <span className="mt-1.5 size-2.5 rounded-full bg-[#3b6fa0] ring-4 ring-[#3b6fa0]/15 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#0f1b3d] leading-snug">{r.notes || statusLabel(r.status)}</p>
                      <p className="text-[11px] text-[#0f1b3d]/50 mt-1">{formatDate(r.created_at)} · {r.service_providers?.name || "Equipe Prosper"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelCard>
        </div>
      </div>
    </div>
  );
}

function PillTab({ value, label, icon: Icon, count, alert }: { value: string; label: string; icon: any; count?: number; alert?: boolean }) {
  return (
    <TabsTrigger value={value} className="shrink-0 h-10 rounded-xl px-3 sm:px-3.5 gap-2 text-[12px] sm:text-[13px] font-semibold text-[#0f1b3d]/65 hover:text-[#0f1b3d] data-[state=active]:bg-[#0f1b3d] data-[state=active]:text-white data-[state=active]:shadow-sm transition-colors">
      <Icon className="size-4" /><span>{label}</span>
      {count !== undefined && count > 0 && <span className={cn("min-w-5 h-5 px-1.5 rounded-md text-[10px] font-bold tabular-nums flex items-center justify-center", alert ? "bg-rose-500 text-white" : "bg-[#0f1b3d]/10 text-[#0f1b3d]/70 group-data-[state=active]:bg-white/15 group-data-[state=active]:text-white")}>{count}</span>}
    </TabsTrigger>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status || "indefinido";
  const cls = DONE_STATUSES.has(s)
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : s.includes("atras") || s.includes("reprov") || s.includes("cancel")
    ? "bg-rose-50 text-rose-700 border-rose-200"
    : s.includes("aguard") || s.includes("pend")
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-[#0f1b3d]/5 text-[#3b6fa0] border-[#3b6fa0]/20";
  return <Badge variant="outline" className={cn("text-[10px] font-bold uppercase tracking-[0.1em] rounded-lg shrink-0", cls)}>{statusLabel(s)}</Badge>;
}
