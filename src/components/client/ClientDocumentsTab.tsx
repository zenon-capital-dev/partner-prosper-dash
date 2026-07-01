import { useRef, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, CheckCircle2, Clock, AlertCircle, Download, Loader2, Package, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sanitizeStorageFileName, uploadErrorMessage, uploadStorageFileFast } from "@/lib/uploads";
import { downloadStorageFile, openDownloadUrl } from "@/lib/download";
import { ClientDocumentFolders } from "@/components/documents/ClientDocumentFolders";
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

const STATUS_NORMALIZATION: Record<string, string> = {
  pending: "pendente",
  requested: "solicitado",
  submitted: "enviado",
  delivered: "enviado",
  in_review: "em_analise",
  review: "em_analise",
  approved: "aprovado",
  rejected: "reprovado",
  correction_required: "pendente_correcao",
};

function normalizeDocStatus(status?: string | null): string {
  const raw = String(status || "solicitado").toLowerCase();
  return STATUS_NORMALIZATION[raw] ?? raw;
}

function getEffectiveStatus(req: { status: string; due_date: string | null }): string {
  const status = normalizeDocStatus(req.status);
  const pending = ["pendente", "solicitado", "reprovado", "pendente_correcao"].includes(status);
  if (pending && req.due_date && new Date(req.due_date) < new Date(new Date().toDateString())) {
    return "atrasado";
  }
  return status;
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
  hideEmptyState = false,
}: {
  clientId: string;
  requests: DocRequest[];
  products: Product[];
  getUploadFolder?: (request: DocRequest) => string | null | undefined;
  invalidateKeys?: unknown[][];
  hideEmptyState?: boolean;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [confirmReq, setConfirmReq] = useState<DocRequest | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [adhocOpen, setAdhocOpen] = useState(false);
  const [adhocName, setAdhocName] = useState("");
  const [adhocProductId, setAdhocProductId] = useState<string>("");
  const [adhocFiles, setAdhocFiles] = useState<File[]>([]);
  const [adhocSaving, setAdhocSaving] = useState(false);
  const normalizedRequests = useMemo(
    () => requests.map((request) => ({ ...request, status: normalizeDocStatus(request.status) })),
    [requests]
  );

  async function submitAdhoc() {
    if (adhocFiles.length === 0) {
      toast.error("Selecione pelo menos um arquivo");
      return;
    }
    try {
      setAdhocSaving(true);
      const now = new Date().toISOString();
      const rows: any[] = [];
      for (const [index, file] of adhocFiles.entries()) {
        const safe = sanitizeStorageFileName(file.name);
        const path = `${clientId}/adhoc/${Date.now()}_${index}_${safe}`;
        await uploadStorageFileFast("documents", path, file);
        rows.push({
          client_id: clientId,
          product_id: adhocProductId || null,
          name: adhocName.trim() || file.name,
          status: "enviado",
          file_path: path,
          uploaded_at: now,
          file_size: file.size,
          mime_type: file.type,
          source: "client_upload",
          is_required: false,
        });
      }
      const { error } = await supabase.from("documents").insert(rows as any);
      if (error) throw error;
      toast.success(`${adhocFiles.length} arquivo(s) enviado(s)`);
      setAdhocOpen(false);
      setAdhocName(""); setAdhocFiles([]); setAdhocProductId("");
      qc.invalidateQueries({ queryKey: ["client-docs"] });
      (invalidateKeys ?? []).forEach((k) => qc.invalidateQueries({ queryKey: k as any }));
    } catch (e: any) {
      toast.error(uploadErrorMessage(e) ?? "Falha ao enviar documento");
    } finally {
      setAdhocSaving(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, { product: Product | null; items: DocRequest[] }>();
    for (const r of normalizedRequests) {
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
  }, [normalizedRequests, products]);

  async function handleUpload(req: DocRequest, files: File[]) {
    const [file, ...extraFiles] = files;
    if (!file) return;
    try {
      setUploadingId(req.id);
      const folder = getUploadFolder?.(req) || clientId;
      const path = `${folder}/${req.id}/${Date.now()}-${sanitizeStorageFileName(file.name)}`;

      await uploadStorageFileFast("documents", path, file);

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

      if (extraFiles.length > 0) {
        const extraRows: any[] = [];
        for (const [index, extra] of extraFiles.entries()) {
          const extraPath = `${folder}/${req.id}/${Date.now()}-${index + 1}-${sanitizeStorageFileName(extra.name)}`;
          await uploadStorageFileFast("documents", extraPath, extra);
          extraRows.push({
            client_id: clientId,
            product_id: req.product_id || null,
            client_product_id: req.client_product_id || null,
            name: `${req.name} · ${extra.name}`,
            description: req.description,
            status: "enviado",
            file_path: extraPath,
            uploaded_at: now,
            file_size: extra.size,
            mime_type: extra.type,
            source: "client_upload",
            is_required: false,
          });
        }
        const { error: extraErr } = await supabase.from("documents").insert(extraRows as any);
        if (extraErr) throw extraErr;
      }

      const patchCachedList = (old: unknown) => Array.isArray(old)
        ? old.map((item: any) => item?.id === req.id ? {
          ...item,
          status: "enviado",
          file_path: req.source === "documents" ? path : item.file_path,
          file_url: path,
          uploaded_at: now,
          submission_date: now,
          updated_at: now,
          rejection_reason: null,
        } : item)
        : old;

      (qc as any).setQueriesData({ queryKey: ["client-docs"] }, patchCachedList);
      (qc as any).setQueriesData({ queryKey: ["provider-docs"] }, patchCachedList);
      (qc as any).setQueriesData({ queryKey: ["partner-docs"] }, patchCachedList);

      toast.success(`${files.length} arquivo(s) enviado(s) para análise`);
      qc.invalidateQueries({ queryKey: ["client-panel"] });
      qc.invalidateQueries({ queryKey: ["client-docs"] });
      qc.invalidateQueries({ queryKey: ["provider-docs"] });
      invalidateKeys?.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
    } catch (e: any) {
      toast.error(uploadErrorMessage(e) ?? "Falha ao enviar documento");
    } finally {
      setUploadingId(null);
      setConfirmReq(null);
      setPendingFiles([]);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const [viewingId, setViewingId] = useState<string | null>(null);
  async function handleDownload(req: DocRequest) {
    const path = req.file_path || req.file_url;
    if (!path) return;
    if (path.startsWith("http")) return openDownloadUrl(path);
    setViewingId(req.id);
    const newTab = window.open("", "_blank");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada");
      const baseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
      const anonKey = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${baseUrl}/storage/v1/object/authenticated/documents/${path}`, {
        headers: { apikey: anonKey, authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (newTab) newTab.location.href = url;
      else window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (_) {
      newTab?.close();
      toast.error("Não foi possível abrir o arquivo");
    } finally {
      setViewingId(null);
    }
  }

  const adhocDialog = (
    <Dialog open={adhocOpen} onOpenChange={setAdhocOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar novo documento</DialogTitle>
          <DialogDescription>Envie um arquivo avulso para a equipe analisar.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome base (opcional)</Label>
            <Input value={adhocName} onChange={(e) => setAdhocName(e.target.value)} placeholder="Ex.: Comprovante de residência" />
          </div>
          {products.length > 0 && (
            <div className="space-y-1.5">
              <Label>Vincular a um serviço (opcional)</Label>
              <Select value={adhocProductId} onValueChange={setAdhocProductId}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Arquivos</Label>
            <Input type="file" multiple onChange={(e) => setAdhocFiles(Array.from(e.target.files ?? []))} />
            {adhocFiles.length > 0 && (
              <p className="text-xs text-muted-foreground">{adhocFiles.length} arquivo(s) selecionado(s)</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAdhocOpen(false)}>Cancelar</Button>
          <Button onClick={submitAdhoc} disabled={adhocSaving}>
            {adhocSaving ? <><Loader2 className="size-4 mr-1.5 animate-spin" /> Enviando…</> : <><Upload className="size-4 mr-1.5" /> Enviar</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (normalizedRequests.length === 0) {
    if (hideEmptyState) return null;
    return (
      <div className="vx-card bg-white rounded-2xl px-6 py-7 text-center border-slate-100 space-y-4">
        <CheckCircle2 className="size-9 text-emerald-500/30 mx-auto" />
        <div>
          <h3 className="font-editorial text-xl font-bold text-slate-900">Você está em dia!</h3>
          <p className="text-muted-foreground mt-1 text-sm">Nenhum documento pendente de envio no momento.</p>
        </div>
        <Button size="sm" onClick={() => setAdhocOpen(true)} className="gap-2">
          <Plus className="size-4" /> Enviar novo documento
        </Button>
        {adhocDialog}
      </div>
    );
  }

  const totals = {
    pending: normalizedRequests.filter((r) => r.status === "pendente" || r.status === "solicitado" || r.status === "reprovado" || r.status === "pendente_correcao").length,
    review: normalizedRequests.filter((r) => r.status === "enviado" || r.status === "em_analise").length,
    done: normalizedRequests.filter((r) => r.status === "aprovado").length,
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        multiple
        ref={fileRef}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) setPendingFiles(files);
        }}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Envie arquivos solicitados ou adicione um documento avulso.</p>
        <Button size="sm" onClick={() => setAdhocOpen(true)} className="gap-2">
          <Plus className="size-4" /> Enviar novo documento
        </Button>
      </div>
      {adhocDialog}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard tone="warning" label="Pendentes" value={totals.pending} icon={Clock} />
        <SummaryCard tone="info" label="Em análise" value={totals.review} icon={Loader2} />
        <SummaryCard tone="success" label="Concluídos" value={totals.done} icon={CheckCircle2} />
      </div>

      <div className="vx-card bg-white rounded-2xl border-slate-100 p-4">
        <ClientDocumentFolders clientId={clientId} viewerRole="client" />
      </div>




      {grouped.map(([key, { product, items }]) => (
        <div key={key} className="vx-card bg-white rounded-2xl overflow-hidden border-slate-100">
          <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/30 flex items-center gap-3">
            <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
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
              const hasFile = Boolean(req.file_path || req.file_url);
              const waitingReview = ["enviado", "em_analise"].includes(effective);
              
              return (
                <div key={req.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3 hover:bg-slate-50/40 transition-colors">
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
                      <Button variant="outline" size="sm" className="rounded-xl" disabled={viewingId === req.id} onClick={() => handleDownload(req)}>
                        {viewingId === req.id ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Download className="size-4 mr-1.5" />} Ver
                      </Button>
                    )}

                    <Button
                      size="sm"
                      className="rounded-xl bg-slate-900"
                      disabled={isUploading}
                       onClick={() => { setPendingFiles([]); if (fileRef.current) fileRef.current.value = ""; setConfirmReq(req); }}
                    >
                      {isUploading ? <Loader2 className="size-4 animate-spin" /> : waitingReview ? "Substituir arquivo" : hasFile ? "Atualizar arquivo" : "Selecionar arquivo"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <AlertDialog open={!!confirmReq} onOpenChange={(o) => { if (!o) { setConfirmReq(null); setPendingFiles([]); if (fileRef.current) fileRef.current.value = ""; } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingFiles.length ? "Confirmar envio" : "Selecionar arquivos"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingFiles.length
                ? <>O documento <strong>{confirmReq?.name}</strong> ficará com status <strong>Enviado para análise</strong>. Se houver mais de um arquivo, todos serão anexados.</>
                : <>Escolha um ou mais arquivos para <strong>{confirmReq?.name}</strong>.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingFiles.length > 0 && (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              {pendingFiles.map((pendingFile, index) => (
                <div key={`${pendingFile.name}-${pendingFile.size}-${index}`} className="flex items-center gap-3">
                  <FileText className="size-5 text-slate-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{pendingFile.name}</p>
                    <p className="text-xs text-slate-500">{(pendingFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => { if (fileRef.current) fileRef.current.value = ""; fileRef.current?.click(); }}>Trocar arquivo</Button>
            </div>
          )}

          <AlertDialogFooter>
            <Button variant="outline" onClick={() => { setConfirmReq(null); setPendingFiles([]); if (fileRef.current) fileRef.current.value = ""; }}>Cancelar</Button>
            {pendingFiles.length === 0 ? (
              <Button onClick={() => { if (fileRef.current) fileRef.current.value = ""; fileRef.current?.click(); }}>Escolher arquivos</Button>
            ) : (
              <Button
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={!!uploadingId}
                onClick={() => { if (confirmReq && pendingFiles.length) handleUpload(confirmReq, pendingFiles); }}
              >
                {uploadingId ? <><Loader2 className="size-4 animate-spin mr-1.5" /> Enviando...</> : <><Upload className="size-4 mr-1.5" /> Confirmar envio</>}
              </Button>
            )}
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
    <div className={cn("vx-card p-4 flex items-center gap-3 border transition-all hover:scale-[1.01]", tones[tone])}>
      <div className="size-9 rounded-xl bg-white/50 flex items-center justify-center shrink-0">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">{label}</p>
        <p className="text-xl font-bold font-editorial leading-none mt-1">{value}</p>
      </div>
    </div>
  );
}