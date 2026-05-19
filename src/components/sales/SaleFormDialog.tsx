import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { CircleDollarSign, Users, Package, Handshake, Sparkles, UserCircle, Calendar, FileText, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
  clientId?: string;
}

function Section({ icon: Icon, title, hint, children }: { icon: any; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white/60 p-4 sm:p-5 space-y-3 shadow-[0_1px_0_0_hsl(var(--border)/0.6)]">
      <div className="flex items-center gap-2.5">
        <div className="size-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center ring-1 ring-indigo-100">
          <Icon className="size-3.5" strokeWidth={2.4} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-[12px] font-bold text-slate-900 leading-tight tracking-tight uppercase">{title}</h4>
          {hint && <p className="text-[10.5px] text-slate-500 leading-tight mt-0.5">{hint}</p>}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
        {label} {required && <span className="text-rose-500">*</span>}
      </Label>
      {children}
    </div>
  );
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
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["vendedor", "admin", "colaborador"]);
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
    try {
      const { data: sale, error } = await supabase.from("sales").insert({
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
      }).select().single();

      if (error) throw error;

      // Manually generate commissions if they are not handled by a trigger
      const commissionsToInsert = [];

      if (form.partner_id && Number(form.commission_percent) > 0) {
        commissionsToInsert.push({
          partner_id: form.partner_id,
          client_id: form.client_id,
          product_id: form.product_id,
          sale_id: sale.id,
          amount: (Number(form.amount) * Number(form.commission_percent)) / 100,
          sale_value: Number(form.amount),
          status: "pendente",
          commission_type: "percentual",
          rule_type: "percentage",
          rule_value: Number(form.commission_percent),
        });
      }

      if (form.referrer_id && Number(form.referrer_percent) > 0) {
        commissionsToInsert.push({
          referrer_id: form.referrer_id,
          client_id: form.client_id,
          product_id: form.product_id,
          sale_id: sale.id,
          amount: (Number(form.amount) * Number(form.referrer_percent)) / 100,
          sale_value: Number(form.amount),
          status: "pendente",
          commission_type: "indicacao",
          rule_type: "percentage",
          rule_value: Number(form.referrer_percent),
        });
      }

      if (commissionsToInsert.length > 0) {
        const { error: commErr } = await supabase.from("commissions").insert(commissionsToInsert as any);
        if (commErr) toast.warning("Venda registrada, mas houve um erro ao gerar comissões: " + commErr.message);
      }

      toast.success("Venda registrada e comissões geradas");
      onCreated?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar venda");
    } finally {
      setSubmitting(false);
    }
  };

  const amount = Number(form.amount || 0);
  const partnerCalc = form.partner_id ? (amount * Number(form.commission_percent || 0)) / 100 : 0;
  const referrerCalc = form.referrer_id ? (amount * Number(form.referrer_percent || 0)) / 100 : 0;
  const collaboratorCalc = form.collaborator_id ? (amount * Number(form.collaborator_percent || 0)) / 100 : 0;
  const totalCommissions = partnerCalc + referrerCalc + collaboratorCalc;
  const liquido = amount - totalCommissions;
  const totalPct = amount > 0 ? (totalCommissions / amount) * 100 : 0;

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-2xl border-slate-200 shadow-2xl gap-0">
        {/* Header premium */}
        <DialogHeader className="px-6 sm:px-8 pt-6 pb-5 bg-gradient-to-br from-white via-indigo-50/30 to-white border-b border-slate-200/70">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/25">
              <CircleDollarSign className="size-5" strokeWidth={2.4} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="font-display text-[20px] font-bold text-slate-900 leading-tight tracking-tight">
                Nova venda
              </DialogTitle>
              <DialogDescription className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
                Registro comercial · Comissões automáticas
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="px-5 sm:px-8 py-5 max-h-[70vh] overflow-y-auto bg-slate-50/40 space-y-4">

          {/* Cliente & Produto */}
          <Section icon={Users} title="Cliente & Produto" hint="Selecione o cliente e o serviço vendido">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {!clientId && (
                <Field label="Cliente" required className="md:col-span-2">
                  <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                    <SelectContent>{clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Produto / Serviço" required className="md:col-span-2">
                <Select value={form.product_id} onValueChange={handleProductChange}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
                  <SelectContent>{products?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Valor (R$)" required>
                <Input type="number" step="0.01" className="bg-white font-mono" value={form.amount ?? ""} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" />
              </Field>
              <Field label="Data da venda">
                <Input type="date" className="bg-white" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} />
              </Field>
            </div>
          </Section>

          {/* Comissionamento */}
          <Section icon={Wallet} title="Comissionamento" hint="Quem participa da venda e qual o percentual de cada um">
            {/* Parceiro */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-3">
              <Field label="Parceiro">
                <Select value={form.partner_id ?? "none"} onValueChange={handlePartnerChange}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Sem parceiro" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem parceiro</SelectItem>
                    {partners?.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="% Parceiro">
                <Input type="number" step="0.01" className="bg-white font-mono text-right" value={form.commission_percent ?? 0} onChange={(e) => setForm({ ...form, commission_percent: e.target.value })} />
              </Field>
            </div>
            {/* Indicador */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-3">
              <Field label="Indicador">
                <Select value={form.referrer_id ?? "none"} onValueChange={(v) => {
                  const r = referrers?.find((x: any) => x.id === v);
                  setForm({ ...form, referrer_id: v === "none" ? null : v, referrer_percent: r?.commission_percent ?? form.referrer_percent ?? 0 });
                }}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Sem indicador" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem indicador</SelectItem>
                    {referrers?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="% Indicador">
                <Input type="number" step="0.01" className="bg-white font-mono text-right" value={form.referrer_percent ?? 0} onChange={(e) => setForm({ ...form, referrer_percent: e.target.value })} />
              </Field>
            </div>
            {/* Colaborador */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-3">
              <Field label="Colaborador">
                <Select value={form.collaborator_id ?? "none"} onValueChange={(v) => setForm({ ...form, collaborator_id: v === "none" ? null : v })}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Sem colaborador" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem colaborador</SelectItem>
                    {collaborators?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name ?? c.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="% Colaborador">
                <Input type="number" step="0.01" className="bg-white font-mono text-right" value={form.collaborator_percent ?? 0} onChange={(e) => setForm({ ...form, collaborator_percent: e.target.value })} />
              </Field>
            </div>
          </Section>

          {/* Status & notas */}
          <Section icon={FileText} title="Status & Observações">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Status">
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Observações">
              <Textarea rows={3} className="bg-white" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anotações internas, condições especiais..." />
            </Field>
          </Section>

          {/* Resumo financeiro */}
          {amount > 0 && (
            <div className="rounded-xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50/60 via-white to-white p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="size-3.5 text-indigo-600" />
                <h4 className="text-[11px] font-bold text-indigo-900 uppercase tracking-widest">Resumo da venda</h4>
              </div>
              <div className="space-y-2 text-[13px] font-mono">
                <div className="flex justify-between text-slate-700"><span>Valor bruto</span><span className="font-bold tabular-nums">{fmt(amount)}</span></div>
                {partnerCalc > 0 && <div className="flex justify-between text-rose-600"><span>− Parceiro ({form.commission_percent}%)</span><span className="tabular-nums">{fmt(partnerCalc)}</span></div>}
                {referrerCalc > 0 && <div className="flex justify-between text-rose-600"><span>− Indicador ({form.referrer_percent}%)</span><span className="tabular-nums">{fmt(referrerCalc)}</span></div>}
                {collaboratorCalc > 0 && <div className="flex justify-between text-rose-600"><span>− Colaborador ({form.collaborator_percent}%)</span><span className="tabular-nums">{fmt(collaboratorCalc)}</span></div>}
                <div className={cn("border-t border-indigo-200/60 pt-2 mt-1 flex justify-between font-bold text-[14px]", totalPct > 100 ? "text-rose-600" : "text-emerald-600")}>
                  <span>Líquido ({(100 - totalPct).toFixed(1)}%)</span>
                  <span className="tabular-nums">{fmt(liquido)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 sm:px-8 py-4 bg-white border-t border-slate-200/70 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-slate-300">Cancelar</Button>
          <Button onClick={submit} disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20">
            {submitting ? "Salvando..." : "Registrar venda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
