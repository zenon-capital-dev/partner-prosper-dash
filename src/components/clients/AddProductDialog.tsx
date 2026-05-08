import { useState } from "react";
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
import { Package, Handshake, UserCheck, UserCog, Calculator, Loader2 } from "lucide-react";
import { formatBRL } from "@/lib/format";

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
      // 1. Cria o vínculo cliente↔produto com prestador
      const { data: cp, error: cpErr } = await supabase
        .from("client_products")
        .insert({
          client_id: clientId,
          product_id: form.product_id,
          service_provider_id: form.service_provider_id || null,
          value: form.value,
          status: "aguardando_inicio",
          notes: form.notes || null,
        })
        .select("id")
        .single();
      if (cpErr) throw cpErr;

      // 2. Cria a venda (gera splits via trigger)
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-5 text-primary" /> Adicionar Produto ao Cliente
          </DialogTitle>
          <DialogDescription>
            Configure produto, parceiros, prestador e comissões. As comissões são geradas automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* PRODUTO */}
          <section className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Package className="size-3" /> Produto e Valor
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Produto *</Label>
                <Select value={form.product_id} onValueChange={handleProductChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {p.base_price > 0 && `· ${formatBRL(p.base_price)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Valor da venda (R$) *</Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={form.value || ""}
                  onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
                  placeholder="0,00"
                />
              </div>
            </div>
          </section>

          {/* PARCEIRO */}
          <section className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Handshake className="size-3" /> Parceiro Vendedor (opcional)
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Parceiro</Label>
                <Select value={form.partner_id} onValueChange={handlePartnerChange}>
                  <SelectTrigger><SelectValue placeholder="Sem parceiro" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem parceiro</SelectItem>
                    {partners.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name} ({Number(p.commission_percent || 10)}% padrão)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">% Comissão</Label>
                <Input
                  type="number" step="0.1" min="0" max="100"
                  value={form.partner_commission}
                  onChange={(e) => setForm({ ...form, partner_commission: Number(e.target.value) })}
                  disabled={!form.partner_id}
                />
              </div>
            </div>
          </section>

          {/* INDICADOR */}
          <section className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <UserCheck className="size-3" /> Indicador (opcional)
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Quem indicou</Label>
                <Select value={form.referrer_id} onValueChange={handleReferrerChange}>
                  <SelectTrigger><SelectValue placeholder="Sem indicador" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem indicador</SelectItem>
                    {referrers.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.full_name} ({Number(r.commission_percent || 5)}% padrão)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">% Comissão</Label>
                <Input
                  type="number" step="0.1" min="0" max="100"
                  value={form.referrer_commission}
                  onChange={(e) => setForm({ ...form, referrer_commission: Number(e.target.value) })}
                  disabled={!form.referrer_id}
                />
              </div>
            </div>
          </section>

          {/* PRESTADOR */}
          <section className="space-y-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <UserCog className="size-3" /> Prestador delegado (opcional)
            </h4>
            <Select value={form.service_provider_id} onValueChange={(v) => setForm({ ...form, service_provider_id: v })}>
              <SelectTrigger><SelectValue placeholder="Delegar mais tarde" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Delegar mais tarde</SelectItem>
                {providers.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.specialty && `· ${p.specialty}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          {/* OBS */}
          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2} maxLength={1000}
              placeholder="Ex.: prazo especial, documentos pendentes..."
            />
          </div>

          {/* RESUMO */}
          {form.value > 0 && (
            <section className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="size-4 text-primary" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Resumo do Split</p>
              </div>
              <div className="space-y-1.5 text-sm">
                <Row label="Valor da venda" value={formatBRL(form.value)} bold />
                {form.partner_id && (
                  <Row label={`↳ Parceiro (${form.partner_commission}%)`} value={`− ${formatBRL(partnerCalc)}`} muted />
                )}
                {form.referrer_id && (
                  <Row label={`↳ Indicador (${form.referrer_commission}%)`} value={`− ${formatBRL(referrerCalc)}`} muted />
                )}
                <div className="border-t border-primary/20 pt-2 mt-2">
                  <Row label="Líquido para empresa" value={formatBRL(companyShare)} bold success={companyShare >= 0} danger={companyShare < 0} />
                </div>
              </div>
            </section>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.product_id || form.value <= 0}>
            {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
            Adicionar e Gerar Comissões
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, bold, muted, success, danger }: any) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-xs ${muted ? "text-muted-foreground" : ""}`}>{label}</span>
      <span className={`tabular-nums ${bold ? "font-bold" : ""} ${success ? "text-emerald-600" : ""} ${danger ? "text-rose-600" : ""}`}>
        {value}
      </span>
    </div>
  );
}
