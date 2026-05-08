import { useRef, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, CheckCircle2, Clock, AlertCircle, Download, Loader2, Package, History as HistoryIcon, ChevronDown, ChevronUp, ShieldCheck, Info } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type DocRequest = {
  id: string;
  client_id: string;
  product_id: string | null;
  name: string; // Updated from request_title to name
  description: string | null;
  status: string;
  file_path: string | null; // Updated from file_url to file_path
  due_date: string | null; // Updated from deadline to due_date
  rejection_reason: string | null;
  uploaded_at: string | null; // Updated from submission_date
  reviewed_at: string | null; // Updated from approval_date
  created_at: string;
};

type Product = { id: string; name: string };

const STATUS_META: Record<string, { label: string; tone: string; icon: any }> = {
  solicitado: { label: "Pendente", tone: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300", icon: Clock },
  enviado: { label: "Enviado", tone: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300", icon: Loader2 },
  em_analise: { label: "Em Análise", tone: "bg-primary-muted text-primary border-primary/20", icon: Loader2 },
  aprovado: { label: "Aprovado", tone: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300", icon: CheckCircle2 },
  reprovado: { label: "Reprovado", tone: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300", icon: AlertCircle },
  pendente_correcao: { label: "Pendente Correção", tone: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertCircle },
  vencido: { label: "Vencido", tone: "bg-slate-100 text-slate-500 border-slate-200", icon: Clock },
};

export function ClientDocumentsTab({
  clientId,
  requests,
  products,
}: {
  clientId: string;
  requests: DocRequest[];
  products: Product[];
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [confirmReq, setConfirmReq] = useState<DocRequest | null>(null);
  const [historyFilter, setHistoryFilter] = useState<string>("todos");
  const [visibleHistoryCount, setVisibleHistoryCount] = useState<Record<string, number>>({});

  const { data: history } = useQuery({
    queryKey: ["document-history", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_history")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<string, { product: Product | null; items: DocRequest[] }>();
    for (const r of requests) {
      const key = r.product_id ?? "__sem_produto__";
      const product = products.find((p) => p.id === r.product_id) ?? null;
      if (!map.has(key)) map.set(key, { product, items: [] });
      map.get(key)!.items.push(r);
    }
    return Array.from(map.entries());
  }, [requests, products]);

  async function handleUpload(req: DocRequest, file: File) {
    try {
      setUploadingId(req.id);
      
      // Validações
      const maxSizeMB = 10;
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      
      if (file.size > maxSizeMB * 1024 * 1024) {
        throw new Error(`Arquivo muito grande. Limite de ${maxSizeMB}MB.`);
      }
      
      if (!allowedTypes.includes(file.type)) {
        throw new Error("Formato inválido. Use PDF, JPG ou PNG.");
      }

      const ext = file.name.split(".").pop() ?? "bin";
      const timestamp = Date.now();
      const path = `${clientId}/${req.id}/${timestamp}.${ext}`;
      const oldPath = req.file_path;

      // Upload file
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      // Update request status
      const { error: updErr } = await supabase
        .from("documents")
        .update({ 
          file_path: path, 
          status: "enviado", 
          uploaded_at: new Date().toISOString(),
          rejection_reason: null,
          file_size: file.size,
          mime_type: file.type
        })
        .eq("id", req.id);
      if (updErr) throw updErr;

      // Audit Log (if tables exist, or just toast success)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("audit_logs").insert({
          user_id: user?.id,
          action: "RE-UPLOAD",
          entity_type: "documents",
          entity_id: req.id,
          old_data: { file_path: oldPath },
          new_data: { file_path: path, file_name: file.name, size: file.size }
        });
      } catch (e) {
        console.warn("Could not write audit log", e);
      }

      toast.success("Documento enviado para análise");
      qc.invalidateQueries({ queryKey: ["client-panel"] });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao enviar documento");
    } finally {
      setUploadingId(null);
      setConfirmReq(null);
    }
  }

  async function downloadFile(url: string) {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(url, 3600);
    if (error || !data) return toast.error("Não foi possível acessar o arquivo");
    window.open(data.signedUrl, "_blank");
  }

  async function handleDownload(req: DocRequest) {
    if (!req.file_path) return;
    await downloadFile(req.file_path);
  }

  if (requests.length === 0) {
    return (
      <div className="vx-card bg-white dark:bg-slate-900/40 rounded-[24px] p-12 text-center border-slate-100 dark:border-white/5">
        <FileText className="size-12 text-primary/30 mx-auto mb-4" />
        <h3 className="font-editorial text-2xl font-bold text-slate-900 dark:text-white">Nenhum documento solicitado</h3>
        <p className="text-muted-foreground mt-2 text-sm">Quando sua equipe solicitar documentos, eles aparecerão aqui.</p>
      </div>
    );
  }

  const totals = {
    pending: requests.filter((r) => r.status === "solicitado" || r.status === "reprovado").length,
    review: requests.filter((r) => r.status === "enviado" || r.status === "analisando").length,
    done: requests.filter((r) => r.status === "aprovado" || r.status === "concluido").length,
  };

  return (
    <div className="space-y-8">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard tone="warning" label="Pendentes" value={totals.pending} icon={Clock} />
        <SummaryCard tone="info" label="Em análise" value={totals.review} icon={Loader2} />
        <SummaryCard tone="success" label="Concluídos" value={totals.done} icon={CheckCircle2} />
      </div>

      {grouped.map(([key, { product, items }]) => (
        <div key={key} className="vx-card bg-white dark:bg-slate-900/40 rounded-[24px] overflow-hidden border-slate-100 dark:border-white/5">
          <div className="px-6 py-5 border-b border-slate-50 dark:border-white/5 bg-slate-50/30 dark:bg-white/5 flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Package className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Produto</p>
              <h3 className="font-editorial text-lg font-bold text-slate-900 dark:text-white">{product?.name ?? "Documentos gerais"}</h3>
            </div>
          </div>

          <div className="divide-y divide-slate-50 dark:divide-white/5">
            {items.map((req) => {
              const meta = STATUS_META[req.status] ?? STATUS_META.solicitado;
              const Icon = meta.icon;
              const isUploading = uploadingId === req.id;
              const overdue = req.deadline && new Date(req.deadline) < new Date() && req.status === "solicitado";

              return (
                <div key={req.id} className="p-6 flex flex-col md:flex-row md:items-center gap-4 hover:bg-slate-50/40 dark:hover:bg-white/5 transition-colors">
                  <div className={cn("size-12 rounded-xl flex items-center justify-center shrink-0", meta.tone, "border")}>
                    <Icon className={cn("size-5", req.status === "enviado" || req.status === "analisando" ? "animate-spin" : "")} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-slate-900 dark:text-white">{req.request_title}</p>
                      <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider", meta.tone)}>
                        {meta.label}
                      </Badge>
                      {overdue && <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200">Atrasado</Badge>}
                    </div>
                    {req.description && <p className="text-sm text-muted-foreground mt-1">{req.description}</p>}
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      {req.deadline && <span className="flex items-center gap-1"><Clock className="size-3" /> Prazo: {formatDate(req.deadline)}</span>}
                      {req.submission_date && <span>Último envio: {formatDate(req.submission_date)}</span>}
                    </div>

                    {req.status === "reprovado" && req.rejection_reason && (
                      <p className="text-xs text-rose-600 mt-2 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 rounded-lg border border-rose-100 dark:border-rose-500/20">
                        <strong>Motivo do reprovado:</strong> {req.rejection_reason}
                      </p>
                    )}

                    {/* Histórico Colapsável com Timeline */}
                    {history?.some(h => h.request_id === req.id) && (
                      <Collapsible
                        open={openHistory === req.id}
                        onOpenChange={() => {
                          setOpenHistory(openHistory === req.id ? null : req.id);
                          setHistoryFilter("todos");
                        }}
                        className="mt-6"
                      >
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 text-[11px] uppercase tracking-wider font-bold text-primary px-0 hover:bg-transparent group/btn">
                            <HistoryIcon className="size-3.5 mr-2 group-hover/btn:rotate-[-30deg] transition-transform" />
                            Histórico de Versões
                            {openHistory === req.id ? <ChevronUp className="size-4 ml-1.5" /> : <ChevronDown className="size-4 ml-1.5" />}
                          </Button>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent className="mt-4 pt-4 border-t border-slate-50 dark:border-white/5 animate-fade-down">
                          {/* Filtros do Histórico */}
                          <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
                            {["todos", "enviado", "aprovado", "reprovado"].map((f) => (
                              <button
                                key={f}
                                onClick={() => setHistoryFilter(f)}
                                className={cn(
                                  "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all shrink-0",
                                  historyFilter === f 
                                    ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900" 
                                    : "bg-transparent text-muted-foreground border-slate-200 dark:border-white/10 hover:border-primary/30"
                                )}
                              >
                                {f}
                              </button>
                            ))}
                          </div>

                          <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-slate-100 dark:before:bg-white/5">
                            {(() => {
                              const filtered = history
                                ?.filter((h) => h.request_id === req.id)
                                .filter((h) => historyFilter === "todos" || h.status === historyFilter);
                              
                              const limit = visibleHistoryCount[req.id] || 3;
                              const displayed = filtered?.slice(0, limit);
                              const hasMore = (filtered?.length || 0) > limit;

                              return (
                                <>
                                  {displayed?.map((h) => (
                                    <div key={h.id} className="relative pl-8 group/history">
                                      {/* Timeline Dot */}
                                      <div className={cn(
                                        "absolute left-0 top-1.5 size-[23px] rounded-full border-4 border-white dark:border-slate-950 flex items-center justify-center transition-transform group-hover/history:scale-110",
                                        STATUS_META[h.status]?.tone.split(' ')[0] || "bg-slate-200"
                                      )}>
                                        <div className="size-1.5 rounded-full bg-current opacity-60" />
                                      </div>

                                      <div className="space-y-1.5">
                                        <div className="flex items-center justify-between gap-4">
                                          <span className="text-[11px] font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                                            {formatDate(h.created_at)}
                                          </span>
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-7 text-[10px] text-primary hover:bg-primary/5 rounded-lg px-2"
                                            onClick={() => downloadFile(h.file_url)}
                                          >
                                            <Download className="size-3 mr-1.5" /> Baixar Versão
                                          </Button>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className={cn("text-[9px] font-bold uppercase tracking-widest px-1.5 py-0 h-4", STATUS_META[h.status]?.tone || "bg-slate-50")}>
                                            {STATUS_META[h.status]?.label || h.status}
                                          </Badge>
                                          {h.rejection_reason && (
                                            <span className="text-[10px] text-rose-500 italic font-medium">Motivo: {h.rejection_reason}</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  
                                  {hasMore && (
                                    <div className="pl-8">
                                      <Button 
                                        variant="link" 
                                        size="sm" 
                                        className="text-[10px] font-bold uppercase tracking-widest p-0 h-auto text-muted-foreground hover:text-primary"
                                        onClick={() => setVisibleHistoryCount({ ...visibleHistoryCount, [req.id]: limit + 3 })}
                                      >
                                        Carregar mais versões...
                                      </Button>
                                    </div>
                                  )}

                                  {filtered?.length === 0 && (
                                    <p className="pl-8 text-[11px] italic text-muted-foreground py-2">Nenhuma versão encontrada para este filtro.</p>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {req.file_url && (
                      <Button variant="outline" size="sm" className="rounded-xl border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5" onClick={() => handleDownload(req)}>
                        <Download className="size-4 mr-1.5" /> Ver
                      </Button>
                    )}
                    
                    <input
                      type="file"
                      className="hidden"
                      id={`upload-${req.id}`}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUpload(req, f);
                        e.target.value = "";
                      }}
                    />

                    {/* Botão Anexar ou Reenviar */}
                    {(req.status === "solicitado" || req.status === "reprovado" || req.file_url) && (
                      <Button
                        size="sm"
                        variant={req.file_url ? "outline" : "default"}
                        className={cn(
                          "rounded-xl transition-all font-semibold",
                          !req.file_url && "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm",
                          req.file_url && "border-primary/20 text-primary hover:bg-primary/5 dark:hover:bg-primary/10"
                        )}
                        disabled={isUploading}
                        onClick={() => {
                          if (req.file_url) {
                            setConfirmReq(req);
                          } else {
                            document.getElementById(`upload-${req.id}`)?.click();
                          }
                        }}
                      >
                        {isUploading ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Upload className="size-4 mr-1.5" />}
                        {isUploading ? "Enviando..." : req.file_url ? "Reenviar" : "Anexar Arquivo"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Modal de Confirmação */}
      <AlertDialog open={!!confirmReq} onOpenChange={() => setConfirmReq(null)}>
        <AlertDialogContent className="rounded-[24px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-editorial text-2xl">Confirmar novo envio?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Ao enviar um novo arquivo para <strong className="text-slate-900 dark:text-white">"{confirmReq?.request_title}"</strong>, 
              o arquivo anterior será substituído e o processo de análise será reiniciado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl border-slate-200">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="rounded-xl bg-primary"
              onClick={() => document.getElementById(`upload-${confirmReq?.id}`)?.click()}
            >
              Confirmar e Escolher Arquivo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone: "warning" | "info" | "success" }) {
  const colors = {
    warning: "text-amber-500 bg-amber-50 dark:bg-amber-500/10",
    info: "text-blue-500 bg-blue-50 dark:bg-blue-500/10",
    success: "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10",
  }[tone];
  return (
    <div className="vx-card p-5 bg-white dark:bg-slate-900/40 border-slate-100 dark:border-white/5 rounded-2xl flex items-center gap-4">
      <div className={cn("size-12 rounded-xl flex items-center justify-center", colors)}>
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        <p className="font-editorial text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
