import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, FileText, Check, X, Clock, Trash2, Eye,
  Package, RefreshCw, MessageSquare, AlertCircle, Loader2, CheckCircle2
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DocumentDialog } from "@/components/documents/DocumentDialog";
import { logTimeline } from "@/lib/timeline";

const STATUS_META: Record<string, { label: string; tone: string; icon: any }> = {
  solicitado: { label: "Solicitado", tone: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Clock },
  enviado: { label: "Enviado", tone: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Loader2 },
  em_analise: { label: "Em análise", tone: "bg-primary/10 text-primary border-primary/20", icon: Loader2 },
  aprovado: { label: "Aprovado", tone: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  reprovado: { label: "Rejeitado", tone: "bg-rose-500/10 text-rose-400 border-rose-500/20", icon: AlertCircle },
  pendente_correcao: { label: "Reenvio", tone: "bg-orange-500/10 text-orange-400 border-orange-500/20", icon: RefreshCw },
  vencido: { label: "Vencido", tone: "bg-slate-500/10 text-slate-400 border-slate-500/20", icon: Clock },
};

export function ClientDocuments({ clientId }: { clientId: string; user_id?: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [defaultProductId, setDefaultProductId] = useState<string | null>(null);

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
    window.open(data.signedUrl, "_blank");
  };

  const deleteDoc = async (id: string) => {
    if (!confirm("Excluir esta solicitação?")) return;
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Solicitação removida");
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
          <h3 className="editorial-title text-xl">Documentos por produto</h3>
          <p className="editorial-label text-white/40">Solicite, valide e acompanhe os arquivos de cada produto.</p>
        </div>
        <Button
          onClick={() => { setSelectedDoc(null); setDefaultProductId(null); setOpen(true); }}
          className="btn-premium h-10 px-5 gap-2"
        >
          <Plus className="size-4" /> Solicitar Documento
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryStat label="Total" value={totals.total} tone="text-white" />
        <SummaryStat label="Pendentes" value={totals.pending} tone="text-amber-400" />
        <SummaryStat label="Em análise" value={totals.review} tone="text-blue-400" />
        <SummaryStat label="Aprovados" value={totals.done} tone="text-emerald-400" />
        <SummaryStat label="Rejeitados" value={totals.rejected} tone="text-rose-400" />
      </div>

      {isLoading ? (
        <div className="vx-card p-12 text-center text-white/20">Carregando documentos...</div>
      ) : grouped.length === 0 ? (
        <div className="vx-card p-16 text-center border-dashed">
          <FileText className="size-10 text-white/10 mx-auto mb-4" />
          <p className="editorial-title text-white/40">Nenhum produto contratado ainda</p>
          <p className="text-xs text-white/30 mt-2">Adicione produtos ao cliente para organizar os documentos.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.name} className="vx-card overflow-hidden">
              <header className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <Package className="size-5" />
                  </div>
                  <div>
                    <p className="editorial-label text-white/40">Produto</p>
                    <h4 className="font-bold text-white">{group.name}</h4>
                  </div>
                  <Badge variant="outline" className="ml-2 text-[10px]">{group.items.length} doc(s)</Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5"
                  onClick={() => {
                    setSelectedDoc(null);
                    setDefaultProductId(group.productId);
                    setOpen(true);
                  }}
                >
                  <Plus className="size-3.5" /> Solicitar
                </Button>
              </header>

              {group.items.length === 0 ? (
                <div className="p-8 text-center text-white/30 text-sm">
                  Nenhum documento solicitado para este produto.
                </div>
              ) : (
                <ul className="divide-y divide-white/[0.04]">
                  {group.items.map((doc: any) => {
                    const meta = STATUS_META[doc.status] ?? STATUS_META.solicitado;
                    const Icon = meta.icon;
                    return (
                      <li key={doc.id} className="p-5 flex flex-col lg:flex-row lg:items-center gap-4 hover:bg-white/[0.02] transition-colors">
                        <div className={cn("size-11 rounded-xl flex items-center justify-center shrink-0 border", meta.tone)}>
                          <Icon className={cn("size-5", ["enviado", "em_analise"].includes(doc.status) && "animate-spin")} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-white">{doc.name}</p>
                            <Badge variant="outline" className={cn("text-[9px] uppercase tracking-widest", meta.tone)}>
                              {meta.label}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] uppercase tracking-widest",
                                doc.is_required
                                  ? "border-rose-500/30 text-rose-400"
                                  : "border-white/10 text-white/40"
                              )}
                            >
                              {doc.is_required ? "Obrigatório" : "Opcional"}
                            </Badge>
                          </div>
                          {doc.description && (
                            <p className="text-xs text-white/50 mt-1">{doc.description}</p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] uppercase tracking-widest font-bold text-white/40">
                            {doc.due_date && (
                              <span className="flex items-center gap-1.5 text-amber-400/70">
                                <Clock className="size-3" /> Prazo {formatDate(doc.due_date)}
                              </span>
                            )}
                            {doc.uploaded_at && <span>Enviado {formatDate(doc.uploaded_at)}</span>}
                            {doc.uploader?.full_name && <span>Por {doc.uploader.full_name}</span>}
                            {doc.reviewed_at && <span>Revisado {formatDate(doc.reviewed_at)}</span>}
                          </div>
                          {doc.status === "reprovado" && doc.rejection_reason && (
                            <p className="text-xs text-rose-300 mt-2 bg-rose-500/10 px-3 py-2 rounded-lg border border-rose-500/20">
                              <strong>Motivo:</strong> {doc.rejection_reason}
                            </p>
                          )}
                          {doc.internal_notes && (
                            <p className="text-xs text-white/50 mt-2 bg-white/[0.03] px-3 py-2 rounded-lg border border-white/[0.05]">
                              <MessageSquare className="size-3 inline mr-1" /> {doc.internal_notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0 flex-wrap">
                          {doc.file_path && (
                            <Button variant="ghost" size="sm" onClick={() => viewFile(doc.file_path)} className="h-8 gap-1.5">
                              <Eye className="size-3.5" /> Ver
                            </Button>
                          )}
                          {doc.status !== "aprovado" && doc.file_path && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => updateStatus(doc, "aprovado")}
                              className="text-emerald-400 hover:bg-emerald-500/10 h-8 gap-1.5"
                            >
                              <Check className="size-3.5" /> Aprovar
                            </Button>
                          )}
                          {doc.status !== "em_analise" && doc.file_path && doc.status !== "aprovado" && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => updateStatus(doc, "em_analise")}
                              className="text-blue-400 hover:bg-blue-500/10 h-8 gap-1.5"
                            >
                              <Loader2 className="size-3.5" /> Analisar
                            </Button>
                          )}
                          {doc.status !== "reprovado" && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => handleReject(doc)}
                              className="text-rose-400 hover:bg-rose-500/10 h-8 gap-1.5"
                            >
                              <X className="size-3.5" /> Rejeitar
                            </Button>
                          )}
                          {doc.file_path && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => handleRequestResend(doc)}
                              className="text-orange-400 hover:bg-orange-500/10 h-8 gap-1.5"
                            >
                              <RefreshCw className="size-3.5" /> Reenvio
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => handleAddNote(doc)}
                            className="size-8 text-white/40 hover:text-white"
                            title="Comentário"
                          >
                            <MessageSquare className="size-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => deleteDoc(doc.id)}
                            className="size-8 text-white/20 hover:text-rose-500"
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

      <DocumentDialog
        open={open}
        onOpenChange={setOpen}
        clientId={clientId}
        document={selectedDoc}
        defaultProductId={defaultProductId}
        onSuccess={refresh}
      />
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="vx-card p-4">
      <p className="editorial-label text-white/40">{label}</p>
      <p className={cn("text-2xl font-bold font-mono mt-1", tone)}>{value}</p>
    </div>
  );
}
