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
import { MaskedInput } from "@/components/ui/masked-input";
import { onlyDigits } from "@/lib/masks";
import { isValidPhoneBR } from "@/lib/validators";

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
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["vendedor", "admin", "colaborador"]);
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids).order("full_name");
      return data ?? [];
    },
  });

  const submit = async () => {
    const fullName = (form.full_name ?? "").trim();
    if (!fullName) { toast.error("Nome obrigatório"); return; }
    if (fullName.length > 150) { toast.error("Nome muito longo"); return; }
    if (form.phone && !isValidPhoneBR(form.phone)) { toast.error("Telefone inválido"); return; }
    if (form.whatsapp && !isValidPhoneBR(form.whatsapp)) { toast.error("WhatsApp inválido"); return; }

    const email = (form.email ?? "").trim().toLowerCase() || null;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Email inválido"); return; }

    let prob: number | null = null;
    if (form.close_probability != null && form.close_probability !== "") {
      const n = Number(form.close_probability);
      if (Number.isNaN(n) || n < 0 || n > 100) { toast.error("Probabilidade deve ser entre 0 e 100"); return; }
      prob = Math.round(n);
    }

    let estVal: number | null = null;
    if (form.estimated_value != null && form.estimated_value !== "") {
      const n = Number(form.estimated_value);
      if (Number.isNaN(n) || n < 0) { toast.error("Valor estimado inválido"); return; }
      estVal = n;
    }

    setSubmitting(true);

    // Duplicidade em leads ABERTOS (não Fechado/Perdido), por email OU telefone
    const cleanPhone = form.phone ? onlyDigits(form.phone) : null;
    const cleanWhats = form.whatsapp ? onlyDigits(form.whatsapp) : null;
    if (email || cleanPhone || cleanWhats) {
      const orParts: string[] = [];
      if (email) orParts.push(`email.eq.${email}`);
      if (cleanPhone) orParts.push(`phone.eq.${cleanPhone}`);
      if (cleanWhats) orParts.push(`whatsapp.eq.${cleanWhats}`);
      let query = supabase.from("leads").select("id, full_name, status")
        .not("status", "in", "(Fechado,Perdido)")
        .or(orParts.join(","));
      if (lead?.id) query = query.neq("id", lead.id);
      const { data: existing } = await query.limit(1);
      if (existing && existing.length > 0) {
        toast.warning(`Já existe lead aberto com mesmos dados: ${existing[0].full_name}`);
      }
    }

    const payload = {
      full_name: fullName,
      company: form.company?.trim() || null,
      email,
      phone: cleanPhone,
      whatsapp: cleanWhats,
      status: form.status || "Novo",
      source: form.source || "Manual",
      notes: form.notes?.trim() || null,
      product_id: form.product_id || null,
      partner_id: form.partner_id || null,
      responsible_id: form.responsible_id || null,
      referral_id: form.referral_id || null,
      estimated_value: estVal,
      close_probability: prob,
      next_action: form.next_action?.trim() || null,
      next_action_date: form.next_action_date || null,
    };

    const { error } = lead?.id
      ? await supabase.from("leads").update(payload).eq("id", lead.id)
      : await supabase.from("leads").insert(payload);

    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(lead?.id ? "Lead atualizado" : "Lead cadastrado");
    onCreated?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{lead?.id ? "Editar Lead" : "Novo Lead / Convidado"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div className="sm:col-span-2 space-y-2">
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
            <MaskedInput mask="phone" value={form.whatsapp ?? ""} onChange={(v) => setForm({ ...form, whatsapp: v })} placeholder="(11) 99999-9999" />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <MaskedInput mask="phone" value={form.phone ?? ""} onChange={(v) => setForm({ ...form, phone: v })} placeholder="(11) 99999-9999" />
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
          <div className="space-y-2">
            <Label>Próxima ação</Label>
            <Input value={form.next_action ?? ""} onChange={(e) => setForm({ ...form, next_action: e.target.value })} placeholder="Ex: Ligar para agendar reunião" />
          </div>
          <div className="space-y-2">
            <Label>Data da próxima ação</Label>
            <Input type="date" value={form.next_action_date ?? ""} onChange={(e) => setForm({ ...form, next_action_date: e.target.value })} />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Cancelar</Button>
          <Button onClick={submit} disabled={submitting} className="w-full sm:w-auto bg-gradient-primary hover:opacity-90">{submitting ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
