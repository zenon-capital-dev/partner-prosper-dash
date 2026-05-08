import { useRef, useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, CheckCircle2, Clock, AlertCircle, Download, Loader2, Package } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type DocRequest = {
  id: string;
  client_id: string;
  product_id: string | null;
  request_title: string;
  description: string | null;
  status: string;
  file_url: string | null;
  deadline: string | null;
  rejection_reason: string | null;
  submission_date: string | null;
  approval_date: string | null;
  requested_at: string;
};

type Product = { id: string; name: string };

const STATUS_META: Record<string, { label: string; tone: string; icon: any }> = {
  solicitado: { label: "Pendente", tone: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300", icon: Clock },
  enviado: { label: "Analisando", tone: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300", icon: Loader2 },
  analisando: { label: "Analisando", tone: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300", icon: Loader2 },
  aprovado: { label: "Concluído", tone: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300", icon: CheckCircle2 },
  concluido: { label: "Concluído", tone: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300", icon: CheckCircle2 },
  reprovado: { label: "Reprovado", tone: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300", icon: AlertCircle },
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
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${clientId}/${req.id}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { error: updErr } = await supabase
        .from("document_requests")
        .update({ file_url: path, status: "enviado", submission_date: new Date().toISOString() })
        .eq("id", req.id);
      if (updErr) throw updErr;

      toast.success("Documento enviado para análise");
      qc.invalidateQueries({ queryKey: ["client-panel"] });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao enviar documento");
    } finally {
      setUploadingId(null);
    }
  }

  async function handleDownload(req: DocRequest) {
    if (!req.file_url) return;
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(req.file_url, 60);
    if (error || !data) return toast.error("Não foi possível baixar o arquivo");
    window.open(data.signedUrl, "_blank");
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
                      {req.deadline && <span>Prazo: {formatDate(req.deadline)}</span>}
                      {req.submission_date && <span>Enviado: {formatDate(req.submission_date)}</span>}
                      {req.approval_date && <span>Aprovado: {formatDate(req.approval_date)}</span>}
                    </div>
                    {req.status === "reprovado" && req.rejection_reason && (
                      <p className="text-xs text-rose-600 mt-2 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 rounded-lg">
                        <strong>Motivo:</strong> {req.rejection_reason}
                      </p>
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
                        onClick={() => document.getElementById(`upload-${req.id}`)?.click()}
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
