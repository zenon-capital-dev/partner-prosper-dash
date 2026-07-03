import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Plus, FileText, Download, Trash2, Upload, Calendar, CheckCircle2, Clock, Loader2, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type FileEntry = { path: string; name: string; size?: number; uploaded_at?: string };

const STATUS: Record<string, { label: string; tone: string; icon: any }> = {
  pending: { label: "Pendente", tone: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  in_progress: { label: "Em produção", tone: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: Loader2 },
  delivered: { label: "Entregue", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
};

export function ClientDeliveries({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [openDelivery, setOpenDelivery] = useState<any | null>(null);
  const [newForm, setNewForm] = useState({ title: "", description: "", client_product_id: "" });
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [savingNew, setSavingNew] = useState(false);

  const { data: products } = useQuery({
    queryKey: ["client-products-min", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_products")
        .select("id, products(name)")
        .eq("client_id", clientId);
      return data ?? [];
    },
  });

  const { data: deliveries, isLoading } = useQuery({
    queryKey: ["client-deliveries", clientId],
    queryFn: async () => {
      const productIds = (products ?? []).map((p: any) => p.id);
      if (!productIds.length) return [];
      const { data } = await supabase
        .from("demand_deliveries")
        .select("*, client_product:client_products(id, products(name))")
        .in("client_product_id", productIds)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!products,
  });

  const create = async () => {
    if (!newForm.title.trim() || !newForm.client_product_id) {
      return toast.error("Selecione a demanda e informe o nome da entrega");
    }
    setSavingNew(true);
    // 1. cria a entrega
    const { data: created, error } = await supabase.from("demand_deliveries").insert({
      client_product_id: newForm.client_product_id,
      title: newForm.title,
      description: newForm.description || null,
      status: "delivered",
      files: [],
    }).select("id").single();
    if (error || !created) {
      setSavingNew(false);
      return toast.error(error?.message || "Erro ao criar entrega");
    }
    // 2. faz upload dos arquivos (se houver)
    const uploaded: FileEntry[] = [];
    for (const file of newFiles) {
      const path = `deliveries/${newForm.client_product_id}/${created.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { upsert: false });
      if (upErr) { toast.error(`${file.name}: ${upErr.message}`); continue; }
      uploaded.push({ path, name: file.name, size: file.size, uploaded_at: new Date().toISOString() });
    }
    if (uploaded.length) {
      await supabase.from("demand_deliveries").update({ files: uploaded as any }).eq("id", created.id);
    }
    setSavingNew(false);
    toast.success("Entrega criada");
    setNewForm({ title: "", description: "", client_product_id: "" });
    setNewFiles([]);
    setCreating(false);
    qc.invalidateQueries({ queryKey: ["client-deliveries", clientId] });
  };


  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold tracking-tight">Entregas de Valor</h3>
          <p className="text-xs text-muted-foreground">Marcos e artefatos entregues ao cliente</p>
        </div>
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 gap-2" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Nova entrega
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
      ) : !deliveries?.length ? (
        <div className="cp-panel p-12 text-center border-dashed">
          <Package className="size-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma entrega registrada para este cliente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {deliveries.map((d: any) => {
            const st = STATUS[d.status] ?? STATUS.pending;
            const Icon = st.icon;
            const files = (d.files || []) as FileEntry[];
            return (
              <button
                key={d.id}
                onClick={() => setOpenDelivery(d)}
                className="group text-left cp-panel p-5 hover:border-indigo-500/40 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Package className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-foreground truncate">{d.title}</h4>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {d.client_product?.products?.name || "Demanda"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("gap-1 text-[10px] font-bold uppercase tracking-wider", st.tone)}>
                    <Icon className="size-3" /> {st.label}
                  </Badge>
                </div>
                {d.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{d.description}</p>
                )}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Calendar className="size-3" />{formatDate(d.created_at)}</span>
                  <span className="flex items-center gap-1.5 font-semibold text-indigo-600">
                    <FileText className="size-3" /> {files.length} arquivo{files.length === 1 ? "" : "s"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova entrega</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Demanda</label>
              <Select value={newForm.client_product_id} onValueChange={(v) => setNewForm({ ...newForm, client_product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar demanda..." /></SelectTrigger>
                <SelectContent>
                  {(products ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.products?.name || "Sem nome"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nome da entrega</label>
              <Input value={newForm.title} onChange={(e) => setNewForm({ ...newForm, title: e.target.value })} placeholder="Ex: Relatório mensal - Outubro" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Descrição</label>
              <Textarea rows={4} value={newForm.description} onChange={(e) => setNewForm({ ...newForm, description: e.target.value })} placeholder="O que foi entregue, contexto, links..." />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Arquivos ({newFiles.length})
                </label>
                <Button asChild size="sm" variant="outline" className="gap-1.5 h-8">
                  <label className="cursor-pointer">
                    <Upload className="size-3.5" /> Anexar arquivos
                    <input type="file" multiple hidden onChange={(e) => {
                      const list = e.target.files ? Array.from(e.target.files) : [];
                      setNewFiles((prev) => [...prev, ...list]);
                      e.target.value = "";
                    }} />
                  </label>
                </Button>
              </div>
              {newFiles.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-[11px] text-muted-foreground">
                  Adicione os arquivos que o cliente vai baixar.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {newFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 text-xs">
                      <FileText className="size-3.5 text-slate-500 shrink-0" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-[10px] text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</span>
                      <button
                        type="button"
                        onClick={() => setNewFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-rose-500 hover:text-rose-600"
                        aria-label="Remover"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)} disabled={savingNew}>Cancelar</Button>
            <Button onClick={create} disabled={savingNew} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
              {savingNew && <Loader2 className="size-3.5 animate-spin" />}
              {savingNew ? "Salvando..." : "Criar entrega"}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      {openDelivery && (
        <DeliveryDetailDialog
          delivery={openDelivery}
          onClose={() => setOpenDelivery(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["client-deliveries", clientId] })}
        />
      )}
    </div>
  );
}

function DeliveryDetailDialog({ delivery, onClose, onChanged }: { delivery: any; onClose: () => void; onChanged: () => void }) {
  const [title, setTitle] = useState(delivery.title || "");
  const [description, setDescription] = useState(delivery.description || "");
  const [status, setStatus] = useState(delivery.status || "pending");
  const [files, setFiles] = useState<FileEntry[]>((delivery.files || []) as FileEntry[]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const st = STATUS[status] ?? STATUS.pending;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("demand_deliveries")
      .update({ title, description: description || null, status, files: files as any })
      .eq("id", delivery.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Entrega atualizada");
    onChanged();
    onClose();
  };

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    const added: FileEntry[] = [];
    for (const file of Array.from(list)) {
      const path = `deliveries/${delivery.client_product_id}/${delivery.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("documents").upload(path, file, { upsert: false });
      if (error) { toast.error(`${file.name}: ${error.message}`); continue; }
      added.push({ path, name: file.name, size: file.size, uploaded_at: new Date().toISOString() });
    }
    if (added.length) {
      const newFiles = [...files, ...added];
      setFiles(newFiles);
      await supabase.from("demand_deliveries").update({ files: newFiles as any }).eq("id", delivery.id);
      toast.success(`${added.length} arquivo(s) enviado(s)`);
      onChanged();
    }
    setUploading(false);
  };

  const removeFile = async (path: string) => {
    const newFiles = files.filter(f => f.path !== path);
    setFiles(newFiles);
    await supabase.storage.from("documents").remove([path]);
    await supabase.from("demand_deliveries").update({ files: newFiles as any }).eq("id", delivery.id);
    onChanged();
  };

  const download = async (f: FileEntry) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(f.path, 60);
    if (error || !data) return toast.error("Erro ao gerar link");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Package className="size-5" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="truncate">Detalhes da entrega</DialogTitle>
                <p className="text-[11px] text-muted-foreground truncate">
                  {delivery.client_product?.products?.name || "Demanda"} · criada em {formatDate(delivery.created_at)}
                </p>
              </div>
            </div>
            <Badge variant="outline" className={cn("gap-1 text-[10px] font-bold uppercase tracking-wider", st.tone)}>
              <st.icon className="size-3" /> {st.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nome da entrega</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Descrição</label>
            <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o que está sendo entregue: escopo, resultados, próximos passos, links..." className="mt-1" />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Arquivos ({files.length})
              </label>
              <Button asChild size="sm" variant="outline" disabled={uploading} className="gap-1.5 h-8">
                <label className="cursor-pointer">
                  {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                  {uploading ? "Enviando..." : "Adicionar arquivos"}
                  <input type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
                </label>
              </Button>
            </div>
            {files.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                Nenhum arquivo anexado ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((f) => (
                  <div key={f.path} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 hover:border-indigo-300 transition-colors">
                    <div className="size-9 rounded-lg bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{f.name}</p>
                      {f.size ? <p className="text-[10px] text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</p> : null}
                    </div>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => download(f)}>
                      <Download className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => removeFile(f.path)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
