import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Folder, FolderPlus, Upload, FileText, Download, Trash2, Lock, Users, Loader2, Eye, ShieldCheck } from "lucide-react";
import { openDownloadUrl } from "@/lib/download";
import { cn } from "@/lib/utils";

type Scope = "client" | "internal";

interface FolderRow {
  id: string;
  client_product_id: string;
  name: string;
  scope: Scope;
  owner_provider_user_id: string | null;
  created_by: string;
  created_at: string;
}
interface FileRow {
  id: string;
  folder_id: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  uploaded_by: string;
  created_at: string;
  mime_type?: string | null;
  _uploader?: { id: string; full_name?: string | null; email?: string | null } | null;
}

interface Props {
  clientProductId: string;
  /** Papel do usuário atual nesta demanda */
  role: "admin" | "client" | "provider";
}

const BUCKET = "product-documents";

export function ProductDocumentFolders({ clientProductId, role }: Props) {
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [files, setFiles] = useState<Record<string, FileRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [adminFilter, setAdminFilter] = useState<"all" | "client" | "internal">("all");
  const [nameQuery, setNameQuery] = useState("");
  const [owners, setOwners] = useState<Map<string, { full_name?: string | null; email?: string | null }>>(new Map());
  const scopeKey = `product-doc-folder-scope:${clientProductId}:${role}`;
  const [newScope, setNewScope] = useState<Scope>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(scopeKey) as Scope | null;
      if (stored === "client" || stored === "internal") return stored;
    }
    return "client";
  });
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const uploadRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { getCurrentUserId } = await import("@/lib/current-user");
      const userId = await getCurrentUserId();
      if (mounted) setMe(userId);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(scopeKey, newScope); } catch {}
  }, [newScope, scopeKey]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: fData, error } = await supabase
      .from("product_document_folders")
      .select("*")
      .eq("client_product_id", clientProductId)
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar pastas: " + error.message);
      setLoading(false);
      return;
    }
    const folderRows = (fData as FolderRow[]) || [];
    setFolders(folderRows);
    if (role === "admin") {
      const ownerIds = Array.from(new Set(folderRows.map((f) => f.owner_provider_user_id).filter(Boolean))) as string[];
      if (ownerIds.length) {
        const { data: owns } = await supabase.from("profiles").select("id, full_name, email").in("id", ownerIds);
        const map = new Map<string, any>();
        (owns ?? []).forEach((u: any) => map.set(u.id, u));
        setOwners(map);
      } else {
        setOwners(new Map());
      }
    }
    if (fData && fData.length) {
      const { data: rawFiles, error: fileError } = await supabase
        .from("product_document_files")
        .select("*")
        .in("folder_id", fData.map((f: any) => f.id))
        .order("created_at", { ascending: false });
      if (fileError) toast.error("Erro ao carregar arquivos: " + fileError.message);
      const files = (rawFiles as FileRow[] | null) ?? [];
      const uploaderIds = Array.from(new Set(files.map((f) => f.uploaded_by).filter(Boolean)));
      const uploaderMap = new Map<string, any>();
      if (uploaderIds.length) {
        const { data: uploaders } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", uploaderIds);
        (uploaders ?? []).forEach((u: any) => uploaderMap.set(u.id, u));
      }
      const grouped: Record<string, FileRow[]> = {};
      files.forEach((f) => {
        f._uploader = uploaderMap.get(f.uploaded_by) ?? null;
        grouped[f.folder_id] = grouped[f.folder_id] || [];
        grouped[f.folder_id].push(f);
      });
      setFiles(grouped);
    } else {
      setFiles({});
    }
    setLoading(false);
  }, [clientProductId]);

  useEffect(() => {
    load();
  }, [load]);

  const folderIdsKey = useMemo(() => folders.map((f) => f.id).sort().join(","), [folders]);

  useEffect(() => {
    if (!clientProductId) return;
    const foldersChannel = supabase
      .channel(`product-document-folders:${clientProductId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_document_folders", filter: `client_product_id=eq.${clientProductId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(foldersChannel);
    };
  }, [clientProductId, load]);

  useEffect(() => {
    if (!clientProductId) return;
    const ids = folderIdsKey ? folderIdsKey.split(",").filter(Boolean) : [];
    if (!ids.length) return;
    // Realtime PostgREST filter does not support `in.()`; assinamos um canal por pasta.
    const channels = ids.map((fid) =>
      supabase
        .channel(`product-document-files:${fid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "product_document_files", filter: `folder_id=eq.${fid}` },
          () => load()
        )
        .subscribe()
    );
    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [clientProductId, load, folderIdsKey]);

  // Cliente sempre cria pasta compartilhada. Zenon e prestador escolhem entre cliente e interno.
  const effectiveScope: Scope = role === "client" ? "client" : newScope;

  const createFolder = async () => {
    if (!newName.trim()) return toast.error("Informe o nome da pasta");
    if (!me) return toast.error("Sua sessão expirou. Faça login novamente.");
    const payload: any = {
      client_product_id: clientProductId,
      name: newName.trim(),
      scope: effectiveScope,
      created_by: me,
    };
    if (effectiveScope === "internal") payload.owner_provider_user_id = me;
    if (role === "provider" && effectiveScope === "client") payload.owner_provider_user_id = me;
    const { error } = await supabase.from("product_document_folders").insert(payload);
    if (error) return toast.error("Erro ao criar pasta: " + error.message);
    toast.success("Pasta criada");
    setNewName("");
    setNewFolderOpen(false);
    load();
  };

  const deleteFolder = async (id: string) => {
    if (!confirm("Excluir esta pasta e todos os arquivos dela?")) return;
    const { error } = await supabase.from("product_document_folders").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pasta excluída");
    load();
  };

  const upload = async (folder: FolderRow, file: File) => {
    if (!me) return toast.error("Sua sessão expirou. Faça login novamente.");
    setUploadingId(folder.id);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${clientProductId}/${folder.id}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("product_document_files").insert({
        folder_id: folder.id,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: me,
      });
      if (insErr) throw insErr;
      toast.success(folder.scope === "client" ? "Arquivo enviado e disponível para o cliente" : "Arquivo enviado na pasta interna");
      load();
    } catch (e: any) {
      toast.error("Erro no upload: " + (e.message || e));
    } finally {
      setUploadingId(null);
    }
  };

  const download = async (f: FileRow) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(f.file_path, 3600);
    if (error) return toast.error(error.message);
    openDownloadUrl(data.signedUrl, f.file_name);
  };

  const removeFile = async (f: FileRow) => {
    if (!confirm(`Remover "${f.file_name}"?`)) return;
    await supabase.storage.from(BUCKET).remove([f.file_path]);
    const { error } = await supabase.from("product_document_files").delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    load();
  };

  // Defesa em profundidade: cliente NUNCA vê pastas internas, mesmo se a RLS falhar
  const visibleFolders = useMemo(() => {
    let list = role === "client" ? folders.filter((f) => f.scope === "client") : folders;
    if (role === "admin" && adminFilter !== "all") list = list.filter((f) => f.scope === adminFilter);
    if (nameQuery.trim()) {
      const q = nameQuery.trim().toLowerCase();
      list = list.filter((f) => f.name.toLowerCase().includes(q));
    }
    return list;
  }, [folders, role, adminFilter, nameQuery]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-foreground">Pastas de documentos</h4>
          <p className="text-xs text-muted-foreground">
            {role === "client" && "Pastas liberadas para o cliente visualizar, baixar e enviar arquivos."}
            {role === "provider" && "Escolha entre compartilhar com o cliente ou manter interno com a Zenon."}
            {role === "admin" && "Gerencie pastas do cliente, pastas internas de prestador e revise todos os arquivos enviados."}
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-2" onClick={() => setNewFolderOpen(true)}>
          <FolderPlus className="size-4" /> Nova pasta
        </Button>
      </div>

      {role === "admin" && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar pasta por nome..."
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            className="h-8 text-xs max-w-xs"
          />
          <div className="flex gap-1 rounded-md border p-0.5 bg-slate-50">
            {(["all", "client", "internal"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setAdminFilter(k)}
                className={cn(
                  "text-[11px] px-2.5 py-1 rounded",
                  adminFilter === k ? "bg-white shadow-sm font-semibold text-foreground" : "text-muted-foreground"
                )}
              >
                {k === "all" ? "Todas" : k === "client" ? "Cliente" : "Internas"}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground ml-auto">
            {visibleFolders.length} pasta(s) · {visibleFolders.reduce((a, f) => a + (files[f.id]?.length || 0), 0)} arquivo(s)
          </span>
        </div>
      )}


      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground p-4">
          <Loader2 className="size-4 animate-spin" /> Carregando...
        </div>
      ) : visibleFolders.length === 0 ? (
        <div className="border border-dashed rounded-xl p-8 text-center text-xs text-muted-foreground">
          Nenhuma pasta criada ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleFolders.map((f) => {
            const isOpen = openFolderId === f.id;
            const isOwn = f.created_by === me;
            const isInternal = f.scope === "internal";
            const canDelete = role === "admin" || isOwn;
            const list = files[f.id] || [];
            return (
              <div key={f.id} className="border rounded-xl bg-white overflow-hidden">
                <button
                  className="w-full flex items-center justify-between gap-3 p-3 hover:bg-slate-50 text-left"
                  onClick={() => setOpenFolderId(isOpen ? null : f.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Folder className={cn("size-4 shrink-0", isInternal ? "text-amber-600" : "text-primary")} />
                    <span className="text-sm font-semibold truncate">{f.name}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {list.length}
                    </Badge>
                    {isInternal ? (
                      <Badge variant="outline" className="text-[10px] gap-1 border-amber-200 bg-amber-50 text-amber-700 shrink-0">
                        <Lock className="size-2.5" /> Interna
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] gap-1 border-blue-200 bg-blue-50 text-blue-700 shrink-0">
                        <Eye className="size-2.5" /> Cliente
                      </Badge>
                    )}
                    {role === "admin" && f.owner_provider_user_id && (
                      <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
                        <ShieldCheck className="size-2.5" /> Prestador
                      </Badge>
                    )}
                  </div>
                  {canDelete && (
                    <Trash2
                      className="size-3.5 text-rose-500 hover:text-rose-700 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFolder(f.id);
                      }}
                    />
                  )}
                </button>
                {isOpen && (
                  <div className="border-t p-3 space-y-2 bg-slate-50/40">
                    <div className="flex items-center gap-2">
                      <input
                        ref={(el) => (uploadRefs.current[f.id] = el)}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) upload(f, file);
                          e.target.value = "";
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 h-8 text-xs"
                        disabled={uploadingId === f.id}
                        onClick={() => uploadRefs.current[f.id]?.click()}
                      >
                        {uploadingId === f.id ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                        Enviar arquivo
                      </Button>
                    </div>
                    {list.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground py-2">Nenhum arquivo.</p>
                    ) : (
                      <ul className="space-y-1">
                        {list.map((file) => (
                          <li key={file.id} className="flex items-center justify-between gap-2 bg-white border rounded-md px-2 py-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="size-3.5 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <span className="text-xs truncate block">{file.file_name}</span>
                                {role === "admin" && (
                                  <span className="text-[10px] text-muted-foreground truncate block">
                                    Enviado por {file._uploader?.full_name || file._uploader?.email || "usuário"} · {new Date(file.created_at).toLocaleDateString("pt-BR")}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => download(file)}>
                                <Download className="size-3.5" />
                              </Button>
                              {(role === "admin" || file.uploaded_by === me) && (
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-rose-600" onClick={() => removeFile(file)}>
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
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova pasta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder="Ex.: Faturamento, Fiscal, Contratos..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createFolder()}
            />
            {role !== "client" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNewScope("client")}
                  className={cn(
                    "flex-1 text-left border rounded-lg p-2 text-xs",
                    newScope === "client" ? "border-primary bg-primary/5" : "border-slate-200"
                  )}
                >
                  <div className="font-semibold flex items-center gap-1"><Users className="size-3" /> Compartilhar com cliente</div>
                  <div className="text-[10px] text-muted-foreground">Cliente e Zenon veem os arquivos.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setNewScope("internal")}
                  className={cn(
                    "flex-1 text-left border rounded-lg p-2 text-xs",
                    newScope === "internal" ? "border-primary bg-primary/5" : "border-slate-200"
                  )}
                >
                  <div className="font-semibold flex items-center gap-1"><Lock className="size-3" /> Interna</div>
                  <div className="text-[10px] text-muted-foreground">Só você e a Zenon.</div>
                </button>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              {effectiveScope === "internal"
                ? "Esta pasta será interna: apenas você e a equipe Zenon terão acesso. O cliente e outros prestadores não vão vê-la."
                : "Esta pasta será visível para o cliente e para a equipe Zenon."}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>Cancelar</Button>
            <Button onClick={createFolder} disabled={!newName.trim()}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ProductDocumentFolders;
