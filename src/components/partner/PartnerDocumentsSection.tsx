import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Download, Upload, Trash2, FileText, CheckCircle2 } from "lucide-react";
import { formatBR as format } from "@/lib/datetime";
import { assertUploadFile, sanitizeStorageFileName, uploadErrorMessage } from "@/lib/uploads";
import { downloadStorageFile } from "@/lib/download";
import { confirmAction } from "@/lib/confirm";

type Slot = "original" | "signed" | "final";
type Doc = {
  id: string;
  partner_id: string;
  name: string;
  description: string | null;
  original_path: string | null;
  original_uploaded_at: string | null;
  signed_path: string | null;
  signed_uploaded_at: string | null;
  final_path: string | null;
  final_uploaded_at: string | null;
  status: string;
};

const BUCKET = "partner-contracts";

export function PartnerDocumentsSection({ partnerId }: { partnerId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("partner_documents")
      .select("*")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: true });
    if (error) toast.error(error.message);
    setDocs((data ?? []) as Doc[]);
    setLoading(false);
  };

  useEffect(() => { if (partnerId) reload(); }, [partnerId]);

  const createDoc = async () => {
    const name = form.name.trim();
    if (!name) { toast.error("Informe o nome do documento"); return; }
    setSaving(true);
    const { error } = await (supabase as any).from("partner_documents").insert({
      partner_id: partnerId,
      name,
      description: form.description.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Documento adicionado");
    setForm({ name: "", description: "" });
    setOpen(false);
    reload();
  };

  const renameDoc = async (id: string, name: string, old: string) => {
    const v = name.trim();
    if (!v || v === old) return;
    const { error } = await (supabase as any).from("partner_documents").update({ name: v }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Renomeado");
    reload();
  };

  const removeDoc = async (id: string) => {
    if (!(await confirmAction({ title: "Excluir documento?", description: "Os arquivos também serão removidos.", destructive: true, confirmText: "Excluir" }))) return;
    const doc = docs.find((d) => d.id === id);
    const paths = [doc?.original_path, doc?.signed_path, doc?.final_path].filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
    const { error } = await (supabase as any).from("partner_documents").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removido");
    reload();
  };

  const uploadSlot = async (doc: Doc, slot: Slot, file: File) => {
    try {
      assertUploadFile(file);
      const path = `${partnerId}/custom/${doc.id}/${slot}-${Date.now()}-${sanitizeStorageFileName(file.name)}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const now = new Date().toISOString();
      const patch: any = slot === "original"
        ? { original_path: path, original_uploaded_at: now, status: doc.status === "pendente" ? "enviado" : doc.status }
        : slot === "signed"
          ? { signed_path: path, signed_uploaded_at: now, status: "assinado" }
          : { final_path: path, final_uploaded_at: now, status: "concluido" };
      const { error } = await (supabase as any).from("partner_documents").update(patch).eq("id", doc.id);
      if (error) throw error;
      toast.success("Arquivo enviado");
      reload();
    } catch (e: any) {
      toast.error(uploadErrorMessage(e) || e?.message || "Erro no upload");
    }
  };

  const downloadFile = async (path: string) => {
    const filename = path.split("/").pop() || "documento";
    try { await downloadStorageFile(BUCKET, path, filename); }
    catch (e: any) { toast.error(e?.message || "Não foi possível abrir"); }
  };

  const removeSlot = async (doc: Doc, slot: Slot) => {
    if (!(await confirmAction({ title: "Excluir arquivo?", destructive: true, confirmText: "Excluir" }))) return;
    const pathKey = slot === "original" ? "original_path" : slot === "signed" ? "signed_path" : "final_path";
    const dateKey = slot === "original" ? "original_uploaded_at" : slot === "signed" ? "signed_uploaded_at" : "final_uploaded_at";
    const path = (doc as any)[pathKey] as string | null;
    if (path) await supabase.storage.from(BUCKET).remove([path]);
    const { error } = await (supabase as any).from("partner_documents").update({ [pathKey]: null, [dateKey]: null }).eq("id", doc.id);
    if (error) { toast.error(error.message); return; }
    reload();
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5"><FileText className="size-4 text-indigo-600" /> Documentos personalizados</p>
            <p className="text-xs text-muted-foreground">Cadastre livremente qualquer documento (contrato adicional, aditivos, procurações…) com nome à sua escolha, arquivo original, versão assinada pelo parceiro e versão final concluída por você.</p>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4 mr-1" /> Novo documento
          </Button>
        </div>

        {loading ? (
          <p className="text-xs text-slate-500 py-6 text-center">Carregando…</p>
        ) : docs.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-lg p-8 text-center">
            <FileText className="size-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Nenhum documento cadastrado ainda.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setOpen(true)}>
              <Plus className="size-4 mr-1" /> Adicionar o primeiro
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map((doc) => (
              <div key={doc.id} className="border border-slate-200 rounded-lg p-3 bg-white">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <Input
                      defaultValue={doc.name}
                      onBlur={(e) => renameDoc(doc.id, e.target.value, doc.name)}
                      className="h-8 text-sm font-semibold flex-1"
                    />
                    <Badge variant="outline" className="capitalize whitespace-nowrap">
                      {doc.status === "concluido" && <CheckCircle2 className="size-3 mr-1 text-emerald-600" />}
                      {doc.status}
                    </Badge>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeDoc(doc.id)} title="Excluir documento">
                    <Trash2 className="size-4 text-rose-600" />
                  </Button>
                </div>
                {doc.description && <p className="text-[12px] text-slate-500 mb-2">{doc.description}</p>}
                <div className="grid sm:grid-cols-3 gap-2">
                  <FileSlot
                    label="Original (baixar)"
                    tone="indigo"
                    path={doc.original_path}
                    uploadedAt={doc.original_uploaded_at}
                    onPick={(f) => uploadSlot(doc, "original", f)}
                    onDownload={downloadFile}
                    onDelete={() => removeSlot(doc, "original")}
                  />
                  <FileSlot
                    label="Assinado pelo parceiro"
                    tone="amber"
                    path={doc.signed_path}
                    uploadedAt={doc.signed_uploaded_at}
                    onPick={(f) => uploadSlot(doc, "signed", f)}
                    onDownload={downloadFile}
                    onDelete={() => removeSlot(doc, "signed")}
                  />
                  <FileSlot
                    label="Concluído (final)"
                    tone="emerald"
                    path={doc.final_path}
                    uploadedAt={doc.final_uploaded_at}
                    onPick={(f) => uploadSlot(doc, "final", f)}
                    onDownload={downloadFile}
                    onDelete={() => removeSlot(doc, "final")}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo documento</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome do documento</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex.: Aditivo contratual, Procuração, Termo de sigilo…"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição (opcional)</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={createDoc} disabled={saving}>{saving ? "Salvando…" : "Adicionar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function FileSlot({ label, tone, path, uploadedAt, onPick, onDownload, onDelete }: {
  label: string;
  tone: "indigo" | "amber" | "emerald";
  path: string | null;
  uploadedAt: string | null;
  onPick: (f: File) => void;
  onDownload: (p: string) => void;
  onDelete: () => void;
}) {
  const bg = path
    ? tone === "indigo" ? "bg-indigo-50/50 border-indigo-200"
      : tone === "amber" ? "bg-amber-50/50 border-amber-200"
      : "bg-emerald-50/50 border-emerald-200"
    : "bg-slate-50/50 border-slate-200";
  return (
    <div className={`border rounded-md p-2.5 ${bg}`}>
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">{label}</p>
      {path ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-1">
            <button onClick={() => onDownload(path)} className="inline-flex items-center gap-1 text-emerald-700 text-[12px] hover:underline font-medium truncate">
              <Download className="size-3" /> Baixar
            </button>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer text-[11px] text-indigo-700 hover:underline">
                Trocar
                <input type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
              </label>
              <button onClick={onDelete} className="text-[11px] text-rose-600 hover:underline">×</button>
            </div>
          </div>
          {uploadedAt && <p className="text-[10px] text-slate-500">{format(new Date(uploadedAt), "dd/MM/yyyy HH:mm")}</p>}
        </div>
      ) : (
        <label className="cursor-pointer inline-flex items-center gap-1.5 text-[12px] text-indigo-700 hover:underline">
          <Upload className="size-3" /> Enviar
          <input type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
        </label>
      )}
    </div>
  );
}
