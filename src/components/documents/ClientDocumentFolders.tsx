import { useMemo, useRef, useState } from "react";
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
  Loader2, FilePlus2,
} from "lucide-react";
import { DocumentDialog } from "@/components/documents/DocumentDialog";

type Role = "admin" | "client" | "provider";

interface Props {
  clientId: string;
  viewerRole: Role;
}

export function ClientDocumentFolders({ clientId, viewerRole }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [providersFor, setProvidersFor] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [requestingInFolder, setRequestingInFolder] = useState<string | null>(null);

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

  const currentFolderId = activeId ?? folders[0]?.id ?? null;

  const { data: files = [] } = useQuery({
    queryKey: ["cdf-files", currentFolderId],
    enabled: !!currentFolderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("folder_id", currentFolderId!)
        .order("created_at", { ascending: false });
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
      qc.invalidateQueries({ queryKey: ["cdf-files", currentFolderId] });
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
    qc.invalidateQueries({ queryKey: ["cdf-files", currentFolderId] });
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
      ) : folders.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-lg p-6 text-center bg-white">
          <Folder className="size-6 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-600">Nenhuma pasta ainda.</p>
          {isAdmin && (
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setCreating(true)}>
              Criar primeira pasta
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Tabs value={currentFolderId ?? ""} onValueChange={setActiveId}>
              <TabsList className="flex-wrap h-auto">
                {folders.map((f) => (
                  <TabsTrigger key={f.id} value={f.id} className="gap-1">
                    <Folder className="size-3.5" />
                    {f.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {currentFolderId && (
            <div className="border border-slate-200 rounded-lg bg-white p-3 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-slate-50">
                    {files.length} arquivo(s)
                  </Badge>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {isAdmin && (
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
                  {canUpload && (
                    <>
                      <input ref={fileRef} type="file" multiple hidden onChange={onUpload} />
                      <Button size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                        {uploading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Upload className="size-3.5 mr-1" />}
                        Enviar arquivos
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {files.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">Nenhum arquivo nesta pasta.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {files.map((f: any) => (
                    <li key={f.id} className="flex items-center gap-3 py-2">
                      <FileText className="size-4 text-slate-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate">{f.name}</p>
                        <p className="text-[11px] text-slate-500">{formatDate(f.uploaded_at ?? f.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {f.file_path && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => viewFile(f.file_path)}>
                              <Eye className="size-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => downloadFile(f.file_path, f.name)}>
                              <Download className="size-3.5" />
                            </Button>
                          </>
                        )}
                        {(isAdmin || f.uploaded_by === user?.id) && (
                          <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={() => removeFile(f)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
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
