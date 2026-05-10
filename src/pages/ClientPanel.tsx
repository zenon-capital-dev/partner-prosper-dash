import { useRef, useState, useMemo } from "react";
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
  ChevronLeft, Sparkles, MessageSquare, Zap
} from "lucide-react";
import { formatBRL, formatDate, initials } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NpsCard } from "@/components/nps/NpsCard";
import { ClientDocumentsTab } from "@/components/client/ClientDocumentsTab";
import { ClientContractsTab } from "@/components/client/ClientContractsTab";
import { ClientProductSteps } from "@/components/clients/tabs/ClientProductSteps";
import { PageHero } from "@/components/PageHero";

export default function ClientPanel() {
  const { user } = useAuth();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["client-panel", user?.id],
    queryFn: async () => {
      const { data: client } = await supabase
        .from("clients")
        .select("id, full_name, email, phone, company, status, created_at, onboarding_status, onboarding_progress")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!client) return null;

      const [docs, catalog, requests, contracts, payments, granularProducts] = await Promise.all([
        supabase.from("documents").select("*, products(name)").eq("client_id", client.id).order("created_at", { ascending: false }),
        supabase.from("products").select("id, name, description, base_price, recurring, product_categories(name, color)").eq("active", true),
        supabase.from("document_requests").select("*").eq("client_id", client.id).order("requested_at", { ascending: false }),
        supabase.from("contracts").select("id, name, status, amount, signed_at, sent_at, file_path, created_at, products(name)").eq("client_id", client.id).order("created_at", { ascending: false }),
        supabase.from("payments").select("id, amount, due_date, status, paid_at, payment_method, installment_number, installments_count").eq("client_id", client.id).order("due_date", { ascending: false }),
        supabase.from("client_products").select("*, products(name, description)").eq("client_id", client.id).order("created_at", { ascending: false }),
      ]);

      return {
        client,
        docs: docs.data ?? [],
        catalog: catalog.data ?? [],
        requests: requests.data ?? [],
        contracts: contracts.data ?? [],
        payments: payments.data ?? [],
        granularProducts: granularProducts.data ?? [],
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

  const { client, docs, catalog, requests, contracts, payments, granularProducts } = data;
  const activeProducts = granularProducts.filter((p: any) => p.status !== 'cancelado' && p.status !== 'finalizado');
  const monthlyTotal = granularProducts.reduce((sum: number, p: any) => sum + Number(p.value || 0), 0);
  const pendingDocs = docs.filter((d: any) => d.status === "solicitado" || d.status === "reprovado" || d.status === "pendente_correcao").length;
  const selectedProduct = granularProducts.find((p: any) => p.id === selectedProductId);

  return (
    <div className="bg-premium min-h-screen dark:bg-[#020617]">
      <div className="page-shell space-y-12 py-12">
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
               eyebrow="Solution"
               category={selectedProduct.products?.name}
               title={selectedProduct.products?.name}
               description={selectedProduct.products?.description || "Acompanhe o progresso e as entregas desta demanda em tempo real."}
               icon={<Package className="size-6" />}
               actions={
                 <div className="flex gap-2">
                   <Button variant="outline" className="rounded-xl h-11 border-border/40">
                     <MessageSquare className="size-4 mr-2" /> Falar com Equipe
                   </Button>
                   <Button className="btn-premium h-11 rounded-xl">
                     Baixar Relatórios
                   </Button>
                 </div>
               }
               kpis={[
                 { label: "Status", value: selectedProduct.status?.replace(/_/g, ' '), tone: "info", icon: <Activity className="size-4" /> },
                 { label: "Início", value: formatDate(selectedProduct.created_at), tone: "default", icon: <Calendar className="size-4" /> },
                 { label: "Prazo Estimado", value: selectedProduct.deadline ? formatDate(selectedProduct.deadline) : "Em definição", tone: "warning", icon: <Clock className="size-4" /> },
                 { label: "Progresso", value: "Acompanhe abaixo", tone: "primary", icon: <Zap className="size-4" /> },
               ]}
             />

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className="lg:col-span-2 space-y-8">
                  <div className="vx-card p-10 bg-white dark:bg-card border-slate-100 dark:border-white/5 rounded-[40px]">
                    <h3 className="font-editorial text-2xl font-bold mb-8">Fluxo de Execução</h3>
                    <ClientProductSteps clientProductId={selectedProduct.id} showDetails={true} />
                  </div>

                  {/* Custom Fields if any */}
                  {selectedProduct.custom_fields && Object.keys(selectedProduct.custom_fields).length > 0 && (
                    <div className="vx-card p-10 bg-white dark:bg-card border-slate-100 dark:border-white/5 rounded-[40px]">
                      <h3 className="font-editorial text-2xl font-bold mb-8">Dados do Processo</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {Object.entries(selectedProduct.custom_fields).map(([key, val]: [string, any]) => (
                          <div key={key} className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{key.replace(/_/g, ' ')}</p>
                            <p className="font-bold text-slate-900 dark:text-white">{String(val)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
               </div>

               <div className="space-y-8">
                  <div className="vx-card p-8 bg-slate-900 text-white rounded-[40px] space-y-6 relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Clock className="size-20" /></div>
                    <h3 className="font-editorial text-xl font-bold">Histórico & Updates</h3>
                    <div className="space-y-6 relative">
                       {[
                         { date: new Date().toISOString(), text: "Análise técnica em andamento pelo prestador." },
                         { date: selectedProduct.created_at, text: "Demanda iniciada e checklist gerado automaticamente." }
                       ].map((h, i) => (
                         <div key={i} className="flex gap-4 group">
                           <div className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                           <div className="space-y-1">
                             <p className="text-xs font-medium text-white/90">{h.text}</p>
                             <p className="text-[10px] font-bold text-white/30 uppercase">{formatDate(h.date)}</p>
                           </div>
                         </div>
                       ))}
                    </div>
                  </div>

                  <div className="vx-card p-8 bg-white dark:bg-card border-slate-100 dark:border-white/5 rounded-[40px] space-y-6">
                    <h3 className="font-editorial text-xl font-bold">Documentos da Demanda</h3>
                    <div className="space-y-3">
                       {docs.filter((d: any) => d.client_product_id === selectedProductId).map((d: any) => (
                         <div key={d.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 group hover:border-primary/20 transition-all">
                            <div className="flex items-center gap-3 min-w-0">
                               <FileText className="size-4 text-primary shrink-0" />
                               <p className="text-xs font-bold truncate">{d.name}</p>
                            </div>
                            {d.file_path ? <CheckCircle2 className="size-4 text-emerald-500" /> : <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary" />}
                         </div>
                       ))}
                       {docs.filter((d: any) => d.client_product_id === selectedProductId).length === 0 && (
                         <p className="text-xs text-muted-foreground italic text-center py-4">Sem documentos específicos.</p>
                       )}
                    </div>
                    <Button 
                      className="w-full rounded-2xl h-12 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white border border-slate-100 dark:border-white/10 hover:bg-primary hover:text-white"
                      onClick={() => {
                        const tab = document.querySelector('[data-value="checklist"]') as HTMLElement;
                        tab?.click();
                        setSelectedProductId(null);
                      }}
                    >
                       Central de Documentos
                    </Button>
                  </div>
               </div>
             </div>
          </div>
        ) : (
          /* MAIN HOME VIEW */
          <>
            {/* Header Section */}
            <section className="relative overflow-hidden rounded-[40px] bg-white dark:bg-card p-10 lg:p-16 border border-slate-100 dark:border-white/5 shadow-sm group">
              <div className="absolute top-0 right-0 size-[500px] bg-primary/5 blur-[120px] -mr-64 -mt-64 rounded-full transition-all group-hover:bg-primary/10" />
              
              <div className="flex flex-col lg:flex-row lg:items-center gap-12 relative">
                 <div className="relative group">
                    <div className="size-28 lg:size-32 rounded-[32px] bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center font-editorial text-4xl shadow-2xl ring-8 ring-slate-50 dark:ring-white/5 transition-transform duration-500 group-hover:scale-105">
                       {initials(client.full_name)}
                    </div>
                    <div className="absolute -bottom-2 -right-2 size-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg border-4 border-white dark:border-slate-900">
                       <CheckCircle2 className="size-5" />
                    </div>
                 </div>
                 
                 <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-4">
                       <span className="h-px w-12 bg-primary/30" />
                       <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-primary/60 dark:text-primary/80">Private Client Portal</span>
                    </div>
                    <h1 className="font-editorial text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 dark:text-white leading-[0.95]">
                       Bem-vindo, <br/><span className="text-primary italic">{client.full_name.split(' ')[0]}</span>.
                    </h1>
                    <div className="flex flex-wrap items-center gap-8 text-[13px] text-muted-foreground font-medium pt-4">
                       <span className="flex items-center gap-2.5 hover:text-primary transition-colors cursor-default font-bold uppercase tracking-widest text-[10px] opacity-60"><Mail className="size-3.5" /> {client.email}</span>
                       {client.phone && <span className="flex items-center gap-2.5 hover:text-primary transition-colors cursor-default font-bold uppercase tracking-widest text-[10px] opacity-60"><Phone className="size-3.5" /> {client.phone}</span>}
                    </div>
                 </div>

                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-12 lg:pl-16 lg:border-l border-slate-100 dark:border-white/5">
                    <PremiumStat label="Serviços" value={String(activeProducts.length)} />
                    <PremiumStat label="Faturamento" value={formatBRL(monthlyTotal)} sub="Total" />
                    <PremiumStat label="Pendências" value={String(pendingDocs)} tone={pendingDocs > 0 ? "warning" : "success"} />
                 </div>
              </div>
            </section>

        {/* Navigation Tabs */}
        <Tabs defaultValue="checklist" className="space-y-10">
          <TabsList className="bg-transparent h-auto p-0 flex-wrap gap-x-12 gap-y-4 justify-start border-b border-slate-200 w-full rounded-none pb-px">
            <PremiumTabTrigger value="checklist" label="Documentos Pendentes" icon={ListChecks} count={pendingDocs} />
            <PremiumTabTrigger value="servicos" label="Soluções Contratadas" icon={Package} />
            <PremiumTabTrigger value="financeiro" label="Faturamento" icon={Receipt} />
            <PremiumTabTrigger value="contratos" label="Contratos" icon={FileSignature} />
            <PremiumTabTrigger value="docs" label="Biblioteca" icon={FileText} />
            <PremiumTabTrigger value="descobrir" label="Descobrir" icon={ShoppingBag} />
          </TabsList>

          <TabsContent value="servicos" className="animate-fade-up">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {granularProducts.map((p: any) => (
                <div key={p.id} className="vx-card p-8 bg-white dark:bg-card border-slate-100 dark:border-white/5 hover:border-primary/20 hover:shadow-xl transition-all duration-500 rounded-[32px] group/item">
                  <div className="flex justify-between items-start mb-8">
                    <div className="size-14 rounded-2xl bg-primary/5 dark:bg-primary/10 flex items-center justify-center text-primary transition-transform group-hover/item:scale-110">
                       <Package className="size-7" />
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <h3 className="font-editorial text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                    {p.products?.name}
                  </h3>
                  <p className="text-[14px] text-muted-foreground mt-3 line-clamp-2 min-h-[42px] leading-relaxed">
                    {p.products?.description || "Consultoria técnica e estratégica para o crescimento do seu negócio."}
                  </p>
                  
                  <div className="mt-8 pt-6 border-t border-slate-50 dark:border-white/5">
                     <div className="flex items-center justify-between mb-6">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Progresso da Entrega</span>
                        <span className="text-[10px] font-bold text-primary">Operacional</span>
                     </div>
                     <ClientProductSteps clientProductId={p.id} />
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="checklist" className="animate-fade-up">
            <ClientDocumentsTab clientId={client.id} requests={docs as any} products={catalog as any} />
          </TabsContent>

          <TabsContent value="descobrir" className="animate-fade-up">
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {catalog.filter((c: any) => !granularProducts.some((p: any) => p.product_id === c.id)).map((p: any) => (
                  <div key={p.id} className="vx-card p-8 bg-slate-50 dark:bg-white/[0.02] border-slate-100 dark:border-white/5 hover:bg-white transition-all rounded-[32px] border-dashed border-2">
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
             <div className="vx-card bg-white dark:bg-card rounded-[32px] overflow-hidden border-slate-100 dark:border-white/5">
                <div className="p-8 border-b border-slate-50 dark:border-white/5 bg-slate-50/30 dark:bg-white/5">
                   <h3 className="font-editorial text-2xl font-bold text-slate-900 dark:text-white">Repositório de Arquivos</h3>
                </div>
                <div className="divide-y divide-slate-50 dark:divide-white/5">
                   {docs.map((d: any) => (
                     <div key={d.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
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
             <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 vx-card bg-white dark:bg-card rounded-[32px] overflow-hidden border-slate-100 dark:border-white/5">
                   <div className="p-8 border-b border-slate-50 dark:border-white/5 flex items-center justify-between">
                      <h3 className="font-editorial text-2xl font-bold text-slate-900 dark:text-white">Extrato de Pagamentos</h3>
                   </div>
                   <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                         <thead>
                            <tr className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground bg-slate-50/50 dark:bg-white/5">
                               <th className="px-8 py-5 text-left">Vencimento</th>
                               <th className="px-8 py-5 text-left">Status</th>
                               <th className="px-8 py-5 text-right">Valor</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                            {payments.map((p: any) => (
                              <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-white/10 transition-colors">
                                 <td className="px-8 py-6 font-bold text-slate-700 dark:text-slate-300">{formatDate(p.due_date)}</td>
                                 <td className="px-8 py-6">
                                    <span className={cn(
                                      "vx-pill uppercase tracking-widest text-[9px] px-3 py-1",
                                      p.status === 'pago' ? "vx-pill-success" : "vx-pill-warning"
                                    )}>{p.status}</span>
                                 </td>
                                 <td className="px-8 py-6 text-right font-bold tabular-nums text-slate-900 dark:text-white text-lg">{formatBRL(p.amount)}</td>
                              </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>
                <div className="vx-card p-10 bg-slate-900 text-white rounded-[40px] space-y-8 relative overflow-hidden shadow-2xl">
                   <div className="absolute top-0 right-0 size-32 bg-primary/20 blur-3xl -mt-16 -mr-16 rounded-full" />
                   <Receipt className="size-12 text-primary relative" />
                   <div className="space-y-4 relative">
                      <h3 className="font-editorial text-3xl font-bold leading-tight">Configurações de <br/>Faturamento</h3>
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
           "font-editorial text-4xl font-bold tracking-tighter",
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