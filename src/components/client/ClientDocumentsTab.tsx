import { useRef, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, CheckCircle2, Clock, AlertCircle, Download, Loader2, Package } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { assertUploadFile, uploadErrorMessage } from "@/lib/uploads";
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

type DocRequest = {
  id: string;
  source?: "documents" | "client_document_requests" | "document_requests";
  client_id: string;
  product_id: string | null;
  client_product_id: string | null;
  product_name?: string | null;
  client_name?: string | null;
  name: string;
  description: string | null;
  status: string;
  file_path: string | null;
  file_url?: string | null;
  due_date: string | null;
  rejection_reason: string | null;
  uploaded_at: string | null;
  priority?: string | null;
  submission_date?: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type Product = { id: string; name: string };

const STATUS_META: Record<string, { label: string; tone: string; icon: any }> = {
  pendente: { label: "Pendente", tone: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  solicitado: { label: "Pendente", tone: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  enviado: { label: "Enviado", tone: "bg-blue-50 text-blue-700 border-blue-200", icon: Loader2 },
  em_analise: { label: "Em Análise", tone: "bg-primary-muted text-primary border-primary/20", icon: Loader2 },
  aprovado: { label: "Aprovado", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  reprovado: { label: "Rejeitado", tone: "bg-rose-50 text-rose-700 border-rose-200", icon: AlertCircle },
  pendente_correcao: { label: "Reenvio Necessário", tone: "bg-orange-100 text-orange-700 border-orange-200", icon: AlertCircle },
  atrasado: { label: "Atrasado", tone: "bg-rose-100 text-rose-700 border-rose-300", icon: AlertCircle },
  vencido: { label: "Vencido", tone: "bg-slate-100 text-slate-500 border-slate-200", icon: Clock },
};

function getEffectiveStatus(req: { status: string; due_date: string | null }): string {
  const pending = ["pendente", "solicitado", "reprovado", "pendente_correcao"].includes(req.status);
  if (pending && req.due_date && new Date(req.due_date) < new Date(new Date().toDateString())) {
    return "atrasado";
  }
  return req.status;
}

const STATUS_ORDER: Record<string, number> = {
  atrasado: 0, reprovado: 1, pendente_correcao: 2, pendente: 3, solicitado: 3,
  enviado: 4, em_analise: 5, aprovado: 6, vencido: 7,
};

export function ClientDocumentsTab({
  clientId,
  requests,
  products,
  getUploadFolder,
  invalidateKeys,
}: {
  clientId: string;
  requests: DocRequest[];
  products: Product[];
  getUploadFolder?: (request: DocRequest) => string | null | undefined;
  invalidateKeys?: unknown[][];
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [confirmReq, setConfirmReq] = useState<DocRequest | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, { product: Product | null; items: DocRequest[] }>();
    for (const r of requests) {
      const key = r.client_product_id ?? r.product_id ?? "__sem_produto__";
      const product = products.find((p) => p.id === r.product_id) ?? (r.product_name ? { id: r.product_id ?? key, name: r.product_name } : null);
      if (!map.has(key)) map.set(key, { product, items: [] });
      map.get(key)!.items.push(r);
    }
    // Sort items inside each group by status priority then due date
    map.forEach((group) => {
      group.items.sort((a, b) => {
        const ea = getEffectiveStatus(a);
        const eb = getEffectiveStatus(b);
        const oa = STATUS_ORDER[ea] ?? 99;
        const ob = STATUS_ORDER[eb] ?? 99;
        if (oa !== ob) return oa - ob;
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return da - db;
      });
    });
    return Array.from(map.entries());
  }, [requests, products]);

  async function handleUpload(req: DocRequest, file: File) {
    try {
      setUploadingId(req.id);
      assertUploadFile(file);
      const ext = file.name.split(".").pop() ?? "bin";
      const folder = getUploadFolder?.(req) || clientId;
      const path = `${folder}/${req.id}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
      if (upErr) throw upErr;

      const now = new Date().toISOString();
      let updErr: any = null;
      if (req.source === "client_document_requests") {
        const { error } = await supabase
          .from("client_document_requests")
          .update({ file_url: path, status: "enviado", updated_at: now })
          .eq("id", req.id);
        updErr = error;
      } else if (req.source === "document_requests") {
        const { error } = await supabase
          .from("document_requests")
          .update({ file_url: path, status: "submitted", updated_at: now, submission_date: now } as any)
          .eq("id", req.id);
        updErr = error;
      } else {
        const { error } = await supabase
          .from("documents")
          .update({ file_path: path, status: "enviado", uploaded_at: now, rejection_reason: null, file_size: file.size, mime_type: file.type })
          .eq("id", req.id);
        updErr = error;
      }
      if (updErr) throw updErr;

      toast.success("Documento enviado para análise");
      qc.invalidateQueries({ queryKey: ["client-panel"] });
      qc.invalidateQueries({ queryKey: ["client-docs"] });
      qc.invalidateQueries({ queryKey: ["provider-docs"] });
      invalidateKeys?.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
    } catch (e: any) {
      toast.error(uploadErrorMessage(e) ?? "Falha ao enviar documento");
    } finally {
      setUploadingId(null);
      setConfirmReq(null);
    }
  }

  async function handleDownload(req: DocRequest) {
    const path = req.file_path || req.file_url;
    if (!path) return;
    if (path.startsWith("http")) return window.open(path, "_blank");
    
    const { data, error } = await supabase.storage.from("documents").download(path);
    if (error || !data) return toast.error("Não foi possível acessar o arquivo");
    
    const ext = path.split(".").pop() || "bin";
    const docName = req.name.replace(/\s+/g, "_");
    const filename = `${docName}.${ext}`;
    
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (requests.length === 0) {
    return (
      <div className="vx-card bg-white rounded-[24px] p-12 text-center border-slate-100">
        <CheckCircle2 className="size-12 text-emerald-500/30 mx-auto mb-4" />
        <h3 className="font-editorial text-2xl font-bold text-slate-900">Você está em dia!</h3>
        <p className="text-muted-foreground mt-2 text-sm">Nenhum documento pendente de envio no momento.</p>
      </div>
    );
  }

  const totals = {
    pending: requests.filter((r) => r.status === "pendente" || r.status === "solicitado" || r.status === "reprovado" || r.status === "pendente_correcao").length,
    review: requests.filter((r) => r.status === "enviado" || r.status === "em_analise").length,
    done: requests.filter((r) => r.status === "aprovado").length,
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard tone="warning" label="Pendentes" value={totals.pending} icon={Clock} />
        <SummaryCard tone="info" label="Em análise" value={totals.review} icon={Loader2} />
        <SummaryCard tone="success" label="Concluídos" value={totals.done} icon={CheckCircle2} />
      </div>

      {grouped.map(([key, { product, items }]) => (
        <div key={key} className="vx-card bg-white rounded-[24px] overflow-hidden border-slate-100">
          <div className="px-6 py-5 border-b border-slate-50 bg-slate-50/30 flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Package className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Produto</p>
              <h3 className="font-editorial text-lg font-bold text-slate-900">{product?.name ?? "Documentos gerais"}</h3>
            </div>
          </div>

          <div className="divide-y divide-slate-50">
            {items.map((req) => {
              const effective = getEffectiveStatus(req);
              const meta = STATUS_META[effective] ?? STATUS_META.solicitado;
              const Icon = meta.icon;
              const isUploading = uploadingId === req.id;
              
              return (
                <div key={req.id} className="p-6 flex flex-col md:flex-row md:items-center gap-4 hover:bg-slate-50/40 transition-colors">
                  <div className={cn("size-12 rounded-xl flex items-center justify-center shrink-0", meta.tone, "border")}>
                    <Icon className={cn("size-5", req.status === "enviado" || req.status === "em_analise" ? "animate-spin" : "")} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-slate-900">{req.name}</p>
                      <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider", meta.tone)}>
                        {meta.label}
                      </Badge>
                      {req.priority && req.priority !== "media" && (
                        <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider", 
                          req.priority === "urgente" ? "bg-red-600 text-white border-red-700" : 
                          req.priority === "alta" ? "bg-orange-500 text-white border-orange-600" : 
                          "bg-blue-50 text-blue-700")}>
                          {req.priority}
                        </Badge>
                      )}
                    </div>
                    {req.description && <p className="text-sm text-muted-foreground mt-1">{req.description}</p>}
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      {req.due_date && <span className="flex items-center gap-1"><Clock className="size-3" /> Prazo: {formatDate(req.due_date)}</span>}
                      {req.uploaded_at && <span>Último envio: {formatDate(req.uploaded_at)}</span>}
                    </div>

                    {req.status === "reprovado" && req.rejection_reason && (
                      <p className="text-xs text-rose-600 mt-2 bg-rose-50 px-3 py-2 rounded-lg border border-rose-100">
                        <strong>Motivo da reprovação:</strong> {req.rejection_reason}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(req.file_path || req.file_url) && (
                      <Button variant="outline" size="sm" className="rounded-xl" onClick={() => handleDownload(req)}>
                        <Download className="size-4 mr-1.5" /> Ver
                      </Button>
                    )}

                    <input
                      type="file"
                      ref={fileRef}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && confirmReq) handleUpload(confirmReq, file);
                      }}
                    />

                    <Button
                      size="sm"
                      className="rounded-xl bg-slate-900"
                      disabled={isUploading}
                      onClick={() => setConfirmReq(req)}
                    >
                      {isUploading ? <Loader2 className="size-4 animate-spin" /> : req.file_path ? "Atualizar" : "Enviar"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <AlertDialog open={!!confirmReq} onOpenChange={(o) => !o && setConfirmReq(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar Documento</AlertDialogTitle>
            <AlertDialogDescription>
              Selecione o arquivo para o documento <strong>{confirmReq?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmReq(null)}>Cancelar</Button>
            <Button onClick={() => fileRef.current?.click()}>Selecionar Arquivo</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({ tone, label, value, icon: Icon }: { tone: string; label: string; value: number; icon: any }) {
  const tones: any = {
    warning: "bg-amber-50 text-amber-600 border-amber-100",
    info: "bg-blue-50 text-blue-600 border-blue-100",
    success: "bg-emerald-50 text-emerald-600 border-emerald-100",
  };

  return (
    <div className={cn("vx-card p-6 flex items-center gap-4 border transition-all hover:scale-[1.02]", tones[tone])}>
      <div className="size-10 rounded-xl bg-white/50 flex items-center justify-center shrink-0">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">{label}</p>
        <p className="text-2xl font-bold font-editorial">{value}</p>
      </div>
    </div>
  );
}