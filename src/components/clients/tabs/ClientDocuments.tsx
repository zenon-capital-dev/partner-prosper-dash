import { useMemo, useRef, useState } from "react";
import { openDownloadUrl } from "@/lib/download";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, FileText, Check, X, Clock, Trash2, Eye, Pencil,
  Package, RefreshCw, MessageSquare, AlertCircle, Loader2, CheckCircle2, Upload, Mail,
  MessageCircle, ChevronDown
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem
} from "@/components/ui/dropdown-menu";

import { formatDate } from "@/lib/format";
import { nowBR } from "@/lib/datetime";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DocumentDialog } from "@/components/documents/DocumentDialog";
import { ClientDocumentFolders } from "@/components/documents/ClientDocumentFolders";
import { logTimeline } from "@/lib/timeline";
import { confirmAction } from "@/lib/confirm";
import { sanitizeStorageFileName, assertUploadFile, uploadErrorMessage } from "@/lib/uploads";
import { useAuth } from "@/hooks/useAuth";

const STATUS_META: Record<string, { label: string; tone: string; icon: any }> = {
  solicitado: { label: "Solicitado", tone: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  enviado: { label: "Enviado", tone: "bg-blue-50 text-blue-700 border-blue-200", icon: Loader2 },
  em_analise: { label: "Em análise", tone: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: Loader2 },
  aprovado: { label: "Aprovado", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  reprovado: { label: "Rejeitado", tone: "bg-rose-50 text-rose-700 border-rose-200", icon: AlertCircle },
  pendente_correcao: { label: "Reenvio", tone: "bg-orange-50 text-orange-700 border-orange-200", icon: RefreshCw },
  vencido: { label: "Vencido", tone: "bg-slate-100 text-slate-700 border-slate-200", icon: Clock },
};

export function ClientDocuments({ clientId }: { clientId: string; user_id?: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [defaultProductId, setDefaultProductId] = useState<string | null>(null);
  const adminFileRef = useRef<HTMLInputElement>(null);
  const [pendingUpload, setPendingUpload] = useState<{ doc?: any; productId?: string | null; source: "email" | "whatsapp" | "admin" } | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["client-docs-admin", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select(`*, products(id,name)`)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: clientProducts = [] } = useQuery({
    queryKey: ["client-products-for-docs", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_products")
        .select("id, custom_product_name, products(id,name)")
        .eq("client_id", clientId);
      return data ?? [];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["client-docs-admin", clientId] });

  const updateStatus = async (doc: any, status: string, extra: Record<string, any> = {}) => {
    const { error } = await supabase
      .from("documents")
      .update({ status: status as any, reviewed_at: new Date().toISOString(), ...extra })
      .eq("id", doc.id);
    if (error) return toast.error(error.message);
    await logTimeline(
      clientId,
      status === "aprovado" ? "document_approved" : "document_requested",
      `Documento ${STATUS_META[status]?.label.toLowerCase() || status}: ${doc.name}`,
      doc.products?.name ? `Produto: ${doc.products.name}` : undefined,
    );
    toast.success(`Status: ${STATUS_META[status]?.label || status}`);
    refresh();
  };

  const handleReject = async (doc: any) => {
    const reason = window.prompt("Motivo da rejeição:");
    if (!reason) return;
    await updateStatus(doc, "reprovado", { rejection_reason: reason });
  };

  const handleRequestResend = async (doc: any) => {
    const note = window.prompt("Comentário para reenvio (opcional):") || null;
    await updateStatus(doc, "pendente_correcao", { rejection_reason: note });
  };

  const handleAddNote = async (doc: any) => {
    const note = window.prompt("Observação interna:", doc.internal_notes || "");
    if (note === null) return;
    const { error } = await supabase.from("documents").update({ internal_notes: note }).eq("id", doc.id);
    if (error) return toast.error(error.message);
    toast.success("Observação salva");
    refresh();
  };

  const viewFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
    if (error) return toast.error(error.message);
    openDownloadUrl(data.signedUrl);
  };

  const deleteDoc = async (id: string) => {
    if (!(await confirmAction("Excluir esta solicitação?"))) return;
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Solicitação removida");
    refresh();
  };

  const triggerAdminUpload = (opts: { doc?: any; productId?: string | null; source: "email" | "whatsapp" | "admin" }) => {
    setPendingUpload(opts);
    setTimeout(() => adminFileRef.current?.click(), 0);
  };

  const handleAdminFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !pendingUpload) return;
    for (const file of files) {
      try {
        assertUploadFile(file);
      } catch (err: any) {
        toast.error(uploadErrorMessage(err));
        return;
      }
    }
    setUploading(true);
    const productSegment = pendingUpload.productId ?? "geral";
    const now = nowBR().toISOString();
    const rows: any[] = [];

    for (const [index, file] of files.entries()) {
      const path = `${clientId}/${productSegment}/${Date.now()}-${index}-${sanitizeStorageFileName(file.name)}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
      if (upErr) { toast.error(uploadErrorMessage(upErr)); setUploading(false); return; }

      const baseFields = {
        file_path: path,
        file_size: file.size,
        mime_type: file.type,
        uploaded_at: now,
        uploaded_by: user?.id ?? null,
        // O banco só aceita: client_upload, admin_upload, email, whatsapp, provider_upload, imported
        source: pendingUpload.source === "admin" ? "admin_upload" : pendingUpload.source,
        status: "em_analise" as const,
      };

      if (pendingUpload.doc?.id && index === 0 && !pendingUpload.doc.file_path) {
        const oldPath = pendingUpload.doc.file_path as string | undefined;
        const { error } = await supabase.from("documents").update(baseFields as any).eq("id", pendingUpload.doc.id);
        if (error) { toast.error(error.message); setUploading(false); return; }
        if (oldPath && oldPath !== path) {
          // limpa blob órfão; ignora erro (pode não ter permissão de delete)
          await supabase.storage.from("documents").remove([oldPath]).catch(() => {});
        }
      } else {
        rows.push({
          client_id: clientId,
          product_id: pendingUpload.productId ?? null,
          name: pendingUpload.doc?.id ? `${pendingUpload.doc.name} · ${file.name}` : file.name,
          description: pendingUpload.doc?.id ? `Arquivo adicional de ${pendingUpload.doc.name}` : `Anexado pelo admin (${pendingUpload.source})`,
          is_required: false,
          ...baseFields,
        });
      }
    }
    if (rows.length > 0) {
      const { error } = await supabase.from("documents").insert(rows as any);
      if (error) { toast.error(error.message); setUploading(false); return; }
    }
    toast.success(`${files.length} documento(s) anexado(s)`);
    setUploading(false);
    setPendingUpload(null);
    refresh();
  };

  const grouped = useMemo(() => {
    const groups = new Map<string, { name: string; productId: string | null; items: any[] }>();
    // Inicializa um bucket por produto contratado para que o admin veja produtos sem documentos ainda
    for (const cp of clientProducts) {
      const name = cp.products?.name || cp.custom_product_name || "Produto";
      const pid = cp.products?.id || null;
      const key = pid || `cp_${cp.id}`;
      if (!groups.has(key)) groups.set(key, { name, productId: pid, items: [] });
    }
    for (const d of docs) {
      const pid = d.products?.id || null;
      const key = pid || "__geral__";
      if (!groups.has(key)) {
        groups.set(key, { name: d.products?.name || "Documentos gerais", productId: pid, items: [] });
      }
      groups.get(key)!.items.push(d);
    }
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [docs, clientProducts]);

  const totals = {
    total: docs.length,
    pending: docs.filter((d: any) => ["solicitado", "pendente_correcao"].includes(d.status)).length,
    review: docs.filter((d: any) => ["enviado", "em_analise"].includes(d.status)).length,
    done: docs.filter((d: any) => d.status === "aprovado").length,
    rejected: docs.filter((d: any) => d.status === "reprovado").length,
  };

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-bold tracking-tight">Documentos por produto</h3>
          <p className="text-xs text-muted-foreground">Solicite, valide e acompanhe os arquivos de cada produto.</p>
        </div>
        <Button
          onClick={() => { setSelectedDoc(null); setDefaultProductId(null); setOpen(true); }}
          className="bg-indigo-600 hover:bg-indigo-700 h-10 px-5 gap-2"
        >
          <Plus className="size-4" /> Solicitar Documento
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryStat label="Total" value={totals.total} tone="text-slate-900" />
        <SummaryStat label="Pendentes" value={totals.pending} tone="text-amber-600" />
        <SummaryStat label="Em análise" value={totals.review} tone="text-blue-600" />
        <SummaryStat label="Aprovados" value={totals.done} tone="text-emerald-600" />
        <SummaryStat label="Rejeitados" value={totals.rejected} tone="text-rose-600" />
      </div>

      {isLoading ? (
        <div className="cp-panel p-12 text-center text-muted-foreground">Carregando documentos...</div>
      ) : grouped.length === 0 ? (
        <div className="cp-panel p-16 text-center border-dashed">
          <FileText className="size-10 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-sm font-bold text-muted-foreground">Nenhum produto contratado ainda</p>
          <p className="text-xs text-muted-foreground/70 mt-2">Adicione produtos ao cliente para organizar os documentos.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.name} className="cp-panel overflow-hidden">
              <header className="px-4 sm:px-5 py-4 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                    <Package className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Produto</p>
                    <h4 className="font-bold text-foreground truncate">{group.name}</h4>
                  </div>
                  <Badge variant="outline" className="ml-2 text-[10px]">{group.items.length} doc(s)</Badge>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 w-full sm:w-auto"
                        title="Anexar arquivo recebido em nome do cliente"
                        disabled={uploading}
                      >
                        <Upload className="size-3.5" /> Anexar em nome do cliente
                        <ChevronDown className="size-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => triggerAdminUpload({ productId: group.productId, source: "email" })}>
                        <Mail className="size-3.5 mr-2" /> Recebido por Email
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => triggerAdminUpload({ productId: group.productId, source: "whatsapp" })}>
                        <MessageCircle className="size-3.5 mr-2" /> Recebido por WhatsApp
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => triggerAdminUpload({ productId: group.productId, source: "admin" })}>
                        <Upload className="size-3.5 mr-2" /> Upload manual
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 w-full sm:w-auto"
                    onClick={() => {
                      setSelectedDoc(null);
                      setDefaultProductId(group.productId);
                      setOpen(true);
                    }}
                  >
                    <Plus className="size-3.5" /> Solicitar
                  </Button>
                </div>
              </header>

              {group.items.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Nenhum documento solicitado para este produto.
                </div>
              ) : (
                <ul className="divide-y divide-border/40">
                  {group.items.map((doc: any) => {
                    const meta = STATUS_META[doc.status] ?? STATUS_META.solicitado;
                    const Icon = meta.icon;
                    return (
                      <li key={doc.id} className="p-5 flex flex-col lg:flex-row lg:items-center gap-4 hover:bg-muted/20 transition-colors">
                        <div className={cn("size-11 rounded-xl flex items-center justify-center shrink-0 border", meta.tone)}>
                          <Icon className={cn("size-5", ["enviado", "em_analise"].includes(doc.status) && "animate-spin")} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-foreground">{doc.name}</p>
                            <Badge variant="outline" className={cn("text-[9px] uppercase tracking-widest", meta.tone)}>
                              {meta.label}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] uppercase tracking-widest",
                                doc.is_required
                                  ? "border-rose-200 text-rose-600 bg-rose-50"
                                  : "border-border text-muted-foreground"
                              )}
                            >
                              {doc.is_required ? "Obrigatório" : "Opcional"}
                            </Badge>
                          </div>
                          {doc.description && (
                            <p className="text-xs text-muted-foreground mt-1">{doc.description}</p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground/60">
                            {doc.due_date && (
                              <span className="flex items-center gap-1.5 text-amber-600">
                                <Clock className="size-3" /> Prazo {formatDate(doc.due_date)}
                              </span>
                            )}
                            {doc.uploaded_at && <span>Enviado {formatDate(doc.uploaded_at)}</span>}
                            {doc.uploaded_by && <span>{doc.source === "client_upload" ? "Enviado pelo cliente" : "Enviado pela Zenon"}</span>}
                            {doc.reviewed_at && <span>Revisado {formatDate(doc.reviewed_at)}</span>}
                          </div>
                          {doc.status === "reprovado" && doc.rejection_reason && (
                            <p className="text-xs text-rose-700 mt-2 bg-rose-50 px-3 py-2 rounded-lg border border-rose-200">
                              <strong>Motivo:</strong> {doc.rejection_reason}
                            </p>
                          )}
                          {doc.internal_notes && (
                            <p className="text-xs text-muted-foreground mt-2 bg-muted/40 px-3 py-2 rounded-lg border border-border/40">
                              <MessageSquare className="size-3 inline mr-1" /> {doc.internal_notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0 flex-wrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost" size="sm"
                                className="text-indigo-600 hover:bg-indigo-50 h-8 gap-1.5"
                                title="Anexar arquivo(s) recebido(s) em nome do cliente"
                                disabled={uploading}
                              >
                                <Upload className="size-3.5" /> {doc.file_path ? "Adicionar arquivo" : "Anexar pelo admin"}
                                <ChevronDown className="size-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => triggerAdminUpload({ doc, productId: doc.product_id, source: "email" })}>
                                <Mail className="size-3.5 mr-2" /> Recebido por Email
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => triggerAdminUpload({ doc, productId: doc.product_id, source: "whatsapp" })}>
                                <MessageCircle className="size-3.5 mr-2" /> Recebido por WhatsApp
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => triggerAdminUpload({ doc, productId: doc.product_id, source: "admin" })}>
                                <Upload className="size-3.5 mr-2" /> Upload manual
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {doc.source && doc.source !== "client_upload" && (
                            <Badge variant="outline" className="h-6 text-[9px] uppercase tracking-widest bg-indigo-50 border-indigo-200 text-indigo-700">
                              <Mail className="size-3 mr-1" /> {doc.source}
                            </Badge>
                          )}
                          {doc.file_path && (
                            <Button variant="ghost" size="sm" onClick={() => viewFile(doc.file_path)} className="h-8 gap-1.5">
                              <Eye className="size-3.5" /> Ver
                            </Button>
                          )}
                          {doc.status !== "aprovado" && doc.file_path && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => updateStatus(doc, "aprovado")}
                              className="text-emerald-600 hover:bg-emerald-50 h-8 gap-1.5"
                            >
                              <Check className="size-3.5" /> Aprovar
                            </Button>
                          )}
                          {doc.status !== "em_analise" && doc.file_path && doc.status !== "aprovado" && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => updateStatus(doc, "em_analise")}
                              className="text-blue-600 hover:bg-blue-50 h-8 gap-1.5"
                            >
                              <Loader2 className="size-3.5" /> Analisar
                            </Button>
                          )}
                          {doc.status !== "reprovado" && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => handleReject(doc)}
                              className="text-rose-600 hover:bg-rose-50 h-8 gap-1.5"
                            >
                              <X className="size-3.5" /> Rejeitar
                            </Button>
                          )}
                          {doc.file_path && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => handleRequestResend(doc)}
                              className="text-orange-600 hover:bg-orange-50 h-8 gap-1.5"
                            >
                              <RefreshCw className="size-3.5" /> Reenvio
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => { setSelectedDoc(doc); setDefaultProductId(doc.product_id ?? null); setOpen(true); }}
                            className="size-8 text-muted-foreground hover:text-indigo-600"
                            title="Editar solicitação"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            aria-label="Adicionar comentário"
                            onClick={() => handleAddNote(doc)}
                            className="size-8 text-muted-foreground hover:text-foreground"
                            title="Comentário"
                          >
                            <MessageSquare className="size-4" />
                          </Button>

                          <Button
                            variant="ghost" size="icon"
                            onClick={() => deleteDoc(doc.id)}
                            className="size-8 text-muted-foreground hover:text-rose-600"
                            title="Excluir"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <div className="pt-2">
        <ClientDocumentFolders clientId={clientId} viewerRole="admin" />
      </div>

      <DocumentDialog
        open={open}
        onOpenChange={setOpen}
        clientId={clientId}
        document={selectedDoc}
        defaultProductId={defaultProductId}
        onSuccess={refresh}
      />
      <input
        ref={adminFileRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleAdminFileSelected}
      />
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="cp-panel p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <p className={cn("text-2xl font-bold font-mono mt-1", tone)}>{value}</p>
    </div>
  );
}
