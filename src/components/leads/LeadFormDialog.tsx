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
  lead?: any;
}

export function LeadFormDialog({ open, onOpenChange, onCreated, lead }: Props) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({ 
    status: "Novo", 
    source: "Instagram" 
  });

  useEffect(() => {
    if (lead) setForm(lead);
    else setForm({ status: "Novo", source: "Instagram", close_probability: 50 });
  }, [lead, open]);

  const { data: partners } = useQuery({
    queryKey: ["partners-select"],
    queryFn: async () => (await supabase.from("partners").select("id, full_name").eq("active", true).order("full_name")).data ?? [],
  });

  const { data: indicators } = useQuery({
    queryKey: ["indicators-select"],
    queryFn: async () => {
      const { data } = await supabase.from("referrers").select("id, full_name").eq("active", true).order("full_name");
      return data ?? [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products-select"],
    queryFn: async () => (await supabase.from("products").select("id, name").eq("active", true).order("name")).data ?? [],
  });

  const { data: collaborators } = useQuery({
    queryKey: ["collaborators-select-leads"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
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
      company: form.company || null,
      email: form.email || null,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      status: form.status,
      source: form.source || "Manual",
      notes: form.notes || null,
      product_id: form.product_id || null,
      partner_id: form.partner_id || null,
      responsible_id: form.responsible_id || null,
      referral_id: form.referral_id || null,
      estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
      close_probability: form.close_probability != null && form.close_probability !== "" ? Number(form.close_probability) : null,
      next_action: form.next_action || null,
      next_action_date: form.next_action_date || null,
    };
    
    const { error } = lead?.id
      ? await supabase.from("leads").update(payload).eq("id", lead.id)
      : await supabase.from("leads").insert(payload);
    
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(lead?.id ? "Lead atualizado" : "Lead cadastrado");
    onCreated?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{lead?.id ? "Editar Lead" : "Novo Lead / Convidado"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2 space-y-2">
            <Label>Nome completo *</Label>
            <Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Input value={form.company ?? ""} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input value={form.whatsapp ?? ""} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Valor estimado (R$)</Label>
            <Input type="number" step="0.01" value={form.estimated_value ?? ""} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Probabilidade de fechamento (%)</Label>
            <Input type="number" min={0} max={100} value={form.close_probability ?? ""} onChange={(e) => setForm({ ...form, close_probability: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Produto de interesse</Label>
            <Select value={form.product_id ?? "none"} onValueChange={(v) => setForm({ ...form, product_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {products?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Origem *</Label>
            <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Instagram">Instagram</SelectItem>
                <SelectItem value="Tráfego Pago">Tráfego Pago</SelectItem>
                <SelectItem value="Prospecção Ativa">Prospecção Ativa</SelectItem>
                <SelectItem value="Indicação">Indicação</SelectItem>
                <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                <SelectItem value="Site">Site</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status do Lead</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Novo">Novo lead</SelectItem>
                <SelectItem value="Primeiro contato">Primeiro contato</SelectItem>
                <SelectItem value="Diagnóstico">Diagnóstico</SelectItem>
                <SelectItem value="Proposta enviada">Proposta enviada</SelectItem>
                <SelectItem value="Negociação">Negociação</SelectItem>
                <SelectItem value="Contrato enviado">Contrato enviado</SelectItem>
                <SelectItem value="Fechado">Fechado</SelectItem>
                <SelectItem value="Perdido">Perdido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Quem indicou</Label>
            <Select value={form.referral_id ?? "none"} onValueChange={(v) => setForm({ ...form, referral_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguém</SelectItem>
                {indicators?.map((i) => <SelectItem key={i.id} value={i.id}>{i.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Parceiro vinculado</Label>
            <Select value={form.partner_id ?? "none"} onValueChange={(v) => setForm({ ...form, partner_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {partners?.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Colaborador responsável</Label>
            <Select value={form.responsible_id ?? "none"} onValueChange={(v) => setForm({ ...form, responsible_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {collaborators?.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Observações</Label>
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
