import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
  client?: any;
}

export function ClientFormDialog({ open, onOpenChange, onCreated, client }: Props) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({ status: "ativo" });

  useEffect(() => {
    if (client) setForm(client);
    else setForm({ status: "ativo" });
  }, [client, open]);

  const { data: partners } = useQuery({
    queryKey: ["partners-select"],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, full_name").eq("active", true).order("full_name");
      return data ?? [];
    },
  });

  const submit = async () => {
    if (!form.full_name) {
      toast.error("Nome obrigatório");
      return;
    }
    setSubmitting(true);
    const payload = {
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      document: form.document || null,
      company: form.company || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      status: form.status,
      partner_id: form.partner_id || null,
      notes: form.notes || null,
      tags: form.tags ?? [],
      created_by: user?.id,
    };
    const { error } = client?.id
      ? await supabase.from("clients").update(payload).eq("id", client.id)
      : await supabase.from("clients").insert(payload);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(client?.id ? "Cliente atualizado" : "Cliente cadastrado");
    onCreated?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{client?.id ? "Editar cliente" : "Novo cliente"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2 space-y-2">
            <Label>Nome completo *</Label>
            <Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>CPF/CNPJ</Label>
            <Input value={form.document ?? ""} onChange={(e) => setForm({ ...form, document: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Input value={form.company ?? ""} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Endereço</Label>
            <Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Input value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Parceiro indicador</Label>
            <Select value={form.partner_id ?? "none"} onValueChange={(v) => setForm({ ...form, partner_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem indicação</SelectItem>
                {partners?.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="prospecto">Prospecto</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Tags (separadas por vírgula)</Label>
            <Input
              placeholder="VIP, risco, novo, prioridade"
              value={(form.tags ?? []).join(", ")}
              onChange={(e) => setForm({ ...form, tags: e.target.value.split(",").map((t: string) => t.trim()).filter(Boolean) })}
            />
            <p className="text-[10px] text-muted-foreground">Sugestões: VIP, risco, novo, prioridade</p>
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Observações internas</Label>
            <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting} className="bg-gradient-primary hover:opacity-90">{submitting ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
