import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
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
  X, AlertCircle, Loader2, Wallet
} from "lucide-react";
import { formatDate, formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ReportStatusDialog } from "@/components/provider/ReportStatusDialog";
import { RequestDocumentDialog } from "@/components/provider/RequestDocumentDialog";
import { ClientProductSteps } from "@/components/clients/tabs/ClientProductSteps";
import { ProductInteractionPanel } from "@/components/provider/ProductInteractionPanel";
import { ProviderAtuacao } from "@/components/provider/ProviderAtuacao";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { onlyDigits } from "@/lib/masks";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PROVIDER_PATH_TO_TAB: Record<string, string> = {
  atuacao: "atuacao",
  "por-cliente": "por-cliente", demandas: "clientes", documentos: "documentos",
  reportes: "reportes", contratos: "contratos", perfil: "perfil",
};
const PROVIDER_TAB_TO_PATH: Record<string, string> = {
  atuacao: "atuacao",
  "por-cliente": "por-cliente", clientes: "demandas", documentos: "documentos",
  reportes: "reportes", contratos: "contratos", perfil: "perfil",
};

export default function ProviderPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const activeTab = tabParam && PROVIDER_PATH_TO_TAB[tabParam] ? PROVIDER_PATH_TO_TAB[tabParam] : "dashboard";
  const setActiveTab = (v: string) => navigate(v === "dashboard" ? "/prestador" : `/prestador/${PROVIDER_TAB_TO_PATH[v] || v}`);
  const [reportTarget, setReportTarget] = useState<{ id: string; productName?: string; clientName?: string } | null>(null);
  const [docRequestTarget, setDocRequestTarget] = useState<{ clientId: string; cpId: string; context?: string } | null>(null);
  const [search, setSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [reportStatusFilter, setReportStatusFilter] = useState<string>("todos");
  const [reportPeriod, setReportPeriod] = useState<string>("30");
  const [demandStatusFilter, setDemandStatusFilter] = useState<string>("todos");

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
    return clientProducts.filter((cp: any) => {
      if (demandStatusFilter !== "todos" && cp.status !== demandStatusFilter) return false;
      const q = search.toLowerCase();
      if (!q) return true;
      return (
        cp.clients?.full_name?.toLowerCase().includes(q) ||
        cp.products?.name?.toLowerCase().includes(q) ||
        cp.clients?.company?.toLowerCase().includes(q)
      );
    });
  }, [clientProducts, search, demandStatusFilter]);

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
        .select("id, status, notes, pending, next_steps, created_at, client_product_id")
        .in("client_product_id", clientProductIds)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const lastReportMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of reports as any[]) if (!m.has(r.client_product_id)) m.set(r.client_product_id, r.created_at);
    return m;
  }, [reports]);

  const needsReport = (cpId: string, status: string) => {
    if (status === "concluido" || status === "cancelado") return false;
    const last = lastReportMap.get(cpId);
    if (!last) return true;
    return Date.now() - new Date(last).getTime() > 7 * 86400000;
  };

  const filteredReports = useMemo(() => {
    const cutoff = reportPeriod === "all" ? 0 : Date.now() - parseInt(reportPeriod) * 86400000;
    return (reports as any[]).filter((r) => {
      if (reportStatusFilter !== "todos" && r.status !== reportStatusFilter) return false;
      if (cutoff && new Date(r.created_at).getTime() < cutoff) return false;
      if (search) {
        const cp = clientProducts.find((c: any) => c.id === r.client_product_id);
        const name = (cp?.clients?.full_name || "").toLowerCase();
        if (!name.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [reports, reportStatusFilter, reportPeriod, search, clientProducts]);

  const groupedByClient = useMemo(() => {
    const groups = new Map<string, { client: any; products: any[] }>();
    for (const cp of clientProducts as any[]) {
      const cid = cp.clients?.id || "unknown";
      if (!groups.has(cid)) groups.set(cid, { client: cp.clients, products: [] });
      groups.get(cid)!.products.push(cp);
    }
    return Array.from(groups.values());
  }, [clientProducts]);

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
    const pendingReports = clientProducts.filter((c: any) => needsReport(c.id, c.status)).length;
    
    const valuesToReceive = clientProducts
      .filter((c: any) => c.status !== "cancelado")
      .reduce((acc: number, curr: any) => acc + (Number(curr.value) || 0), 0);

    const nextDeadlines = clientProducts
      .filter((c: any) => c.status !== "concluido" && c.deadline)
      .sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 3);

    return { total, active, urgent, delayed, docsAwaiting, pendingReports, valuesToReceive, nextDeadlines };
  }, [clientProducts, documents, lastReportMap]);

  async function handleDownload(filePath: string, name: string) {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(filePath, 3600);
    if (error || !data) return;
    window.open(data.signedUrl, "_blank");
  }

  if (!provider) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-8 ">
        <div className="vx-card p-12 max-w-lg text-center shadow-2xl bg-white/40 backdrop-blur-xl border-white/20">
          <Inbox className="size-12 text-primary/30 mx-auto mb-6" />
          <h2 className=" text-3xl font-bold tracking-tight mb-3">Acesso pendente</h2>
          <p className="text-muted-foreground leading-relaxed">
            Sua conta ainda não foi vinculada a um cadastro de prestador. <br/>Entre em contato com o administrador para liberação.
          </p>
        </div>
      </div>
    );
  }

  const selectedProduct = clientProducts.find((cp: any) => cp.id === selectedProductId);

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="max-w-[1600px] mx-auto px-5 lg:px-8 py-8 space-y-6">

        {/* Header & Stats Strip */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 rounded-2xl border border-slate-200/70 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center text-lg font-bold tracking-tight shadow-md">
              {provider.name.split(' ').map((p:string) => p[0]).slice(0,2).join('')}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">Painel do Prestador</p>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
                Olá, <span className="text-indigo-600">{provider.name.split(' ')[0]}</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="size-3.5 text-emerald-500" /> {provider.specialty || "Prestador Especialista"} · {provider.email}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 lg:gap-10">
            <StatItem label="Ativas" value={String(stats.active)} />
            <StatItem label="Urgentes" value={String(stats.urgent)} tone="warning" />
            <StatItem label="Atrasadas" value={String(stats.delayed)} tone="warning" />
            <StatItem label="A Receber" value={formatBRL(stats.valuesToReceive)} tone="success" />
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
                <div className="vx-card p-8 bg-white border-slate-100 rounded-2xl">
                   <div className="flex items-center gap-3 mb-6">
                      <div className="size-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                        <Briefcase className="size-5" />
                      </div>
                      <h3 className=" text-xl font-bold">Escopo do Serviço</h3>
                   </div>
                   <div className="space-y-4">
                      <p className="text-sm text-slate-600 leading-relaxed">
                         {selectedProduct.products?.description || "Descrição do serviço não disponível."}
                      </p>
                   </div>
                </div>

                <div className="vx-card p-8 bg-white border-slate-100 rounded-2xl">
                   <div className="flex items-start justify-between mb-8">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-primary">Atendimento em Curso</p>
                        <h2 className=" text-3xl font-bold text-slate-900">
                           {selectedProduct.clients?.full_name}
                        </h2>
                        <div className="flex items-center gap-3 pt-2">
                           <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 font-bold tracking-widest text-[10px] uppercase">
                             {selectedProduct.products?.name}
                           </Badge>
                           <StatusBadge status={selectedProduct.status} />
                        </div>
                      </div>
                      <div className="size-14 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
                         <Briefcase className="size-6 text-slate-400" />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 pt-8 border-t border-slate-50">
                      <DetailField label="Data de Início" value={formatDate(selectedProduct.created_at)} />
                      <DetailField label="Prazo Fatal" value={selectedProduct.deadline ? formatDate(selectedProduct.deadline) : "—"} />
                      <DetailField label="Valor Delegado" value={formatBRL(selectedProduct.value)} />
                   </div>

                   {selectedProduct.notes && (
                     <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Observações do Admin</p>
                        <p className="text-sm text-slate-700 leading-relaxed italic">{selectedProduct.notes}</p>
                     </div>
                   )}
                </div>

                {/* Checklist / Steps */}
                <div className="vx-card p-8 bg-white border-slate-100 rounded-2xl">
                   <div className="flex items-center gap-3 mb-6">
                      <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                        <ListChecks className="size-5" />
                      </div>
                      <h3 className=" text-xl font-bold">Checklist Operacional</h3>
                   </div>
                   <ClientProductSteps clientProductId={selectedProduct.id} />
                </div>

                <ProductInteractionPanel clientProductId={selectedProduct.id} />
              </div>

              <div className="space-y-6">
                {/* Actions */}
                <div className="vx-card p-6 bg-white border border-slate-200/70 rounded-xl shadow-sm space-y-3">
                   <h3 className="text-sm font-bold text-slate-900 mb-2">Ações Rápidas</h3>
                   <Button
                     className="w-full h-11 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                     onClick={() => setReportTarget({ id: selectedProduct.id, productName: selectedProduct.products?.name, clientName: selectedProduct.clients?.full_name })}
                   >
                     <ClipboardCheck className="size-4 mr-2" /> Reportar Status
                   </Button>
                   {selectedProduct.clients?.phone && (
                     <Button
                       variant="outline"
                       className="w-full h-11 rounded-lg border-slate-200 hover:border-indigo-300 hover:text-indigo-700 font-semibold"
                       onClick={() => window.open(`https://wa.me/55${(selectedProduct.clients.phone || '').replace(/\D/g,'')}`, '_blank')}
                     >
                       <MessageSquare className="size-4 mr-2" /> Falar com Cliente
                     </Button>
                   )}
                   <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                     Use Reportes para atualizar o admin sobre andamento, pendências e próximos passos da demanda.
                   </p>
                </div>

                {/* Documents for this product */}
                <div className="vx-card p-6 bg-white border-slate-100 rounded-xl space-y-4">
                   <h3 className=" text-lg font-bold border-b border-slate-50 pb-3">Documentos Vinculados</h3>
                   <div className="space-y-3">
                      {documents.filter(d => d.client_product_id === selectedProductId).length === 0 ? (
                        <p className="text-xs text-muted-foreground italic p-4 text-center">Nenhum documento anexado.</p>
                      ) : (
                        documents.filter(d => d.client_product_id === selectedProductId).map((d: any) => (
                          <div key={d.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 animate-fade-up">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <TabsList className="bg-white p-1 rounded-lg border border-slate-200/70 h-10 flex-wrap shadow-sm">
                <TabsTrigger value="dashboard" className="rounded-md px-4 text-xs font-semibold data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">Visão geral</TabsTrigger>
                <TabsTrigger value="atuacao" className="rounded-md px-4 text-xs font-semibold data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">Atuação</TabsTrigger>
                <TabsTrigger value="por-cliente" className="rounded-md px-4 text-xs font-semibold data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">Por Cliente · {groupedByClient.length}</TabsTrigger>
                <TabsTrigger value="clientes" className="rounded-md px-4 text-xs font-semibold data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">Demandas · {clientProducts.length}</TabsTrigger>
                <TabsTrigger value="documentos" className="rounded-md px-4 text-xs font-semibold data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">Documentos · {documents.length}</TabsTrigger>
                <TabsTrigger value="reportes" className="rounded-md px-4 text-xs font-semibold data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">Reportes · {reports.length}</TabsTrigger>
                <TabsTrigger value="contratos" className="rounded-md px-4 text-xs font-semibold data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">Contratos · {contracts.length}</TabsTrigger>
                <TabsTrigger value="perfil" className="rounded-md px-4 text-xs font-semibold data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700">Meu Perfil</TabsTrigger>
              </TabsList>


              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Buscar demanda..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-12 bg-white/50 border-slate-200 rounded-2xl w-full md:w-[320px] transition-all focus:ring-primary/20"
                />
              </div>
            </div>

            <TabsContent value="dashboard" className="space-y-8 outline-none animate-fade-up">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <DashboardCard 
                  label="Documentos para Análise" 
                  value={stats.docsAwaiting} 
                  icon={FileText} 
                  description="Aguardando sua validação"
                  tone={stats.docsAwaiting > 0 ? "warning" : "default"}
                />
                <DashboardCard 
                  label="Demandas Urgentes" 
                  value={stats.urgent} 
                  icon={AlertCircle} 
                  description="Alta prioridade"
                  tone={stats.urgent > 0 ? "destructive" : "default"}
                />
                <DashboardCard 
                  label="Reportes Pendentes" 
                  value={stats.pendingReports} 
                  icon={ClipboardCheck} 
                  description="Necessário atualizar status"
                />
                <DashboardCard 
                  label="Total a Receber" 
                  value={formatBRL(stats.valuesToReceive)} 
                  icon={Wallet} 
                  description="Contratos ativos"
                  tone="success"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="vx-card p-8 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                       <h3 className=" text-2xl font-bold">Demandas com Prazo Próximo</h3>
                       <Button variant="ghost" className="text-primary text-xs font-bold uppercase tracking-widest" onClick={() => navigate("/prestador")}>Ver todas</Button>
                    </div>
                    {stats.nextDeadlines.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic text-center py-10">Nenhum prazo próximo definido.</p>
                    ) : (
                      <div className="space-y-4">
                        {stats.nextDeadlines.map((cp: any) => (
                          <div 
                            key={cp.id} 
                            onClick={() => setSelectedProductId(cp.id)}
                            className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-primary/20 transition-all cursor-pointer group"
                          >
                             <div className="flex items-center gap-4">
                                <div className="size-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center">
                                   <Clock className="size-5 text-slate-400 group-hover:text-primary transition-colors" />
                                </div>
                                <div>
                                   <p className="font-bold text-slate-900 group-hover:text-primary transition-colors">{cp.clients?.full_name}</p>
                                   <p className="text-xs text-muted-foreground">{cp.products?.name}</p>
                                </div>
                             </div>
                             <div className="text-right">
                                <p className="text-xs font-bold text-slate-900">{formatDate(cp.deadline)}</p>
                                <p className="text-[10px] text-rose-500 font-bold uppercase tracking-widest mt-1">Prazo Fatal</p>
                             </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="vx-card p-6 bg-white rounded-2xl border border-slate-200/70 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-900 mb-1">Reportes recentes</h3>
                    <p className="text-[11px] text-slate-500 mb-4">Últimas 5 atualizações enviadas ao admin.</p>
                    {reports.length === 0 ? (
                      <div className="text-center py-8">
                        <ClipboardCheck className="size-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-500">Nenhum reporte ainda. Mantenha o admin informado.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {reports.slice(0, 5).map((r: any) => {
                          const cp = clientProducts.find((c: any) => c.id === r.client_product_id);
                          return (
                            <button key={r.id} onClick={() => cp && setSelectedProductId(cp.id)} className="w-full text-left p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-slate-900 truncate">{cp?.clients?.full_name || "—"}</p>
                                <span className="text-[10px] text-slate-500 shrink-0">{formatDate(r.created_at)}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">{cp?.products?.name}</p>
                              {r.notes && <p className="text-[11px] text-slate-600 line-clamp-2 mt-1">{r.notes}</p>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="atuacao" className="outline-none animate-fade-up">
              <ProviderAtuacao providerId={providerId!} clientProducts={clientProducts} />
            </TabsContent>

            <TabsContent value="por-cliente" className="space-y-6 outline-none animate-fade-up">
              {groupedByClient.length === 0 ? (
                <EmptyState message="Nenhum cliente delegado." />
              ) : groupedByClient.map(({ client, products }) => {
                const totalValue = products.reduce((s, p) => s + (Number(p.value) || 0), 0);
                const active = products.filter(p => p.status !== "concluido" && p.status !== "cancelado").length;
                const needsRpt = products.filter(p => needsReport(p.id, p.status)).length;
                return (
                  <div key={client?.id || "x"} className="vx-card bg-white border border-slate-100 rounded-2xl overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-slate-50/50 to-transparent">
                      <div>
                        <h3 className=" text-2xl font-bold">{client?.full_name || "Cliente"}</h3>
                        <p className="text-xs text-muted-foreground">{client?.company || client?.email || "—"}</p>
                      </div>
                      <div className="flex items-center gap-6 text-xs">
                        <div><p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Demandas</p><p className="font-bold text-lg">{products.length}</p></div>
                        <div><p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Ativas</p><p className="font-bold text-lg">{active}</p></div>
                        <div><p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">A receber</p><p className="font-bold text-lg tabular-nums">{formatBRL(totalValue)}</p></div>
                        {needsRpt > 0 && <Badge className="bg-amber-500 text-white text-[10px]">{needsRpt} sem reporte</Badge>}
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50/40 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          <th className="px-6 py-3 text-left">Produto</th>
                          <th className="px-6 py-3 text-center">Status</th>
                          <th className="px-6 py-3 text-center">SLA</th>
                          <th className="px-6 py-3 text-left">Prazo</th>
                          <th className="px-6 py-3 text-left">Último reporte</th>
                          <th className="px-6 py-3 text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {products.map((p: any) => {
                          const last = lastReportMap.get(p.id);
                          const stale = needsReport(p.id, p.status);
                          return (
                            <tr key={p.id} className="hover:bg-slate-50/50">
                              <td className="px-6 py-4 font-bold">{p.products?.name || "—"}</td>
                              <td className="px-6 py-4 text-center"><StatusBadge status={p.status} /></td>
                              <td className="px-6 py-4 text-center"><Badge variant="outline" className={cn("text-[9px]", p.sla_status === "no_prazo" ? "text-emerald-600 border-emerald-200" : p.sla_status === "atrasado" ? "text-rose-600 border-rose-200" : "text-amber-600 border-amber-200")}>{p.sla_status || "—"}</Badge></td>
                              <td className="px-6 py-4 text-xs text-muted-foreground">{p.deadline ? formatDate(p.deadline) : "—"}</td>
                              <td className="px-6 py-4 text-xs">
                                {last ? (
                                  <span className={cn(stale ? "text-amber-600 font-bold" : "text-muted-foreground")}>{formatDate(last)}{stale && " · atrasado"}</span>
                                ) : (
                                  <span className="text-rose-600 font-bold">Sem reporte</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-1">
                                  <Button size="sm" variant="ghost" onClick={() => setReportTarget({ id: p.id, productName: p.products?.name, clientName: client?.full_name })}>
                                    <ClipboardCheck className="size-3.5 mr-1" /> Reportar
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setSelectedProductId(p.id)}>Abrir</Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="clientes" className="space-y-4 outline-none">
              <div className="flex flex-wrap gap-2">
                {["todos","aguardando_inicio","em_andamento","aguardando_documentos","aguardando_cliente","pendente_correcao","aguardando_aprovacao_final","concluido"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setDemandStatusFilter(s)}
                    className={cn("text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors", demandStatusFilter === s ? "bg-primary text-white" : "bg-slate-100 text-muted-foreground hover:bg-slate-200")}
                  >
                    {s.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
              {isLoading ? (
                <div className="p-20 text-center"><Loader2 className="size-8 animate-spin mx-auto text-primary/20" /></div>
              ) : filteredProducts.length === 0 ? (
                <EmptyState message={search ? "Nenhum resultado para sua busca." : "Nenhum atendimento delegado a você no momento."} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredProducts.map((cp: any) => {
                    const stale = needsReport(cp.id, cp.status);
                    return (
                      <div
                        key={cp.id}
                        className="vx-card p-6 bg-white border-slate-100 hover:border-primary/20 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-2xl group/card"
                      >
                        <div className="flex items-start justify-between mb-6">
                          <div className="size-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover/card:bg-primary/10 group-hover/card:text-primary transition-colors">
                            <Briefcase className="size-6" />
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <StatusBadge status={cp.status} />
                            {stale && <Badge className="bg-amber-500 text-white text-[9px]">Sem reporte</Badge>}
                          </div>
                        </div>

                        <div className="space-y-1 cursor-pointer" onClick={() => setSelectedProductId(cp.id)}>
                          <h3 className=" text-xl font-bold text-slate-900 leading-tight group-hover/card:text-primary transition-colors">{cp.clients?.full_name}</h3>
                          <p className="text-xs text-muted-foreground font-medium">{cp.products?.name}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-50">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Prazo</p>
                            <p className="text-xs font-bold">{cp.deadline ? formatDate(cp.deadline) : "—"}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Valor</p>
                            <p className="text-xs font-bold tabular-nums">{cp.value ? formatBRL(cp.value) : "—"}</p>
                          </div>
                        </div>

                        <div className="mt-6 grid grid-cols-2 gap-2">
                          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setReportTarget({ id: cp.id, productName: cp.products?.name, clientName: cp.clients?.full_name })}>
                            <ClipboardCheck className="size-3.5 mr-1" /> Reportar
                          </Button>
                          <Button size="sm" className="rounded-xl" onClick={() => setSelectedProductId(cp.id)}>
                            Abrir <ArrowRight className="size-3.5 ml-1" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="documentos">
              {documents.length === 0 ? (
                <EmptyState message="Nenhum documento disponível para seus atendimentos." />
              ) : (
                <div className="vx-card overflow-hidden bg-white border-slate-100 rounded-xl">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50/50 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        <th className="px-6 py-5 text-left">Documento / Atendimento</th>
                        <th className="px-6 py-5 text-left">Status</th>
                        <th className="px-6 py-5 text-left">Data</th>
                        <th className="px-6 py-5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {documents.map((d: any) => (
                        <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                               <div className="size-9 rounded-lg bg-primary/5 flex items-center justify-center text-primary/60">
                                 <FileText className="size-4" />
                               </div>
                               <div>
                                  <p className="font-bold text-slate-900 leading-tight">{d.name}</p>
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

            <TabsContent value="reportes" className="space-y-4">
              <div className="flex flex-wrap gap-3 items-center">
                <Select value={reportStatusFilter} onValueChange={setReportStatusFilter}>
                  <SelectTrigger className="w-48 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    <SelectItem value="aguardando_documentos">Aguardando documentos</SelectItem>
                    <SelectItem value="em_analise">Em análise</SelectItem>
                    <SelectItem value="aguardando_cliente">Aguardando cliente</SelectItem>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    <SelectItem value="pendente_correcao">Pendente correção</SelectItem>
                    <SelectItem value="aguardando_aprovacao_final">Aguardando aprovação</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={reportPeriod} onValueChange={setReportPeriod}>
                  <SelectTrigger className="w-40 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Últimos 7 dias</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                    <SelectItem value="all">Tudo</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground ml-auto">{filteredReports.length} reportes</span>
              </div>

              {filteredReports.length === 0 ? (
                <EmptyState message="Nenhum reporte no filtro atual." />
              ) : (
                <div className="space-y-3">
                  {filteredReports.map((r: any) => {
                    const cp = clientProducts.find((c: any) => c.id === r.client_product_id);
                    return (
                      <div key={r.id} className="vx-card p-6 bg-white border border-slate-100 rounded-xl hover:border-primary/20 transition-all">
                        <div className="flex items-start gap-4">
                          <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
                            <ClipboardCheck className="size-6" />
                          </div>
                          <div className="flex-1 space-y-3 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap">
                              <button onClick={() => cp && setSelectedProductId(cp.id)} className="font-bold hover:text-primary transition-colors">{cp?.clients?.full_name ?? "Cliente"}</button>
                              <span className="size-1 rounded-full bg-slate-300" />
                              <p className="text-xs text-muted-foreground font-medium">{cp?.products?.name}</p>
                              <StatusBadge status={r.status} />
                              <span className="text-[10px] text-muted-foreground ml-auto">{formatDate(r.created_at)}</span>
                            </div>
                            {r.notes && (
                              <div>
                                <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground mb-1">Andamento</p>
                                <p className="text-sm text-slate-700 leading-relaxed">{r.notes}</p>
                              </div>
                            )}
                            {r.pending && (
                              <div>
                                <p className="text-[9px] uppercase tracking-widest font-bold text-amber-600 mb-1">Pendências</p>
                                <p className="text-sm text-amber-700 leading-relaxed">{r.pending}</p>
                              </div>
                            )}
                            {r.next_steps && (
                              <div>
                                <p className="text-[9px] uppercase tracking-widest font-bold text-primary mb-1">Próximos passos</p>
                                <p className="text-sm text-primary leading-relaxed">{r.next_steps}</p>
                              </div>
                            )}
                          </div>
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
                    <div key={c.id} className="vx-card p-6 bg-white border-slate-100 rounded-2xl space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <FileText className="size-5" />
                        </div>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest">{c.status.replace(/_/g, ' ')}</Badge>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 truncate">{c.name}</h4>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mt-1">
                          {c.contract_type?.replace(/_/g, ' ') || "Contrato Geral"}
                        </p>
                      </div>
                      <div className="pt-4 border-t border-slate-50 space-y-2">
                        <p className="text-xs text-muted-foreground flex items-center justify-between">
                          <span>Criado em:</span>
                          <span className="font-bold text-slate-700">{formatDate(c.created_at)}</span>
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
                          className="w-full bg-slate-100 text-slate-700 hover:bg-primary hover:text-white transition-all rounded-xl"
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

            <TabsContent value="perfil" className="animate-fade-up">
              <ProfileTab provider={provider} userId={user?.id} />
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
      {docRequestTarget && (
        <RequestDocumentDialog
          open={!!docRequestTarget}
          onOpenChange={(v) => !v && setDocRequestTarget(null)}
          clientId={docRequestTarget.clientId}
          clientProductId={docRequestTarget.cpId}
          context={docRequestTarget.context}
        />
      )}
    </div>
  );
}

function DashboardCard({ 
  label, 
  value, 
  icon: Icon, 
  description, 
  tone = "default" 
}: { 
  label: string; 
  value: string | number; 
  icon: any; 
  description: string;
  tone?: "default" | "warning" | "success" | "destructive" 
}) {
  const tones: any = {
    default: "text-primary bg-primary/5 border-primary/10",
    warning: "text-amber-500 bg-amber-500/5 border-amber-500/10",
    success: "text-emerald-500 bg-emerald-500/5 border-emerald-500/10",
    destructive: "text-rose-500 bg-rose-500/5 border-rose-500/10",
  };
  
  return (
    <div className="vx-card p-6 bg-white border border-slate-100 rounded-2xl shadow-sm flex flex-col justify-between group hover:border-primary/20 transition-all">
       <div className="flex items-center justify-between mb-4">
          <div className={cn("size-10 rounded-xl flex items-center justify-center border", tones[tone])}>
             <Icon className="size-5" />
          </div>
          <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
       </div>
       <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</p>
          <p className="text-2xl font-bold  text-slate-900 mt-1">{value}</p>
          <p className="text-[10px] text-muted-foreground mt-1 font-medium">{description}</p>
       </div>
    </div>
  );
}

function StatItem({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" | "success" }) {
  const colors: any = {
    default: "text-slate-900",
    warning: "text-amber-500",
    success: "text-emerald-500",
  };
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">{label}</p>
      <p className={cn("text-3xl font-bold  tracking-tight leading-none", colors[tone])}>{value}</p>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <p className="text-sm font-bold text-slate-900">{value}</p>
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
    aguardando_inicio: { label: "AGUARDANDO", className: "bg-slate-100 text-slate-600 border-slate-200" },
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
    <div className="vx-card p-20 text-center bg-white border-slate-100 rounded-2xl border-dashed border-2">
      <Inbox className="size-12 text-slate-200 mx-auto mb-4" />
      <p className=" text-lg text-muted-foreground">{message}</p>
    </div>
  );
}

function ProfileTab({ provider, userId }: { provider: any; userId?: string }) {
  const [form, setForm] = useState({
    name: provider?.name ?? "",
    email: provider?.email ?? "",
    phone: provider?.phone ?? "",
    specialty: provider?.specialty ?? "",
    document_number: provider?.document_number ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [pwd, setPwd] = useState({ new: "", confirm: "" });

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("service_providers").update({
      name: form.name, phone: form.phone, specialty: form.specialty,
      document_number: form.document_number,
    }).eq("id", provider.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
  };

  const changePwd = async () => {
    if (!pwd.new || pwd.new.length < 8) return toast.error("Senha precisa ter ao menos 8 caracteres");
    if (pwd.new !== pwd.confirm) return toast.error("Senhas não coincidem");
    const { error } = await supabase.auth.updateUser({ password: pwd.new });
    if (error) return toast.error(error.message);
    setPwd({ new: "", confirm: "" });
    toast.success("Senha atualizada");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm space-y-5">
        <div>
          <h3 className="text-base font-bold text-slate-900">Dados profissionais</h3>
          <p className="text-xs text-slate-500">Mantenha seus dados atualizados para o admin.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Nome completo</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5 h-10" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">E-mail</label>
            <Input value={form.email} disabled className="mt-1.5 h-10 bg-slate-50" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Telefone</label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" className="mt-1.5 h-10" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">CPF/CNPJ</label>
            <Input value={form.document_number} onChange={(e) => setForm({ ...form, document_number: e.target.value })} className="mt-1.5 h-10" />
          </div>
          <div className="md:col-span-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Especialidade</label>
            <Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} className="mt-1.5 h-10" />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/70 p-6 shadow-sm space-y-5">
        <div>
          <h3 className="text-base font-bold text-slate-900">Alterar senha</h3>
          <p className="text-xs text-slate-500">Mínimo 8 caracteres.</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Nova senha</label>
            <Input type="password" value={pwd.new} onChange={(e) => setPwd({ ...pwd, new: e.target.value })} className="mt-1.5 h-10" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Confirmar nova senha</label>
            <Input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} className="mt-1.5 h-10" />
          </div>
        </div>
        <Button onClick={changePwd} variant="outline" className="w-full">Atualizar senha</Button>
      </div>
    </div>
  );
}