import { useState, useRef, useEffect } from "react";
import { nowBR, formatBRDate } from "@/lib/datetime";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Upload, X, Calendar as CalendarIcon, Package, Users, Building2, UserCircle, Handshake, Plus, FileText, Paperclip } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { assertUploadFile, sanitizeStorageFileName, uploadErrorMessage, uploadStorageFileFast } from "@/lib/uploads";
import { useClientsRef, useProvidersRef } from "@/hooks/useReferenceData";
import { useMemo } from "react";


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
  clientId?: string;
  document?: any;
  defaultProductId?: string | null;
  clientProductId?: string | null;
}

type RecipientType = "client" | "collaborator" | "provider" | "partner";

export function DocumentDialog({ open, onOpenChange, onSuccess, clientId: propClientId, document: editDoc, defaultProductId, clientProductId: propClientProductId }: Props) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [recipientType, setRecipientType] = useState<RecipientType>("client");
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("");
  const [form, setForm] = useState<any>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  // Multi-doc items (only used when creating, not editing)
  type DocItem = { name: string; file: File | null };
  const [items, setItems] = useState<DocItem[]>([{ name: "", file: null }]);
  const itemFileRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (open) {
      if (editDoc) {
        setForm({
          name: editDoc.name,
          description: editDoc.description || "",
          product_id: editDoc.product_id || "none",
          client_product_id: editDoc.client_product_id || "none",
          due_date: editDoc.due_date || "",
          sale_id: editDoc.sale_id || "none",
          is_required: editDoc.is_required ?? true,
          priority: editDoc.priority || "media",
        });
        
        if (editDoc.collaborator_id) {
          setRecipientType("collaborator");
          setSelectedRecipientId(editDoc.collaborator_id);
        } else if (editDoc.provider_id) {
          setRecipientType("provider");
          setSelectedRecipientId(editDoc.provider_id);
        } else if (editDoc.partner_id) {
          setRecipientType("partner");
          setSelectedRecipientId(editDoc.partner_id);
        } else {
          setRecipientType("client");
          setSelectedRecipientId(editDoc.client_id || "");
        }
      } else {
        setForm({
          name: "",
          description: "",
          product_id: defaultProductId || "none",
          client_product_id: propClientProductId || "none",
          due_date: "",
          sale_id: "none",
          is_required: true,
          priority: "media",
        });
        setRecipientType("client");
        setSelectedRecipientId(propClientId || "");
        setItems([{ name: "", file: null }]);
      }
    }
  }, [open, editDoc, propClientId, defaultProductId, propClientProductId]);

  const { data: sales } = useQuery({
    queryKey: ["sales-by-client", selectedRecipientId],
    queryFn: async () => {
      if (recipientType !== "client") return [];
      const { data } = await supabase
        .from("sales")
        .select("id, amount, sale_date, products(name)")
        .eq("client_id", selectedRecipientId)
        .order("sale_date", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: open && !!selectedRecipientId && recipientType === "client",
  });

  const { data: allClients } = useClientsRef(open);
  const clients = useMemo(
    () => (allClients ?? []).filter((c: any) => c.status === "ativo"),
    [allClients],
  );

  const { data: collaborators } = useQuery({
    queryKey: ["collaborators-list-simple"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").eq("active", true).order("full_name").limit(300);
      return data ?? [];
    },
    enabled: open,
  });

  const { data: providers } = useProvidersRef(open);

  const { data: partners } = useQuery({
    queryKey: ["partners-list-simple"],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, full_name, email").order("full_name").limit(500);
      return data ?? [];
    },
    enabled: open,
  });




  const { data: clientProducts } = useQuery({
    queryKey: ["client-products-list", selectedRecipientId],
    queryFn: async () => {
      if (recipientType !== "client") return [];
      const { data } = await supabase
        .from("client_products")
        .select("id, product_id, custom_product_name, products(id, name)")
        .eq("client_id", selectedRecipientId);
      return data ?? [];
    },
    enabled: open && !!selectedRecipientId && recipientType === "client",
  });

  const submit = async () => {
    if (!selectedRecipientId) { toast.error("Selecione um destinatário"); return; }

    // Build list of doc names to create (when not editing). When editing, just use form.name.
    const docNames: { name: string; file: File | null }[] = editDoc
      ? [{ name: form.name, file: fileRef.current?.files?.[0] || null }]
      : items.filter(i => (i.name || "").trim()).map(i => ({ name: i.name.trim(), file: i.file }));

    if (docNames.length === 0) { toast.error("Informe ao menos um nome de documento"); return; }

    if (recipientType === "client" && (!form.client_product_id || form.client_product_id === "none")) {
      toast.error("Selecione a demanda/produto vinculado (obrigatório para clientes)");
      return;
    }

    if (recipientType === "partner") {
      const exists = (partners ?? []).some((p: any) => p.id === selectedRecipientId);
      if (!exists) { toast.error("Parceiro selecionado é inválido."); return; }
    } else if (recipientType === "provider") {
      const exists = (providers ?? []).some((p: any) => p.id === selectedRecipientId);
      if (!exists) { toast.error("Prestador selecionado é inválido."); return; }
    } else if (recipientType === "collaborator") {
      const exists = (collaborators ?? []).some((p: any) => p.id === selectedRecipientId);
      if (!exists) { toast.error("Colaborador selecionado é inválido."); return; }
    }

    setSubmitting(true);

    let successCount = 0;
    let failMsg: string | null = null;

    for (const item of docNames) {
      let file_path = editDoc?.file_path || null;
      let file_size = editDoc?.file_size || null;
      let mime_type = editDoc?.mime_type || null;
      let status = editDoc?.status || "solicitado";
      let uploaded_at = editDoc?.uploaded_at || null;

      const file = item.file;
      if (file) {
        try { assertUploadFile(file); } catch (e: any) { failMsg = uploadErrorMessage(e); break; }
        const folder = recipientType === "client" ? selectedRecipientId : `${recipientType}s/${selectedRecipientId}`;
        const path = `${folder}/${Date.now()}-${sanitizeStorageFileName(file.name)}`;
        try {
          await uploadStorageFileFast("documents", path, file);
        } catch (upErr: any) {
          failMsg = uploadErrorMessage(upErr);
          break;
        }

        if (editDoc?.id && editDoc.file_path) {
          const { count } = await supabase
            .from("document_versions")
            .select("id", { count: "exact", head: true })
            .eq("document_id", editDoc.id);
          await supabase.from("document_versions").insert({
            document_id: editDoc.id,
            version_number: (count ?? 0) + 1,
            file_path: editDoc.file_path,
            file_size: editDoc.file_size,
            mime_type: editDoc.mime_type,
            uploaded_by: editDoc.uploaded_by,
            note: "Versão substituída por novo upload",
          });
        }

        file_path = path;
        file_size = file.size;
        mime_type = file.type;
        status = "enviado";
        uploaded_at = nowBR().toISOString();
      }

      const payload: any = {
        name: item.name,
        description: form.description || null,
        product_id: form.product_id === "none" ? null : form.product_id,
        client_product_id: form.client_product_id === "none" ? null : form.client_product_id,
        sale_id: form.sale_id === "none" ? null : form.sale_id,
        due_date: form.due_date || null,
        is_required: form.is_required ?? true,
        priority: form.priority || "media",
        status,
        file_path,
        file_size,
        mime_type,
        requested_by: editDoc ? editDoc.requested_by : user?.id,
        uploaded_by: file ? user?.id : (editDoc?.uploaded_by || null),
        uploaded_at,
      };

      payload.client_id = recipientType === "client" ? selectedRecipientId : null;
      payload.collaborator_id = recipientType === "collaborator" ? selectedRecipientId : null;
      payload.provider_id = recipientType === "provider" ? selectedRecipientId : null;
      payload.partner_id = recipientType === "partner" ? selectedRecipientId : null;

      const { error } = editDoc
        ? await supabase.from("documents").update(payload).eq("id", editDoc.id)
        : await supabase.from("documents").insert(payload);

      if (error) { failMsg = error.message; break; }
      successCount++;

      // Notify recipient (best-effort) — only for new
      if (!editDoc) {
        try {
          if (recipientType === "client" && selectedRecipientId) {
            const { data: c } = await supabase.from("clients").select("user_id").eq("id", selectedRecipientId).maybeSingle();
            if (c?.user_id) {
              await supabase.from("notifications").insert({
                user_id: c.user_id,
                title: file ? "Novo documento disponível" : "Novo documento solicitado",
                message: file ? `${item.name} foi enviado pela equipe.` : `Envie o documento "${item.name}" pelo seu portal.`,
                type: file ? "document_uploaded" : "document_requested",
                link: "/portal-cliente/documentos",
              });
            }
          } else if (recipientType === "provider" && selectedRecipientId) {
            const { data: sp } = await supabase.from("service_providers").select("user_id").eq("id", selectedRecipientId).maybeSingle();
            if (sp?.user_id) {
              await supabase.from("notifications").insert({
                user_id: sp.user_id, title: "Novo documento solicitado",
                message: `Envie o documento "${item.name}" pelo seu painel.`,
                type: "document_requested", link: "/prestador",
              });
            }
          } else if (recipientType === "collaborator" && selectedRecipientId) {
            await supabase.from("notifications").insert({
              user_id: selectedRecipientId, title: "Novo documento solicitado",
              message: `Envie o documento "${item.name}" pelo seu painel.`,
              type: "document_requested", link: "/colaborador",
            });
          } else if (recipientType === "partner" && selectedRecipientId) {
            const { data: p } = await supabase.from("partners").select("user_id").eq("id", selectedRecipientId).maybeSingle();
            if (p?.user_id) {
              await supabase.from("notifications").insert({
                user_id: p.user_id, title: "Novo documento solicitado",
                message: `Envie o documento "${item.name}" pelo seu painel.`,
                type: "document_requested", link: "/parceiro/documentos",
              });
            }
          }
        } catch (_) {}
      }
    }

    setSubmitting(false);
    if (failMsg) { toast.error(failMsg); return; }

    const recipientLabel = recipientType === 'client' ? 'cliente' : recipientType === 'collaborator' ? 'colaborador' : recipientType === 'provider' ? 'prestador' : 'parceiro';
    toast.success(
      editDoc
        ? "Documento atualizado"
        : successCount > 1
          ? `${successCount} documentos solicitados ao ${recipientLabel}`
          : `Documento solicitado ao ${recipientLabel}`
    );
    onSuccess?.();
    onOpenChange(false);
    setForm({});
    setSelectedFileName("");
    setItems([{ name: "", file: null }]);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200/70 bg-gradient-to-b from-slate-50/70 to-white">
          <DialogTitle className="font-display text-xl text-slate-900">
            {editDoc ? "Editar solicitação" : "Nova solicitação de documento"}
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1">Defina o destinatário, vincule a uma demanda e (opcionalmente) já anexe o arquivo.</p>
        </DialogHeader>
        
        <div className="space-y-5 px-6 py-5">
          {!editDoc && (
            <div className="space-y-3 rounded-xl border border-slate-200/70 bg-slate-50/40 p-4">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Destinatário</Label>
              <div className="grid grid-cols-4 gap-1.5">
                {([
                  { key: "client", label: "Cliente", icon: Users },
                  { key: "collaborator", label: "Colab.", icon: UserCircle },
                  { key: "provider", label: "Prest.", icon: Building2 },
                  { key: "partner", label: "Parceiro", icon: Handshake },
                ] as { key: RecipientType; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setRecipientType(key); setSelectedRecipientId(""); }}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-[11px] font-medium transition",
                      recipientType === key
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/30"
                        : "border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </button>
                ))}
              </div>

              <Select value={selectedRecipientId} onValueChange={setSelectedRecipientId}>
                <SelectTrigger>
                  <SelectValue placeholder={`Selecione o ${recipientType === 'client' ? 'cliente' : recipientType === 'collaborator' ? 'colaborador' : recipientType === 'provider' ? 'prestador' : 'parceiro'}`} />
                </SelectTrigger>
                <SelectContent>
                  {recipientType === "client" && clients?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                  {recipientType === "collaborator" && collaborators?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name || c.email}</SelectItem>
                  ))}
                  {recipientType === "provider" && providers?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                  {recipientType === "partner" && partners?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name || c.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {editDoc ? (
            <div className="space-y-2">
              <Label>Nome do documento *</Label>
              <Input
                placeholder="Ex: RG, Contrato Social, IRPF..."
                value={form.name ?? ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Documentos solicitados *
                </Label>
                <span className="text-[11px] text-slate-500">
                  {items.filter(i => i.name.trim()).length} item(ns)
                </span>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300 transition-colors">
                    <div className="flex items-start gap-2">
                      <div className="size-8 rounded-md bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="size-4 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <Input
                          placeholder={`Documento ${idx + 1} — ex: RG, Contrato Social, IRPF...`}
                          value={item.name}
                          onChange={(e) => {
                            const next = [...items];
                            next[idx] = { ...next[idx], name: e.target.value };
                            setItems(next);
                          }}
                          className="h-9"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            ref={(el) => { itemFileRefs.current[idx] = el; }}
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0] || null;
                              const next = [...items];
                              next[idx] = { ...next[idx], file: f };
                              setItems(next);
                            }}
                          />
                          {item.file ? (
                            <div className="flex items-center gap-2 flex-1 min-w-0 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-1">
                              <Paperclip className="size-3.5 text-emerald-700 shrink-0" />
                              <span className="text-[11px] text-emerald-900 truncate flex-1">{item.file.name}</span>
                              <button
                                type="button"
                                className="text-emerald-700 hover:text-emerald-900"
                                onClick={() => {
                                  const next = [...items];
                                  next[idx] = { ...next[idx], file: null };
                                  setItems(next);
                                  if (itemFileRefs.current[idx]) itemFileRefs.current[idx]!.value = "";
                                }}
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] gap-1.5"
                              onClick={() => itemFileRefs.current[idx]?.click()}
                            >
                              <Upload className="size-3" /> Anexar arquivo (opcional)
                            </Button>
                          )}
                        </div>
                      </div>
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="size-8 p-0 text-slate-400 hover:text-rose-600 shrink-0"
                          onClick={() => setItems(items.filter((_, i) => i !== idx))}
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-1.5 border-dashed"
                onClick={() => setItems([...items, { name: "", file: null }])}
              >
                <Plus className="size-3.5" /> Adicionar outro documento
              </Button>
              <p className="text-[11px] text-slate-500">
                Cada item gera uma solicitação separada com o mesmo destinatário, prazo e prioridade.
              </p>
            </div>
          )}


          <div className="grid grid-cols-2 gap-4">
            {recipientType === "client" && (
              <div className="space-y-2 col-span-2">
                <Label>Produto / Demanda vinculada *</Label>
                <Select
                  value={form.client_product_id || ""}
                  onValueChange={(v) => {
                     const cp = clientProducts?.find((x: any) => x.id === v);
                     setForm({ ...form, client_product_id: v, product_id: cp?.product_id || "none" });
                  }}
                >
                  <SelectTrigger>
                    <Package className="size-3.5 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Selecione a demanda (obrigatório)" />
                  </SelectTrigger>
                  <SelectContent>
                    {(clientProducts?.length ?? 0) === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground">Nenhuma demanda para este cliente.</div>
                    ) : clientProducts!.map((cp: any) => (
                      <SelectItem key={cp.id} value={cp.id}>{cp.products?.name || cp.custom_product_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Prazo para envio</Label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <Input 
                  type="date" 
                  className="pl-9"
                  value={form.due_date ?? ""} 
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={form.priority || "media"} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
            <input
              id="is_required"
              type="checkbox"
              className="size-4 accent-primary"
              checked={form.is_required ?? true}
              onChange={(e) => setForm({ ...form, is_required: e.target.checked })}
            />
            <Label htmlFor="is_required" className="cursor-pointer flex-1">
              Documento obrigatório
              <span className="block text-[11px] font-normal text-muted-foreground">
                Desmarque para tornar este documento opcional.
              </span>
            </Label>
          </div>

          {recipientType === "client" && selectedRecipientId && (sales?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <Label>Vincular a uma venda (opcional)</Label>
              <Select value={form.sale_id || "none"} onValueChange={(v) => setForm({ ...form, sale_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma venda específica" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma venda específica</SelectItem>
                  {sales?.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.products?.name || "Venda"} — {formatBRDate(s.sale_date)} — R$ {Number(s.amount).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Instruções / Descrição</Label>
            <Textarea 
              placeholder="Explique o que precisa ser enviado..."
              value={form.description ?? ""} 
              onChange={(e) => setForm({ ...form, description: e.target.value })} 
              className="min-h-[100px]"
            />
          </div>

          {editDoc && (
            <div className="space-y-2">
              <Label>Já possui o arquivo? (opcional)</Label>
              {selectedFileName ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
                      <Upload className="size-4 text-emerald-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-emerald-900 truncate">{selectedFileName}</p>
                      <p className="text-[11px] text-emerald-700/80">Arquivo selecionado — será enviado ao salvar.</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-emerald-700 hover:text-emerald-900"
                    onClick={() => { if (fileRef.current) fileRef.current.value = ""; setSelectedFileName(""); }}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-primary/60 hover:bg-primary/5 transition-colors cursor-pointer group"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="size-8 mx-auto text-slate-400 mb-2 group-hover:text-primary transition-colors" />
                  <p className="text-sm font-medium text-slate-700">Clique para selecionar</p>
                  <p className="text-[11px] text-muted-foreground mt-1">PDF, PNG, JPG, JPEG, DOCX, XLSX (até 20MB)</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(e) => setSelectedFileName(e.target.files?.[0]?.name || "")}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 px-6 py-4 border-t border-slate-200/70 bg-slate-50/40">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting} className="bg-gradient-primary">
            {submitting ? "Salvando..." : editDoc ? "Salvar Alterações" : "Criar Solicitação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}