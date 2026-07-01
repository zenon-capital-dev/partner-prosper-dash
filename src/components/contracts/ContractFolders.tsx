import { useRef, useState } from "react";
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
import { toast } from "sonner";
import { sanitizeStorageFileName, uploadErrorMessage } from "@/lib/uploads";
import { downloadStorageFile } from "@/lib/download";
import { formatDate } from "@/lib/format";
import {
  FolderPlus, Folder, Upload, FileSignature, Download, Eye, Trash2,
  Loader2, Pencil, CheckCircle2, Clock,
} from "lucide-react";

type Role = "admin" | "client";

interface Props {
  clientId: string;
  viewerRole: Role;
}

export function ContractFolders({ clientId, viewerRole }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const originalFileRef = useRef<HTMLInputElement>(null);
  const signedFileRef = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [signingContractId, setSigningContractId] = useState<string | null>(null);

  const isAdmin = viewerRole === "admin";
  const isClient = viewerRole === "client";

  const { data: folders = [], isLoading } = useQuery({
    queryKey: ["cf-folders", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_folders" as any)
        .select("*")
        .eq("client_id", clientId)
        .order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const currentFolderId = activeId ?? folders[0]?.id ?? null;

  const { data: contracts = [] } = useQuery({
    queryKey: ["cf-contracts", currentFolderId],
    enabled: !!currentFolderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
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
      .from("contract_folders" as any)
      .insert({ client_id: clientId, name, created_by: user?.id })
      .select()
      .single();
    if (error) return toast.error(error.message);
    toast.success("Pasta criada");
    setNewName(""); setCreating(false);
    setActiveId((data as any)?.id ?? null);
    qc.invalidateQueries({ queryKey: ["cf-folders", clientId] });
  }

  async function renameFolder() {
    if (!renaming) return;
    const { error } = await supabase
      .from("contract_folders" as any)
      .update({ name: renaming.name.trim() })
      .eq("id", renaming.id);
    if (error) return toast.error(error.message);
    toast.success("Pasta renomeada");
    setRenaming(null);
    qc.invalidateQueries({ queryKey: ["cf-folders", clientId] });
  }

  async function deleteFolder(id: string) {
    if (!confirm("Excluir esta pasta? Os contratos ficarão sem pasta.")) return;
    const { error } = await supabase.from("contract_folders" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (activeId === id) setActiveId(null);
    toast.success("Pasta excluída");
    qc.invalidateQueries({ queryKey: ["cf-folders", clientId] });
  }

  async function onUploadOriginal(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !currentFolderId) return;
    try {
      setUploading(true);
      const safe = sanitizeStorageFileName(file.name);
      const path = `${clientId}/folder/${currentFolderId}/${Date.now()}_${safe}`;
      const up = await supabase.storage.from("contracts").upload(path, file);
      if (up.error) throw up.error;
      const { error } = await supabase.from("contracts").insert({
        client_id: clientId,
        folder_id: currentFolderId,
        name: file.name.replace(/\.[^.]+$/, ""),
        file_path: path,
        status: "enviado",
        sent_at: new Date().toISOString(),
      } as any);
      if (error) throw error;
      toast.success("Contrato enviado ao cliente");
      qc.invalidateQueries({ queryKey: ["cf-contracts", currentFolderId] });
    } catch (e: any) {
      toast.error(uploadErrorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  async function onUploadSigned(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const contractId = signingContractId;
    e.target.value = "";
    setSigningContractId(null);
    if (!file || !contractId) return;
    try {
      setUploading(true);
      const safe = sanitizeStorageFileName(file.name);
      const path = `${clientId}/signed/${contractId}/${Date.now()}_${safe}`;
      const up = await supabase.storage.from("contracts").upload(path, file);
      if (up.error) throw up.error;
      const { error } = await supabase
        .from("contracts")
        .update({
          signed_file_path: path,
          signed_uploaded_at: new Date().toISOString(),
          status: "assinado",
          signed_at: new Date().toISOString(),
        } as any)
        .eq("id", contractId);
      if (error) throw error;
      toast.success("Assinado enviado. Obrigado!");
      qc.invalidateQueries({ queryKey: ["cf-contracts", currentFolderId] });
    } catch (e: any) {
      toast.error(uploadErrorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  async function viewFile(path: string) {
    const { data, error } = await supabase.storage.from("contracts").createSignedUrl(path, 3600);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function downloadFile(path: string, name: string) {
    try { await downloadStorageFile("contracts", path, name); }
    catch (e: any) { toast.error(e.message || "Erro ao baixar"); }
  }

  async function removeContract(c: any) {
    if (!confirm(`Excluir "${c.name}"?`)) return;
    if (c.file_path) await supabase.storage.from("contracts").remove([c.file_path]);
    if (c.signed_file_path) await supabase.storage.from("contracts").remove([c.signed_file_path]);
    const { error } = await supabase.from("contracts").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Contrato excluído");
    qc.invalidateQueries({ queryKey: ["cf-contracts", currentFolderId] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Folder className="size-4 text-primary" />
          <h3 className="font-bold text-sm">Pastas de Contratos</h3>
          <Badge variant="outline" className="text-[10px]">{folders.length}</Badge>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setCreating(true)} className="gap-2">
            <FolderPlus className="size-4" /> Nova pasta
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Carregando...</div>
      ) : folders.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {isAdmin ? "Crie uma pasta para organizar os contratos (ex.: Prestação de Serviço, NDA)." : "Nenhuma pasta disponível."}
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {folders.map((f: any) => (
              <button
                key={f.id}
                onClick={() => setActiveId(f.id)}
                className={`shrink-0 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                  f.id === currentFolderId
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white hover:bg-slate-50 border-slate-200"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>

          {isAdmin && currentFolderId && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => originalFileRef.current?.click()} disabled={uploading} className="gap-2">
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Enviar contrato
              </Button>
              <Button size="sm" variant="ghost" onClick={() => {
                const f = folders.find((x: any) => x.id === currentFolderId);
                if (f) setRenaming({ id: f.id, name: f.name });
              }} className="gap-2">
                <Pencil className="size-4" /> Renomear
              </Button>
              <Button size="sm" variant="ghost" onClick={() => deleteFolder(currentFolderId)} className="gap-2 text-rose-600">
                <Trash2 className="size-4" /> Excluir pasta
              </Button>
            </div>
          )}

          <div className="rounded-xl border bg-white">
            {contracts.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Nenhum contrato nessa pasta.</div>
            ) : (
              <ul className="divide-y">
                {contracts.map((c: any) => (
                  <li key={c.id} className="p-3 flex items-center gap-3 flex-wrap">
                    <FileSignature className="size-5 text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Enviado em {formatDate(c.created_at)}
                        {c.signed_uploaded_at && ` · Assinado em ${formatDate(c.signed_uploaded_at)}`}
                      </p>
                    </div>
                    {c.signed_file_path ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                        <CheckCircle2 className="size-3" /> Assinado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
                        <Clock className="size-3" /> Aguardando
                      </Badge>
                    )}
                    <div className="flex items-center gap-1">
                      {c.file_path && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => viewFile(c.file_path)} title="Visualizar">
                            <Eye className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => downloadFile(c.file_path, c.name)} title="Baixar">
                            <Download className="size-4" />
                          </Button>
                        </>
                      )}
                      {isClient && !c.signed_file_path && (
                        <Button size="sm" variant="default" className="gap-2" onClick={() => {
                          setSigningContractId(c.id);
                          signedFileRef.current?.click();
                        }}>
                          <Upload className="size-3.5" /> Enviar assinado
                        </Button>
                      )}
                      {c.signed_file_path && (
                        <Button size="icon" variant="ghost" onClick={() => downloadFile(c.signed_file_path, `assinado_${c.name}`)} title="Baixar assinado">
                          <Download className="size-4 text-emerald-600" />
                        </Button>
                      )}
                      {isAdmin && (
                        <Button size="icon" variant="ghost" onClick={() => removeContract(c)} title="Excluir">
                          <Trash2 className="size-4 text-rose-600" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <input ref={originalFileRef} type="file" className="hidden" onChange={onUploadOriginal} />
      <input ref={signedFileRef} type="file" className="hidden" onChange={onUploadSigned} />

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova pasta de contratos</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Nome da pasta</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex.: Prestação de Serviço, NDA, Aditivos" autoFocus />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button onClick={createFolder}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Renomear pasta</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={renaming?.name ?? ""} onChange={(e) => setRenaming((s) => s ? { ...s, name: e.target.value } : s)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenaming(null)}>Cancelar</Button>
            <Button onClick={renameFolder}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
