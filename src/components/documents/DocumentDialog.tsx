import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Upload, X, Calendar as CalendarIcon, Package } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
  clientId?: string;
  document?: any;
}

export function DocumentDialog({ open, onOpenChange, onSuccess, clientId: propClientId, document: editDoc }: Props) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [form, setForm] = useState<any>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (editDoc) {
        setForm({
          name: editDoc.name,
          description: editDoc.description || "",
          product_id: editDoc.product_id || "none",
          due_date: editDoc.due_date || "",
          sale_id: editDoc.sale_id || "none",
        });
        setSelectedClientId(editDoc.client_id);
      } else {
        setForm({
          name: "",
          description: "",
          product_id: "none",
          due_date: "",
          sale_id: "none",
        });
        setSelectedClientId(propClientId || "");
      }
    }
  }, [open, editDoc, propClientId]);

  const clientId = propClientId || selectedClientId;
  const { data: sales } = useQuery({
    queryKey: ["sales-by-client", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("id, amount, sale_date, products(name)")
        .eq("client_id", clientId)
        .order("sale_date", { ascending: false });
      return data ?? [];
    },
    enabled: open && !!clientId,
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-list-simple"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name").eq("status", "ativo").order("full_name");
      return data ?? [];
    },
    enabled: open && !propClientId && !editDoc,
  });

  const { data: products } = useQuery({
    queryKey: ["products-list-simple"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name").eq("active", true).order("name");
      return data ?? [];
    },
    enabled: open,
  });

  const submit = async () => {
    const clientId = propClientId || selectedClientId;
    if (!clientId) { toast.error("Selecione um cliente"); return; }
    if (!form.name) { toast.error("Nome do documento é obrigatório"); return; }
    
    setSubmitting(true);

    let file_path = editDoc?.file_path || null;
    let file_size = editDoc?.file_size || null;
    let mime_type = editDoc?.mime_type || null;
    let status = editDoc?.status || "solicitado";
    let uploaded_at = editDoc?.uploaded_at || null;

    const file = fileRef.current?.files?.[0];
    if (file) {
      const path = `${clientId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
      if (upErr) { toast.error(upErr.message); setSubmitting(false); return; }
      file_path = path;
      file_size = file.size;
      mime_type = file.type;
      status = "enviado";
      uploaded_at = new Date().toISOString();
    }

    const payload = {
      client_id: clientId,
      name: form.name,
      description: form.description || null,
      product_id: form.product_id === "none" ? null : form.product_id,
      sale_id: form.sale_id === "none" ? null : form.sale_id,
      due_date: form.due_date || null,
      status,
      file_path,
      file_size,
      mime_type,
      requested_by: editDoc ? editDoc.requested_by : user?.id,
      uploaded_by: file ? user?.id : (editDoc?.uploaded_by || null),
      uploaded_at,
    };

    const { error } = editDoc 
      ? await supabase.from("documents").update(payload).eq("id", editDoc.id)
      : await supabase.from("documents").insert(payload);

    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    
    toast.success(editDoc ? "Documento atualizado" : (file ? "Documento enviado" : "Documento solicitado ao cliente"));
    onSuccess?.();
    onOpenChange(false);
    setForm({});
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {editDoc ? "Editar solicitação" : "Nova solicitação de documento"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          {!propClientId && !editDoc && (
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
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
            <div className="space-y-2">
              <Label>Produto vinculado</Label>
              <Select 
                value={form.product_id || "none"} 
                onValueChange={(v) => setForm({ ...form, product_id: v })}
              >
                <SelectTrigger>
                  <Package className="size-3.5 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Geral" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geral / Nenhum</SelectItem>
                  {products?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          </div>

          {clientId && (sales?.length ?? 0) > 0 && (
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
                      {s.products?.name || "Venda"} — {new Date(s.sale_date).toLocaleDateString('pt-BR')} — R$ {Number(s.amount).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Instruções / Descrição</Label>
            <Textarea 
              placeholder="Explique ao cliente o que ele precisa enviar..."
              value={form.description ?? ""} 
              onChange={(e) => setForm({ ...form, description: e.target.value })} 
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
