import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package, FileText, Download, Upload, CheckCircle2, Clock, AlertCircle,
  Calendar, Receipt, ShoppingBag, Inbox, Mail, Phone, ClipboardList, History, MessageSquare, ListTodo, Eye
} from "lucide-react";
import { formatBRL, formatDate, initials } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const cycleLabel: Record<string, string> = {
  mensal: "/mês", trimestral: "/trim.", semestral: "/sem.", anual: "/ano", unico: "único",
};

export default function ClientPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["client-panel", user?.id],
    queryFn: async () => {
      const { data: client } = await supabase
        .from("clients")
        .select("id, full_name, email, phone, company, status, created_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!client) return null;

      const [subs, sales, docs, catalog, requests, contracts, timeline, payments] = await Promise.all([
        supabase
          .from("client_subscriptions")
          .select("*, products(name, description, product_categories(name, color))")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("sales")
          .select("id, amount, sale_date, status, products(name)")
          .eq("client_id", client.id)
          .order("sale_date", { ascending: false }),
        supabase
          .from("documents")
          .select("*")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("products")
          .select("id, name, description, base_price, recurring, product_categories(name, color)")
          .eq("active", true),
        supabase
          .from("document_requests")
          .select("*")
          .eq("client_id", client.id)
          .order("requested_at", { ascending: false }),
        supabase
          .from("contracts")
          .select("id, name, status, amount, signed_at, sent_at, file_path, created_at, products(name)")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("client_timeline")
          .select("*")
          .eq("client_id", client.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("payments")
          .select("id, amount, due_date, status, paid_at, payment_method, installment_number, installments_count")
          .eq("client_id", client.id)
          .order("due_date", { ascending: false }),
      ]);

      return {
        client,
        subscriptions: subs.data ?? [],
        sales: sales.data ?? [],
        docs: docs.data ?? [],
        catalog: catalog.data ?? [],
        requests: requests.data ?? [],
        contracts: contracts.data ?? [],
        timeline: timeline.data ?? [],
        payments: payments.data ?? [],
      };
    },
    enabled: !!user,
  });

  const download = async (path: string, name: string) => {
    const { data: file, error } = await supabase.storage.from("documents").download(path);
    if (error) return toast.error(error.message);
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = async (docId: string, file: File) => {
    if (!data) return;
    setUploadingDocId(docId);
    const path = `${data.client.id}/${docId}-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
    if (upErr) { setUploadingDocId(null); return toast.error(upErr.message); }

    const { error: dbErr } = await supabase.from("documents").update({
      file_path: path, file_size: file.size, mime_type: file.type,
      status: "enviado", uploaded_by: user!.id,
    }).eq("id", docId);

    setUploadingDocId(null);
    if (dbErr) return toast.error(dbErr.message);
    toast.success("Documento enviado!");
    qc.invalidateQueries({ queryKey: ["client-panel"] });
  };

  if (isLoading) {
    return <div className="p-12 text-center text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="vx-card p-10 max-w-md text-center">
          <Inbox className="size-10 text-muted-foreground/50 mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold">Cadastro em processamento</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Sua conta ainda não foi vinculada como cliente. Entre em contato com o administrador.
          </p>
        </div>
      </div>
    );
  }

  const { client, subscriptions, sales, docs, catalog, requests, contracts, timeline, payments } = data;
  const activeSubs = subscriptions.filter((s: any) => s.status === "ativa");
  const monthlyTotal = activeSubs
    .filter((s: any) => s.billing_cycle === "mensal")
    .reduce((sum: number, s: any) => sum + Number(s.amount), 0);
  const pendingDocs = requests.filter((r: any) => r.status === "solicitado" || r.status === "reprovado").length;
  const ownedProductIds = new Set(subscriptions.map((s: any) => s.product_id).filter(Boolean));
  const availableCatalog = catalog.filter((p: any) => !ownedProductIds.has(p.id));
  const overduePayments = payments.filter((p: any) => p.status !== "pago" && p.due_date && new Date(p.due_date) < new Date());
  const upcomingPayments = payments.filter((p: any) => p.status !== "pago").slice(0, 10);
  const pendingContracts = contracts.filter((c: any) => c.status !== "assinado" && c.status !== "finalizado");

  return (
    <div className="page-shell space-y-7">
      {/* ===== Greeting card ===== */}
      <div className="vx-card p-6 lg:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-xl">
            {initials(client.full_name)}
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Bem-vindo de volta</p>
            <h1 className="font-display text-[28px] font-bold tracking-tight leading-tight">{client.full_name}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {client.company && <span>{client.company}</span>}
              {client.email && <span className="flex items-center gap-1"><Mail className="size-3" /> {client.email}</span>}
              {client.phone && <span className="flex items-center gap-1"><Phone className="size-3" /> {client.phone}</span>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-6 lg:border-l lg:pl-7 lg:border-border">
          <Stat label="Ativos" value={String(activeSubs.length)} />
          <Stat label="Mensalidade" value={formatBRL(monthlyTotal)} />
          <Stat label="Pendentes" value={String(pendingDocs)} tone={pendingDocs > 0 ? "warning" : "default"} />
        </div>
      </div>

      <Tabs defaultValue="produtos" className="space-y-5">
        <TabsList className="h-11 p-1">
          <TabsTrigger value="produtos" className="h-9 gap-2 text-[13px] font-semibold">
            <Package className="size-4" /> Meus Produtos
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{activeSubs.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="catalogo" className="h-9 gap-2 text-[13px] font-semibold">
            <ShoppingBag className="size-4" /> Catálogo
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{availableCatalog.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="docs" className="h-9 gap-2 text-[13px] font-semibold">
            <FileText className="size-4" /> Meus Arquivos
          </TabsTrigger>
          <TabsTrigger value="solicitacoes" className="h-9 gap-2 text-[13px] font-semibold">
            <Upload className="size-4" /> Solicitações
            {pendingDocs > 0 && <Badge className="ml-1 h-5 px-1.5 text-[10px] bg-warning text-warning-foreground">{pendingDocs}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="contratos" className="h-9 gap-2 text-[13px] font-semibold">
            <ClipboardList className="size-4" /> Contratos
            {pendingContracts.length > 0 && <Badge className="ml-1 h-5 px-1.5 text-[10px] bg-warning text-warning-foreground">{pendingContracts.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="h-9 gap-2 text-[13px] font-semibold">
            <Receipt className="size-4" /> Financeiro
            {overduePayments.length > 0 && <Badge className="ml-1 h-5 px-1.5 text-[10px] bg-destructive text-destructive-foreground">{overduePayments.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="historico" className="h-9 gap-2 text-[13px] font-semibold">
            <History className="size-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* ===== MEUS PRODUTOS ===== */}
        <TabsContent value="produtos" className="space-y-3">
          {subscriptions.length === 0 ? (
            <Empty icon={Package} title="Nenhum produto contratado" desc="Confira o catálogo para ver os produtos disponíveis." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {subscriptions.map((s: any) => {
                const cat = s.products?.product_categories;
                const name = s.products?.name ?? s.custom_name ?? "Produto";
                const statusTone = s.status === "ativa" ? "vx-pill-success" : s.status === "inadimplente" ? "vx-pill-danger" : "vx-pill-muted";
                return (
                  <div key={s.id} className="vx-card vx-card-hover p-5 flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {cat && (
                          <span className="vx-pill" style={{ background: `${cat.color}15`, color: cat.color, borderColor: "transparent" }}>
                            {cat.name}
                          </span>
                        )}
                        <h3 className="font-display font-bold text-[17px] mt-2 truncate">{name}</h3>
                        {s.products?.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.products.description}</p>
                        )}
                      </div>
                      <span className={`vx-pill ${statusTone}`}>{s.status}</span>
                    </div>
                    <div className="flex items-end justify-between pt-3 border-t border-border">
                      <div>
                        <p className="font-display text-[22px] font-bold tabular-nums leading-none">{formatBRL(s.amount)}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{cycleLabel[s.billing_cycle] ?? s.billing_cycle}</p>
                      </div>
                      {s.next_billing_date && (
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Próx. cobrança</p>
                          <p className="text-xs font-semibold flex items-center gap-1 mt-1">
                            <Calendar className="size-3" /> {formatDate(s.next_billing_date)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ===== CATÁLOGO ===== */}
        <TabsContent value="catalogo" className="space-y-3">
          {availableCatalog.length === 0 ? (
            <Empty icon={ShoppingBag} title="Você já contratou todos os produtos" desc="Não há novos produtos disponíveis no momento." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {availableCatalog.map((p: any) => {
                const cat = p.product_categories;
                return (
                  <div key={p.id} className="vx-card vx-card-hover p-5 flex flex-col gap-4">
                    <div>
                      {cat && (
                        <span className="vx-pill" style={{ background: `${cat.color}15`, color: cat.color, borderColor: "transparent" }}>
                          {cat.name}
                        </span>
                      )}
                      <h3 className="font-display font-bold text-[17px] mt-2">{p.name}</h3>
                      {p.description && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3">{p.description}</p>}
                    </div>
                    <div className="flex items-end justify-between pt-3 border-t border-border">
                      <div>
                        <p className="font-display text-[22px] font-bold tabular-nums leading-none">{formatBRL(p.base_price)}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{p.recurring ? "recorrente" : "único"}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toast.info("Solicitação enviada ao seu consultor")}
                      >
                        Tenho interesse
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ===== DOCUMENTOS ===== */}
        <TabsContent value="docs" className="space-y-3">
          {pendingDocs > 0 && (
            <div className="vx-card p-4 border-warning/40 bg-warning/[0.04] flex items-start gap-3">
              <AlertCircle className="size-5 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold">{pendingDocs} documento(s) aguardando envio</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Anexe os arquivos solicitados abaixo para que possamos seguir com seu atendimento.
                </p>
              </div>
            </div>
          )}

          {docs.length === 0 ? (
            <Empty icon={FileText} title="Nenhum documento" desc="Quando seu consultor solicitar um documento, ele aparecerá aqui." />
          ) : (
            <div className="vx-card divide-y divide-border">
              {docs.map((d: any) => {
                const statusMeta =
                  d.status === "aprovado" ? { label: "Aprovado", icon: CheckCircle2, tone: "text-success bg-success/10" } :
                  d.status === "enviado" || d.status === "em_analise" ? { label: "Em análise", icon: Clock, tone: "text-info bg-info/10" } :
                  d.status === "reprovado" ? { label: "Reprovado", icon: AlertCircle, tone: "text-destructive bg-destructive/10" } :
                  d.status === "pendente_correcao" ? { label: "Pendente correção", icon: AlertCircle, tone: "text-orange-600 bg-orange-50" } :
                  d.status === "vencido" ? { label: "Vencido", icon: AlertCircle, tone: "text-slate-500 bg-slate-50" } :
                                            { label: "Aguardando envio", icon: Upload, tone: "text-warning bg-warning/10" };
                const StatusIcon = statusMeta.icon;
                const isUploading = uploadingDocId === d.id;
                const needsUpload = d.status === "solicitado" || d.status === "reprovado" || d.status === "pendente_correcao";

                return (
                  <div key={d.id} className="p-4 lg:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="size-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <FileText className="size-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[14px] truncate">{d.name}</p>
                      {d.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{d.description}</p>}
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-semibold ${statusMeta.tone}`}>
                          <StatusIcon className="size-3" /> {statusMeta.label}
                        </span>
                        {(d.status === "reprovado" || d.status === "pendente_correcao") && d.rejection_reason && (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-semibold text-destructive bg-destructive/5">
                            <AlertCircle className="size-3" /> Motivo: {d.rejection_reason}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground">Solicitado em {formatDate(d.created_at)}</span>
                        {d.due_date && <span className="text-[11px] text-orange-600 font-medium">Prazo: {formatDate(d.due_date)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {d.file_path && (
                        <Button size="sm" variant="outline" onClick={() => download(d.file_path, d.name)} className="gap-1.5">
                          <Download className="size-3.5" /> Baixar
                        </Button>
                      )}
                      {needsUpload && (
                        <>
                          <input
                            type="file"
                            ref={fileRef}
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUpload(d.id, f);
                              e.target.value = "";
                            }}
                          />
                          <Button
                            size="sm"
                            disabled={isUploading}
                            onClick={() => {
                              fileRef.current?.setAttribute("data-doc-id", d.id);
                              fileRef.current?.click();
                            }}
                            className="gap-1.5"
                          >
                            <Upload className="size-3.5" /> {isUploading ? "Enviando…" : d.file_path ? "Reenviar" : "Enviar"}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="solicitacoes" className="space-y-4">
          <ClientRequestsView requests={requests} client={client} />
        </TabsContent>

        {/* ===== CONTRATOS ===== */}
        <TabsContent value="contratos" className="space-y-3">
          {contracts.length === 0 ? (
            <Empty icon={ClipboardList} title="Nenhum contrato" desc="Seus contratos aparecerão aqui assim que forem gerados." />
          ) : (
            <div className="vx-card divide-y divide-border">
              {contracts.map((c: any) => {
                const tone =
                  c.status === "assinado" || c.status === "finalizado" ? "vx-pill-success" :
                  c.status === "enviado" ? "vx-pill-info" :
                  c.status === "cancelado" ? "vx-pill-danger" : "vx-pill-muted";
                return (
                  <div key={c.id} className="p-4 lg:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="size-11 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <ClipboardList className="size-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[14px] truncate">{c.name}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                        {c.products?.name && <span>{c.products.name}</span>}
                        {c.amount && <span className="vx-mono font-semibold text-foreground">{formatBRL(c.amount)}</span>}
                        <span>Criado em {formatDate(c.created_at)}</span>
                        {c.signed_at && <span className="text-success">Assinado em {formatDate(c.signed_at)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`vx-pill ${tone}`}>{c.status}</span>
                      {c.file_path && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={async () => {
                          const { data: f, error } = await supabase.storage.from("contracts").download(c.file_path);
                          if (error) return toast.error(error.message);
                          const url = URL.createObjectURL(f);
                          const a = document.createElement("a"); a.href = url; a.download = c.name; a.click();
                          URL.revokeObjectURL(url);
                        }}>
                          <Download className="size-3.5" /> Baixar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ===== FINANCEIRO ===== */}
        <TabsContent value="financeiro" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="vx-card p-5">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Mensalidade ativa</p>
              <p className="font-display text-[22px] font-bold tabular-nums mt-1.5">{formatBRL(monthlyTotal)}</p>
            </div>
            <div className="vx-card p-5">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Pagamentos pendentes</p>
              <p className="font-display text-[22px] font-bold tabular-nums mt-1.5">{upcomingPayments.length}</p>
            </div>
            <div className="vx-card p-5">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Em atraso</p>
              <p className={`font-display text-[22px] font-bold tabular-nums mt-1.5 ${overduePayments.length > 0 ? "text-destructive" : ""}`}>
                {overduePayments.length}
              </p>
            </div>
          </div>

          {payments.length > 0 && (
            <div className="vx-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <Receipt className="size-4 text-primary" />
                <p className="text-sm font-semibold">Cobranças e pagamentos</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 text-left font-semibold">Vencimento</th>
                    <th className="px-5 py-3 text-left font-semibold">Parcela</th>
                    <th className="px-5 py-3 text-right font-semibold">Valor</th>
                    <th className="px-5 py-3 text-left font-semibold">Método</th>
                    <th className="px-5 py-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.map((p: any) => {
                    const overdue = p.status !== "pago" && p.due_date && new Date(p.due_date) < new Date();
                    return (
                      <tr key={p.id} className={overdue ? "bg-destructive/5" : ""}>
                        <td className="px-5 py-3.5 text-xs">{p.due_date ? formatDate(p.due_date) : "—"}</td>
                        <td className="px-5 py-3.5 text-xs text-muted-foreground">{p.installment_number}/{p.installments_count}</td>
                        <td className="px-5 py-3.5 text-right vx-mono font-semibold">{formatBRL(p.amount)}</td>
                        <td className="px-5 py-3.5 text-xs text-muted-foreground">{p.payment_method ?? "—"}</td>
                        <td className="px-5 py-3.5">
                          <span className={`vx-pill ${
                            p.status === "pago" ? "vx-pill-success" :
                            overdue ? "vx-pill-danger" : "vx-pill-muted"
                          }`}>
                            {overdue ? "atrasado" : p.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {sales.length > 0 && (
            <div className="vx-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center gap-2">
                <ShoppingBag className="size-4 text-primary" />
                <p className="text-sm font-semibold">Histórico de contratações</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 text-left font-semibold">Data</th>
                    <th className="px-5 py-3 text-left font-semibold">Produto</th>
                    <th className="px-5 py-3 text-right font-semibold">Valor</th>
                    <th className="px-5 py-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sales.map((s: any) => (
                    <tr key={s.id}>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">{formatDate(s.sale_date)}</td>
                      <td className="px-5 py-3.5 font-medium">{s.products?.name ?? "—"}</td>
                      <td className="px-5 py-3.5 text-right vx-mono font-semibold">{formatBRL(s.amount)}</td>
                      <td className="px-5 py-3.5"><span className="vx-pill vx-pill-muted">{s.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {payments.length === 0 && sales.length === 0 && (
            <Empty icon={Receipt} title="Sem histórico financeiro" desc="Suas compras e cobranças aparecerão aqui." />
          )}
        </TabsContent>

        {/* ===== HISTÓRICO ===== */}
        <TabsContent value="historico" className="space-y-4">
          <div className="vx-card">
            <div className="p-4 border-b border-border flex items-center gap-2">
              <History className="size-4 text-primary" />
              <p className="text-sm font-semibold">Linha do tempo</p>
            </div>
            <div className="p-6">
              {timeline.length === 0 ? (
                <div className="text-center py-8">
                  <History className="size-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium">Nenhum evento registrado ainda.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {timeline.map((h: any) => (
                    <div key={h.id} className="relative pl-6 border-l-2 border-primary/20 last:border-0 pb-5 last:pb-0">
                      <div className="absolute left-[-9px] top-0 size-4 rounded-full bg-primary border-4 border-background shadow-sm" />
                      <p className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">{formatDate(h.created_at)}</p>
                      <p className="text-sm font-bold mt-1">{h.title}</p>
                      {h.description && <p className="text-xs text-muted-foreground mt-0.5">{h.description}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ClientRequestsView({ requests, client }: { requests: any[]; client: any }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeReqId, setActiveReqId] = useState<string | null>(null);

  const onUpload = async (reqId: string, file: File) => {
    setActiveReqId(reqId);
    const path = `client-requests/${client.id}/${reqId}-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
    if (upErr) { setActiveReqId(null); return toast.error(upErr.message); }

    const { data: publicData } = supabase.storage.from("documents").getPublicUrl(path);
    const { error: dbErr } = await supabase.from("document_requests").update({
      file_url: publicData.publicUrl,
      status: "enviado",
      submission_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", reqId);

    setActiveReqId(null);
    if (dbErr) return toast.error(dbErr.message);
    toast.success("Documento enviado com sucesso! Agora aguarde a análise.");
    qc.invalidateQueries({ queryKey: ["client-panel"] });
  };

  return (
    <div className="space-y-4">
      {requests.length === 0 ? (
        <Empty icon={Upload} title="Sem solicitações" desc="Seu consultor ainda não solicitou nenhum documento específico." />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {requests.map((r) => {
            const isPending = r.status === "solicitado" || r.status === "reprovado";
            const isReproved = r.status === "reprovado";
            const isApproved = r.status === "aprovado";
            
            return (
              <div key={r.id} className="vx-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 hover:border-primary/20 transition-all">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-[15px]">{r.request_title}</p>
                    <Badge variant="outline" className={cn("text-[9px] uppercase font-bold", 
                      isApproved ? "bg-success/5 text-success border-success/20" : 
                      isReproved ? "bg-destructive/5 text-destructive border-destructive/20" :
                      isPending ? "bg-warning/5 text-warning border-warning/20" : "bg-info/5 text-info border-info/20"
                    )}>
                      {r.status === 'solicitado' ? 'Pendente' : r.status === 'enviado' ? 'Em análise' : r.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{r.description || "Por favor, anexe o arquivo solicitado."}</p>
                  
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="size-3" /> Solicitado: {formatDate(r.requested_at)}</span>
                    {r.deadline && <span className="flex items-center gap-1 font-semibold text-orange-600"><Clock className="size-3" /> Prazo: {formatDate(r.deadline)}</span>}
                  </div>

                  {isReproved && r.rejection_reason && (
                    <div className="mt-3 p-2 rounded-lg bg-destructive/5 border border-destructive/10">
                      <p className="text-[11px] font-bold text-destructive flex items-center gap-1.5">
                        <AlertCircle className="size-3" /> Motivo da Reprovação:
                      </p>
                      <p className="text-xs text-destructive/80 mt-1">{r.rejection_reason}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="file"
                    className="hidden"
                    id={`file-input-${r.id}`}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUpload(r.id, f);
                    }}
                  />
                  {r.file_url && (
                    <Button variant="outline" size="sm" className="h-9 px-4 text-xs font-bold uppercase tracking-wider" onClick={() => window.open(r.file_url)}>
                      <Eye className="size-3.5 mr-2" /> Ver Enviado
                    </Button>
                  )}
                  {isPending && (
                    <Button
                      size="sm"
                      disabled={activeReqId === r.id}
                      onClick={() => document.getElementById(`file-input-${r.id}`)?.click()}
                      className="h-9 px-5 text-xs font-bold uppercase tracking-wider shadow-md bg-gradient-primary"
                    >
                      <Upload className="size-3.5 mr-2" />
                      {activeReqId === r.id ? "Enviando..." : "Enviar agora"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" }) {
  return (
    <div>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`font-display text-[22px] font-bold tabular-nums leading-none mt-1.5 ${tone === "warning" ? "text-warning" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function Empty({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="vx-card py-16 text-center">
      <Icon className="size-10 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
    </div>
  );
}
