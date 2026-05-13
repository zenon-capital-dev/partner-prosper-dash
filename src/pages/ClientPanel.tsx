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
import { NpsCard } from "@/components/nps/NpsCard";
import { ClientDocumentsTab } from "@/components/client/ClientDocumentsTab";
import { ClientContractsTab } from "@/components/client/ClientContractsTab";
import { ClientProductSteps } from "@/components/clients/tabs/ClientProductSteps";
import { PageHero } from "@/components/PageHero";
import { ProsperLogo } from "@/components/VendxLogo";
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

export default function ClientPanel() {
  const { user, signOut } = useAuth();
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const activeTab = tabParam && CLIENT_PATH_TO_TAB[tabParam] ? CLIENT_PATH_TO_TAB[tabParam] : "home";
  const setActiveTab = (v: string) => navigate(v === "home" ? "/cliente" : `/cliente/${CLIENT_TAB_TO_PATH[v] || v}`);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["client-panel", user?.id],
    queryFn: async () => {
      const { data: client } = await supabase
        .from("clients")
        .select(`
          id, full_name, email, phone, company, status, created_at, onboarding_status, onboarding_progress,
          companies(id, name, trade_name)
        `)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!client) return null;

      const [docs, catalog, requests, contracts, payments, granularProducts, reports, formalDeliveries] = await Promise.all([
        supabase.from("documents").select("*, products(name)").eq("client_id", client.id).order("created_at", { ascending: false }),
        supabase.from("products").select("id, name, description, base_price, recurring, product_categories(name, color)").eq("active", true),
        supabase.from("document_requests").select("*").eq("client_id", client.id).order("requested_at", { ascending: false }),
        supabase.from("contracts").select("id, name, status, amount, signed_at, sent_at, file_path, created_at, products(name)").eq("client_id", client.id).order("created_at", { ascending: false }),
        supabase.from("payments").select("id, amount, due_date, status, paid_at, payment_method, installment_number, installments_count").eq("client_id", client.id).order("due_date", { ascending: false }),
        supabase.from("client_products").select("*, products(name, description), companies(id, name, trade_name)").eq("client_id", client.id).order("created_at", { ascending: false }),
        supabase.from("client_product_status_reports").select("*, service_providers(name)").in("client_product_id", (await supabase.from("client_products").select("id").eq("client_id", client.id)).data?.map(p => p.id) || []).order("created_at", { ascending: false }),
        supabase.from("demand_deliveries").select("*, client_products(id, products(name))").in("client_product_id", (await supabase.from("client_products").select("id").eq("client_id", client.id)).data?.map(p => p.id) || []).order("created_at", { ascending: false }),
      ]);

      return {
        client,
        docs: docs.data ?? [],
        catalog: catalog.data ?? [],
        requests: requests.data ?? [],
        contracts: contracts.data ?? [],
        payments: payments.data ?? [],
        granularProducts: granularProducts.data ?? [],
        reports: reports.data ?? [],
        formalDeliveries: formalDeliveries.data ?? [],
      };
    },
    enabled: !!user,
  });

  if (isLoading) return <div className="p-20 text-center animate-pulse"><Loader2 className="size-8 animate-spin mx-auto text-primary/20" /></div>;
  
  if (!data) return (
    <div className="min-h-[70vh] flex items-center justify-center p-8 bg-premium">
      <div className="vx-card p-12 max-w-lg text-center shadow-2xl bg-white/40 backdrop-blur-xl border-white/20">
        <Inbox className="size-12 text-primary/30 mx-auto mb-6" />
        <h2 className="font-editorial text-3xl font-bold tracking-tight mb-3">Sua experiência está sendo preparada</h2>
        <p className="text-muted-foreground leading-relaxed">
          Nossa equipe está configurando seu acesso personalizado. <br/>Em breve você terá acesso a todo o seu ecossistema.
        </p>
      </div>
    </div>
  );

  const { client, docs, catalog, requests, contracts, payments, granularProducts, reports, formalDeliveries } = data;
  const activeProducts = granularProducts.filter((p: any) => p.status !== 'cancelado' && p.status !== 'finalizado');
  const monthlyTotal = granularProducts.reduce((sum: number, p: any) => sum + Number(p.value || 0), 0);
  const pendingDocs = docs.filter((d: any) => ["solicitado", "reprovado", "pendente_correcao"].includes(d.status)).length;
  const pendingPayments = payments.filter((p: any) => p.status !== 'pago').length;
  const pendingContracts = contracts.filter((c: any) => c.status !== 'assinado').length;
  const deliveries = [
    ...docs.filter((d: any) => d.status === 'aprovado' || d.status === 'concluido').map(d => ({ ...d, type: 'document' })),
    ...formalDeliveries.map((d: any) => ({ ...d, name: d.title, type: 'delivery' }))
  ].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  const selectedProduct = granularProducts.find((p: any) => p.id === selectedProductId);

  return (
    <div className="bg-slate-50 min-h-screen text-slate-900">
      {/* ─── Sticky Top Bar ─── */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="page-shell flex items-center justify-between h-14 sm:h-16 px-4 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <ProsperLogo size={28} />
            <div className="min-w-0">
              <p className="font-semibold text-[14px] tracking-tight leading-none text-slate-900">Prosper</p>
              <p className="hidden sm:block text-[11px] text-slate-500 mt-0.5">Portal do Cliente</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-9 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              onClick={() => toast.info("Notificações em breve")}
              aria-label="Notificações"
            >
              <Bell className="size-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 pl-1 pr-2 sm:pr-3 h-9 rounded-md border border-slate-200 hover:bg-slate-50 transition-colors active:scale-[0.98]">
                  <span className="size-7 rounded-md bg-indigo-600 text-white flex items-center justify-center text-[11px] font-semibold shrink-0">
                    {initials(client.full_name)}
                  </span>
                  <span className="hidden sm:inline text-[13px] font-medium text-slate-700 max-w-[140px] truncate">{client.full_name?.split(" ")[0]}</span>
                  <ChevronRight className="size-3.5 text-slate-400 rotate-90" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-bold leading-none truncate">{client.full_name}</p>
                    <p className="text-[11px] text-muted-foreground leading-none truncate">{client.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setActiveTab("home")} className="gap-2">
                  <LayoutDashboard className="size-4" /> Painel inicial
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.open("https://wa.me/5511999999999", "_blank")} className="gap-2">
                  <MessageSquare className="size-4" /> Falar com a equipe
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => { await signOut(); toast.success("Sessão encerrada"); navigate("/auth", { replace: true }); }}
                  className="gap-2 text-rose-600 focus:text-rose-600"
                >
                  <LogOut className="size-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="page-shell space-y-6 sm:space-y-10 py-5 sm:py-10 px-4 sm:px-6">
        {selectedProductId && selectedProduct ? (
          /* SINGLE PRODUCT VIEW */
          <div className="animate-fade-up space-y-8">
             <Button 
               variant="ghost" 
               onClick={() => setSelectedProductId(null)} 
               className="group text-muted-foreground hover:text-primary transition-colors h-10 px-0"
             >
               <ChevronLeft className="size-4 mr-2 group-hover:-translate-x-1 transition-transform" /> Voltar para o Painel
             </Button>

             <PageHero 
               eyebrow="Solução em Execução"
               category={selectedProduct.products?.name}
               title={selectedProduct.products?.name}
               description={selectedProduct.products?.description || "Acompanhe o progresso e as entregas desta demanda em tempo real."}
               icon={<Package className="size-6" />}
               actions={
                 <div className="flex gap-2">
                   <Button variant="outline" className="rounded-xl h-11 border-border/40" onClick={() => window.open(`https://wa.me/5511999999999`, '_blank')}>
                     <MessageSquare className="size-4 mr-2" /> Falar com Equipe
                   </Button>
                   <Button className="btn-premium h-11 rounded-xl" onClick={() => toast.info("Relatório sendo gerado...")}>
                     Baixar Relatório
                   </Button>
                 </div>
               }
               kpis={[
                 { label: "Status", value: selectedProduct.status?.replace(/_/g, ' '), tone: "info", icon: <Activity className="size-4" /> },
                 { label: "Prazo Estimado", value: selectedProduct.deadline ? formatDate(selectedProduct.deadline) : "Em definição", tone: "warning", icon: <Clock className="size-4" /> },
                 { label: "Documentos", value: `${docs.filter((d: any) => d.client_product_id === selectedProductId && d.file_path).length} enviados`, tone: "success", icon: <FileText className="size-4" /> },
               ]}
             />

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-8">
               <div className="lg:col-span-2 space-y-8">
                  <div className="vx-card p-10 bg-white dark:bg-card border-slate-100 dark:border-white/5 rounded-[40px]">
                    <h3 className="font-editorial text-2xl font-bold mb-8">Checklist de Execução</h3>
                    <ClientProductSteps clientProductId={selectedProduct.id} showDetails={true} />
                  </div>

                  <div className="vx-card p-10 bg-white dark:bg-card border-slate-100 dark:border-white/5 rounded-[40px]">
                    <h3 className="font-editorial text-2xl font-bold mb-8">Documentos da Demanda</h3>
                    <div className="space-y-4">
                       {docs.filter((d: any) => d.client_product_id === selectedProductId).length === 0 ? (
                         <p className="text-sm text-muted-foreground italic">Nenhum documento específico solicitado para esta demanda.</p>
                       ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {docs.filter((d: any) => d.client_product_id === selectedProductId).map((d: any) => (
                             <div key={d.id} className="p-5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 flex items-center justify-between group hover:border-primary/20 transition-all">
                                <div className="flex items-center gap-4 min-w-0">
                                   <div className={cn(
                                     "size-10 rounded-xl flex items-center justify-center shrink-0",
                                     d.file_path ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/5 text-primary"
                                   )}>
                                      <FileText className="size-5" />
                                   </div>
                                   <div className="min-w-0">
                                      <p className="text-sm font-bold truncate">{d.name}</p>
                                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                                         {d.file_path ? "Enviado" : "Pendente"}
                                      </p>
                                   </div>
                                </div>
                                {d.file_path ? (
                                   <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-primary" onClick={() => window.open(d.file_path, '_blank')}>
                                      <Download className="size-4" />
                                   </Button>
                                ) : (
                                   <Button variant="outline" size="sm" className="rounded-xl h-8 text-[10px] font-bold uppercase tracking-widest" onClick={() => toast.info("Funcionalidade de upload na aba Documentos")}>
                                      <Upload className="size-3 mr-1.5" /> Upload
                                   </Button>
                                )}
                             </div>
                           ))}
                         </div>
                       )}
                    </div>
                  </div>
               </div>

               <div className="space-y-8">
                  <div className="bg-white border border-slate-200/70 rounded-2xl shadow-sm p-6 sm:p-8 space-y-5">
                    <h3 className="font-display text-lg font-semibold text-slate-900">Mensagens & Atualizações</h3>
                    <div className="space-y-5">
                       {reports.filter((r: any) => r.client_product_id === selectedProductId).length === 0 ? (
                         <p className="text-sm text-slate-500 leading-relaxed">Nenhuma atualização registrada ainda. Nossa equipe reportará novidades em breve.</p>
                       ) : (
                         reports.filter((r: any) => r.client_product_id === selectedProductId).slice(0, 5).map((r: any) => (
                           <div key={r.id} className="flex gap-3">
                             <div className="size-2 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                             <div className="space-y-1 min-w-0">
                               <p className="text-sm text-slate-700 leading-relaxed">{r.notes}</p>
                               <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                  <span>{formatDate(r.created_at)}</span>
                                  <span>·</span>
                                  <span className="text-indigo-600 font-medium">{r.service_providers?.name?.split(' ')[0] || "Equipe"}</span>
                               </div>
                             </div>
                           </div>
                         ))
                       )}
                    </div>
                  </div>


                  <div className="vx-card p-8 bg-white dark:bg-card border-slate-100 dark:border-white/5 rounded-[40px] space-y-6">
                    <h3 className="font-editorial text-xl font-bold">Histórico de Atividades</h3>
                    <div className="space-y-4">
                       <div className="flex items-start gap-4">
                          <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                             <CheckCircle2 className="size-4" />
                          </div>
                          <div>
                             <p className="text-xs font-bold text-slate-900 dark:text-white">Demanda Criada</p>
                             <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(selectedProduct.created_at)}</p>
                          </div>
                       </div>
                    </div>
                  </div>
               </div>
             </div>
          </div>
        ) : (
          /* MAIN HOME VIEW */
          <>
            {/* ─── Hero (light) ─── */}
            <section className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/70 shadow-sm p-6 sm:p-8 lg:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-8 items-center">
                <div className="space-y-5">
                  <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-[11px] font-medium text-indigo-700">
                    <span className="size-1.5 rounded-full bg-indigo-600" />
                    Sua jornada
                  </span>

                  <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-slate-900 leading-tight">
                    Olá, <span className="text-indigo-600">{client.full_name?.split(" ")[0] || ""}</span>.
                    <span className="block text-slate-500 text-base sm:text-lg lg:text-xl font-normal mt-1.5">
                      Tudo o que importa, num só lugar.
                    </span>
                  </h1>

                  <div className="space-y-2 max-w-md pt-1">
                    <div className="flex items-center justify-between text-[11.5px] font-medium text-slate-500">
                      <span>Progresso do onboarding</span>
                      <span className="text-slate-900 font-semibold tabular-nums">{Math.round(client.onboarding_progress || 0)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-700"
                        style={{ width: `${Math.max(4, Math.round(client.onboarding_progress || 0))}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      onClick={() => setActiveTab("checklist")}
                      className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-medium transition-colors active:scale-[0.99] shadow-sm"
                    >
                      <ListChecks className="size-4" /> Ver pendências
                      {pendingDocs > 0 && (
                        <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded bg-white/20 text-white text-[10.5px] font-semibold tabular-nums">{pendingDocs}</span>
                      )}
                    </button>
                    <button
                      onClick={() => window.open("https://wa.me/5511999999999", "_blank")}
                      className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-slate-200 bg-white text-slate-700 text-[13px] font-medium hover:bg-slate-50 transition-colors active:scale-[0.99]"
                    >
                      <MessageSquare className="size-4" /> Falar com a equipe
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:border-l lg:border-slate-200/70 lg:pl-8">
                  <HeroKpi label="Serviços ativos" value={String(activeProducts.length)} icon={<Package className="size-3.5" />} />
                  <HeroKpi label="Documentos" value={String(pendingDocs)} sub={pendingDocs > 0 ? "pendentes" : "em dia"} tone={pendingDocs > 0 ? "warning" : "success"} icon={<FileText className="size-3.5" />} />
                  <HeroKpi label="Pagamentos" value={String(pendingPayments)} sub={pendingPayments > 0 ? "em aberto" : "quitado"} tone={pendingPayments > 0 ? "warning" : "success"} icon={<Receipt className="size-3.5" />} />
                  <HeroKpi label="Contratos" value={String(pendingContracts)} sub={pendingContracts > 0 ? "p/ assinar" : "assinados"} tone={pendingContracts > 0 ? "warning" : "success"} icon={<FileSignature className="size-3.5" />} />
                </div>
              </div>
            </section>


            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 sm:space-y-10">
              <div className="-mx-4 sm:mx-0 overflow-x-auto scrollbar-hide">
                <TabsList className="bg-transparent h-auto p-0 flex-nowrap sm:flex-wrap gap-x-6 sm:gap-x-12 gap-y-4 justify-start border-b border-slate-200 w-max sm:w-full rounded-none pb-px px-4 sm:px-0">
                  <PremiumTabTrigger value="home" label="Início" icon={LayoutDashboard} />
                  <PremiumTabTrigger value="servicos" label="Meus Produtos" icon={Package} />
                  <PremiumTabTrigger value="checklist" label="Documentos" icon={ListChecks} count={pendingDocs} />
                  <PremiumTabTrigger value="financeiro" label="Pagamentos" icon={Receipt} count={pendingPayments} />
                  <PremiumTabTrigger value="contratos" label="Contratos" icon={FileSignature} count={pendingContracts} />
                  <PremiumTabTrigger value="docs" label="Biblioteca" icon={FileText} />
                  <PremiumTabTrigger value="descobrir" label="Novas Soluções" icon={ShoppingBag} />
                </TabsList>
              </div>

              <TabsContent value="home" className="animate-fade-up space-y-10">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-8">
                  <div className="lg:col-span-2 space-y-8">
                    {/* Próximas Etapas */}
                    <div className="vx-card p-5 sm:p-8 bg-white dark:bg-card border-slate-100 dark:border-white/5 rounded-2xl sm:rounded-[32px] shadow-sm">
                      <h3 className="font-editorial text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Próximas Etapas</h3>
                      <div className="space-y-4">
                        {activeProducts.length === 0 ? (
                          <p className="text-sm text-muted-foreground italic">Nenhuma etapa pendente no momento.</p>
                        ) : (
                          activeProducts.slice(0, 3).map((p: any) => (
                            <div key={p.id} className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                               <div className="flex items-center gap-4">
                                  <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                     <Activity className="size-5" />
                                  </div>
                                  <div>
                                     <p className="font-bold text-slate-900 dark:text-white">{p.products?.name}</p>
                                     <p className="text-xs text-muted-foreground">Etapa: {p.status?.replace(/_/g, ' ')}</p>
                                  </div>
                               </div>
                               <Button variant="ghost" size="sm" className="text-primary font-bold" onClick={() => setSelectedProductId(p.id)}>Ver Detalhes</Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Entregas Recentes */}
                    <div className="vx-card p-5 sm:p-8 bg-white dark:bg-card border-slate-100 dark:border-white/5 rounded-2xl sm:rounded-[32px] shadow-sm">
                      <h3 className="font-editorial text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Entregas Disponíveis</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {deliveries.length === 0 ? (
                          <div className="col-span-full py-8 text-center bg-slate-50 dark:bg-white/5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10">
                            <p className="text-sm text-muted-foreground italic">Suas entregas aparecerão aqui assim que forem concluídas.</p>
                          </div>
                        ) : (
                          deliveries.slice(0, 4).map((d: any) => (
                            <div key={d.id} className="flex items-center justify-between p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20">
                                <div className="flex items-center gap-3 min-w-0">
                                   {d.type === 'document' ? <CheckCircle2 className="size-4 text-emerald-500 shrink-0" /> : <Package className="size-4 text-indigo-500 shrink-0" />}
                                   <div className="min-w-0">
                                      <p className="text-xs font-bold truncate">{d.name}</p>
                                      {d.client_products?.products?.name && <p className="text-[9px] text-muted-foreground truncate">{d.client_products.products.name}</p>}
                                   </div>
                                </div>
                               <Button variant="ghost" size="icon" className="size-8 text-emerald-600" onClick={() => window.open(d.file_path || d.file_url, '_blank')}>
                                  <Download className="size-4" />
                               </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    {/* Ações Necessárias */}
                    <div className="bg-white border border-slate-200/70 rounded-2xl shadow-sm p-5 sm:p-7">
                       <h3 className="font-display text-base sm:text-lg font-semibold mb-4 text-slate-900">Ações Necessárias</h3>
                       <div className="space-y-2">
                          <ActionItem icon={FileText} label="Documentos Pendentes" count={pendingDocs} onClick={() => setActiveTab("checklist")} />
                          <ActionItem icon={Receipt} label="Pagamentos em Aberto" count={pendingPayments} onClick={() => setActiveTab("financeiro")} />
                          <ActionItem icon={FileSignature} label="Contratos para Assinar" count={pendingContracts} onClick={() => setActiveTab("contratos")} />
                       </div>
                    </div>

                    {/* Canal de Suporte */}
                    <div className="bg-white border border-slate-200/70 rounded-2xl shadow-sm p-5 sm:p-7">
                       <h3 className="font-display text-base sm:text-lg font-semibold mb-2 text-slate-900">Suporte & Sucesso</h3>
                       <p className="text-sm text-slate-500 leading-relaxed mb-5">Nosso time de especialistas está à disposição para acelerar sua jornada.</p>
                       <div className="space-y-2.5">
                          <Button className="w-full rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium h-11" onClick={() => window.open('https://wa.me/5511999999999', '_blank')}>
                             <MessageSquare className="size-4 mr-2" /> Iniciar Chat
                          </Button>
                          <Button variant="outline" className="w-full rounded-md h-11 border-slate-200 text-slate-700 hover:bg-slate-50 font-medium" onClick={() => window.location.href = 'mailto:suporte@prosper.com'}>
                             <Mail className="size-4 mr-2" /> Enviar E-mail
                          </Button>
                       </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="servicos" className="animate-fade-up">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                  {granularProducts.map((p: any) => {
                    const productPendingDocs = docs.filter((d: any) => d.client_product_id === p.id && ["solicitado", "reprovado", "pendente_correcao"].includes(d.status)).length;
                    const latestReport = reports.find((r: any) => r.client_product_id === p.id);
                    return (
                      <div 
                        key={p.id} 
                        className="vx-card p-5 sm:p-8 bg-white dark:bg-card border-slate-100 dark:border-white/5 hover:border-primary/20 hover:shadow-xl transition-all duration-500 rounded-2xl sm:rounded-[32px] group/item cursor-pointer flex flex-col h-full"
                        onClick={() => setSelectedProductId(p.id)}
                      >
                        <div className="flex justify-between items-start mb-8">
                          <div className="size-14 rounded-2xl bg-primary/5 dark:bg-primary/10 flex items-center justify-center text-primary transition-transform group-hover/item:scale-110">
                             <Package className="size-7" />
                          </div>
                          <StatusBadge status={p.status} />
                        </div>
                        
                        <h3 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                          {p.products?.name}
                        </h3>
                        <p className="text-[14px] text-muted-foreground mt-3 line-clamp-2 leading-relaxed">
                          {p.products?.description}
                        </p>
                        
                        <div className="mt-auto pt-8 space-y-5">
                           <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                              <div>
                                 <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Última Atualização</p>
                                 <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{latestReport ? formatDate(latestReport.created_at) : formatDate(p.created_at)}</p>
                              </div>
                              <div className="text-right">
                                 <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Prazo Estimado</p>
                                 <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{p.deadline ? formatDate(p.deadline) : "Em definição"}</p>
                              </div>
                              <div>
                                 <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Pendências</p>
                                 <p className={cn("text-xs font-bold", productPendingDocs > 0 ? "text-amber-500" : "text-emerald-500")}>
                                    {productPendingDocs > 0 ? `${productPendingDocs} documentos` : "Tudo em dia"}
                                 </p>
                              </div>
                              <div className="text-right">
                                 <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Início</p>
                                 <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{formatDate(p.created_at)}</p>
                              </div>
                           </div>

                           <div className="pt-6 border-t border-slate-50 dark:border-white/5 flex items-center justify-between group/link">
                              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Ver detalhes da execução</span>
                              <ArrowRight className="size-4 text-primary group-hover/link:translate-x-1 transition-transform" />
                           </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="checklist" className="animate-fade-up">
                <ClientDocumentsTab clientId={client.id} requests={docs as any} products={catalog as any} />
              </TabsContent>

              <TabsContent value="descobrir" className="animate-fade-up">
                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                    {catalog.filter((c: any) => !granularProducts.some((p: any) => p.product_id === c.id)).map((p: any) => (
                      <div key={p.id} className="vx-card p-5 sm:p-8 bg-slate-50 dark:bg-white/[0.02] border-slate-100 dark:border-white/5 hover:bg-white transition-all rounded-2xl sm:rounded-[32px] border-dashed border-2">
                        <h3 className="font-editorial text-2xl font-bold text-slate-800 dark:text-slate-100">{p.name}</h3>
                        <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{p.description}</p>
                        <div className="mt-8 flex items-center justify-between">
                           <p className="text-xl font-bold text-slate-900 dark:text-white">{formatBRL(p.base_price)}</p>
                           <Button className="rounded-xl h-10 px-6 bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-primary hover:text-white transition-all">Saber mais</Button>
                        </div>
                      </div>
                    ))}
                 </div>
              </TabsContent>

              <TabsContent value="docs" className="animate-fade-up">
                 <div className="vx-card bg-white dark:bg-card rounded-2xl sm:rounded-[32px] overflow-hidden border-slate-100 dark:border-white/5">
                    <div className="p-5 sm:p-8 border-b border-slate-50 dark:border-white/5 bg-slate-50/30 dark:bg-white/5">
                       <h3 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Repositório de Arquivos</h3>
                    </div>
                    <div className="divide-y divide-slate-50 dark:divide-white/5">
                       {docs.map((d: any) => (
                         <div key={d.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-5">
                               <div className="size-12 rounded-[18px] bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400">
                                  <FileText className="size-6" />
                               </div>
                               <div>
                                  <p className="font-bold text-slate-900 dark:text-white">{d.name}</p>
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1 opacity-60">Enviado em {formatDate(d.created_at)}</p>
                               </div>
                            </div>
                            <Button variant="outline" size="sm" className="rounded-xl gap-2 h-10 border-slate-200 dark:border-white/10 hover:bg-primary hover:text-white transition-all">
                               <Download className="size-4" /> Download
                            </Button>
                         </div>
                       ))}
                       {docs.length === 0 && <p className="p-16 text-center font-editorial italic text-muted-foreground">Sua biblioteca de documentos está vazia.</p>}
                    </div>
                 </div>
              </TabsContent>

              <TabsContent value="financeiro" className="animate-fade-up">
                 <div className="grid lg:grid-cols-3 gap-5 sm:gap-8">
                    <div className="lg:col-span-2 vx-card bg-white dark:bg-card rounded-2xl sm:rounded-[32px] overflow-hidden border-slate-100 dark:border-white/5">
                       <div className="p-5 sm:p-8 border-b border-slate-50 dark:border-white/5 flex items-center justify-between">
                          <h3 className="font-editorial text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Extrato de Pagamentos</h3>
                       </div>
                       <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                             <thead>
                                <tr className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground bg-slate-50/50 dark:bg-white/5">
                                   <th className="px-4 sm:px-8 py-4 sm:py-5 text-left">Vencimento</th>
                                   <th className="px-4 sm:px-8 py-4 sm:py-5 text-left">Status</th>
                                   <th className="px-4 sm:px-8 py-4 sm:py-5 text-right">Valor</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                                {payments.map((p: any) => (
                                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-white/10 transition-colors">
                                     <td className="px-4 sm:px-8 py-4 sm:py-6 font-bold text-slate-700 dark:text-slate-300">{formatDate(p.due_date)}</td>
                                     <td className="px-4 sm:px-8 py-4 sm:py-6">
                                        <span className={cn(
                                          "vx-pill uppercase tracking-widest text-[9px] px-3 py-1",
                                          p.status === 'pago' ? "vx-pill-success" : "vx-pill-warning"
                                        )}>{p.status}</span>
                                     </td>
                                     <td className="px-4 sm:px-8 py-4 sm:py-6 text-right font-bold tabular-nums text-slate-900 dark:text-white text-lg">{formatBRL(p.amount)}</td>
                                  </tr>
                                ))}
                             </tbody>
                          </table>
                       </div>
                    </div>
                    <div className="vx-card p-10 bg-slate-900 text-white rounded-[40px] space-y-5 sm:space-y-8 relative overflow-hidden shadow-2xl">
                       <div className="absolute top-0 right-0 size-32 bg-primary/20 blur-3xl -mt-16 -mr-16 rounded-full" />
                       <Receipt className="size-12 text-primary relative" />
                       <div className="space-y-4 relative">
                          <h3 className="font-editorial text-2xl sm:text-3xl font-bold leading-tight">Configurações de <br/>Faturamento</h3>
                          <p className="text-sm text-white/50 leading-relaxed font-medium">Precisa ajustar ciclos, métodos ou dados fiscais? Nossa equipe financeira está disponível para suporte.</p>
                       </div>
                       <Button className="w-full rounded-[20px] bg-white text-slate-900 hover:bg-primary hover:text-white transition-all h-14 font-bold text-base shadow-xl">Solicitar Ajuste</Button>
                    </div>
                 </div>
              </TabsContent>

              <TabsContent value="contratos" className="animate-fade-up">
                <ClientContractsTab clientId={client.id} contracts={contracts as any} />
              </TabsContent>
            </Tabs>

            {/* NPS — pesquisa de satisfação */}
            <section className="max-w-2xl mx-auto w-full pt-12">
              <NpsCard clientId={client.id} />
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function HeroKpi({ label, value, sub, icon, tone = "default" }: { label: string; value: string; sub?: string; icon?: React.ReactNode; tone?: "default" | "success" | "warning" }) {
  const accent = tone === "warning" ? "text-amber-600" : tone === "success" ? "text-emerald-600" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200/70 bg-slate-50/70 p-3 sm:p-4 hover:bg-slate-50 transition-colors min-w-0">
      <div className="flex items-center justify-between mb-1.5 text-slate-500">
        <span className="text-[10px] sm:text-[10.5px] font-medium uppercase tracking-wide truncate">{label}</span>
        {icon && <span className="shrink-0 opacity-70">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("font-display text-xl sm:text-2xl font-semibold tabular-nums leading-none", accent)}>{value}</span>
        {sub && <span className="text-[10px] sm:text-[10.5px] font-medium uppercase tracking-wide text-slate-400 truncate">{sub}</span>}
      </div>
    </div>
  );
}

function PremiumStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "success" | "warning" | "default" }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">{label}</p>
      <div className="flex items-baseline gap-2">
         <span className={cn(
           "font-editorial text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tighter",
           tone === "success" ? "text-emerald-500" : tone === "warning" ? "text-amber-500" : "text-slate-900 dark:text-white"
         )}>{value}</span>
         {sub && <span className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest opacity-40">{sub}</span>}
      </div>
    </div>
  );
}

function PremiumTabTrigger({ value, label, icon: Icon, count }: { value: string; label: string; icon: any; count?: number }) {
  return (
    <TabsTrigger 
      value={value} 
      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-none rounded-none p-0 pb-6 text-[13px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40 transition-all relative group h-auto"
    >
      <div className="flex items-center gap-3">
        <Icon className="size-4 opacity-40 group-data-[state=active]:opacity-100 transition-opacity" />
        {label}
        {count !== undefined && <span className="ml-1 text-[10px] tabular-nums font-bold opacity-30 group-data-[state=active]:opacity-100 group-data-[state=active]:text-primary/60">({count})</span>}
      </div>
      <div className="absolute bottom-0 left-0 w-full h-1 bg-primary scale-x-0 data-[state=active]:scale-x-100 transition-transform origin-left rounded-full" />
    </TabsTrigger>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: any = {
    aguardando_documentos: { label: "PENDENTE DOCS", className: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
    em_analise: { label: "EM ANÁLISE", className: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
    aguardando_cliente: { label: "AGUARDANDO VOCÊ", className: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
    em_andamento: { label: "EM ANDAMENTO", className: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20" },
    pendente_correcao: { label: "AJUSTE NECESSÁRIO", className: "bg-rose-500/10 text-rose-700 border-rose-500/20" },
    concluido: { label: "CONCLUÍDO", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    aguardando_inicio: { label: "AGUARDANDO", className: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-white/40" },
    ativo: { label: "ATIVO", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  };
  const cfg = map[status] || { label: (status || "—").toUpperCase(), className: "bg-slate-100 text-slate-600 border-slate-200" };
  return (
    <Badge variant="outline" className={cn("text-[9px] font-bold tracking-widest border px-2 py-0.5 rounded-lg", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

function ActionItem({ icon: Icon, label, count, onClick }: { icon: any; label: string; count: number; onClick: () => void }) {
  return (
    <div 
      className={cn(
        "flex items-center justify-between p-4 rounded-2xl transition-all cursor-pointer",
        count > 0 ? "bg-white/10 border border-white/10 hover:bg-white/15" : "opacity-40 grayscale pointer-events-none"
      )}
      onClick={onClick}
    >
       <div className="flex items-center gap-3">
          <Icon className="size-4 text-primary" />
          <span className="text-[13px] font-bold">{label}</span>
       </div>
       {count > 0 && (
         <div className="size-6 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">
            {count}
         </div>
       )}
    </div>
  );
}
