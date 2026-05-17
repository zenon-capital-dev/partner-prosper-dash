import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Package, Handshake, UserCheck, UserCog, Calculator, Loader2, ArrowRight } from "lucide-react";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

const schema = z.object({
  product_id: z.string().uuid({ message: "Selecione um produto" }),
  value: z.number().min(0, "Valor inválido").max(10_000_000, "Valor muito alto"),
  partner_id: z.string().uuid().optional().or(z.literal("")),
  partner_commission: z.number().min(0).max(100).optional(),
  referrer_id: z.string().uuid().optional().or(z.literal("")),
  referrer_commission: z.number().min(0).max(100).optional(),
  service_provider_id: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().max(1000).optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
}

function CustomFieldsForm({ productId, onChange }: { productId: string, onChange: (val: any) => void }) {
  const [values, setValues] = useState<any>({});
  
  const { data: product } = useQuery({
    queryKey: ["product-fields", productId],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("custom_fields_template").eq("id", productId).single();
      return data;
    },
    enabled: !!productId
  });

  const fields = (product?.custom_fields_template as any[]) || [];

  const handleFieldChange = (name: string, value: any) => {
    const next = { ...values, [name]: value };
    setValues(next);
    onChange(next);
  };

  if (!fields.length) return <p className="text-[11px] text-slate-400 italic">Este produto não possui campos adicionais.</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map((f: any) => (
        <div key={f.name} className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-slate-500">{f.label}</Label>
          {f.type === 'select' ? (
            <Select onValueChange={(v) => handleFieldChange(f.name, v)}>
              <SelectTrigger className="h-10 bg-white border-slate-200 rounded-lg">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                {f.options?.map((opt: string) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : f.type === 'boolean' ? (
            <div className="flex items-center gap-2 h-10 px-3 bg-white border border-slate-200 rounded-lg">
              <Switch onCheckedChange={(v) => handleFieldChange(f.name, v)} />
              <span className="text-xs text-slate-700">Sim</span>
            </div>
          ) : (
            <Input 
              type={f.type || 'text'}
              className="h-10 bg-white border-slate-200 rounded-lg"
              onChange={(e) => handleFieldChange(f.name, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function AddProductDialog({ open, onOpenChange, clientId }: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_id: "",
    value: 0,
    partner_id: "",
    partner_commission: 10,
    referrer_id: "",
    referrer_commission: 5,
    collaborator_id: "",
    collaborator_commission: 0,
    service_provider_id: "",
    provider_payout: 0,
    notes: "",
  });

  // Pré-preenche com a rede já vinculada ao cliente (parceiro / indicador / colaborador)
  useQuery({
    queryKey: ["client-network-prefill", clientId, open],
    enabled: !!clientId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("partner_id, referrer_id, collaborator_id, partners(commission_percent), referrers(commission_percent)")
        .eq("id", clientId)
        .maybeSingle();
      if (data) {
        setForm((f) => ({
          ...f,
          partner_id: f.partner_id || data.partner_id || "",
          partner_commission: data.partner_id && (data as any).partners?.commission_percent ? Number((data as any).partners.commission_percent) : f.partner_commission,
          referrer_id: f.referrer_id || data.referrer_id || "",
          referrer_commission: data.referrer_id && (data as any).referrers?.commission_percent ? Number((data as any).referrers.commission_percent) : f.referrer_commission,
          collaborator_id: f.collaborator_id || (data.collaborator_id ?? ""),
        }));
      }
      return data;
    },
  });

  const { data: collaborators = [] } = useQuery({
    queryKey: ["all-collaborators-select"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["vendedor", "colaborador", "admin"]);
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids).order("full_name");
      return data ?? [];
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["client-companies", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").eq("client_id", clientId);
      return data ?? [];
    },
    enabled: !!clientId
  });

  const { data: products = [] } = useQuery({
    queryKey: ["all-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, base_price").order("name");
      return data ?? [];
    },
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["all-partners"],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, full_name, commission_percent").eq("active", true).order("full_name");
      return data ?? [];
    },
  });

  const { data: referrers = [] } = useQuery({
    queryKey: ["all-referrers"],
    queryFn: async () => {
      const { data } = await supabase.from("referrers").select("id, full_name, commission_percent").eq("active", true).order("full_name");
      return data ?? [];
    },
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["all-providers"],
    queryFn: async () => {
      const { data } = await supabase.from("service_providers").select("id, name, specialty").order("name");
      return data ?? [];
    },
  });

  const handleProductChange = (productId: string) => {
    const p = products.find((x: any) => x.id === productId);
    setForm({ ...form, product_id: productId, value: Number(p?.base_price || 0) });
  };

  const handlePartnerChange = (partnerId: string) => {
    const p = partners.find((x: any) => x.id === partnerId);
    setForm({ ...form, partner_id: partnerId, partner_commission: Number(p?.commission_percent || 10) });
  };

  const handleReferrerChange = (refId: string) => {
    const r = referrers.find((x: any) => x.id === refId);
    setForm({ ...form, referrer_id: refId, referrer_commission: Number(r?.commission_percent || 5) });
  };

  const partnerCalc = form.partner_id ? ((form.value * (form.partner_commission || 0)) / 100) || 0 : 0;
  const referrerCalc = form.referrer_id ? ((form.value * (form.referrer_commission || 0)) / 100) || 0 : 0;
  const collaboratorCalc = form.collaborator_id ? ((form.value * (form.collaborator_commission || 0)) / 100) || 0 : 0;
  const providerCalc = form.service_provider_id ? Number(form.provider_payout || 0) : 0;
  const totalCommissions = partnerCalc + referrerCalc + collaboratorCalc + providerCalc;
  const companyShare = form.value - totalCommissions;
  const totalPercent = ((totalCommissions / (form.value || 1)) * 100) || 0;

  async function handleSave() {
    const validation = schema.safeParse(form);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }
    if (companyShare < 0) {
      toast.error("Soma das comissões + repasse excede o valor do produto");
      return;
    }

    setSaving(true);
    try {
      const { data: cp, error: cpErr } = await supabase
        .from("client_products")
        .insert({
          client_id: clientId,
          company_id: (form as any).company_id === "none" ? null : (form as any).company_id,
          product_id: form.product_id,
          service_provider_id: form.service_provider_id || null,
          partner_commission: form.partner_id ? form.partner_commission : null,
          employee_commission: form.collaborator_id ? form.collaborator_commission : null,
          custom_fields: (form as any).custom_fields || {},
          value: form.value,
          notes: form.notes || null,
        })
        .select("id")
        .single();
      if (cpErr) throw cpErr;

      const { error: sErr } = await supabase.from("sales").insert({
        client_id: clientId,
        product_id: form.product_id,
        partner_id: form.partner_id || null,
        commission_percent: form.partner_id ? form.partner_commission : 0,
        referrer_id: form.referrer_id || null,
        referrer_percent: form.referrer_id ? form.referrer_commission : 0,
        collaborator_id: form.collaborator_id || null,
        collaborator_percent: form.collaborator_id ? form.collaborator_commission : 0,
        amount: form.value,
        status: "concluida",
      });
      if (sErr) throw sErr;

      toast.success("Produto adicionado com sucesso", {
        description: `Comissões geradas: ${formatBRL(totalCommissions)} (${totalPercent.toFixed(1)}%)`,
      });
      qc.invalidateQueries({ queryKey: ["client-products"] });
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      onOpenChange(false);
      setForm({
        product_id: "", value: 0, partner_id: "", partner_commission: 10,
        referrer_id: "", referrer_commission: 5,
        collaborator_id: "", collaborator_commission: 0,
        service_provider_id: "", provider_payout: 0, notes: "",
      });
    } catch (e: any) {
      toast.error("Erro ao adicionar", { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto bg-white border-slate-200 shadow-xl p-0">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px]">
          <div className="p-8 space-y-8">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-3">
                <Package className="size-6 text-primary" /> Novo Fechamento
              </DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-slate-400">
                Configure os detalhes da venda, comissões e delegação técnica.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-8">
              {/* PRODUTO */}
              <div className="space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-primary flex items-center gap-2">
                   01. Seleção de Produto
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-slate-500">Empresa (Opcional)</Label>
                    <Select 
                      value={(form as any).company_id || "none"} 
                      onValueChange={(v) => setForm({ ...form, company_id: v } as any)}
                    >
                      <SelectTrigger className="h-12 bg-white border-slate-200 rounded-xl">
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Pessoa Física / Geral</SelectItem>
                        {companies.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-slate-500">Produto</Label>
                    <Select value={form.product_id} onValueChange={handleProductChange}>
                      <SelectTrigger className="h-12 bg-white border-slate-200 rounded-xl"><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-slate-500">Valor da Venda</Label>
                    <div className="relative">
                       <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">R$</span>
                       <Input
                         type="number" step="0.01" min="0"
                         value={form.value || ""}
                         onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                         className="h-12 pl-12 bg-white border-slate-200 rounded-xl font-mono text-lg font-bold"
                         placeholder="0,00"
                       />
                    </div>
                  </div>
                </div>
              </div>

              {/* COMISSOES */}
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-primary flex items-center gap-2">02. Rede de Comissionamento</p>
                  <span className={cn(
                    "text-[10px] font-mono px-2 py-1 rounded-md",
                    totalPercent > 100 ? "bg-rose-50 text-rose-700" : totalPercent > 60 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"
                  )}>
                    {totalPercent.toFixed(1)}% comprometido
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* PARCEIRO */}
                  <div className="space-y-2 p-4 bg-slate-50/60 border border-slate-200/70 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-slate-500 flex items-center gap-1.5"><Handshake className="size-3" /> Parceiro Vendedor</Label>
                      {partnerCalc > 0 && <span className="text-[10px] font-mono text-emerald-600">{formatBRL(partnerCalc)}</span>}
                    </div>
                    <Select
                      value={form.partner_id || "__none__"}
                      onValueChange={(v) => v === "__none__" ? setForm({ ...form, partner_id: "", partner_commission: 10 }) : handlePartnerChange(v)}
                    >
                      <SelectTrigger className="h-10 bg-transparent border-slate-200 rounded-lg"><SelectValue placeholder="Direto / Sem parceiro" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Direto / Sem parceiro</SelectItem>
                        {partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {form.partner_id && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="relative">
                          <Input type="number" step="0.1" min="0" max="100" value={form.partner_commission}
                            onChange={(e) => setForm({ ...form, partner_commission: Number(e.target.value) })}
                            className="h-9 bg-white border-slate-200 pr-7 font-mono text-sm" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">%</span>
                        </div>
                        <div className="relative">
                          <Input type="number" step="0.01" min="0" value={partnerCalc.toFixed(2)}
                            onChange={(e) => setForm({ ...form, partner_commission: form.value > 0 ? (Number(e.target.value) / form.value) * 100 : 0 })}
                            className="h-9 bg-white border-slate-200 pl-7 font-mono text-sm" />
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">R$</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* INDICADOR */}
                  <div className="space-y-2 p-4 bg-slate-50/60 border border-slate-200/70 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-slate-500 flex items-center gap-1.5"><UserCheck className="size-3" /> Indicador</Label>
                      {referrerCalc > 0 && <span className="text-[10px] font-mono text-emerald-600">{formatBRL(referrerCalc)}</span>}
                    </div>
                    <Select
                      value={form.referrer_id || "__none__"}
                      onValueChange={(v) => v === "__none__" ? setForm({ ...form, referrer_id: "", referrer_commission: 5 }) : handleReferrerChange(v)}
                    >
                      <SelectTrigger className="h-10 bg-transparent border-slate-200 rounded-lg"><SelectValue placeholder="Sem indicação" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem indicação</SelectItem>
                        {referrers.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {form.referrer_id && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="relative">
                          <Input type="number" step="0.1" min="0" max="100" value={form.referrer_commission}
                            onChange={(e) => setForm({ ...form, referrer_commission: Number(e.target.value) })}
                            className="h-9 bg-white border-slate-200 pr-7 font-mono text-sm" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">%</span>
                        </div>
                        <div className="relative">
                          <Input type="number" step="0.01" min="0" value={referrerCalc.toFixed(2)}
                            onChange={(e) => setForm({ ...form, referrer_commission: form.value > 0 ? (Number(e.target.value) / form.value) * 100 : 0 })}
                            className="h-9 bg-white border-slate-200 pl-7 font-mono text-sm" />
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">R$</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* COLABORADOR INTERNO */}
                  <div className="space-y-2 p-4 bg-slate-50/60 border border-slate-200/70 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-slate-500 flex items-center gap-1.5"><UserCog className="size-3" /> Vendedor Interno</Label>
                      {collaboratorCalc > 0 && <span className="text-[10px] font-mono text-emerald-600">{formatBRL(collaboratorCalc)}</span>}
                    </div>
                    <Select
                      value={form.collaborator_id || "__none__"}
                      onValueChange={(v) => setForm({ ...form, collaborator_id: v === "__none__" ? "" : v, collaborator_commission: v === "__none__" ? 0 : (form.collaborator_commission || 5) })}
                    >
                      <SelectTrigger className="h-10 bg-transparent border-slate-200 rounded-lg"><SelectValue placeholder="Sem vendedor interno" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem vendedor interno</SelectItem>
                        {collaborators.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name ?? c.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {form.collaborator_id && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="relative">
                          <Input type="number" step="0.1" min="0" max="100" value={form.collaborator_commission}
                            onChange={(e) => setForm({ ...form, collaborator_commission: Number(e.target.value) })}
                            className="h-9 bg-white border-slate-200 pr-7 font-mono text-sm" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">%</span>
                        </div>
                        <div className="relative">
                          <Input type="number" step="0.01" min="0" value={collaboratorCalc.toFixed(2)}
                            onChange={(e) => setForm({ ...form, collaborator_commission: form.value > 0 ? (Number(e.target.value) / form.value) * 100 : 0 })}
                            className="h-9 bg-white border-slate-200 pl-7 font-mono text-sm" />
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">R$</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* PRESTADOR (repasse fixo R$) */}
                  <div className="space-y-2 p-4 bg-slate-50/60 border border-slate-200/70 rounded-2xl">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-slate-500 flex items-center gap-1.5"><Calculator className="size-3" /> Prestador (repasse)</Label>
                      {providerCalc > 0 && <span className="text-[10px] font-mono text-emerald-600">{formatBRL(providerCalc)}</span>}
                    </div>
                    <Select
                      value={form.service_provider_id || "__none__"}
                      onValueChange={(v) => setForm({ ...form, service_provider_id: v === "__none__" ? "" : v, provider_payout: v === "__none__" ? 0 : form.provider_payout })}
                    >
                      <SelectTrigger className="h-10 bg-transparent border-slate-200 rounded-lg"><SelectValue placeholder="Sem prestador" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem prestador / executar internamente</SelectItem>
                        {providers.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} · {p.specialty}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {form.service_provider_id && (
                      <div className="mt-3 relative">
                        <Input type="number" step="0.01" min="0" value={form.provider_payout || ""}
                          onChange={(e) => setForm({ ...form, provider_payout: Number(e.target.value) })}
                          placeholder="Valor fixo do repasse"
                          className="h-9 bg-white border-slate-200 pl-9 font-mono text-sm" />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">R$</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR SUMMARY */}
          <div className="bg-slate-50/60 border-l border-slate-200 p-8 bg-slate-50 flex flex-col justify-between">
            <div className="space-y-8">
               <div className="space-y-2">
                 <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Split de Receita</p>
                 <div className="space-y-3 pt-4">
                    <div className="flex justify-between items-center text-slate-500">
                       <span className="text-[11px] font-bold uppercase tracking-wider">Bruto</span>
                       <span className="font-mono text-sm">{formatBRL(form.value)}</span>
                    </div>
                    {partnerCalc > 0 && (
                      <div className="flex justify-between items-center text-rose-600">
                         <span className="text-[11px] font-bold uppercase tracking-wider">Parceiro · {form.partner_commission}%</span>
                         <span className="font-mono text-sm">− {formatBRL(partnerCalc)}</span>
                      </div>
                    )}
                    {referrerCalc > 0 && (
                      <div className="flex justify-between items-center text-rose-600">
                         <span className="text-[11px] font-bold uppercase tracking-wider">Indicador · {form.referrer_commission}%</span>
                         <span className="font-mono text-sm">− {formatBRL(referrerCalc)}</span>
                      </div>
                    )}
                    {collaboratorCalc > 0 && (
                      <div className="flex justify-between items-center text-rose-600">
                         <span className="text-[11px] font-bold uppercase tracking-wider">Vendedor int. · {form.collaborator_commission}%</span>
                         <span className="font-mono text-sm">− {formatBRL(collaboratorCalc)}</span>
                      </div>
                    )}
                    {providerCalc > 0 && (
                      <div className="flex justify-between items-center text-rose-600">
                         <span className="text-[11px] font-bold uppercase tracking-wider">Prestador (repasse)</span>
                         <span className="font-mono text-sm">− {formatBRL(providerCalc)}</span>
                      </div>
                    )}
                    <div className="h-px bg-slate-100" />
                    <div className="flex justify-between items-center">
                       <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Líquido empresa</span>
                       <span className="font-mono text-xl font-bold text-emerald-600">{formatBRL(companyShare)}</span>
                    </div>
                    {form.value > 0 && (
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                        <span>Margem</span>
                        <span>{((companyShare / form.value) * 100).toFixed(1)}%</span>
                      </div>
                    )}
                 </div>
              {/* CAMPOS PERSONALIZADOS */}
              {form.product_id && (
                <div className="space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-primary flex items-center gap-2">
                     04. Informações Específicas
                  </p>
                  <CustomFieldsForm 
                    productId={form.product_id} 
                    onChange={(fields) => setForm({ ...form, custom_fields: fields } as any)} 
                  />
                </div>
              )}
            </div>

               <div className="p-4 bg-primary/10 border border-primary/20 rounded-2xl">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-2">Internal Note</p>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="bg-transparent border-none p-0 text-xs text-slate-700 focus-visible:ring-0 resize-none h-24"
                    placeholder="Adicionar notas internas sobre esta venda..."
                  />
               </div>
            </div>

            <div className="space-y-3 pt-8">
               <button 
                 disabled={saving || !form.product_id || form.value <= 0}
                 onClick={handleSave}
                 className="w-full action-button btn-primary h-12 shadow-md"
               >
                 {saving ? <Loader2 className="size-5 animate-spin" /> : <>Finalizar Venda <ArrowRight className="size-4 ml-2" /></>}
               </button>
               <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full text-[10px] font-bold uppercase tracking-widest text-slate-500">Descartar</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
