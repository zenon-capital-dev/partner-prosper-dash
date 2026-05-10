import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { FileText, Download, Check, X, Clock, FilePlus, Eye, AlertCircle, MessageSquare, History, Search, RefreshCw, Lock, Unlock, MoreVertical, Filter } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { DocumentDialog } from "@/components/documents/DocumentDialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatCard } from "@/components/StatCard";
import { logAudit } from "@/lib/audit";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export type DocumentStatus = 'solicitado' | 'enviado' | 'em_analise' | 'aprovado' | 'reprovado' | 'pendente_correcao' | 'vencido';

const statusConfig: Record<DocumentStatus, { label: string; color: string; icon: any }> = {
  solicitado: { label: "Solicitado", color: "bg-warning-muted text-warning border-warning/20", icon: Clock },
  enviado: { label: "Enviado", color: "bg-info-muted text-info border-info/20", icon: FileText },
  em_analise: { label: "Em análise", color: "bg-primary-muted text-primary border-primary/20", icon: Eye },
  aprovado: { label: "Aprovado", color: "bg-success-muted text-success border-success/20", icon: Check },
  reprovado: { label: "Reprovado", color: "bg-destructive-muted text-destructive border-destructive/20", icon: X },
  pendente_correcao: { label: "Pendente correção", color: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertCircle },
  vencido: { label: "Vencido", color: "bg-slate-100 text-slate-500 border-slate-200", icon: History },
};

type ActionMode = "reject" | "request_resend" | "comment" | null;

export default function Documents() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [requiredFilter, setRequiredFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Action dialog state (reject/request_resend/comment)
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [actionDoc, setActionDoc] = useState<any>(null);
  const [actionReason, setActionReason] = useState("");

  const { data: docs, refetch } = useQuery({
    queryKey: ["docs-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select(`
          *,
          clients(id, full_name),
          products(id, name),
          client_products(
            id,
            custom_product_name,
            products:product_id(name),
            service_providers:service_provider_id(id, name)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  // Resolve user names for uploaded_by / approved_by
  const userIds = useMemo(() => {
    const ids = new Set<string>();
    (docs ?? []).forEach((d: any) => {
      if (d.uploaded_by) ids.add(d.uploaded_by);
      if (d.approved_by) ids.add(d.approved_by);
      if (d.requested_by) ids.add(d.requested_by);
    });
    return Array.from(ids);
  }, [docs]);

  const { data: profiles } = useQuery({
    queryKey: ["docs-profiles", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
      return data ?? [];
    },
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, any>();
    (profiles ?? []).forEach((p: any) => m.set(p.id, p));
    return m;
  }, [profiles]);

  const updateStatus = async (id: string, status: DocumentStatus, extra: Partial<any> = {}) => {
    const updateData: any = { status, reviewed_at: new Date().toISOString(), ...extra };
    if (status === "aprovado") {
      const { data: { user } } = await supabase.auth.getUser();
      updateData.approved_by = user?.id ?? null;
    }
    const { error } = await supabase.from("documents").update(updateData).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Documento atualizado para ${statusConfig[status].label}`);
    logAudit(`DOCUMENT_${status.toUpperCase()}`, "documents", id, extra);
    refetch();
  };

  const viewFile = async (doc: any) => {
    if (!doc.file_path) return toast.error("Arquivo ainda não enviado");
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 3600);
    if (error) { toast.error(error.message); return; }
    logAudit("DOCUMENT_VIEW", "documents", doc.id, { name: doc.name });
    window.open(data.signedUrl, "_blank");
  };

  const downloadFile = async (doc: any) => {
    if (!doc.file_path) return toast.error("Arquivo ainda não enviado");
    const { data, error } = await supabase.storage.from("documents").download(doc.file_path);
    if (error) return toast.error(error.message);
    logAudit("DOCUMENT_DOWNLOAD", "documents", doc.id, { name: doc.name });
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = doc.name; a.click();
  };

  const toggleVisibility = async (doc: any) => {
    const { error } = await supabase.from("documents").update({ is_public: !doc.is_public }).eq("id", doc.id);
    if (error) return toast.error(error.message);
    toast.success(`Visibilidade alterada para ${!doc.is_public ? "público" : "interno"}`);
    refetch();
  };

  const openActionDialog = (mode: ActionMode, doc: any) => {
    setActionMode(mode);
    setActionDoc(doc);
    setActionReason("");
  };

  const submitActionDialog = async () => {
    if (!actionDoc || !actionMode) return;
    if (actionMode !== "comment" && !actionReason.trim()) {
      return toast.error("É obrigatório informar o motivo");
    }
    if (actionMode === "reject") {
      await updateStatus(actionDoc.id, "reprovado", { rejection_reason: actionReason });
    } else if (actionMode === "request_resend") {
      await updateStatus(actionDoc.id, "pendente_correcao", { rejection_reason: actionReason });
    } else if (actionMode === "comment") {
      const prev = actionDoc.internal_notes ?? "";
      const stamp = new Date().toLocaleString("pt-BR");
      const merged = (prev ? prev + "\n\n" : "") + `[${stamp}] ${actionReason || "(sem texto)"}`;
      const { error } = await supabase.from("documents").update({ internal_notes: merged }).eq("id", actionDoc.id);
      if (error) return toast.error(error.message);
      toast.success("Comentário adicionado");
      refetch();
    }
    setActionMode(null);
    setActionDoc(null);
    setActionReason("");
  };

  const allDocs = docs ?? [];

  // Build filter options
  const clientOptions = useMemo(() => {
    const m = new Map<string, string>();
    allDocs.forEach((d: any) => { if (d.clients?.id) m.set(d.clients.id, d.clients.full_name); });
    return Array.from(m.entries());
  }, [allDocs]);

  const productOptions = useMemo(() => {
    const m = new Map<string, string>();
    allDocs.forEach((d: any) => {
      const id = d.product_id || d.client_products?.products?.id;
      const name = d.products?.name || d.client_products?.products?.name || d.client_products?.custom_product_name;
      if (id && name) m.set(id, name);
    });
    return Array.from(m.entries());
  }, [allDocs]);

  const providerOptions = useMemo(() => {
    const m = new Map<string, string>();
    allDocs.forEach((d: any) => {
      const sp = d.client_products?.service_providers;
      if (sp?.id) m.set(sp.id, sp.name);
    });
    return Array.from(m.entries());
  }, [allDocs]);

  const kpis = useMemo(() => ({
    total: allDocs.length,
    pendentes: allDocs.filter((d: any) => ['solicitado', 'enviado', 'em_analise', 'pendente_correcao'].includes(d.status)).length,
    aprovados: allDocs.filter((d: any) => d.status === 'aprovado').length,
    reprovados: allDocs.filter((d: any) => d.status === 'reprovado' || d.status === 'vencido').length,
  }), [allDocs]);

  const filteredDocs = useMemo(() => allDocs.filter((d: any) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (clientFilter !== "all" && d.clients?.id !== clientFilter) return false;
    if (productFilter !== "all") {
      const pid = d.product_id || d.client_products?.products?.id;
      if (pid !== productFilter) return false;
    }
    if (providerFilter !== "all" && d.client_products?.service_providers?.id !== providerFilter) return false;
    if (requiredFilter === "required" && !d.is_required) return false;
    if (requiredFilter === "optional" && d.is_required) return false;
    if (requiredFilter === "pending" && !['solicitado', 'enviado', 'em_analise', 'pendente_correcao'].includes(d.status)) return false;
    if (requiredFilter === "rejected" && !['reprovado', 'vencido'].includes(d.status)) return false;
    if (dateFrom) {
      const ref = d.uploaded_at || d.requested_at || d.created_at;
      if (!ref || new Date(ref) < new Date(dateFrom)) return false;
    }
    if (dateTo) {
      const ref = d.uploaded_at || d.requested_at || d.created_at;
      if (!ref || new Date(ref) > new Date(dateTo + "T23:59:59")) return false;
    }
    if (search) {
      const hay = `${d.name} ${d.clients?.full_name ?? ''} ${d.products?.name ?? ''}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  }), [allDocs, search, statusFilter, clientFilter, productFilter, providerFilter, requiredFilter, dateFrom, dateTo]);

  const clearFilters = () => {
    setStatusFilter("all"); setClientFilter("all"); setProductFilter("all");
    setProviderFilter("all"); setRequiredFilter("all"); setDateFrom(""); setDateTo(""); setSearch("");
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Central de Documentos"
          description="Gerencie todos os documentos vinculados a clientes, produtos e demandas."
        />
        <Button onClick={() => { setSelectedDoc(null); setIsDialogOpen(true); }} className="gap-2 self-start">
          <FilePlus className="size-4" /> Solicitar Documento
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total" value={String(kpis.total)} icon={FileText} iconColor="primary" />
        <StatCard label="Pendentes" value={String(kpis.pendentes)} icon={Clock} iconColor="warning" />
        <StatCard label="Aprovados" value={String(kpis.aprovados)} icon={Check} iconColor="success" />
        <StatCard label="Reprovados / vencidos" value={String(kpis.reprovados)} icon={X} iconColor="destructive" />
      </div>

      {/* Filters */}
      <div className="vx-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Filter className="size-4 text-muted-foreground" /> Filtros
          </div>
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">Limpar</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative md:col-span-2 lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por documento, cliente ou produto..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(statusConfig).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={requiredFilter} onValueChange={setRequiredFilter}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="required">Apenas obrigatórios</SelectItem>
              <SelectItem value="optional">Apenas opcionais</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="rejected">Rejeitados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger><SelectValue placeholder="Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clientOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os produtos</SelectItem>
              {productOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger><SelectValue placeholder="Prestador" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os prestadores</SelectItem>
              {providerOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="De" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="Até" />
          </div>
        </div>
      </div>

      <div className="vx-card overflow-hidden">
        {filteredDocs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Nenhum documento encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="px-4 py-4 text-left">Documento / Cliente</th>
                  <th className="px-4 py-4 text-left">Produto / Demanda</th>
                  <th className="px-4 py-4 text-left">Status</th>
                  <th className="px-4 py-4 text-left">Enviado por</th>
                  <th className="px-4 py-4 text-left">Aprovado por</th>
                  <th className="px-4 py-4 text-left">Prestador</th>
                  <th className="px-4 py-4 text-left">Datas</th>
                  <th className="px-4 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDocs.map((d: any) => {
                  const config = statusConfig[d.status as DocumentStatus] || statusConfig.solicitado;
                  const StatusIcon = config.icon;
                  const productName = d.products?.name || d.client_products?.products?.name || d.client_products?.custom_product_name || "Geral";
                  const provider = d.client_products?.service_providers;
                  const uploader = d.uploaded_by ? profileMap.get(d.uploaded_by) : null;
                  const approver = d.approved_by ? profileMap.get(d.approved_by) : null;

                  return (
                    <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`size-10 rounded-lg ${config.color.split(' ')[0]} flex items-center justify-center shrink-0`}>
                            <FileText className="size-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">{d.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{d.clients?.full_name || "—"}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Badge variant="secondary" className="text-[9px] font-bold py-0 h-4 border-none opacity-70">
                                {d.is_required ? "OBRIGATÓRIO" : "OPCIONAL"}
                              </Badge>
                              <Badge variant="outline" className="text-[9px] font-bold py-0 h-4 border-none opacity-50">
                                {d.is_public ? "PÚBLICO" : "INTERNO"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs font-medium text-foreground">{productName}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className={`w-fit gap-1 text-[10px] font-bold uppercase py-0.5 ${config.color}`}>
                            <StatusIcon className="size-2.5" />
                            {config.label}
                          </Badge>
                          {d.rejection_reason && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="flex items-center gap-1 text-[10px] text-destructive hover:underline text-left mt-1">
                                  <AlertCircle className="size-2.5" /> Ver motivo
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">{d.rejection_reason}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs text-muted-foreground">
                          {uploader?.full_name || uploader?.email || (d.uploaded_at ? "—" : "Não enviado")}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs text-muted-foreground">
                          {approver?.full_name || approver?.email || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs font-medium text-foreground">{provider?.name || "—"}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-0.5">
                          <p className="text-[11px] text-muted-foreground">
                            <span className="font-medium">Solic.:</span> {formatDate(d.requested_at || d.created_at)}
                          </p>
                          {d.due_date && (
                            <p className="text-[11px] text-muted-foreground">
                              <span className="font-medium">Prazo:</span> {formatDate(d.due_date)}
                            </p>
                          )}
                          {d.uploaded_at && (
                            <p className="text-[11px] text-success">
                              <span className="font-medium">Enviado:</span> {formatDate(d.uploaded_at)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {d.file_path && (
                            <>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="size-8" onClick={() => viewFile(d)}>
                                      <Eye className="size-4 text-muted-foreground" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Visualizar</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="size-8" onClick={() => downloadFile(d)}>
                                      <Download className="size-4 text-muted-foreground" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Baixar</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="size-8">
                                <MoreVertical className="size-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel className="text-xs">Análise</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => updateStatus(d.id, "aprovado")} className="text-success">
                                <Check className="size-4 mr-2" /> Aprovar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateStatus(d.id, "em_analise")}>
                                <Eye className="size-4 mr-2" /> Marcar em análise
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openActionDialog("request_resend", d)} className="text-orange-600">
                                <RefreshCw className="size-4 mr-2" /> Solicitar reenvio
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openActionDialog("reject", d)} className="text-destructive">
                                <X className="size-4 mr-2" /> Rejeitar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs">Outras ações</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => openActionDialog("comment", d)}>
                                <MessageSquare className="size-4 mr-2" /> Adicionar comentário
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleVisibility(d)}>
                                {d.is_public ? <Lock className="size-4 mr-2" /> : <Unlock className="size-4 mr-2" />}
                                Tornar {d.is_public ? "interno" : "público"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setSelectedDoc(d); setIsDialogOpen(true); }}>
                                <FilePlus className="size-4 mr-2" /> Editar solicitação
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DocumentDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        document={selectedDoc}
        onSuccess={refetch}
      />

      {/* Reject / Request resend / Comment dialog */}
      <Dialog open={actionMode !== null} onOpenChange={(o) => { if (!o) { setActionMode(null); setActionDoc(null); setActionReason(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionMode === "reject" && "Rejeitar documento"}
              {actionMode === "request_resend" && "Solicitar reenvio"}
              {actionMode === "comment" && "Adicionar comentário"}
            </DialogTitle>
            <DialogDescription>
              {actionMode === "reject" && "Informe o motivo da reprovação. Esse motivo será exibido ao cliente para que possa reenviar o documento correto."}
              {actionMode === "request_resend" && "Informe o motivo / orientação para o reenvio. O cliente receberá essa mensagem."}
              {actionMode === "comment" && "Adicione uma observação interna a este documento."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>
              {actionMode === "comment" ? "Comentário" : "Motivo"}
              {actionMode !== "comment" && <span className="text-destructive ml-1">*</span>}
            </Label>
            <Textarea
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              rows={5}
              placeholder={actionMode === "reject" ? "Ex.: Documento ilegível, favor reenviar com melhor qualidade." : ""}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionMode(null)}>Cancelar</Button>
            <Button onClick={submitActionDialog} variant={actionMode === "reject" ? "destructive" : "default"}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
