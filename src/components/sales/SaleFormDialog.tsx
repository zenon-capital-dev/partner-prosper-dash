import { useState, useEffect } from "react";
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
  clientId?: string;
}

export function SaleFormDialog({ open, onOpenChange, onCreated, clientId }: Props) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({ status: "pendente", commission_percent: 10, sale_date: new Date().toISOString().split("T")[0] });

  useEffect(() => {
    if (open) setForm({ status: "pendente", commission_percent: 10, sale_date: new Date().toISOString().split("T")[0], client_id: clientId });
  }, [open, clientId]);

  const { data: clients } = useQuery({
    queryKey: ["clients-select"],
    queryFn: async () => (await supabase.from("clients").select("id, full_name").order("full_name")).data ?? [],
  });
  const { data: products } = useQuery({
    queryKey: ["products-select"],
    queryFn: async () => (await supabase.from("products").select("id, name, base_price, default_commission_percent").eq("active", true).order("name")).data ?? [],
  });
  const { data: partners } = useQuery({
    queryKey: ["partners-select"],
    queryFn: async () => (await supabase.from("partners").select("id, full_name, commission_percent").eq("active", true).order("full_name")).data ?? [],
  });
  const { data: referrers } = useQuery({
    queryKey: ["referrers-select"],
    queryFn: async () => (await supabase.from("referrers").select("id, full_name, commission_percent").eq("active", true).order("full_name")).data ?? [],
  });
  const { data: collaborators } = useQuery({
    queryKey: ["collaborators-select"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["vendedor", "admin"]);
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids).order("full_name");
      return data ?? [];
    },
  });

  // Auto-fill from selected client
  useQuery({
    queryKey: ["sale-client-prefill", form.client_id],
    enabled: !!form.client_id,
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("partner_id, referrer_id, collaborator_id").eq("id", form.client_id).maybeSingle();
      if (data) {
        setForm((f: any) => ({
          ...f,
          partner_id: f.partner_id ?? data.partner_id ?? null,
          referrer_id: f.referrer_id ?? data.referrer_id ?? null,
          collaborator_id: f.collaborator_id ?? data.collaborator_id ?? null,
        }));
      }
      return data;
    },
  });

  const handleProductChange = (productId: string) => {
    const p = products?.find((x: any) => x.id === productId);
    setForm({ ...form, product_id: productId, amount: p?.base_price ?? form.amount, commission_percent: p?.default_commission_percent ?? form.commission_percent });
  };

  const handlePartnerChange = (partnerId: string) => {
    const p = partners?.find((x: any) => x.id === partnerId);
    setForm({ ...form, partner_id: partnerId === "none" ? null : partnerId, commission_percent: p?.commission_percent ?? form.commission_percent });
  };

  const submit = async () => {
    if (!form.client_id || !form.product_id || !form.amount) {
      toast.error("Cliente, produto e valor são obrigatórios");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("sales").insert({
      client_id: form.client_id,
      product_id: form.product_id,
      partner_id: form.partner_id || null,
      referrer_id: form.referrer_id || null,
      collaborator_id: form.collaborator_id || null,
      amount: Number(form.amount),
      commission_percent: Number(form.commission_percent || 0),
      referrer_percent: Number(form.referrer_percent || 0),
      collaborator_percent: Number(form.collaborator_percent || 0),
      status: form.status,
      sale_date: form.sale_date,
      notes: form.notes || null,
      created_by: user?.id,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Venda registrada — comissões geradas automaticamente");
    onCreated?.();
    onOpenChange(false);
  };

  const amount = Number(form.amount || 0);
  const partnerCalc = form.partner_id ? (amount * Number(form.commission_percent || 0)) / 100 : 0;
  const referrerCalc = form.referrer_id ? (amount * Number(form.referrer_percent || 0)) / 100 : 0;
  const collaboratorCalc = form.collaborator_id ? (amount * Number(form.collaborator_percent || 0)) / 100 : 0;
  const totalCommissions = partnerCalc + referrerCalc + collaboratorCalc;
  const liquido = amount - totalCommissions;
  const totalPct = amount > 0 ? (totalCommissions / amount) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle className="font-display text-xl">Nova venda</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          {!clientId && (
            <div className="col-span-2 space-y-2">
              <Label>Cliente *</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>{clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="col-span-2 space-y-2">
            <Label>Produto *</Label>
            <Select value={form.product_id} onValueChange={handleProductChange}>
              <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
              <SelectContent>{products?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor (R$) *</Label>
            <Input type="number" step="0.01" value={form.amount ?? ""} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Data da venda</Label>
            <Input type="date" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Parceiro</Label>
            <Select value={form.partner_id ?? "none"} onValueChange={handlePartnerChange}>
              <SelectTrigger><SelectValue placeholder="Sem parceiro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem parceiro</SelectItem>
                {partners?.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>% Parceiro</Label>
            <Input type="number" step="0.01" value={form.commission_percent ?? 0} onChange={(e) => setForm({ ...form, commission_percent: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Indicador</Label>
            <Select value={form.referrer_id ?? "none"} onValueChange={(v) => {
              const r = referrers?.find((x: any) => x.id === v);
              setForm({ ...form, referrer_id: v === "none" ? null : v, referrer_percent: r?.commission_percent ?? form.referrer_percent ?? 0 });
            }}>
              <SelectTrigger><SelectValue placeholder="Sem indicador" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem indicador</SelectItem>
                {referrers?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>% Indicador</Label>
            <Input type="number" step="0.01" value={form.referrer_percent ?? 0} onChange={(e) => setForm({ ...form, referrer_percent: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Colaborador</Label>
            <Select value={form.collaborator_id ?? "none"} onValueChange={(v) => setForm({ ...form, collaborator_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Sem colaborador" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem colaborador</SelectItem>
                {collaborators?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name ?? c.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>% Colaborador</Label>
            <Input type="number" step="0.01" value={form.collaborator_percent ?? 0} onChange={(e) => setForm({ ...form, collaborator_percent: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
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
          <Button onClick={submit} disabled={submitting} className="bg-gradient-primary hover:opacity-90">{submitting ? "Salvando..." : "Registrar venda"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
