import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Upload, Calendar as CalendarIcon, Package, DollarSign } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
  clientId?: string;
  contract?: any;
}

export function ContractDialog({ open, onOpenChange, onSuccess, clientId: propClientId, contract: editContract }: Props) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [form, setForm] = useState<any>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      if (editContract) {
        setForm({
          name: editContract.name,
          amount: editContract.amount || "",
          description: editContract.internal_notes || "",
          product_id: editContract.product_id || "none",
          sale_id: editContract.sale_id || "none",
        });
        setSelectedClientId(editContract.client_id);
      } else {
        setForm({
          name: "",
          amount: "",
          description: "",
          product_id: "none",
          sale_id: "none",
        });
        setSelectedClientId(propClientId || "");
      }
    }
  }, [open, editContract, propClientId]);

  const clientId = propClientId || selectedClientId;
  const { data: sales } = useQuery({
    queryKey: ["sales-by-client-contract", clientId],
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
    enabled: open && !propClientId && !editContract,
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
    if (!clientId) { toast.error("Selecione um cliente"); return; }
    if (!form.name) { toast.error("Nome do contrato é obrigatório"); return; }
    
    setSubmitting(true);

    let file_path = editContract?.file_path || null;

    const file = fileRef.current?.files?.[0];
    if (file) {
      const path = `${clientId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("contracts").upload(path, file);
      if (upErr) { toast.error(upErr.message); setSubmitting(false); return; }
      file_path = path;
    }

    const payload = {
      client_id: clientId,
      name: form.name,
      amount: form.amount ? Number(form.amount) : null,
      internal_notes: form.description || null,
      product_id: form.product_id === "none" ? null : form.product_id,
      sale_id: form.sale_id === "none" ? null : form.sale_id,
      file_path,
    };

    const { error } = editContract 
      ? await supabase.from("contracts").update(payload).eq("id", editContract.id)
      : await supabase.from("contracts").insert({ ...payload, status: 'criado' });

    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    
    toast.success(editContract ? "Contrato atualizado" : "Contrato registrado com sucesso");
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
            {editContract ? "Editar contrato" : "Novo contrato"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          {!propClientId && !editContract && (
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
            <Label>Título do contrato *</Label>
            <Input 
              placeholder="Ex: Contrato de Assessoria Jurídica" 
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
              <Label>Valor do contrato</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                <Input 
                  type="number" 
                  className="pl-9"
                  placeholder="0,00"
                  value={form.amount ?? ""} 
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} 
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
            <Label>Observações internas</Label>
            <Textarea 
              placeholder="Apenas o administrador e colaboradores verão isso..."
              value={form.description ?? ""} 
              onChange={(e) => setForm({ ...form, description: e.target.value })} 
            />
          </div>

          <div className="space-y-2">
            <Label>{editContract && editContract.file_path ? "Substituir arquivo (opcional)" : "Anexar contrato assinado ou minuta (opcional)"}</Label>
            <div 
              className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer group" 
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="size-8 mx-auto text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
              <p className="text-sm font-medium">Clique para selecionar</p>
              <p className="text-[11px] text-muted-foreground mt-1">PDF, DOCX, Imagens</p>
              <input ref={fileRef} type="file" className="hidden" />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting} className="bg-gradient-primary">
            {submitting ? "Salvando..." : editContract ? "Salvar Alterações" : "Gerar / Salvar Contrato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
