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

  if (!fields.length) return <p className="text-[11px] text-white/20 italic">Este produto não possui campos adicionais.</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map((f: any) => (
        <div key={f.name} className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-white/40">{f.label}</Label>
          {f.type === 'select' ? (
            <Select onValueChange={(v) => handleFieldChange(f.name, v)}>
              <SelectTrigger className="h-10 bg-white/[0.03] border-white/10 rounded-lg">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                {f.options?.map((opt: string) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : f.type === 'boolean' ? (
            <div className="flex items-center gap-2 h-10 px-3 bg-white/[0.03] border border-white/10 rounded-lg">
              <Switch onCheckedChange={(v) => handleFieldChange(f.name, v)} />
              <span className="text-xs text-white/60">Sim</span>
            </div>
          ) : (
            <Input 
              type={f.type || 'text'}
              className="h-10 bg-white/[0.03] border-white/10 rounded-lg"
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
    service_provider_id: "",
    notes: "",
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

  const partnerCalc = ((form.value * (form.partner_commission || 0)) / 100) || 0;
  const referrerCalc = ((form.value * (form.referrer_commission || 0)) / 100) || 0;
  const companyShare = form.value - partnerCalc - referrerCalc;

  async function handleSave() {
    const validation = schema.safeParse(form);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }
    if (companyShare < 0) {
      toast.error("Soma das comissões excede o valor do produto");
      return;
    }

    setSaving(true);
    try {
      // 1. Insert Client Product (Database trigger tr_populate_client_product will handle templates)
      const { data: cp, error: cpErr } = await supabase
        .from("client_products")
        .insert({
          client_id: clientId,
          product_id: form.product_id,
          service_provider_id: form.service_provider_id || null,
          custom_fields: (form as any).custom_fields || {},
          notes: form.notes || null,
        })
        .select("id")
        .single();
      if (cpErr) throw cpErr;

      // 2. Create Sale (Trigger will handle splits)
      const { error: sErr } = await supabase.from("sales").insert({
        client_id: clientId,
        product_id: form.product_id,
        partner_id: form.partner_id || null,
        commission_percent: form.partner_id ? form.partner_commission : 0,
        referrer_id: form.referrer_id || null,
        referrer_percent: form.referrer_id ? form.referrer_commission : 0,
        amount: form.value,
        status: "concluida",
      });
      if (sErr) throw sErr;


      toast.success("Produto adicionado com sucesso", {
        description: `Comissões geradas: ${formatBRL(partnerCalc + referrerCalc)}`,
      });
      qc.invalidateQueries({ queryKey: ["client-products"] });
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      onOpenChange(false);
      setForm({
        product_id: "", value: 0, partner_id: "", partner_commission: 10,
        referrer_id: "", referrer_commission: 5, service_provider_id: "", notes: "",
      });
    } catch (e: any) {
      toast.error("Erro ao adicionar", { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto bg-neutral-950 border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] p-0">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px]">
          <div className="p-8 space-y-8">
            <DialogHeader>
              <DialogTitle className="editorial-title flex items-center gap-3">
                <Package className="size-6 text-primary" /> Novo Fechamento
              </DialogTitle>
              <DialogDescription className="editorial-label text-white/20">
                Configure os detalhes da venda, comissões e delegação técnica.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-8">
              {/* PRODUTO */}
              <div className="space-y-4">
                <p className="editorial-label text-primary flex items-center gap-2">
                   01. Seleção de Produto
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="editorial-label text-white/40">Produto</Label>
                    <Select value={form.product_id} onValueChange={handleProductChange}>
                      <SelectTrigger className="h-12 bg-white/[0.03] border-white/10 rounded-xl"><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="editorial-label text-white/40">Valor da Venda</Label>
                    <div className="relative">
                       <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-mono text-sm">R$</span>
                       <Input
                         type="number" step="0.01" min="0"
                         value={form.value || ""}
                         onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                         className="h-12 pl-12 bg-white/[0.03] border-white/10 rounded-xl font-mono text-lg font-bold"
                         placeholder="0,00"
                       />
                    </div>
                  </div>
                </div>
              </div>

              {/* COMISSOES */}
              <div className="space-y-4">
                <p className="editorial-label text-primary flex items-center gap-2">
                   02. Rede de Intermediação
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-2 p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl">
                      <Label className="editorial-label text-white/40 mb-3 block">Parceiro Vendedor</Label>
                      <Select 
                        value={form.partner_id || "__none__"} 
                        onValueChange={(v) => v === "__none__" ? setForm({ ...form, partner_id: "", partner_commission: 10 }) : handlePartnerChange(v)}
                      >
                        <SelectTrigger className="h-10 bg-transparent border-white/10 rounded-lg"><SelectValue placeholder="Direto / Sem parceiro" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Direto / Sem parceiro</SelectItem>
                          {partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {form.partner_id && (
                        <div className="mt-3 flex items-center justify-between">
                           <span className="text-[10px] font-bold uppercase tracking-wider text-white/20">Taxa de Comissão</span>
                           <input 
                             type="number" 
                             value={form.partner_commission} 
                             onChange={(e) => setForm({ ...form, partner_commission: Number(e.target.value) })}
                             className="w-16 bg-white/[0.05] border-none text-right font-mono font-bold text-sm rounded-md px-2 py-1"
                           />
                        </div>
                      )}
                   </div>
                   <div className="space-y-2 p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl">
                      <Label className="editorial-label text-white/40 mb-3 block">Indicador</Label>
                      <Select 
                        value={form.referrer_id || "__none__"} 
                        onValueChange={(v) => v === "__none__" ? setForm({ ...form, referrer_id: "", referrer_commission: 5 }) : handleReferrerChange(v)}
                      >
                        <SelectTrigger className="h-10 bg-transparent border-white/10 rounded-lg"><SelectValue placeholder="Sem indicação" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sem indicação</SelectItem>
                          {referrers.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {form.referrer_id && (
                        <div className="mt-3 flex items-center justify-between">
                           <span className="text-[10px] font-bold uppercase tracking-wider text-white/20">Taxa de Indicação</span>
                           <input 
                             type="number" 
                             value={form.referrer_commission} 
                             onChange={(e) => setForm({ ...form, referrer_commission: Number(e.target.value) })}
                             className="w-16 bg-white/[0.05] border-none text-right font-mono font-bold text-sm rounded-md px-2 py-1"
                           />
                        </div>
                      )}
                   </div>
                </div>
              </div>

              {/* DELEGAÇÃO */}
              <div className="space-y-4">
                <p className="editorial-label text-primary flex items-center gap-2">
                   03. Execução do Serviço
                </p>
                <div className="space-y-2">
                  <Label className="editorial-label text-white/40">Delegar para Prestador</Label>
                  <Select 
                    value={form.service_provider_id || "__none__"} 
                    onValueChange={(v) => setForm({ ...form, service_provider_id: v === "__none__" ? "" : v })}
                  >
                    <SelectTrigger className="h-12 bg-white/[0.03] border-white/10 rounded-xl"><SelectValue placeholder="Delegar mais tarde" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Delegar mais tarde</SelectItem>
                      {providers.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} · {p.specialty}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR SUMMARY */}
          <div className="bg-white/[0.02] border-l border-white/10 p-8 flex flex-col justify-between">
            <div className="space-y-8">
               <div className="space-y-2">
                 <p className="editorial-label">Split de Receita</p>
                 <div className="space-y-4 pt-4">
                    <div className="flex justify-between items-center text-white/40">
                       <span className="text-[11px] font-bold uppercase tracking-wider">Bruto</span>
                       <span className="font-mono text-sm">{formatBRL(form.value)}</span>
                    </div>
                    {form.partner_id && (
                      <div className="flex justify-between items-center text-rose-400">
                         <span className="text-[11px] font-bold uppercase tracking-wider">Vendedor</span>
                         <span className="font-mono text-sm">− {formatBRL(partnerCalc)}</span>
                      </div>
                    )}
                    {form.referrer_id && (
                      <div className="flex justify-between items-center text-rose-400">
                         <span className="text-[11px] font-bold uppercase tracking-wider">Indicador</span>
                         <span className="font-mono text-sm">− {formatBRL(referrerCalc)}</span>
                      </div>
                    )}
                    <div className="h-px bg-white/5" />
                    <div className="flex justify-between items-center">
                       <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Líquido</span>
                       <span className="font-mono text-xl font-bold text-emerald-400">{formatBRL(companyShare)}</span>
                    </div>
                 </div>
              {/* CAMPOS PERSONALIZADOS */}
              {form.product_id && (
                <div className="space-y-4">
                  <p className="editorial-label text-primary flex items-center gap-2">
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
                    className="bg-transparent border-none p-0 text-xs text-white/60 focus-visible:ring-0 resize-none h-24"
                    placeholder="Adicionar notas internas sobre esta venda..."
                  />
               </div>
            </div>

            <div className="space-y-3 pt-8">
               <button 
                 disabled={saving || !form.product_id || form.value <= 0}
                 onClick={handleSave}
                 className="w-full action-button btn-primary h-12 shadow-[0_0_50px_rgba(var(--primary-rgb),0.3)]"
               >
                 {saving ? <Loader2 className="size-5 animate-spin" /> : <>Finalizar Venda <ArrowRight className="size-4 ml-2" /></>}
               </button>
               <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full editorial-label">Descartar</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
