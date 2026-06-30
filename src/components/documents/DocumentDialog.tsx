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
import { Upload, X, Calendar as CalendarIcon, Package, Users, Building2, UserCircle, Handshake } from "lucide-react";
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
    if (!form.name) { toast.error("Nome do documento é obrigatório"); return; }
    
    if (recipientType === "client" && (!form.client_product_id || form.client_product_id === "none")) {
      toast.error("Selecione a demanda/produto vinculado (obrigatório para clientes)");
      return;
    }

    setSubmitting(true);

    let file_path = editDoc?.file_path || null;
    let file_size = editDoc?.file_size || null;
    let mime_type = editDoc?.mime_type || null;
    let status = editDoc?.status || "solicitado";
    let uploaded_at = editDoc?.uploaded_at || null;

    const file = fileRef.current?.files?.[0];
    if (file) {
      try { assertUploadFile(file); } catch (e: any) { toast.error(uploadErrorMessage(e)); setSubmitting(false); return; }
      const folder = recipientType === "client" ? selectedRecipientId : `${recipientType}s/${selectedRecipientId}`;
      const path = `${folder}/${Date.now()}-${sanitizeStorageFileName(file.name)}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
      if (upErr) { toast.error(uploadErrorMessage(upErr)); setSubmitting(false); return; }

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
      name: form.name,
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

    if (recipientType === "client") payload.client_id = selectedRecipientId;
    else if (recipientType === "collaborator") payload.collaborator_id = selectedRecipientId;
    else if (recipientType === "provider") payload.provider_id = selectedRecipientId;
    else if (recipientType === "partner") payload.partner_id = selectedRecipientId;

    const { error } = editDoc
      ? await supabase.from("documents").update(payload).eq("id", editDoc.id)
      : await supabase.from("documents").insert(payload);

    setSubmitting(false);
    if (error) { toast.error(error.message); return; }

    // Notify recipient (best-effort)
    try {
      if (!editDoc && recipientType === "client" && selectedRecipientId) {
        const { data: c } = await supabase.from("clients").select("user_id").eq("id", selectedRecipientId).maybeSingle();
        if (c?.user_id) {
          await supabase.from("notifications").insert({
            user_id: c.user_id,
            title: file ? "Novo documento disponível" : "Novo documento solicitado",
            message: file ? `${form.name} foi enviado pela equipe.` : `Envie o documento "${form.name}" pelo seu portal.`,
            type: file ? "document_uploaded" : "document_requested",
            link: "/portal-cliente/documentos",
          });
        }
      } else if (!editDoc && recipientType === "provider" && selectedRecipientId) {
        const { data: sp } = await supabase.from("service_providers").select("user_id").eq("id", selectedRecipientId).maybeSingle();
        if (sp?.user_id) {
          await supabase.from("notifications").insert({
            user_id: sp.user_id,
            title: "Novo documento solicitado",
            message: `Envie o documento "${form.name}" pelo seu painel.`,
            type: "document_requested",
            link: "/prestador",
          });
        }
      } else if (!editDoc && recipientType === "collaborator" && selectedRecipientId) {
        await supabase.from("notifications").insert({
          user_id: selectedRecipientId,
          title: "Novo documento solicitado",
          message: `Envie o documento "${form.name}" pelo seu painel.`,
          type: "document_requested",
          link: "/colaborador",
        });
      } else if (!editDoc && recipientType === "partner" && selectedRecipientId) {
        const { data: p } = await supabase.from("partners").select("user_id").eq("id", selectedRecipientId).maybeSingle();
        if (p?.user_id) {
          await supabase.from("notifications").insert({
            user_id: p.user_id,
            title: "Novo documento solicitado",
            message: `Envie o documento "${form.name}" pelo seu painel.`,
            type: "document_requested",
            link: "/parceiro/documentos",
          });
        }
      }
    } catch (_) { /* best-effort */ }

    const recipientLabel = recipientType === 'client' ? 'cliente' : recipientType === 'collaborator' ? 'colaborador' : recipientType === 'provider' ? 'prestador' : 'parceiro';
    toast.success(editDoc ? "Documento atualizado" : (file ? "Documento enviado" : `Documento solicitado ao ${recipientLabel}`));
    onSuccess?.();
    onOpenChange(false);
    setForm({});
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {editDoc ? "Editar solicitação" : "Nova solicitação de documento"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          {!editDoc && (
            <div className="space-y-3">
              <Label>Destinatário</Label>
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

          <div className="space-y-2">
            <Label>Nome do documento *</Label>
            <Input
              placeholder="Ex: RG, Contrato Social, IRPF..."
              value={form.name ?? ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>


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

          {!editDoc && (
            <div className="space-y-2">
              <Label>Já possui o arquivo? (opcional)</Label>
              <div 
                className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer group" 
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="size-8 mx-auto text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
                <p className="text-sm font-medium">Clique para selecionar</p>
                <p className="text-[11px] text-muted-foreground mt-1">PDF, PNG, JPG, JPEG, DOCX, XLSX</p>
                <input ref={fileRef} type="file" className="hidden" />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting} className="bg-gradient-primary">
            {submitting ? "Salvando..." : editDoc ? "Salvar Alterações" : "Criar Solicitação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}