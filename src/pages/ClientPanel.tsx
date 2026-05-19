import { useRef, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package, FileText, Download, Upload, CheckCircle2, Clock, AlertCircle,
  Calendar, Receipt, ShoppingBag, Inbox, Mail, Phone, ClipboardList, History, ArrowRight,
  FileSignature, ShieldCheck, ChevronRight, Loader2, ListChecks, Activity,
  ChevronLeft, Sparkles, MessageSquare, Zap, LayoutDashboard, LogOut, Bell, User as UserIcon,
} from "lucide-react";
import { formatBRL, formatDate, initials } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ClientDocumentsTab } from "@/components/client/ClientDocumentsTab";
import { ClientContractsTab } from "@/components/client/ClientContractsTab";
import { ClientProductSteps } from "@/components/clients/tabs/ClientProductSteps";
import { PageHero } from "@/components/PageHero";
import { ProsperLogo } from "@/components/VendxLogo";
import { NotificationBell } from "@/components/NotificationBell";
import { useSystemSettings, buildWhatsAppLink, buildMailtoLink } from "@/hooks/useSystemSettings";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";

const CLIENT_PATH_TO_TAB: Record<string, string> = {
  produtos: "servicos", documentos: "checklist", financeiro: "financeiro",
  contratos: "contratos", biblioteca: "docs", descobrir: "descobrir",
};
const CLIENT_TAB_TO_PATH: Record<string, string> = {
  servicos: "produtos", checklist: "documentos", financeiro: "financeiro",
  contratos: "contratos", docs: "biblioteca", descobrir: "descobrir",
};


const ACTIVE_STATUSES = new Set(["ativo", "em_andamento", "em_execucao", "aguardando_inicio", "aguardando_documentos", "pendente_cliente", "em_analise"]);
const DONE_STATUSES = new Set(["concluido", "concluida", "finalizado", "finalizada", "assinado", "pago", "aprovado"]);

const statusLabel = (status?: string | null) => (status || "Em definição")
  .replace(/_/g, " ")
  .replace(/\b\w/g, (m) => m.toUpperCase());

const isPendingDoc = (status?: string | null) => ["solicitado", "pendente", "reprovado", "pendente_correcao", "pending", "rejected"].includes(status || "");
const isOpenPayment = (status?: string | null) => !["pago", "paid", "cancelado", "cancelled"].includes(status || "");
const isContractPending = (status?: string | null) => ["enviado", "aguardando_assinatura", "pendente", "criado"].includes(status || "");

export default function ClientPanel() {
  const { user, signOut } = useAuth();
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const settings = useSystemSettings();
  const queryClient = useQueryClient();
  const wa = (msg?: string) => buildWhatsAppLink(settings.support_whatsapp, msg);
  const activeTab = tabParam && CLIENT_PATH_TO_TAB[tabParam] ? CLIENT_PATH_TO_TAB[tabParam] : "home";
  const setActiveTab = (v: string) => navigate(v === "home" ? "/cliente" : `/cliente/${CLIENT_TAB_TO_PATH[v] || v}`);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all");

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
        safe(supabase.from("document_requests").select("*").eq("client_id", client.id).order("requested_at", { ascending: false })),
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
          action={<Button onClick={() => window.location.reload()} className="h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white">Tentar novamente</Button>}
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
        action={<Button onClick={() => window.open(wa("Olá, meu acesso ao portal do cliente ainda não está vinculado."), "_blank")} className="h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"><MessageSquare className="size-4 mr-2" /> Falar com a equipe</Button>}
      />
    </ClientPanelShell>
  );

  const { client, docs: allDocs, catalog, requests, contracts, payments, granularProducts: allProducts, reports: allReports, formalDeliveries: allFormalDeliveries } = data;
  const allDocumentItems = [
    ...allDocs.map((d: any) => ({ ...d, source: "documents" })),
    ...requests.map((r: any) => ({
      ...r,
      source: "document_requests",
      name: r.request_title,
      file_path: r.file_url,
      due_date: r.deadline,
      uploaded_at: r.submission_date,
      reviewed_at: r.approval_date,
      created_at: r.requested_at,
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
  const onboardingProgress = Math.max(0, Math.min(100, Number(client.onboarding_progress ?? 100)));
  const selectedProduct = allProducts.find((p: any) => p.id === selectedProductId);
  const latestReports = reports.slice(0, 5);
  const deliveries = [
    ...docs.filter((d: any) => ["aprovado", "concluido", "approved"].includes(d.status)).map((d: any) => ({ ...d, type: "document" })),
    ...formalDeliveries.map((d: any) => ({ ...d, name: d.title, type: "delivery" })),
  ].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const criticalActions = [
    { label: "Documentos pendentes", value: pendingDocs, icon: FileText, tab: "checklist", tone: pendingDocs > 0 ? "warning" : "success" as const },
    { label: "Contratos aguardando", value: pendingContracts, icon: FileSignature, tab: "contratos", tone: pendingContracts > 0 ? "warning" : "success" as const },
    { label: "Pagamentos em aberto", value: pendingPayments, icon: Receipt, tab: "financeiro", tone: overduePayments > 0 ? "danger" : pendingPayments > 0 ? "warning" : "success" as const },
  ];

  const firstName = client.full_name?.split(" ")[0] || "Cliente";

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-900">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/70">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 h-16 flex items-center justify-between gap-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-[0_2px_8px_-2px_rgba(79,70,229,0.5)] shrink-0">
              <Package className="size-4.5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-slate-400 leading-none">Portal do cliente</p>
              <p className="text-[13px] font-bold text-slate-900 mt-0.5 leading-tight truncate">Prosper Direct Response</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasMultipleCompanies && (
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="h-9 rounded-lg border border-slate-200/70 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 px-2.5 max-w-[190px] truncate focus:outline-none focus:ring-2 focus:ring-indigo-100"
              >
                <option value="all">Todas as empresas</option>
                {companies.map((co: any) => <option key={co.id} value={co.id}>{co.trade_name || co.name}</option>)}
              </select>
            )}
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 pl-1 pr-2 h-9 rounded-lg border border-slate-200/70 bg-white hover:bg-slate-50 transition-colors">
                  <span className="size-7 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[11px] font-bold shrink-0">{initials(client.full_name)}</span>
                  <span className="hidden sm:inline text-xs font-semibold text-slate-700 max-w-[140px] truncate">{firstName}</span>
                  <ChevronRight className="size-3.5 text-slate-400 rotate-90" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-bold leading-none truncate">{client.full_name}</p>
                  <p className="text-[11px] text-slate-500 leading-none truncate mt-1.5">{client.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setActiveTab("home")} className="gap-2"><LayoutDashboard className="size-4" /> Painel inicial</DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.open(wa(), "_blank")} className="gap-2"><MessageSquare className="size-4" /> Falar com a equipe</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={async () => { await signOut(); toast.success("Sessão encerrada"); navigate("/auth", { replace: true }); }} className="gap-2 text-rose-600 focus:text-rose-600">
                  <LogOut className="size-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 lg:px-8 py-8 lg:py-10 space-y-8">
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
            <section className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 lg:gap-8 items-stretch">
              <div className="bg-white border border-slate-200/70 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_28px_-16px_rgba(15,23,42,0.1)] p-7 lg:p-9 overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                  <div className="max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-50 ring-1 ring-indigo-100 mb-4">
                      <ShieldCheck className="size-3 text-indigo-600" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-700">Acesso liberado · Portal ativo</span>
                    </div>
                    <h1 className="font-display text-[32px] lg:text-[42px] font-bold tracking-[-0.025em] text-slate-900 leading-[1.06]">
                      Olá, {firstName}.<br />Sua operação está organizada aqui.
                    </h1>
                    <p className="text-[14px] text-slate-600 mt-4 leading-relaxed max-w-xl">
                      Acompanhe demandas, documentos, contratos e pagamentos com visão clara do que precisa de ação e do que já foi entregue.
                    </p>
                  </div>
                  <div className="md:text-right shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Status do cadastro</p>
                    <p className="text-sm font-bold text-slate-900 mt-1">{statusLabel(client.status)}</p>
                    <p className="text-[11px] text-slate-500 mt-1">Desde {formatDate(client.created_at)}</p>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 xl:grid-cols-4 gap-3">
                  <MetricTile label="Serviços ativos" value={String(activeProducts.length)} sub={`${completedProducts.length} concluído(s)`} icon={Package} tone="info" />
                  <MetricTile label="Pendências" value={String(pendingDocs + pendingContracts)} sub="documentos e contratos" icon={ListChecks} tone={(pendingDocs + pendingContracts) > 0 ? "warning" : "success"} />
                  <MetricTile label="Em aberto" value={formatBRL(openTotal)} sub={`${pendingPayments} título(s)`} icon={Receipt} tone={openTotal > 0 ? "warning" : "success"} />
                  <MetricTile label="Entregas" value={String(deliveries.length)} sub="arquivos disponíveis" icon={Download} tone="success" />
                </div>
              </div>

              <div className="bg-white border border-slate-200/70 rounded-2xl shadow-sm p-6 flex flex-col">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Prioridades</p>
                    <h2 className="text-lg font-bold text-slate-900 mt-1">Ações necessárias</h2>
                  </div>
                  <span className="size-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Bell className="size-4" /></span>
                </div>
                <div className="space-y-3 flex-1">
                  {criticalActions.map((item) => (
                    <ActionRow key={item.label} {...item} onClick={() => setActiveTab(item.tab)} />
                  ))}
                </div>
                <Button onClick={() => window.open(wa(), "_blank")} variant="outline" className="mt-5 h-10 rounded-lg border-slate-200 font-semibold text-slate-700 hover:bg-slate-50">
                  <MessageSquare className="size-4 mr-2" /> Falar com a equipe
                </Button>
              </div>
            </section>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-7">
              <div className="sticky top-16 z-30 bg-slate-50/90 backdrop-blur-md py-2 -mx-5 px-5 lg:mx-0 lg:px-0">
                <TabsList className="h-auto bg-white border border-slate-200/70 rounded-xl p-1 shadow-sm overflow-x-auto max-w-full justify-start">
                  <PillTab value="home" label="Início" icon={LayoutDashboard} />
                  <PillTab value="servicos" label="Serviços" icon={Package} count={activeProducts.length} />
                  <PillTab value="checklist" label="Documentos" icon={FileText} count={pendingDocs} alert={pendingDocs > 0} />
                  <PillTab value="financeiro" label="Financeiro" icon={Receipt} count={pendingPayments} alert={pendingPayments > 0} />
                  <PillTab value="contratos" label="Contratos" icon={FileSignature} count={pendingContracts} alert={pendingContracts > 0} />
                  <PillTab value="docs" label="Biblioteca" icon={Inbox} count={deliveries.length} />
                  <PillTab value="descobrir" label="Soluções" icon={Sparkles} />
                </TabsList>
              </div>

              <TabsContent value="home" className="space-y-6 animate-fade-up">
                <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 lg:gap-8">
                  <PanelCard title="Demandas em andamento" eyebrow="Execução" action={activeProducts.length > 3 ? <button onClick={() => setActiveTab("servicos")} className="text-xs font-bold text-indigo-700">Ver todas</button> : null}>
                    <div className="space-y-3">
                      {activeProducts.length === 0 ? (
                        <MiniEmpty icon={Package} text="Nenhuma demanda ativa no momento." />
                      ) : activeProducts.slice(0, 4).map((p: any) => {
                        const productDocs = docs.filter((d: any) => d.client_product_id === p.id && isPendingDoc(d.status)).length;
                        const latestReport = reports.find((r: any) => r.client_product_id === p.id);
                        return (
                          <button key={p.id} onClick={() => setSelectedProductId(p.id)} className="w-full text-left rounded-xl border border-slate-200/70 bg-white hover:bg-slate-50 hover:border-indigo-200 transition-all p-4 group">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 min-w-0">
                                <span className="size-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><Package className="size-5" /></span>
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 truncate">{p.products?.name || p.custom_product_name || "Solução contratada"}</p>
                                  <p className="text-xs text-slate-500 mt-1 truncate">{latestReport?.notes || `Status: ${statusLabel(p.status)}`}</p>
                                </div>
                              </div>
                              <StatusBadge status={p.status} />
                            </div>
                            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                              <InfoCell label="Prazo" value={p.deadline ? formatDate(p.deadline) : "Em definição"} />
                              <InfoCell label="Pendências" value={productDocs > 0 ? `${productDocs} doc.` : "Em dia"} tone={productDocs > 0 ? "warning" : "success"} />
                              <InfoCell label="Atualizado" value={formatDate(latestReport?.created_at || p.updated_at || p.created_at)} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </PanelCard>

                  <div className="space-y-6">
                    <PanelCard title="Próximo vencimento" eyebrow="Financeiro">
                      {nextDue ? (
                        <div className="rounded-xl bg-amber-50 border border-amber-200/70 p-5">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">{formatDate(nextDue.due_date)}</p>
                          <p className="text-3xl font-bold tabular-nums text-slate-900 mt-2">{formatBRL(nextDue.amount)}</p>
                          <p className="text-sm text-slate-600 mt-2">{overduePayments > 0 ? "Existe pagamento vencido. Regularize para evitar bloqueios." : "Pagamento em aberto para acompanhamento."}</p>
                          <Button onClick={() => setActiveTab("financeiro")} className="mt-4 h-10 rounded-lg bg-slate-900 hover:bg-slate-800 text-white w-full">Ver financeiro</Button>
                        </div>
                      ) : <MiniEmpty icon={CheckCircle2} text="Nenhuma cobrança pendente." />}
                    </PanelCard>

                    <PanelCard title="Atualizações recentes" eyebrow="Linha do tempo">
                      <div className="space-y-4">
                        {latestReports.length === 0 ? <MiniEmpty icon={Activity} text="Ainda não há atualizações registradas." /> : latestReports.map((r: any) => (
                          <div key={r.id} className="flex gap-3">
                            <span className="mt-1 size-2 rounded-full bg-indigo-600 ring-4 ring-indigo-50 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">{r.notes || statusLabel(r.status)}</p>
                              <p className="text-[11px] text-slate-500 mt-1">{formatDate(r.created_at)} · {r.service_providers?.name || "Equipe Prosper"}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </PanelCard>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="servicos" className="animate-fade-up">
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
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

              <TabsContent value="financeiro" className="animate-fade-up space-y-6">
                <SectionHeader title="Financeiro" description="Extrato de cobranças, vencimentos e pagamentos registrados." counters={[formatBRL(openTotal), `${pendingPayments} aberto(s)`]} />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <MetricTile label="Recorrência" value={formatBRL(monthlyTotal)} sub="base contratada" icon={Activity} tone="info" />
                  <MetricTile label="Total pago" value={formatBRL(paidTotal)} sub="histórico" icon={CheckCircle2} tone="success" />
                  <MetricTile label="Em aberto" value={formatBRL(openTotal)} sub={`${pendingPayments} título(s)`} icon={Clock} tone={openTotal > 0 ? "warning" : "success"} />
                  <MetricTile label="Próximo" value={nextDue ? formatDate(nextDue.due_date) : "—"} sub={nextDue ? formatBRL(nextDue.amount) : "sem pendência"} icon={Calendar} tone={nextDue ? "warning" : "success"} />
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
                    <div className="divide-y divide-slate-100">
                      {deliveries.map((d: any) => (
                        <div key={`${d.type}-${d.id}`} className="py-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="size-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><FileText className="size-5" /></span>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">{d.name}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">{formatDate(d.created_at)}</p>
                            </div>
                          </div>
                          <Button variant="outline" size="sm" className="h-9 rounded-lg border-slate-200" onClick={() => downloadDoc(d.file_path || d.file_url, d.name)}><Download className="size-4 mr-2" />Baixar</Button>
                        </div>
                      ))}
                    </div>
                  )}
                </PanelCard>
              </TabsContent>

              <TabsContent value="descobrir" className="animate-fade-up">
                <SectionHeader title="Novas soluções" description="Produtos disponíveis para ampliar sua operação." />
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {catalog.filter((c: any) => !granularProducts.some((p: any) => p.product_id === c.id)).map((p: any) => (
                    <div key={p.id} className="bg-white border border-slate-200/70 rounded-2xl p-6 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all flex flex-col">
                      <div className="flex items-center justify-between gap-3 mb-5">
                        {p.product_categories?.name ? <Badge variant="outline" className="text-[10px] font-bold rounded-lg border-slate-200 text-slate-600">{p.product_categories.name}</Badge> : <span />}
                        {p.recurring && <Badge className="text-[10px] font-bold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-50">Recorrente</Badge>}
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 leading-tight">{p.name}</h3>
                      <p className="text-sm text-slate-600 mt-2 line-clamp-3 flex-1">{p.description}</p>
                      <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Investimento</p>
                          <p className="text-lg font-bold tabular-nums text-slate-900">{formatBRL(p.base_price)}{p.recurring && <span className="text-[10px] text-slate-500 font-normal">/mês</span>}</p>
                        </div>
                        <Button className="h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => window.open(wa(`Tenho interesse em ${p.name}`), "_blank")}>Tenho interesse</Button>
                      </div>
                    </div>
                  ))}
                  {catalog.filter((c: any) => !granularProducts.some((p: any) => p.product_id === c.id)).length === 0 && <div className="md:col-span-2 xl:col-span-3"><EmptyState icon={Sparkles} title="Tudo liberado" description="Você já tem acesso a todas as soluções disponíveis no catálogo." /></div>}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
