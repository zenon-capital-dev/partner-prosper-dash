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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, Users, Package, Handshake, Sparkles, UserCircle, Calendar, FileText, Wallet, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBR, nowBR, ymdBR } from "@/lib/datetime";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
  clientId?: string;
  sale?: any;
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

export function SaleFormDialog({ open, onOpenChange, onCreated, clientId, sale }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({ status: "pendente", commission_percent: 10, sale_date: ymdBR(nowBR()) });

  useEffect(() => {
    if (open) {
      if (sale) {
        setForm({
          ...sale,
          sale_date: sale.sale_date || ymdBR(nowBR())
        });
      } else {
        setForm({ status: "pendente", commission_percent: 10, sale_date: ymdBR(nowBR()), client_id: clientId });
      }
    }
  }, [open, clientId, sale]);

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
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "colaborador");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids).order("full_name");
      return data ?? [];
    },
  });
  const { data: providers } = useQuery({
    queryKey: ["providers-select-sales"],
    queryFn: async () => (await supabase.from("service_providers").select("id, name, specialty").order("name")).data ?? [],
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
    if (!form.client_id || !form.product_id) {
      toast.error("Cliente e produto são obrigatórios");
      return;
    }
    const amountNum = Number(form.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error("Informe um valor maior que zero");
      return;
    }
    if (amountNum > 1_000_000_000) {
      toast.error("Valor acima do limite permitido");
      return;
    }
    const zenonCostNum = Number(form.zenon_cost || 0);
    if (!Number.isFinite(zenonCostNum) || zenonCostNum < 0) {
      toast.error("Custo Zenon inválido");
      return;
    }
    const providerCostNum = Number(form.provider_cost || 0);
    if (!Number.isFinite(providerCostNum) || providerCostNum < 0) {
      toast.error("Custo do prestador inválido");
      return;
    }
    if (zenonCostNum + providerCostNum > amountNum) {
      toast.error("Custos (Zenon + Prestador) não podem ser maiores que o valor da venda");
      return;
    }
    const pctFields = [
      ["commission_percent", "Comissão parceiro"],
      ["referrer_percent", "Comissão indicador"],
      ["collaborator_percent", "Comissão colaborador"],
    ] as const;
    for (const [k, label] of pctFields) {
      const v = Number((form as any)[k] || 0);
      if (!Number.isFinite(v) || v < 0 || v > 100) {
        toast.error(`${label}: percentual deve ser entre 0 e 100`);
        return;
      }
    }
    const totalPctCheck =
      Number(form.commission_percent || 0) +
      Number(form.referrer_percent || 0) +
      Number(form.collaborator_percent || 0);
    if (totalPctCheck > 100) {
      toast.error("Soma das comissões não pode passar de 100%");
      return;
    }
    if (form.sale_date) {
      const d = new Date(form.sale_date);
      if (isNaN(d.getTime())) {
        toast.error("Data da venda inválida");
        return;
      }
    }
    setSubmitting(true);
    try {
      const payload = {
        client_id: form.client_id,
        product_id: form.product_id,
        partner_id: form.partner_id || null,
        referrer_id: form.referrer_id || null,
        collaborator_id: form.collaborator_id || null,
        amount: Number(form.amount),
        zenon_cost: Number(form.zenon_cost || 0),
        provider_cost: Number(form.provider_cost || 0),
        commission_percent: Number(form.commission_percent || 0),
        referrer_percent: Number(form.referrer_percent || 0),
        collaborator_percent: Number(form.collaborator_percent || 0),
        status: form.status,
        sale_date: form.sale_date,
        notes: form.notes || null,
      } as any;

      if (form.id) {
        const { error } = await supabase.from("sales").update(payload).eq("id", form.id);
        if (error) throw error;
        toast.success("Venda atualizada com sucesso");
      } else {
        const { error } = await supabase.from("sales").insert({
          ...payload,
          created_by: user?.id,
        }).select().single();
        if (error) throw error;
        toast.success("Venda registrada e comissões geradas");
      }

      // Invalida todos os caches que dependem de vendas/demandas para refletir imediatamente em qualquer tela.
      const targetClientId = form.client_id || clientId;
      await Promise.all([
        qc.refetchQueries({ queryKey: ["sales-rich-v2"] }),
        qc.refetchQueries({ queryKey: ["sales-commission-splits"] }),
        // Sempre invalida client-products globalmente (prefix match cobre todos clientes), além de refazer o do cliente alvo.
        qc.invalidateQueries({ queryKey: ["client-products"] }),
        qc.invalidateQueries({ queryKey: ["client-sales"] }),
        qc.invalidateQueries({ queryKey: ["client-payments"] }),
        targetClientId ? qc.refetchQueries({ queryKey: ["client-products", targetClientId] }) : Promise.resolve(),
        targetClientId ? qc.refetchQueries({ queryKey: ["client-sales", targetClientId] }) : Promise.resolve(),
        targetClientId ? qc.refetchQueries({ queryKey: ["client-payments", targetClientId] }) : Promise.resolve(),
      ]);
      qc.invalidateQueries({ queryKey: ["admin-demands"] });
      qc.invalidateQueries({ queryKey: ["cockpit-demands"] });
      qc.invalidateQueries({ queryKey: ["commissions"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-dashboard-snapshot"] });

      onCreated?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar venda");
    } finally {
      setSubmitting(false);
    }
  };

  const amount = Number(form.amount || 0);
  const zenonCost = Number(form.zenon_cost || 0);
  const providerCost = Number(form.provider_cost || 0);
  const totalCosts = zenonCost + providerCost;
  // Cascata: Bruto − Custos = base. Indicador/Imposto sai primeiro;
  // depois Parceiro incide sobre o que sobrou; por fim Colaborador.
  const commissionBase = Math.max(amount - totalCosts, 0);
  const referrerCalc = form.referrer_id ? (commissionBase * Number(form.referrer_percent || 0)) / 100 : 0;
  const partnerBase = Math.max(commissionBase - referrerCalc, 0);
  const partnerCalc = form.partner_id ? (partnerBase * Number(form.commission_percent || 0)) / 100 : 0;
  const collaboratorBase = Math.max(partnerBase - partnerCalc, 0);
  const collaboratorCalc = form.collaborator_id ? (collaboratorBase * Number(form.collaborator_percent || 0)) / 100 : 0;
  const totalCommissions = partnerCalc + referrerCalc + collaboratorCalc;
  const liquido = amount - totalCosts - totalCommissions;
  const marginPct = amount > 0 ? (liquido / amount) * 100 : 0;
  const totalPct = amount > 0 ? (totalCommissions / amount) * 100 : 0;

  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-3xl border-slate-200 shadow-2xl gap-0 bg-white flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        {/* Header Ultra Premium */}
        <DialogHeader className="px-6 sm:px-10 pt-8 pb-10 bg-gradient-to-br from-[#1e293b] via-[#334155] to-[#1e293b] text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <CircleDollarSign className="size-32 rotate-12" />
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-indigo-500/20 backdrop-blur-xl ring-1 ring-white/30 flex items-center justify-center text-white shadow-2xl">
                <CircleDollarSign className="size-7" strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="font-display text-2xl sm:text-3xl font-extrabold text-white leading-tight tracking-tight">
                  {form.id ? "Editar Venda" : "Nova Venda"}
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-slate-300 uppercase tracking-[0.2em] mt-1">
                  Gestão de Receita & Comissionamento
                </DialogDescription>
              </div>
            </div>

            {amount > 0 && (
              <div className="flex flex-wrap gap-2">
                <div className="bg-white/5 backdrop-blur-md rounded-xl px-4 py-2.5 ring-1 ring-white/10 flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Valor Bruto</span>
                  <span className="font-display text-lg font-black tabular-nums">{fmt(amount)}</span>
                </div>
                <div className="bg-amber-500/10 backdrop-blur-md rounded-xl px-4 py-2.5 ring-1 ring-amber-500/20 flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-amber-300 mb-0.5">(−) Impostos</span>
                  <span className="font-display text-lg font-black tabular-nums text-amber-300">{fmt(zenonCost)}</span>
                </div>
                <div className="bg-emerald-500/10 backdrop-blur-md rounded-xl px-4 py-2.5 ring-1 ring-emerald-500/20 flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 mb-0.5">= Líquido</span>
                  <span className="font-display text-lg font-black tabular-nums text-emerald-400">{fmt(liquido)}</span>
                </div>
              </div>
            )}
          </div>

          {/* KPI Bar — sequência: Bruto → (-) Impostos → (-) Prestador → (-) Comissões → Líquido */}
          {amount > 0 && (
            <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white/5 rounded-xl p-3 ring-1 ring-white/5">
                <div className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mb-1">Bruto</div>
                <div className="text-sm font-bold tabular-nums">{fmt(amount)}</div>
              </div>
              <div className="bg-amber-500/5 rounded-xl p-3 ring-1 ring-amber-500/10">
                <div className="text-[9px] uppercase tracking-widest text-amber-300 font-bold mb-1">Impostos (Zenon)</div>
                <div className="text-sm font-bold tabular-nums text-amber-200">−{fmt(zenonCost)}</div>
              </div>
              <div className="bg-orange-500/5 rounded-xl p-3 ring-1 ring-orange-500/10">
                <div className="text-[9px] uppercase tracking-widest text-orange-300 font-bold mb-1">Prestador</div>
                <div className="text-sm font-bold tabular-nums text-orange-200">−{fmt(providerCost)}</div>
              </div>
              <div className="bg-rose-500/5 rounded-xl p-3 ring-1 ring-rose-500/10">
                <div className="text-[9px] uppercase tracking-widest text-rose-300 font-bold mb-1">Parceiro</div>
                <div className="text-sm font-bold tabular-nums text-rose-200">−{fmt(partnerCalc)}</div>
              </div>
              <div className="bg-rose-500/5 rounded-xl p-3 ring-1 ring-rose-500/10">
                <div className="text-[9px] uppercase tracking-widest text-rose-300 font-bold mb-1">Indicador</div>
                <div className="text-sm font-bold tabular-nums text-rose-200">−{fmt(referrerCalc)}</div>
              </div>
              <div className="bg-emerald-500/10 rounded-xl p-3 ring-1 ring-emerald-500/20">
                <div className="text-[9px] uppercase tracking-widest text-emerald-400 font-bold mb-1">Líquido ({marginPct.toFixed(1)}%)</div>
                <div className={cn("text-sm font-bold tabular-nums", liquido >= 0 ? "text-emerald-300" : "text-rose-300")}>{fmt(liquido)}</div>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* Body com Scroll Suave */}
        <div className="px-6 sm:px-10 py-8 flex-1 overflow-y-auto bg-slate-50/50 space-y-8 scrollbar-thin scrollbar-thumb-slate-200">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Coluna Principal */}
            <div className="lg:col-span-7 space-y-8">
              
              <Section icon={Users} title="Dados do Negócio" hint="Identificação principal da transação">
                <div className="grid grid-cols-1 gap-5">
                  {!clientId && (
                    <Field label="Cliente" required>
                      <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                        <SelectTrigger className="h-12 bg-white border-slate-200 shadow-sm focus:ring-indigo-500 rounded-xl">
                          <SelectValue placeholder="Selecione o cliente" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {clients?.map((c) => <SelectItem key={c.id} value={c.id} className="py-3 px-4">{c.full_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Produto / Serviço" required>
                      <Select value={form.product_id} onValueChange={handleProductChange}>
                        <SelectTrigger className="h-12 bg-white border-slate-200 shadow-sm focus:ring-indigo-500 rounded-xl">
                          <SelectValue placeholder="Selecione o produto" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {products?.map((p: any) => <SelectItem key={p.id} value={p.id} className="py-3 px-4">{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field label="Valor Bruto" required>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">R$</span>
                        <Input 
                          type="number" 
                          step="0.01" 
                          className="h-12 pl-10 bg-white border-slate-200 shadow-sm focus:ring-indigo-500 rounded-xl font-mono text-lg font-bold" 
                          value={form.amount ?? ""} 
                          onChange={(e) => setForm({ ...form, amount: e.target.value })} 
                          placeholder="0,00" 
                        />
                      </div>
                    </Field>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/80 to-amber-50/40 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center text-[11px]">🔒</div>
                      <div className="flex-1">
                        <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wider leading-tight">Custos Internos</p>
                        <p className="text-[10px] text-amber-700/80 leading-tight">Não visíveis ao parceiro — deduzidos do líquido</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Custo Zenon">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-600 font-bold text-xs">R$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-11 pl-9 bg-white border-amber-200 shadow-sm focus:ring-amber-500 rounded-lg font-mono text-right tabular-nums"
                            value={form.zenon_cost ?? ""}
                            onChange={(e) => setForm({ ...form, zenon_cost: e.target.value })}
                            placeholder="0,00"
                          />
                        </div>
                      </Field>
                      <Field label="Custo Prestador de Serviço">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-600 font-bold text-xs">R$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-11 pl-9 bg-white border-amber-200 shadow-sm focus:ring-amber-500 rounded-lg font-mono text-right tabular-nums"
                            value={form.provider_cost ?? ""}
                            onChange={(e) => setForm({ ...form, provider_cost: e.target.value })}
                            placeholder="0,00"
                          />
                        </div>
                      </Field>
                    </div>
                    <p className="text-[10.5px] text-amber-700/90 leading-snug">
                      Ordem de dedução: <strong>Bruto</strong> − custos (<strong className="font-mono">{fmt(totalCosts)}</strong>) − Indicador/Imposto − Parceiro − Colaborador. Cada nível incide sobre o que sobrou do nível anterior.
                    </p>
                  </div>
                </div>
              </Section>

              <Section icon={Handshake} title="Estrutura de Comissões" hint="Distribuição de percentuais para os envolvidos">
                <div className="space-y-6">
                  {/* Parceiro */}
                  <div className="bg-slate-100/50 p-4 rounded-2xl space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Field label="Parceiro Estratégico" className="md:col-span-2">
                        <Select value={form.partner_id ?? "none"} onValueChange={handlePartnerChange}>
                          <SelectTrigger className="h-11 bg-white border-slate-200 shadow-sm rounded-lg">
                            <SelectValue placeholder="Nenhum parceiro" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="none">Nenhum parceiro</SelectItem>
                            {partners?.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="% Repasse">
                        <div className="relative">
                          <Input type="number" step="0.01" className="h-11 pr-8 bg-white border-slate-200 shadow-sm rounded-lg font-mono text-right" value={form.commission_percent ?? 0} onChange={(e) => setForm({ ...form, commission_percent: e.target.value })} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                        </div>
                      </Field>
                    </div>
                  </div>

                  {/* Indicador */}
                  <div className="bg-slate-100/50 p-4 rounded-2xl space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Field label="Indicador / Referência" className="md:col-span-2">
                        <Select value={form.referrer_id ?? "none"} onValueChange={(v) => {
                          const r = referrers?.find((x: any) => x.id === v);
                          setForm({ ...form, referrer_id: v === "none" ? null : v, referrer_percent: r?.commission_percent ?? form.referrer_percent ?? 0 });
                        }}>
                          <SelectTrigger className="h-11 bg-white border-slate-200 shadow-sm rounded-lg">
                            <SelectValue placeholder="Nenhum indicador" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="none">Nenhum indicador</SelectItem>
                            {referrers?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="% Indicador">
                        <div className="relative">
                          <Input type="number" step="0.01" className="h-11 pr-8 bg-white border-slate-200 shadow-sm rounded-lg font-mono text-right" value={form.referrer_percent ?? 0} onChange={(e) => setForm({ ...form, referrer_percent: e.target.value })} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                        </div>
                      </Field>
                    </div>
                  </div>

                  {/* Colaborador */}
                  <div className="bg-slate-100/50 p-4 rounded-2xl space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Field label="Colaborador Interno" className="md:col-span-2">
                        <Select value={form.collaborator_id ?? "none"} onValueChange={(v) => setForm({ ...form, collaborator_id: v === "none" ? null : v })}>
                          <SelectTrigger className="h-11 bg-white border-slate-200 shadow-sm rounded-lg">
                            <SelectValue placeholder="Nenhum colaborador" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="none">Nenhum colaborador</SelectItem>
                            {collaborators?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name ?? c.email}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="% Colaborador">
                        <div className="relative">
                          <Input type="number" step="0.01" className="h-11 pr-8 bg-white border-slate-200 shadow-sm rounded-lg font-mono text-right" value={form.collaborator_percent ?? 0} onChange={(e) => setForm({ ...form, collaborator_percent: e.target.value })} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                        </div>
                      </Field>
                    </div>
                  </div>
                </div>
              </Section>
            </div>

            {/* Sidebar de Informações Adicionais */}
            <div className="lg:col-span-5 space-y-8">
              
              <Section icon={Calendar} title="Agendamento & Status">
                <div className="space-y-5">
                  <Field label="Data da Venda">
                    <Input type="date" className="h-11 bg-white border-slate-200 shadow-sm rounded-xl" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} />
                  </Field>
                  <Field label="Status Atual">
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger className="h-11 bg-white border-slate-200 shadow-sm rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="pendente" className="text-amber-600 font-semibold">Pendente</SelectItem>
                        <SelectItem value="em_andamento" className="text-blue-600 font-semibold">Em andamento</SelectItem>
                        <SelectItem value="concluida" className="text-emerald-600 font-semibold">Concluída</SelectItem>
                        <SelectItem value="cancelada" className="text-slate-500 font-semibold">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </Section>

              <Section icon={FileText} title="Documentação">
                <Field label="Notas e Observações Internas">
                  <Textarea 
                    rows={4} 
                    className="bg-white border-slate-200 shadow-sm rounded-xl resize-none focus:ring-indigo-500" 
                    value={form.notes ?? ""} 
                    onChange={(e) => setForm({ ...form, notes: e.target.value })} 
                    placeholder="Condições especiais, prazos, observações do cliente..." 
                  />
                </Field>
              </Section>

              {/* Resumo Dinâmico Flutuante */}
              {amount > 0 && (
                <div className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-xl shadow-indigo-500/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-black text-indigo-900 uppercase tracking-widest">Resumo Financeiro</h4>
                    <Sparkles className="size-4 text-indigo-500" />
                  </div>

                  {/* 1. Valor de venda */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11.5px] font-semibold text-slate-600">Valor de Venda</span>
                    <span className="text-[13px] font-bold tabular-nums font-mono text-slate-900">{fmt(amount)}</span>
                  </div>

                  {/* 2. Custos internos */}
                  {totalCosts > 0 && (
                    <div className="rounded-lg bg-amber-50/60 border border-amber-100 px-3 py-2.5 space-y-1.5">
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-amber-800">Custos Internos</p>
                      {zenonCost > 0 && (
                        <div className="flex items-center justify-between gap-3 text-[11px]">
                          <span className="text-amber-700 font-medium">🔒 Custo Zenon</span>
                          <span className="font-mono font-semibold text-amber-800 tabular-nums">−{fmt(zenonCost)}</span>
                        </div>
                      )}
                      {providerCost > 0 && (
                        <div className="flex items-center justify-between gap-3 text-[11px]">
                          <span className="text-amber-700 font-medium">🛠 Custo Prestador</span>
                          <span className="font-mono font-semibold text-amber-800 tabular-nums">−{fmt(providerCost)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. Base após custos */}
                  <div className="flex items-center justify-between gap-3 px-1">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Base após custos</span>
                    <span className="text-[12px] font-bold tabular-nums font-mono text-slate-700">{fmt(commissionBase)}</span>
                  </div>

                  {/* 4. Comissões em cascata: Indicador → Parceiro → Colaborador */}
                  {(partnerCalc > 0 || referrerCalc > 0 || collaboratorCalc > 0) && (
                    <div className="rounded-lg bg-rose-50/40 border border-rose-100 px-3 py-2.5 space-y-2">
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-rose-700">Comissões em cascata</p>
                      {referrerCalc > 0 && (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="text-rose-700 font-semibold">Indicador / Imposto</span>
                            <span className="font-mono font-bold text-rose-700 tabular-nums">−{fmt(referrerCalc)}</span>
                          </div>
                          <span className="text-[9.5px] text-rose-500/80 font-mono">{form.referrer_percent}% × {fmt(commissionBase)}</span>
                        </div>
                      )}
                      {partnerCalc > 0 && (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="text-rose-700 font-semibold">Parceiro</span>
                            <span className="font-mono font-bold text-rose-700 tabular-nums">−{fmt(partnerCalc)}</span>
                          </div>
                          <span className="text-[9.5px] text-rose-500/80 font-mono">{form.commission_percent}% × {fmt(partnerBase)} <span className="opacity-60">(após indicador)</span></span>
                        </div>
                      )}
                      {collaboratorCalc > 0 && (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="text-rose-700 font-semibold">Colaborador</span>
                            <span className="font-mono font-bold text-rose-700 tabular-nums">−{fmt(collaboratorCalc)}</span>
                          </div>
                          <span className="text-[9.5px] text-rose-500/80 font-mono">{form.collaborator_percent}% × {fmt(collaboratorBase)} <span className="opacity-60">(após parceiro)</span></span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 pt-1.5 mt-1 border-t border-rose-100 text-[10.5px]">
                        <span className="font-bold text-rose-700 uppercase tracking-wider">Total comissões</span>
                        <span className="font-mono font-bold text-rose-700 tabular-nums">−{fmt(totalCommissions)}</span>
                      </div>
                    </div>
                  )}

                  {/* 5. Líquido */}
                  <div className={cn(
                    "rounded-lg px-3 py-3 flex items-center justify-between gap-3",
                    liquido < 0 ? "bg-rose-50 border border-rose-200" : "bg-emerald-50 border border-emerald-200"
                  )}>
                    <div className="flex flex-col">
                      <span className="text-[9.5px] font-bold uppercase tracking-widest text-slate-500">Resultado Líquido</span>
                      <span className={cn("text-lg font-black tabular-nums font-mono leading-tight", liquido < 0 ? "text-rose-700" : "text-emerald-700")}>
                        {fmt(liquido)}
                      </span>
                    </div>
                    <span className={cn(
                      "px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider whitespace-nowrap",
                      liquido < 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                    )}>
                      {marginPct.toFixed(1)}% margem
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 sm:px-10 py-6 bg-white border-t border-slate-100 flex items-center justify-between gap-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting} className="rounded-xl px-6 h-12 font-bold text-slate-500 hover:bg-slate-50 transition-all">
            Cancelar
          </Button>
          <Button 
            onClick={submit} 
            disabled={submitting} 
            className="rounded-xl px-10 h-12 font-bold bg-[#1e293b] hover:bg-black text-white shadow-xl shadow-slate-200 transition-all active:scale-[0.98] flex items-center gap-2"
          >
            {submitting ? "Processando..." : (
              <>
                Confirmar Registro
                <CircleDollarSign className="size-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

