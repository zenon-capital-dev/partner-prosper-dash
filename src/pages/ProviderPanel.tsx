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
  ShieldCheck, LayoutDashboard
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
          id, status, value, deadline, created_at, notes,
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

  const stats = useMemo(() => {
    const total = clientProducts.length;
    const concluidos = clientProducts.filter((c: any) => c.status === "concluido" || c.status === "finalizado").length;
    const emAndamento = clientProducts.filter((c: any) => c.status === "em_andamento").length;
    const pendentes = total - concluidos;
    return { total, concluidos, emAndamento, pendentes };
  }, [clientProducts]);

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
    <div className="bg-background min-h-screen">
      <div className="page-shell space-y-10 py-10">
        {/* Header */}
        <header className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Painel do Prestador</p>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Olá, {provider.name}</h1>
          {provider.specialty && (
            <p className="text-sm text-muted-foreground">{provider.specialty}</p>
          )}
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Atendimentos" value={String(stats.total)} icon={Briefcase} />
          <KpiCard label="Pendentes" value={String(stats.pendentes)} icon={ClipboardCheck} tone="warning" />
          <KpiCard label="Concluídos" value={String(stats.concluidos)} icon={ClipboardCheck} tone="success" />
          <KpiCard label="Valor sob gestão" value={formatBRL(stats.valor)} icon={FileText} />
        </div>

        <Tabs defaultValue="clientes" className="space-y-6">
          <TabsList>
            <TabsTrigger value="clientes">Meus Clientes ({clientProducts.length})</TabsTrigger>
            <TabsTrigger value="documentos">Documentos ({documents.length})</TabsTrigger>
            <TabsTrigger value="reportes">Histórico de Reportes ({reports.length})</TabsTrigger>
          </TabsList>

          {/* CLIENTES */}
          <TabsContent value="clientes" className="space-y-3">
            {isLoading ? (
              <p className="text-center text-muted-foreground py-12">Carregando...</p>
            ) : clientProducts.length === 0 ? (
              <EmptyState message="Nenhum cliente delegado a você no momento." />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {clientProducts.map((cp: any) => (
                  <div key={cp.id} className="vx-card p-6 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-foreground">{cp.clients?.full_name}</h3>
                        <p className="text-xs text-muted-foreground">{cp.products?.name}</p>
                      </div>
                      <StatusBadge status={cp.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Prazo</p>
                        <p className="font-medium">{cp.deadline ? formatDate(cp.deadline) : "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Iniciado</p>
                        <p className="font-medium">{formatDate(cp.created_at)}</p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-border">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => navigate(`/clientes/${cp.clients?.id}`)}
                      >
                        Ver Cliente <ArrowRight className="size-3 ml-1" />
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => setReportTarget({ id: cp.id, productName: cp.products?.name, clientName: cp.clients?.full_name })}
                      >
                        <ClipboardCheck className="size-3 mr-1" /> Reportar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* DOCUMENTOS */}
          <TabsContent value="documentos">
            {documents.length === 0 ? (
              <EmptyState message="Nenhum documento disponível para os produtos delegados." />
            ) : (
              <div className="vx-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <th className="px-6 py-4 text-left">Documento</th>
                      <th className="px-6 py-4 text-left">Cliente</th>
                      <th className="px-6 py-4 text-left">Status</th>
                      <th className="px-6 py-4 text-left">Data</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {documents.map((d: any) => (
                      <tr key={d.id} className="hover:bg-muted/30">
                        <td className="px-6 py-4 font-medium">{d.name}</td>
                        <td className="px-6 py-4 text-xs text-muted-foreground">{d.clients?.full_name}</td>
                        <td className="px-6 py-4"><StatusBadge status={d.status} /></td>
                        <td className="px-6 py-4 text-xs text-muted-foreground">{formatDate(d.created_at)}</td>
                        <td className="px-6 py-4 text-right">
                          {d.file_path ? (
                            <Button size="sm" variant="ghost" onClick={() => handleDownload(d.file_path, d.name)}>
                              <Download className="size-3 mr-1" /> Baixar
                            </Button>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Sem arquivo</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* REPORTES */}
          <TabsContent value="reportes">
            {reports.length === 0 ? (
              <EmptyState message="Você ainda não enviou nenhum reporte." />
            ) : (
              <div className="vx-card divide-y divide-border">
                {reports.map((r: any) => {
                  const cp = clientProducts.find((c: any) => c.id === r.client_product_id);
                  return (
                    <div key={r.id} className="p-5 flex items-start gap-4">
                      <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <ClipboardCheck className="size-5" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm">{cp?.clients?.full_name ?? "Cliente"}</p>
                          <span className="text-muted-foreground text-xs">·</span>
                          <p className="text-xs text-muted-foreground">{cp?.products?.name}</p>
                          <StatusBadge status={r.status} />
                        </div>
                        {r.notes && <p className="text-sm text-muted-foreground">{r.notes}</p>}
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{formatDate(r.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
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

function KpiCard({ label, value, icon: Icon, tone = "default" }: any) {
  const tones: any = {
    default: "bg-muted text-muted-foreground",
    warning: "bg-amber-500/10 text-amber-600",
    success: "bg-emerald-500/10 text-emerald-600",
  };
  return (
    <div className="vx-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className={cn("size-9 rounded-lg flex items-center justify-center", tones[tone])}>
          <Icon className="size-4" />
        </div>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tracking-tight mt-1">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: any = {
    aguardando_documentos: { label: "AGUARDANDO DOCS", className: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
    em_analise: { label: "EM ANÁLISE", className: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
    aguardando_cliente: { label: "AGUARDANDO CLIENTE", className: "bg-orange-500/10 text-orange-700 border-orange-500/30" },
    em_andamento: { label: "EM ANDAMENTO", className: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30" },
    pendente_correcao: { label: "PEND. CORREÇÃO", className: "bg-rose-500/10 text-rose-700 border-rose-500/30" },
    concluido: { label: "CONCLUÍDO", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
    aguardando_inicio: { label: "AGUARDANDO", className: "bg-muted text-muted-foreground border-border" },
    aprovado: { label: "APROVADO", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
    enviado: { label: "ENVIADO", className: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
    solicitado: { label: "SOLICITADO", className: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  };
  const cfg = map[status] || { label: status?.toUpperCase() || "—", className: "bg-muted text-muted-foreground border-border" };
  return (
    <Badge variant="outline" className={cn("text-[9px] font-bold tracking-widest border", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="vx-card p-16 text-center">
      <Inbox className="size-10 text-muted-foreground/40 mx-auto mb-4" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
