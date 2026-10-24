import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { sanitizeStorageFileName, uploadErrorMessage } from "@/lib/uploads";
import { downloadStorageFile } from "@/lib/download";
import {
  FolderPlus, Folder, Upload, FileText, Download, Eye, Trash2, Users, Pencil,
  Loader2, FilePlus2, Clock, CheckCircle2, AlertCircle, RefreshCw,
  MessageSquare, Mail, MessageCircle, ChevronDown, Check, X, Share2,
} from "lucide-react";
import { BulkShareDocumentsDialog } from "@/components/documents/BulkShareDocumentsDialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { DocumentDialog } from "@/components/documents/DocumentDialog";
import { cn } from "@/lib/utils";

const STATUS_META: Record<string, { label: string; tone: string; icon: any }> = {
  solicitado: { label: "Solicitado", tone: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  enviado: { label: "Enviado", tone: "bg-blue-50 text-blue-700 border-blue-200", icon: Loader2 },
  em_analise: { label: "Em análise", tone: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: Loader2 },
  aprovado: { label: "Aprovado", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  reprovado: { label: "Rejeitado", tone: "bg-rose-50 text-rose-700 border-rose-200", icon: AlertCircle },
  pendente_correcao: { label: "Reenvio", tone: "bg-orange-50 text-orange-700 border-orange-200", icon: RefreshCw },
  vencido: { label: "Vencido", tone: "bg-slate-100 text-slate-700 border-slate-200", icon: Clock },
};


type Role = "admin" | "client" | "provider";

interface Props {
  clientId: string;
  viewerRole: Role;
}

export function ClientDocumentFolders({ clientId, viewerRole }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);
  const [attachingDoc, setAttachingDoc] = useState<any>(null);
  const attachSourceRef = useRef<"email" | "whatsapp" | "admin" | "client" | null>(null);
  const [editingDoc, setEditingDoc] = useState<any>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [providersFor, setProvidersFor] = useState<string | null>(null);
  const [sharingOpen, setSharingOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [requestingInFolder, setRequestingInFolder] = useState<string | null>(null);
  const [newContractName, setNewContractName] = useState("");
  const [creatingContract, setCreatingContract] = useState(false);
  const [addingPhaseTo, setAddingPhaseTo] = useState<string | null>(null);
  const [phaseLabel, setPhaseLabel] = useState("");
  const phaseFileRef = useRef<HTMLInputElement>(null);
  const phaseUploadCtx = useRef<{ parentId: string; label: string } | null>(null);


  const isAdmin = viewerRole === "admin";
  const canUpload = viewerRole === "admin" || viewerRole === "client";

  const { data: folders = [], isLoading } = useQuery({
    queryKey: ["cdf-folders", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_document_folders" as any)
        .select("*")
        .eq("client_id", clientId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Auto-cria pasta fixa "Contratos" quando o master abre e ela ainda não existe.
  useEffect(() => {
    if (!isAdmin || isLoading || !clientId) return;
    const hasContratos = (folders as any[]).some((f) => (f.name || "").trim().toLowerCase() === "contratos");
    if (hasContratos) return;
    (async () => {
      const { error } = await supabase
        .from("client_document_folders" as any)
        .insert({ client_id: clientId, name: "Contratos", created_by: user?.id });
      if (!error) qc.invalidateQueries({ queryKey: ["cdf-folders", clientId] });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isLoading, clientId, folders.length]);

  const ALL_ID = "__all__";
  const currentFolderId = activeId ?? ALL_ID;
  const isAllView = currentFolderId === ALL_ID;

  const { data: files = [] } = useQuery({
    queryKey: ["cdf-files", clientId, currentFolderId],
    enabled: !!currentFolderId,
    queryFn: async () => {
      let q = supabase.from("documents").select("*").eq("client_id", clientId);
      if (!isAllView) q = q.eq("folder_id", currentFolderId!);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });



  async function createFolder() {
    const name = newName.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("client_document_folders" as any)
      .insert({ client_id: clientId, name, created_by: user?.id })
      .select()
      .single();
    if (error) return toast.error(error.message);
    toast.success("Pasta criada");
    setNewName(""); setCreating(false);
    setActiveId((data as any)?.id ?? null);
    qc.invalidateQueries({ queryKey: ["cdf-folders", clientId] });
  }

  async function renameFolder() {
    if (!renaming) return;
    const { error } = await supabase
      .from("client_document_folders" as any)
      .update({ name: renaming.name.trim() })
      .eq("id", renaming.id);
    if (error) return toast.error(error.message);
    toast.success("Pasta renomeada");
    setRenaming(null);
    qc.invalidateQueries({ queryKey: ["cdf-folders", clientId] });
  }

  async function deleteFolder(id: string) {
    if (!confirm("Excluir esta pasta e todos os arquivos vinculados?")) return;
    const { error } = await supabase.from("client_document_folders" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (activeId === id) setActiveId(null);
    toast.success("Pasta excluída");
    qc.invalidateQueries({ queryKey: ["cdf-folders", clientId] });
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!selectedFiles.length || !currentFolderId) return;
    try {
      setUploading(true);
      const rows: any[] = [];
      for (const [index, file] of selectedFiles.entries()) {
        const safe = sanitizeStorageFileName(file.name);
        const path = `${clientId}/folder/${currentFolderId}/${Date.now()}_${index}_${safe}`;
        const up = await supabase.storage.from("documents").upload(path, file);
        if (up.error) throw up.error;
        rows.push({
          client_id: clientId,
          folder_id: currentFolderId,
          name: file.name,
          file_path: path,
          file_size: file.size,
          mime_type: file.type,
          status: "aprovado",
          source: viewerRole === "client" ? "client_upload" : "admin_upload",
          uploaded_by: user?.id,
          uploaded_at: new Date().toISOString(),
          is_required: false,
        });
      }
      const { error } = await supabase.from("documents").insert(rows as any);
      if (error) throw error;
      toast.success(`${selectedFiles.length} arquivo(s) enviado(s)`);
      qc.invalidateQueries({ queryKey: ["cdf-files", clientId] });
    } catch (e: any) {
      toast.error(uploadErrorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  async function viewFile(path: string) {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function downloadFile(path: string, name: string) {
    try { await downloadStorageFile("documents", path, name); }
    catch (e: any) { toast.error(e.message || "Erro ao baixar"); }
  }

  async function removeFile(file: any) {
    if (!confirm(`Excluir "${file.name}"?`)) return;
    if (file.file_path) await supabase.storage.from("documents").remove([file.file_path]);
    const { error } = await supabase.from("documents").delete().eq("id", file.id);
    if (error) return toast.error(error.message);
    toast.success("Arquivo excluído");
    qc.invalidateQueries({ queryKey: ["cdf-files", clientId] });
  }

  function triggerAttach(doc: any, source?: "email" | "whatsapp" | "admin") {
    attachSourceRef.current = source ?? null;
    setAttachingDoc(doc);
    setTimeout(() => attachRef.current?.click(), 0);
  }

  async function updateDocStatus(doc: any, status: string, extra: Record<string, any> = {}) {
    const { error } = await supabase
      .from("documents")
      .update({ status: status as any, reviewed_at: new Date().toISOString(), ...extra })
      .eq("id", doc.id);
    if (error) return toast.error(error.message);
    toast.success(`Status: ${STATUS_META[status]?.label || status}`);
    qc.invalidateQueries({ queryKey: ["cdf-files", clientId] });
  }

  async function handleReject(doc: any) {
    const reason = window.prompt("Motivo da rejeição:");
    if (!reason) return;
    await updateDocStatus(doc, "reprovado", { rejection_reason: reason });
  }

  async function handleRequestResend(doc: any) {
    const note = window.prompt("Comentário para reenvio (opcional):") || null;
    await updateDocStatus(doc, "pendente_correcao", { rejection_reason: note });
  }

  async function handleAddNote(doc: any) {
    const note = window.prompt("Observação interna:", doc.internal_notes || "");
    if (note === null) return;
    const { error } = await supabase.from("documents").update({ internal_notes: note }).eq("id", doc.id);
    if (error) return toast.error(error.message);
    toast.success("Observação salva");
    qc.invalidateQueries({ queryKey: ["cdf-files", clientId] });
  }


  async function onAttachToRequest(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const doc = attachingDoc;
    setAttachingDoc(null);
    if (!files.length || !doc) return;
    try {
      setUploading(true);
      const now = new Date().toISOString();
      const chosen = attachSourceRef.current;
      attachSourceRef.current = null;
      const source = chosen ?? (viewerRole === "client" ? "client_upload" : "admin_upload");
      const extraRows: any[] = [];


      for (const [index, file] of files.entries()) {
        const safe = sanitizeStorageFileName(file.name);
        const path = `${clientId}/folder/${currentFolderId}/${Date.now()}_${index}_${safe}`;
        const up = await supabase.storage.from("documents").upload(path, file);
        if (up.error) throw up.error;

        if (index === 0 && !doc.file_path) {
          const { error } = await supabase.from("documents").update({
            file_path: path,
            file_size: file.size,
            mime_type: file.type,
            status: "em_analise",
            uploaded_at: now,
            uploaded_by: user?.id ?? null,
            source,
          } as any).eq("id", doc.id);
          if (error) throw error;
        } else {
          extraRows.push({
            client_id: clientId,
            folder_id: currentFolderId,
            product_id: doc.product_id ?? null,
            name: `${doc.name} — ${file.name}`,
            description: `Arquivo adicional de "${doc.name}"`,
            file_path: path,
            file_size: file.size,
            mime_type: file.type,
            status: "em_analise",
            source,
            uploaded_by: user?.id ?? null,
            uploaded_at: now,
            is_required: false,
          });
        }
      }
      if (extraRows.length) {
        const { error } = await supabase.from("documents").insert(extraRows as any);
        if (error) throw error;
      }
      toast.success(`${files.length} arquivo(s) enviado(s)`);
      qc.invalidateQueries({ queryKey: ["cdf-files", clientId] });
    } catch (err: any) {
      toast.error(uploadErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }
  const activeFolder = folders.find((f) => f.id === currentFolderId);
  const isContratos = !isAllView && (activeFolder?.name || "").trim().toLowerCase() === "contratos";
  const contractRoots = useMemo(
    () => (isContratos ? (files as any[]).filter((f) => !f.parent_document_id) : []),
    [isContratos, files],
  );
  const phasesByParent = useMemo(() => {
    const m = new Map<string, any[]>();
    if (!isContratos) return m;
    for (const f of files as any[]) {
      if (!f.parent_document_id) continue;
      const arr = m.get(f.parent_document_id) ?? [];
      arr.push(f);
      m.set(f.parent_document_id, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return m;
  }, [isContratos, files]);

  async function createContract() {
    const name = newContractName.trim();
    if (!name || !currentFolderId) return;
    const { error } = await supabase.from("documents").insert({
      client_id: clientId,
      folder_id: currentFolderId,
      name,
      status: "em_analise",
      source: viewerRole === "client" ? "client_upload" : "admin_upload",
      is_required: false,
    } as any);
    if (error) return toast.error(error.message);
    setNewContractName(""); setCreatingContract(false);
    toast.success("Contrato criado");
    qc.invalidateQueries({ queryKey: ["cdf-files", clientId] });
  }

  async function deleteContractOrPhase(row: any) {
    if (!confirm(`Excluir "${row.phase_label || row.name}"?`)) return;
    if (row.file_path) await supabase.storage.from("documents").remove([row.file_path]);
    // children (fases) cascade via FK ON DELETE CASCADE
    const { error } = await supabase.from("documents").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["cdf-files", clientId] });
  }

  function openAddPhase(parentId: string) {
    setAddingPhaseTo(parentId);
    setPhaseLabel("");
  }

  async function confirmAddPhase() {
    if (!addingPhaseTo || !phaseLabel.trim()) return;
    phaseUploadCtx.current = { parentId: addingPhaseTo, label: phaseLabel.trim() };
    setAddingPhaseTo(null);
    setTimeout(() => phaseFileRef.current?.click(), 0);
  }

  async function onPhaseFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const ctx = phaseUploadCtx.current;
    phaseUploadCtx.current = null;
    if (!file || !ctx || !currentFolderId) return;
    try {
      setUploading(true);
      const safe = sanitizeStorageFileName(file.name);
      const path = `${clientId}/folder/${currentFolderId}/contract/${ctx.parentId}/${Date.now()}_${safe}`;
      const up = await supabase.storage.from("documents").upload(path, file);
      if (up.error) throw up.error;
      const { error } = await supabase.from("documents").insert({
        client_id: clientId,
        folder_id: currentFolderId,
        parent_document_id: ctx.parentId,
        phase_label: ctx.label,
        name: `${ctx.label} — ${file.name}`,
        file_path: path,
        file_size: file.size,
        mime_type: file.type,
        status: "em_analise",
        source: viewerRole === "client" ? "client_upload" : viewerRole === "provider" ? "provider_upload" : "admin_upload",
        uploaded_by: user?.id,
        uploaded_at: new Date().toISOString(),
        is_required: false,
      } as any);
      if (error) throw error;
      toast.success("Fase adicionada");
      qc.invalidateQueries({ queryKey: ["cdf-files", clientId] });
    } catch (err: any) {
      toast.error(uploadErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Folder className="size-4 text-indigo-600" /> Pastas de documentos
          </h3>
          <p className="text-xs text-slate-500">
            {isAdmin
              ? "Crie categorias (ex.: Faturamento Gerencial, Fiscal) para organizar arquivos do cliente."
              : viewerRole === "client"
                ? "Envie e consulte seus arquivos organizados por categoria."
                : "Pastas em que você foi autorizado pela Zenon."}
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <FolderPlus className="size-4 mr-1" /> Nova pasta
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-slate-500">Carregando pastas...</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Tabs value={currentFolderId} onValueChange={setActiveId}>
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value={ALL_ID} className="gap-1 font-semibold">
                  <Folder className="size-3.5" />
                  Todos os doc
                </TabsTrigger>
                {folders.map((f) => (
                  <TabsTrigger key={f.id} value={f.id} className="gap-1">
                    <Folder className="size-3.5" />
                    {f.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {folders.length === 0 && isAllView && isAdmin && (
            <div className="border border-dashed border-slate-200 rounded-lg p-3 text-center bg-white">
              <p className="text-xs text-slate-500">Ainda não há pastas criadas. Todos os documentos aparecem aqui.</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => setCreating(true)}>
                Criar primeira pasta
              </Button>
            </div>
          )}

          {currentFolderId && (
            <div className="border border-slate-200 rounded-lg bg-white p-3 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-slate-50">
                    {files.length} arquivo(s)
                  </Badge>
                  {isAllView && (
                    <span className="text-[11px] text-slate-500">Visão consolidada — apenas leitura</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {isAdmin && files.some((f: any) => f.file_path) && (
                    <Button size="sm" variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => setSharingOpen(true)}>
                      <Share2 className="size-3.5 mr-1" /> Compartilhar com prestadores
                    </Button>
                  )}
                  {isAdmin && !isAllView && (
                    <>
                      <Button size="sm" variant="default" onClick={() => setRequestingInFolder(currentFolderId)}>
                        <FilePlus2 className="size-3.5 mr-1" /> Solicitar ao cliente
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setProvidersFor(currentFolderId)}>
                        <Users className="size-3.5 mr-1" /> Autorizar prestador
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => {
                        const f = folders.find((x) => x.id === currentFolderId);
                        if (f) setRenaming({ id: f.id, name: f.name });
                      }}>
                        <Pencil className="size-3.5 mr-1" /> Renomear
                      </Button>
                      <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={() => deleteFolder(currentFolderId)}>
                        <Trash2 className="size-3.5 mr-1" /> Excluir pasta
                      </Button>
                    </>
                  )}
                  {canUpload && !isAllView && !isContratos && (
                    <>
                      <input ref={fileRef} type="file" multiple hidden onChange={onUpload} />
                      <input ref={attachRef} type="file" multiple hidden onChange={onAttachToRequest} />
                      <Button size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                        {uploading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Upload className="size-3.5 mr-1" />}
                        Enviar arquivos
                      </Button>
                    </>
                  )}
                  {isContratos && (isAdmin || viewerRole === "client") && (
                    <Button size="sm" onClick={() => setCreatingContract(true)}>
                      <FilePlus2 className="size-3.5 mr-1" /> Novo contrato
                    </Button>
                  )}
                </div>
              </div>

              {isContratos && (
                <input ref={phaseFileRef} type="file" hidden onChange={onPhaseFileSelected} />
              )}

              {isContratos ? (
                contractRoots.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">Nenhum contrato criado ainda.</p>
                ) : (
                  <ul className="space-y-3">
                    {contractRoots.map((c: any) => {
                      const phases = phasesByParent.get(c.id) ?? [];
                      return (
                        <li key={c.id} className="border border-slate-200 rounded-lg bg-slate-50/60 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="size-4 text-indigo-600" />
                            <p className="text-sm font-semibold text-slate-900 flex-1 truncate">{c.name}</p>
                            <Badge variant="outline" className="bg-white text-[10px]">{phases.length} fase(s)</Badge>
                            {(isAdmin || c.uploaded_by === user?.id) && (
                              <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={() => deleteContractOrPhase(c)}>
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                          {phases.length === 0 ? (
                            <p className="text-[11px] text-slate-500 pl-6 pb-2">Nenhuma fase ainda. Adicione a primeira (ex.: "Minuta").</p>
                          ) : (
                            <ol className="pl-6 space-y-1.5">
                              {phases.map((p: any, idx: number) => (
                                <li key={p.id} className="flex items-center gap-2 text-sm bg-white border border-slate-200 rounded px-2 py-1.5">
                                  <Badge variant="outline" className="text-[10px] shrink-0">Fase {idx + 1}</Badge>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium text-slate-800 truncate">{p.phase_label || "—"}</p>
                                    <p className="text-[11px] text-slate-500 truncate">{p.name?.replace(`${p.phase_label} — `, "")} · {formatDate(p.uploaded_at ?? p.created_at)}</p>
                                  </div>
                                  {p.file_path && (
                                    <>
                                      <Button size="sm" variant="ghost" onClick={() => viewFile(p.file_path)}><Eye className="size-3.5" /></Button>
                                      <Button size="sm" variant="ghost" onClick={() => downloadFile(p.file_path, p.name)}><Download className="size-3.5" /></Button>
                                    </>
                                  )}
                                  {(isAdmin || p.uploaded_by === user?.id) && (
                                    <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={() => deleteContractOrPhase(p)}>
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  )}
                                </li>
                              ))}
                            </ol>
                          )}
                          <div className="pl-6 pt-2">
                            <Button size="sm" variant="outline" disabled={uploading} onClick={() => openAddPhase(c.id)}>
                              {uploading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <FilePlus2 className="size-3.5 mr-1" />}
                              Adicionar fase
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : files.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">Nenhum arquivo nesta pasta.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {files.map((f: any) => {
                    const isRequest = !f.file_path;
                    const effective = (f.status as string) || (isRequest ? "solicitado" : "em_analise");
                    const meta = STATUS_META[effective] ?? STATUS_META.solicitado;
                    const Icon = meta.icon;
                    const spin = effective === "enviado" || effective === "em_analise";
                    return (
                      <li key={f.id} className="p-4 flex flex-col lg:flex-row lg:items-center gap-3 hover:bg-slate-50/60 transition-colors">
                        <div className={cn("size-11 rounded-xl flex items-center justify-center shrink-0 border", meta.tone)}>
                          <Icon className={cn("size-5", spin && "animate-spin")} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-slate-900 truncate">{f.name}</p>
                            <Badge variant="outline" className={cn("text-[9px] uppercase tracking-widest", meta.tone)}>
                              {meta.label}
                            </Badge>
                            {typeof f.is_required === "boolean" && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[9px] uppercase tracking-widest",
                                  f.is_required
                                    ? "border-rose-200 text-rose-600 bg-rose-50"
                                    : "border-slate-200 text-slate-500"
                                )}
                              >
                                {f.is_required ? "Obrigatório" : "Opcional"}
                              </Badge>
                            )}
                          </div>
                          {f.description && (
                            <p className="text-xs text-slate-500 mt-1">{f.description}</p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] uppercase tracking-widest font-bold text-slate-400">
                            {f.due_date && (
                              <span className="flex items-center gap-1.5 text-amber-600">
                                <Clock className="size-3" /> Prazo {formatDate(f.due_date)}
                              </span>
                            )}
                            {f.uploaded_at && <span>Enviado {formatDate(f.uploaded_at)}</span>}
                            {f.uploaded_by && viewerRole !== "client" && <span>Enviado pelo cliente</span>}
                            {f.reviewed_at && <span>Revisado {formatDate(f.reviewed_at)}</span>}
                          </div>
                          {f.status === "reprovado" && f.rejection_reason && (
                            <p className="text-xs text-rose-700 mt-2 bg-rose-50 px-3 py-2 rounded-lg border border-rose-200">
                              <strong>Motivo:</strong> {f.rejection_reason}
                            </p>
                          )}
                          {f.internal_notes && isAdmin && (
                            <p className="text-xs text-slate-500 mt-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                              <MessageSquare className="size-3 inline mr-1" /> {f.internal_notes}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                          {canUpload && !isAllView && (
                            isAdmin ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost" size="sm"
                                    className="text-indigo-600 hover:bg-indigo-50 h-8 gap-1.5"
                                    disabled={uploading}
                                    title="Anexar arquivo(s) recebido(s) em nome do cliente"
                                  >
                                    {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                                    {f.file_path ? "Adicionar arquivo" : "Anexar pelo admin"}
                                    <ChevronDown className="size-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => triggerAttach(f, "email")}>
                                    <Mail className="size-3.5 mr-2" /> Recebido por Email
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => triggerAttach(f, "whatsapp")}>
                                    <MessageCircle className="size-3.5 mr-2" /> Recebido por WhatsApp
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => triggerAttach(f, "admin")}>
                                    <Upload className="size-3.5 mr-2" /> Upload manual
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <Button
                                size="sm"
                                variant={isRequest ? "default" : "outline"}
                                disabled={uploading}
                                className="h-8 gap-1.5"
                                onClick={() => triggerAttach(f)}
                              >
                                {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                                {isRequest ? "Enviar arquivo" : "Adicionar"}
                              </Button>
                            )
                          )}
                          {f.source && f.source !== "client" && f.source !== "client_upload" && (
                            <Badge variant="outline" className="h-6 text-[9px] uppercase tracking-widest bg-indigo-50 border-indigo-200 text-indigo-700">
                              <Mail className="size-3 mr-1" /> {f.source}
                            </Badge>
                          )}
                          {f.file_path && (
                            <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => viewFile(f.file_path)}>
                              <Eye className="size-3.5" /> Ver
                            </Button>
                          )}
                          {f.file_path && (
                            <Button variant="ghost" size="icon" className="size-8 text-slate-500 hover:text-slate-900" onClick={() => downloadFile(f.file_path, f.name)} title="Baixar">
                              <Download className="size-4" />
                            </Button>
                          )}
                          {isAdmin && f.file_path && f.status !== "aprovado" && (
                            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-emerald-600 hover:bg-emerald-50" onClick={() => updateDocStatus(f, "aprovado")}>
                              <Check className="size-3.5" /> Aprovar
                            </Button>
                          )}
                          {isAdmin && f.file_path && f.status !== "em_analise" && f.status !== "aprovado" && (
                            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-blue-600 hover:bg-blue-50" onClick={() => updateDocStatus(f, "em_analise")}>
                              <Loader2 className="size-3.5" /> Analisar
                            </Button>
                          )}
                          {isAdmin && f.status !== "reprovado" && (
                            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-rose-600 hover:bg-rose-50" onClick={() => handleReject(f)}>
                              <X className="size-3.5" /> Rejeitar
                            </Button>
                          )}
                          {isAdmin && f.file_path && (
                            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-orange-600 hover:bg-orange-50" onClick={() => handleRequestResend(f)}>
                              <RefreshCw className="size-3.5" /> Reenvio
                            </Button>
                          )}
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="size-8 text-slate-500 hover:text-indigo-600" onClick={() => setEditingDoc(f)} title="Editar solicitação">
                              <Pencil className="size-4" />
                            </Button>
                          )}
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="size-8 text-slate-500 hover:text-slate-900" onClick={() => handleAddNote(f)} title="Comentário interno">
                              <MessageSquare className="size-4" />
                            </Button>
                          )}
                          {(isAdmin || f.uploaded_by === user?.id) && (
                            <Button variant="ghost" size="icon" className="size-8 text-slate-500 hover:text-rose-600" onClick={() => removeFile(f)} title="Excluir">
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>

              )}
            </div>
          )}
        </>
      )}

      {/* Create folder */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova pasta</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Nome</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Faturamento Fiscal" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button onClick={createFolder} disabled={!newName.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog open={!!renaming} onOpenChange={(v) => !v && setRenaming(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Renomear pasta</DialogTitle></DialogHeader>
          {renaming && (
            <Input value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>Cancelar</Button>
            <Button onClick={renameFolder} disabled={!renaming?.name.trim()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {providersFor && (
        <ProviderAccessDialog
          folderId={providersFor}
          clientId={clientId}
          onClose={() => setProvidersFor(null)}
        />
      )}

      {isAdmin && (
        <BulkShareDocumentsDialog open={sharingOpen} onOpenChange={setSharingOpen}
          documents={(files as any[]).map((f) => ({ id: f.id, name: f.name, file_path: f.file_path }))} />
      )}
      {requestingInFolder && (
        <DocumentDialog
          open
          onOpenChange={(v) => !v && setRequestingInFolder(null)}
          clientId={clientId}
          folderId={requestingInFolder}
          onSuccess={() => {
            setRequestingInFolder(null);
            qc.invalidateQueries({ queryKey: ["cdf-files", clientId] });
          }}
        />
      )}

      {editingDoc && (
        <DocumentDialog
          open
          onOpenChange={(v) => !v && setEditingDoc(null)}
          clientId={clientId}
          document={editingDoc}
          folderId={editingDoc.folder_id ?? null}
          onSuccess={() => {
            setEditingDoc(null);
            qc.invalidateQueries({ queryKey: ["cdf-files", clientId] });
          }}
        />
      )}



      {/* Novo contrato */}
      <Dialog open={creatingContract} onOpenChange={setCreatingContract}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo contrato</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Nome do contrato</Label>
            <Input value={newContractName} onChange={(e) => setNewContractName(e.target.value)} placeholder="Ex: Contrato de prestação — 2026" autoFocus />
            <p className="text-[11px] text-slate-500">Depois adicione as fases de assinatura (ex.: Minuta → Assinado pelo cliente → Assinado pela Zenon).</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatingContract(false)}>Cancelar</Button>
            <Button onClick={createContract} disabled={!newContractName.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adicionar fase */}
      <Dialog open={!!addingPhaseTo} onOpenChange={(v) => !v && setAddingPhaseTo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adicionar fase</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Nome da fase</Label>
            <Input value={phaseLabel} onChange={(e) => setPhaseLabel(e.target.value)} placeholder="Ex: Minuta / Assinado pelo cliente" autoFocus />
            <p className="text-[11px] text-slate-500">Ao confirmar, selecione o arquivo dessa fase.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingPhaseTo(null)}>Cancelar</Button>
            <Button onClick={confirmAddPhase} disabled={!phaseLabel.trim()}>Escolher arquivo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProviderAccessDialog({ folderId, clientId, onClose }: { folderId: string; clientId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: authorized = [] } = useQuery({
    queryKey: ["cdf-provider-access", folderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_document_folder_providers" as any)
        .select("provider_id")
        .eq("folder_id", folderId);
      if (error) throw error;
      return (data ?? []).map((r: any) => r.provider_id);
    },
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["cdf-eligible-providers", clientId],
    queryFn: async () => {
      // providers linked to this client + all providers as fallback
      const { data, error } = await supabase
        .from("service_providers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const authSet = useMemo(() => new Set(authorized), [authorized]);

  async function toggle(providerId: string) {
    if (authSet.has(providerId)) {
      const { error } = await supabase
        .from("client_document_folder_providers" as any)
        .delete()
        .eq("folder_id", folderId)
        .eq("provider_id", providerId);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("client_document_folder_providers" as any)
        .insert({ folder_id: folderId, provider_id: providerId, granted_by: user?.id });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["cdf-provider-access", folderId] });
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Prestadores autorizados</DialogTitle></DialogHeader>
        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
          {providers.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">Nenhum prestador cadastrado.</p>
          ) : (
            providers.map((p: any) => (
              <label key={p.id} className="flex items-center gap-2 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={authSet.has(p.id)}
                  onChange={() => toggle(p.id)}
                />
                <span className="text-sm text-slate-800">{p.name}</span>
              </label>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
