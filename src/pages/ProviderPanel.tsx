import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Briefcase, FileText, ClipboardCheck, Inbox, 
  Download, ArrowRight, CheckCircle2, Clock, 
  Search, Filter, ListChecks, MessageSquare,
  ShieldCheck, LayoutDashboard, ChevronLeft,
  X, AlertCircle, Loader2
} from "lucide-react";
import { formatDate, formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ReportStatusDialog } from "@/components/provider/ReportStatusDialog";
import { ClientProductSteps } from "@/components/clients/tabs/ClientProductSteps";
import { Input } from "@/components/ui/input";

export default function ProviderPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reportTarget, setReportTarget] = useState<{ id: string; productName?: string; clientName?: string } | null>(null);
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const { data: provider } = useQuery({
    queryKey: ["provider-self", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      let { data } = await supabase
        .from("service_providers")
        .select("id, name, specialty, email, user_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      
      if (!data && user?.email) {
        const { data: byEmail } = await supabase
          .from("service_providers")
          .select("id, name, specialty, email, user_id")
          .ilike("email", user.email)
          .maybeSingle();
        data = byEmail;
      }
      return data;
    },
  });

  const providerId = provider?.id;

  const { data: clientProducts = [], isLoading } = useQuery({
    queryKey: ["provider-client-products", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_products")
        .select(`
          id, status, value, deadline, created_at, notes, priority,
          sla_due_date, sla_status,
          clients(id, full_name, email, phone, company),
          products(name, description)
        `)
        .eq("service_provider_id", providerId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filteredProducts = useMemo(() => {
    return clientProducts.filter((cp: any) => 
      cp.clients?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      cp.products?.name?.toLowerCase().includes(search.toLowerCase()) ||
      cp.clients?.company?.toLowerCase().includes(search.toLowerCase())
    );
  }, [clientProducts, search]);

  const clientProductIds = useMemo(() => clientProducts.map((cp: any) => cp.id), [clientProducts]);

  const { data: documents = [] } = useQuery({
    queryKey: ["provider-documents", clientProductIds],
    enabled: clientProductIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("id, name, status, file_path, created_at, client_id, client_product_id, clients(full_name)")
        .in("client_product_id", clientProductIds)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["status-reports", clientProductIds],
    enabled: clientProductIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_product_status_reports")
        .select("id, status, notes, created_at, client_product_id")
        .in("client_product_id", clientProductIds)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["provider-contracts", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("contracts")
        .select("id, name, status, file_path, amount, created_at, signed_at, sent_at, contract_type, expires_at")
        .eq("provider_id", providerId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const now = new Date();
    const total = clientProducts.length;
    const active = clientProducts.filter((c: any) => c.status !== "concluido" && c.status !== "cancelado").length;
    const urgent = clientProducts.filter((c: any) => (c.priority === "alta" || c.priority === "urgente") && c.status !== "concluido").length;
    const delayed = clientProducts.filter((c: any) => {
      if (c.status === "concluido") return false;
      const deadline = c.deadline ? new Date(c.deadline) : null;
      const sla = c.sla_due_date ? new Date(c.sla_due_date) : null;
      return (deadline && deadline < now) || (sla && sla < now);
    }).length;
    
    const docsAwaiting = documents.filter((d: any) => d.status === "enviado" || d.status === "em_analise").length;
    const pendingReports = active; // Simplificação: toda demanda ativa precisa de reporte
    
    const valuesToReceive = clientProducts
      .filter((c: any) => c.status !== "cancelado")
      .reduce((acc: number, curr: any) => acc + (Number(curr.value) || 0), 0);

    const nextDeadlines = clientProducts
      .filter((c: any) => c.status !== "concluido" && c.deadline)
      .sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 3);

    return { total, active, urgent, delayed, docsAwaiting, pendingReports, valuesToReceive, nextDeadlines };
  }, [clientProducts, documents]);

  async function handleDownload(filePath: string, name: string) {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(filePath, 3600);
    if (error || !data) return;
    window.open(data.signedUrl, "_blank");
  }

  if (!provider) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-8 bg-premium">
        <div className="vx-card p-12 max-w-lg text-center shadow-2xl bg-white/40 backdrop-blur-xl border-white/20">
          <Inbox className="size-12 text-primary/30 mx-auto mb-6" />
          <h2 className="font-editorial text-3xl font-bold tracking-tight mb-3">Acesso pendente</h2>
          <p className="text-muted-foreground leading-relaxed">
            Sua conta ainda não foi vinculada a um cadastro de prestador. <br/>Entre em contato com o administrador para liberação.
          </p>
        </div>
      </div>
    );
  }

  const selectedProduct = clientProducts.find((cp: any) => cp.id === selectedProductId);

  return (
    <div className="bg-premium min-h-screen dark:bg-[#020617]">
      <div className="page-shell space-y-10 py-10">
        
        {/* Header & Stats Strip */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-white dark:bg-card p-8 rounded-[32px] border border-slate-100 dark:border-white/5 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 size-64 bg-primary/5 blur-3xl -mr-32 -mt-32 rounded-full transition-colors group-hover:bg-primary/10" />
          
          <div className="relative space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="h-px w-8 bg-primary/40" />
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Service Provider Console</p>
            </div>
            <h1 className="font-editorial text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
              Olá, <span className="text-primary italic">{provider.name.split(' ')[0]}</span>.
            </h1>
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-primary/40" /> {provider.specialty || "Prestador Especialista"}
            </p>
          </div>

          <div className="flex flex-wrap gap-8 lg:gap-12 relative">
            <StatItem label="Ativos" value={String(stats.emAndamento)} />
            <StatItem label="Pendentes" value={String(stats.pendentes)} tone="warning" />
            <StatItem label="Concluídos" value={String(stats.concluidos)} tone="success" />
          </div>
        </div>

        {selectedProductId ? (
          /* PRODUCT DETAIL VIEW */
          <div className="animate-fade-up space-y-6">
            <Button 
              variant="ghost" 
              onClick={() => setSelectedProductId(null)} 
              className="group text-muted-foreground hover:text-primary transition-colors"
            >
              <ChevronLeft className="size-4 mr-2 group-hover:-translate-x-1 transition-transform" /> Voltar para lista
            </Button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="vx-card p-8 bg-white dark:bg-card border-slate-100 dark:border-white/5 rounded-[32px]">
                   <div className="flex items-start justify-between mb-8">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-primary">Atendimento em Curso</p>
                        <h2 className="font-editorial text-3xl font-bold text-slate-900 dark:text-white">
                           {selectedProduct.clients?.full_name}
                        </h2>
                        <div className="flex items-center gap-3 pt-2">
                           <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 font-bold tracking-widest text-[10px] uppercase">
                             {selectedProduct.products?.name}
                           </Badge>
                           <StatusBadge status={selectedProduct.status} />
                        </div>
                      </div>
                      <div className="size-14 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center border border-slate-100 dark:border-white/10">
                         <Briefcase className="size-6 text-slate-400" />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 pt-8 border-t border-slate-50 dark:border-white/5">
                      <DetailField label="Data de Início" value={formatDate(selectedProduct.created_at)} />
                      <DetailField label="Prazo Fatal" value={selectedProduct.deadline ? formatDate(selectedProduct.deadline) : "—"} />
                      <DetailField label="Valor Delegado" value={formatBRL(selectedProduct.value)} />
                   </div>

                   {selectedProduct.notes && (
                     <div className="mt-8 p-6 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Observações do Admin</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">{selectedProduct.notes}</p>
                     </div>
                   )}
                </div>

                {/* Checklist / Steps */}
                <div className="vx-card p-8 bg-white dark:bg-card border-slate-100 dark:border-white/5 rounded-[32px]">
                   <div className="flex items-center gap-3 mb-6">
                      <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <ListChecks className="size-5" />
                      </div>
                      <h3 className="font-editorial text-xl font-bold">Checklist Operacional</h3>
                   </div>
                   <ClientProductSteps clientProductId={selectedProduct.id} />
                </div>
              </div>

              <div className="space-y-6">
                {/* Actions */}
                <div className="vx-card p-6 bg-slate-900 text-white rounded-[24px] shadow-xl space-y-4">
                   <h3 className="font-editorial text-xl font-bold mb-4">Ações Rápidas</h3>
                   <Button 
                     className="w-full h-12 rounded-xl bg-white text-slate-900 hover:bg-primary hover:text-white transition-all font-bold"
                     onClick={() => setReportTarget({ id: selectedProduct.id, productName: selectedProduct.products?.name, clientName: selectedProduct.clients?.full_name })}
                   >
                     <ClipboardCheck className="size-4 mr-2" /> Reportar Status
                   </Button>
                   <Button variant="outline" className="w-full h-12 rounded-xl border-white/10 hover:bg-white/5" disabled>
                     <MessageSquare className="size-4 mr-2" /> Mensagem Admin
                   </Button>
                </div>

                {/* Documents for this product */}
                <div className="vx-card p-6 bg-white dark:bg-card border-slate-100 dark:border-white/5 rounded-[24px] space-y-4">
                   <h3 className="font-editorial text-lg font-bold border-b border-slate-50 dark:border-white/5 pb-3">Documentos Vinculados</h3>
                   <div className="space-y-3">
                      {documents.filter(d => d.client_product_id === selectedProductId).length === 0 ? (
                        <p className="text-xs text-muted-foreground italic p-4 text-center">Nenhum documento anexado.</p>
                      ) : (
                        documents.filter(d => d.client_product_id === selectedProductId).map((d: any) => (
                          <div key={d.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-slate-100 transition-colors">
                             <div className="flex items-center gap-3 min-w-0">
                                <FileText className="size-4 text-primary/60 shrink-0" />
                                <p className="text-xs font-bold truncate">{d.name}</p>
                             </div>
                             {d.file_path && (
                               <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-primary" onClick={() => handleDownload(d.file_path, d.name)}>
                                  <Download className="size-4" />
                               </Button>
                             )}
                          </div>
                        ))
                      )}
                   </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* MAIN LIST VIEW */
          <Tabs defaultValue="clientes" className="space-y-8 animate-fade-up">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <TabsList className="bg-slate-100/50 dark:bg-white/5 p-1 rounded-2xl border border-slate-200/50 dark:border-white/5 h-12">
                <TabsTrigger value="clientes" className="rounded-xl px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 shadow-none">
                   Atendimentos ({clientProducts.length})
                </TabsTrigger>
                <TabsTrigger value="documentos" className="rounded-xl px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 shadow-none">
                   Documentos
                </TabsTrigger>
                <TabsTrigger value="reportes" className="rounded-xl px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 shadow-none">
                   Reportes
                </TabsTrigger>
                <TabsTrigger value="contratos" className="rounded-xl px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 shadow-none">
                   Meus Contratos ({contracts.length})
                </TabsTrigger>
              </TabsList>

              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Filtrar por cliente ou serviço..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-12 bg-white/50 dark:bg-card border-slate-200 dark:border-white/5 rounded-2xl w-full md:w-[320px] transition-all focus:ring-primary/20"
                />
              </div>
            </div>

            <TabsContent value="clientes" className="space-y-4 outline-none">
              {isLoading ? (
                <div className="p-20 text-center"><Loader2 className="size-8 animate-spin mx-auto text-primary/20" /></div>
              ) : filteredProducts.length === 0 ? (
                <EmptyState message={search ? "Nenhum resultado para sua busca." : "Nenhum atendimento delegado a você no momento."} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredProducts.map((cp: any) => (
                    <div 
                      key={cp.id} 
                      className="vx-card p-6 bg-white dark:bg-card border-slate-100 dark:border-white/5 hover:border-primary/20 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-[32px] group/card cursor-pointer"
                      onClick={() => setSelectedProductId(cp.id)}
                    >
                      <div className="flex items-start justify-between mb-6">
                        <div className="size-12 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover/card:bg-primary/10 group-hover/card:text-primary transition-colors">
                          <Briefcase className="size-6" />
                        </div>
                        <StatusBadge status={cp.status} />
                      </div>

                      <div className="space-y-1">
                        <h3 className="font-editorial text-xl font-bold text-slate-900 dark:text-white leading-tight group-hover/card:text-primary transition-colors">
                           {cp.clients?.full_name}
                        </h3>
                        <p className="text-xs text-muted-foreground font-medium">{cp.products?.name}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-50 dark:border-white/5">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Prazo Fatal</p>
                          <p className="text-xs font-bold">{cp.deadline ? formatDate(cp.deadline) : "—"}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Início</p>
                           <p className="text-xs font-bold">{formatDate(cp.created_at)}</p>
                        </div>
                      </div>

                      <div className="mt-6 flex items-center justify-between group/link">
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary group-hover/link:translate-x-1 transition-transform">Ver Detalhes</span>
                        <ArrowRight className="size-4 text-primary opacity-0 group-hover/card:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="documentos">
              {documents.length === 0 ? (
                <EmptyState message="Nenhum documento disponível para seus atendimentos." />
              ) : (
                <div className="vx-card overflow-hidden bg-white dark:bg-card border-slate-100 dark:border-white/5 rounded-[24px]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-white/5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        <th className="px-6 py-5 text-left">Documento / Atendimento</th>
                        <th className="px-6 py-5 text-left">Status</th>
                        <th className="px-6 py-5 text-left">Data</th>
                        <th className="px-6 py-5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                      {documents.map((d: any) => (
                        <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-white/10 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                               <div className="size-9 rounded-lg bg-primary/5 flex items-center justify-center text-primary/60">
                                 <FileText className="size-4" />
                               </div>
                               <div>
                                  <p className="font-bold text-slate-900 dark:text-white leading-tight">{d.name}</p>
                                  <p className="text-[10px] text-muted-foreground mt-1">{d.clients?.full_name}</p>
                               </div>
                            </div>
                          </td>
                          <td className="px-6 py-4"><StatusBadge status={d.status} /></td>
                          <td className="px-6 py-4 text-xs text-muted-foreground font-medium">{formatDate(d.created_at)}</td>
                          <td className="px-6 py-4 text-right">
                            {d.file_path ? (
                              <Button size="sm" variant="outline" className="h-8 rounded-lg border-slate-200 hover:bg-primary hover:text-white transition-all" onClick={() => handleDownload(d.file_path, d.name)}>
                                <Download className="size-3 mr-1.5" /> Baixar
                              </Button>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground uppercase tracking-widest border-dashed">Sem arquivo</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="reportes">
              {reports.length === 0 ? (
                <EmptyState message="Você ainda não enviou nenhum reporte." />
              ) : (
                <div className="vx-card divide-y divide-slate-50 dark:divide-white/5 bg-white dark:bg-card border-slate-100 dark:border-white/5 rounded-[24px]">
                  {reports.map((r: any) => {
                    const cp = clientProducts.find((c: any) => c.id === r.client_product_id);
                    return (
                      <div key={r.id} className="p-6 flex items-start gap-4 hover:bg-slate-50/50 dark:hover:bg-white/10 transition-colors first:rounded-t-[24px] last:rounded-b-[24px]">
                        <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-sm">
                          <ClipboardCheck className="size-6" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <p className="font-bold text-slate-900 dark:text-white">{cp?.clients?.full_name ?? "Cliente"}</p>
                            <span className="size-1 rounded-full bg-slate-300" />
                            <p className="text-xs text-muted-foreground font-medium">{cp?.products?.name}</p>
                            <StatusBadge status={r.status} />
                          </div>
                          {r.notes && <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">"{r.notes}"</p>}
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{formatDate(r.created_at)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="contratos" className="animate-fade-up">
              {contracts.length === 0 ? (
                <EmptyState message="Nenhum contrato disponível no momento." />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {contracts.map((c: any) => (
                    <div key={c.id} className="vx-card p-6 bg-white dark:bg-card border-slate-100 dark:border-white/5 rounded-[32px] space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <FileText className="size-5" />
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest">{c.status.replace(/_/g, ' ')}</Badge>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white truncate">{c.name}</h4>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">
                          {c.contract_type?.replace(/_/g, ' ') || "Contrato Geral"}
                        </p>
                      </div>
                      <div className="pt-4 border-t border-slate-50 dark:border-white/5 space-y-2">
                        <p className="text-xs text-muted-foreground flex items-center justify-between">
                          <span>Criado em:</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">{formatDate(c.created_at)}</span>
                        </p>
                        {c.expires_at && (
                          <p className="text-xs text-rose-500 flex items-center justify-between">
                            <span>Vencimento:</span>
                            <span className="font-bold">{formatDate(c.expires_at)}</span>
                          </p>
                        )}
                        {c.amount && (
                          <p className="text-xs text-emerald-500 flex items-center justify-between">
                            <span>Valor:</span>
                            <span className="font-bold">{formatBRL(c.amount)}</span>
                          </p>
                        )}
                      </div>
                      {c.file_path && (
                        <Button 
                          className="w-full bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-primary hover:text-white transition-all rounded-xl"
                          onClick={() => handleDownload(c.file_path, c.name)}
                        >
                          <Download className="size-4 mr-2" /> Baixar Contrato
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {reportTarget && (
        <ReportStatusDialog
          open={!!reportTarget}
          onOpenChange={(v) => !v && setReportTarget(null)}
          clientProductId={reportTarget.id}
          productName={reportTarget.productName}
          clientName={reportTarget.clientName}
        />
      )}
    </div>
  );
}

function StatItem({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" | "success" }) {
  const colors: any = {
    default: "text-slate-900 dark:text-white",
    warning: "text-amber-500",
    success: "text-emerald-500",
  };
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">{label}</p>
      <p className={cn("text-3xl font-bold font-editorial tracking-tight leading-none", colors[tone])}>{value}</p>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <p className="text-sm font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: any = {
    aguardando_documentos: { label: "AGUARDANDO DOCS", className: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
    em_analise: { label: "EM ANÁLISE", className: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
    aguardando_cliente: { label: "AGUARDANDO CLIENTE", className: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
    em_andamento: { label: "EM ANDAMENTO", className: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20" },
    pendente_correcao: { label: "PEND. CORREÇÃO", className: "bg-rose-500/10 text-rose-700 border-rose-500/20" },
    concluido: { label: "CONCLUÍDO", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    aguardando_inicio: { label: "AGUARDANDO", className: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-white/40" },
    aprovado: { label: "APROVADO", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    enviado: { label: "ENVIADO", className: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
    solicitado: { label: "SOLICITADO", className: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
    vencido: { label: "VENCIDO", className: "bg-rose-100 text-rose-700 border-rose-200" },
  };
  const cfg = map[status] || { label: status?.toUpperCase() || "—", className: "bg-slate-100 text-slate-600 border-slate-200" };
  return (
    <Badge variant="outline" className={cn("text-[9px] font-bold tracking-widest border px-2 py-0.5", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="vx-card p-20 text-center bg-white dark:bg-card border-slate-100 dark:border-white/5 rounded-[32px] border-dashed border-2">
      <Inbox className="size-12 text-slate-200 dark:text-white/5 mx-auto mb-4" />
      <p className="font-editorial text-lg text-muted-foreground">{message}</p>
    </div>
  );
}