import { useState, useEffect, useMemo } from "react";
import { useClientsRef, useProductsRef, usePartnersRef, useReferrersRef, useCollaboratorsRef, useProvidersRef } from "@/hooks/useReferenceData";
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
import { saleIsFinalized } from "@/lib/financial";
import { useJourneyStages } from "@/hooks/useSharedStageFilter";
import { deriveClientStatusFromStageName, invalidateJourneyStageCaches } from "@/lib/journey-stage-sync";

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

function StageForClientField({ clientId }: { clientId?: string | null }) {
  const qc = useQueryClient();
  const { data: stages = [] } = useJourneyStages();
  const { data: currentStageId } = useQuery({
    queryKey: ["sale-form-client-stage", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("clients")
        .select("journey_stage_id")
        .eq("id", clientId)
        .maybeSingle();
      return (data?.journey_stage_id as string | null) ?? null;
    },
  });

  async function change(newId: string | null) {
    if (!clientId) {
      toast.error("Selecione um cliente primeiro.");
      return;
    }
    if ((currentStageId ?? null) === newId) return;
    const nextStage = stages.find((s) => s.id === newId);
    const { error } = await supabase.from("clients").update({ journey_stage_id: newId } as any).eq("id", clientId);
    if (error) { toast.error(error.message); return; }
    const derived = deriveClientStatusFromStageName(nextStage?.name);
    toast.success(`Estágio movido para "${nextStage?.name ?? "Sem estágio"}"${derived ? ` · ${derived.replace(/_/g, " ")}` : ""}`);
    qc.invalidateQueries({ queryKey: ["sale-form-client-stage", clientId] });
    invalidateJourneyStageCaches(qc, clientId);
  }

  return (
    <Field label="Estágio do Cliente">
      <Select
        value={currentStageId ?? "__none__"}
        onValueChange={(v) => change(v === "__none__" ? null : v)}
        disabled={!clientId}
      >
        <SelectTrigger className="h-11 bg-white border-slate-200 shadow-sm rounded-xl">
          <SelectValue placeholder={clientId ? "Selecionar estágio" : "Selecione um cliente"} />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={6} className="rounded-xl">
          <SelectItem value="__none__" className="text-slate-500 font-semibold">Sem estágio</SelectItem>
          {stages.map((s) => (
            <SelectItem key={s.id} value={s.id} className="font-semibold" style={{ color: s.color || undefined }}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="mt-1.5 text-[10.5px] text-slate-500 leading-snug">
        Reflete o estágio na esteira do cliente — replica em Clientes, Vendas, Demandas e Metas.
      </p>
    </Field>
  );
}

export function SaleFormDialog({ open, onOpenChange, onCreated, clientId, sale }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({ status: "pendente", commission_percent: 10, sale_date: ymdBR(nowBR()), installments_count: 1, first_due_date: ymdBR(nowBR()), revenue_type: "avulso", recurrence_months: 12, project_id: null });

  useEffect(() => {
    if (open) {
      if (sale) {
        setForm({
          ...sale,
          sale_date: sale.sale_date || ymdBR(nowBR()),
          installments_count: 1,
          first_due_date: sale.recurrence_start || sale.sale_date || ymdBR(nowBR()),
          revenue_type: sale.revenue_type || "avulso",
          recurrence_months: sale.recurrence_months || 12,
          project_id: sale.project_id ?? null,
        });
      } else {
        setForm({ status: "pendente", commission_percent: 10, sale_date: ymdBR(nowBR()), client_id: clientId, installments_count: 1, first_due_date: ymdBR(nowBR()), revenue_type: "avulso", recurrence_months: 12, project_id: null });
      }
    }
  }, [open, clientId, sale]);


  const { data: clients } = useClientsRef(open);
  const { data: productsAll } = useProductsRef(open);
  const products = useMemo(() => (productsAll ?? []).filter((p: any) => p.active !== false), [productsAll]);
  const { data: partnersAll } = usePartnersRef(open);
  const partners = useMemo(() => (partnersAll ?? []).filter((p: any) => p.active !== false), [partnersAll]);
  const { data: referrersAll } = useReferrersRef(open);
  const referrers = useMemo(() => (referrersAll ?? []).filter((r: any) => r.active !== false), [referrersAll]);
  const { data: collaborators } = useCollaboratorsRef(open);
  const { data: providers } = useProvidersRef(open);


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

  const addMonths = (iso: string, m: number) => {
    const [y, mo, d] = iso.split("-").map((x) => parseInt(x, 10));
    const dt = new Date(Date.UTC(y, mo - 1 + m, d));
    return dt.toISOString().slice(0, 10);
  };

  const buildPaymentRows = (saleRow: any, payload: any) => {
    const isRecurring = payload.revenue_type === "recorrente";
    const recurrenceStart = form.first_due_date || form.sale_date || ymdBR(nowBR());
    if (isRecurring) {
      const months = Math.max(1, payload.recurrence_months as number);
      // form.amount = valor TOTAL do contrato recorrente; a mensalidade é total/meses.
      const totalCents = Math.round(Number(form.amount) * 100);
      const baseCents = Math.floor(totalCents / months);
      const remainder = totalCents - baseCents * months;
      return Array.from({ length: months }, (_, i) => ({
        sale_id: saleRow.id,
        client_id: saleRow.client_id,
        product_id: saleRow.product_id,
        amount: ((baseCents + (i === months - 1 ? remainder : 0)) / 100),
        due_date: addMonths(recurrenceStart, i),
        status: "pendente" as any,
        installments_count: months,
        installment_number: i + 1,
        description: `Mensalidade ${i + 1}/${months}`,
      }));
    }

    const n = Math.max(1, Math.min(60, parseInt(form.installments_count || 1, 10) || 1));
    const baseDate = form.first_due_date || form.sale_date || ymdBR(nowBR());
    const totalCents = Math.round(Number(form.amount) * 100);
    const baseCents = Math.floor(totalCents / n);
    const remainder = totalCents - baseCents * n;
    return Array.from({ length: n }, (_, i) => ({
      sale_id: saleRow.id,
      client_id: saleRow.client_id,
      product_id: saleRow.product_id,
      amount: ((baseCents + (i === n - 1 ? remainder : 0)) / 100),
      due_date: addMonths(baseDate, i),
      status: "pendente" as any,
      installments_count: n,
      installment_number: i + 1,
      description: n > 1 ? `Parcela ${i + 1}/${n}` : "Pagamento único",
    }));
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
      const isRecurring = form.revenue_type === "recorrente";
      const recurrenceStart = form.first_due_date || form.sale_date || ymdBR(nowBR());
      const payload = {
        client_id: form.client_id,
        product_id: form.product_id,
        partner_id: form.partner_id || null,
        referrer_id: form.referrer_id || null,
        collaborator_id: form.collaborator_id || null,
        service_provider_id: form.service_provider_id || null,
        amount: Number(form.amount),
        zenon_cost: Number(form.zenon_cost || 0),
        provider_cost: Number(form.provider_cost || 0),
        commission_percent: Number(form.commission_percent || 0),
        referrer_percent: Number(form.referrer_percent || 0),
        collaborator_percent: Number(form.collaborator_percent || 0),
        status: form.status,
        sale_date: form.sale_date,
        notes: form.notes || null,
        revenue_type: isRecurring ? "recorrente" : "avulso",
        recurrence_months: isRecurring ? Math.max(1, Math.min(120, parseInt(form.recurrence_months || 12, 10) || 12)) : null,
        recurrence_start: isRecurring ? recurrenceStart : null,
        project_id: form.project_id || null,
      } as any;

      const shouldGenerateFinancialSchedule = saleIsFinalized(payload);


      if (form.id) {
        const { error } = await supabase.from("sales").update(payload).eq("id", form.id);
        if (error) throw error;

        // Regenerar parcelas pendentes somente quando a venda estiver finalizada.
        const finalizedNow = !saleIsFinalized(sale) && shouldGenerateFinancialSchedule;
        if (shouldGenerateFinancialSchedule && (form.regenerate_payments || finalizedNow)) {
          // Apaga apenas as parcelas ainda pendentes desta venda
          await supabase.from("payments").delete().eq("sale_id", form.id).eq("status", "pendente");
          const rows = buildPaymentRows({ id: form.id, client_id: form.client_id, product_id: form.product_id }, payload);
          if (rows.length) await supabase.from("payments").insert(rows);
          toast.success(`Venda atualizada — ${rows.length} parcela(s) regenerada(s)`);
        } else if (!shouldGenerateFinancialSchedule) {
          await supabase.from("payments").delete().eq("sale_id", form.id).eq("status", "pendente");
          toast.success("Venda salva como negociação — sem fluxo financeiro ativo");
        } else {
          toast.success("Venda atualizada com sucesso");
        }
      } else {
        const { data: newSale, error } = await supabase.from("sales").insert({
          ...payload,
          created_by: user?.id,
        }).select().single();
        if (error) throw error;

        if (shouldGenerateFinancialSchedule) {
          // Gera as parcelas (faturas) apenas quando a venda estiver finalizada.
          const rows = buildPaymentRows(newSale, payload);
          const { error: payErr } = await supabase.from("payments").insert(rows);
          if (payErr) {
            console.warn("Falha ao gerar parcelas:", payErr);
            toast.warning("Venda criada, mas as parcelas não foram geradas: " + payErr.message);
          } else {
            toast.success(`Venda finalizada e ${rows.length} ${rows.length > 1 ? (isRecurring ? "mensalidades geradas" : "parcelas geradas") : "fatura gerada"}`);
          }
        } else {
          toast.success("Negociação registrada — finalize a venda para ativar o fluxo financeiro");
        }
      }


      // Invalida todos os caches que dependem de vendas/demandas para refletir imediatamente em qualquer tela.
      const targetClientId = form.client_id || clientId;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["sales-rich-v2"] }),
        qc.invalidateQueries({ queryKey: ["sales-commission-splits"] }),
        // Sempre invalida client-products globalmente (prefix match cobre todos clientes), além de refazer o do cliente alvo.
        qc.invalidateQueries({ queryKey: ["client-products"] }),
        qc.invalidateQueries({ queryKey: ["client-sales"] }),
        qc.invalidateQueries({ queryKey: ["client-payments"] }),
        targetClientId ? qc.invalidateQueries({ queryKey: ["client-products", targetClientId] }) : Promise.resolve(),
        targetClientId ? qc.invalidateQueries({ queryKey: ["client-sales", targetClientId] }) : Promise.resolve(),
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
      <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-2xl border-slate-200 shadow-xl gap-0 bg-white flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        {/* Header claro, padrão admin */}
        <DialogHeader className="px-6 sm:px-8 pt-6 pb-5 bg-white border-b border-slate-200/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-10 rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 flex items-center justify-center shrink-0">
                <CircleDollarSign className="size-5" strokeWidth={2.4} />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="font-display text-xl sm:text-2xl font-bold text-slate-900 leading-tight tracking-tight">
                  {form.id ? "Editar Venda" : "Nova Venda"}
                </DialogTitle>
                <DialogDescription className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.18em] mt-0.5">
                  Receita & comissionamento
                </DialogDescription>
              </div>
            </div>

            {amount > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <div className="bg-slate-50 border border-slate-200/70 rounded-lg px-3 py-1.5 flex flex-col items-end">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Bruto</span>
                  <span className="font-mono text-sm font-bold tabular-nums text-slate-900">{fmt(amount)}</span>
                </div>
                <div className={cn(
                  "rounded-lg px-3 py-1.5 flex flex-col items-end border",
                  liquido < 0 ? "bg-rose-50 border-rose-200" : "bg-emerald-50 border-emerald-200"
                )}>
                  <span className={cn("text-[9px] font-semibold uppercase tracking-wider", liquido < 0 ? "text-rose-600" : "text-emerald-700")}>Líquido</span>
                  <span className={cn("font-mono text-sm font-bold tabular-nums", liquido < 0 ? "text-rose-700" : "text-emerald-700")}>{fmt(liquido)}</span>
                </div>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Body com Scroll Suave */}
        <div className="px-6 sm:px-8 py-6 flex-1 overflow-y-auto bg-slate-50/60 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">

          {/* Tipo de Receita — destaque no topo, sempre visível (criar e editar) */}
          <div className="rounded-2xl border-2 border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-white p-4 sm:p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                <Calendar className="size-4" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-indigo-700">Tipo de receita</p>
                <p className="text-[11px] text-slate-500 leading-tight">Defina como o faturamento entra no cronograma</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, revenue_type: "avulso" })}
                className={cn(
                  "rounded-xl border-2 p-3 text-left transition",
                  form.revenue_type !== "recorrente"
                    ? "border-slate-500 bg-slate-50 ring-2 ring-slate-200"
                    : "border-slate-200 bg-white hover:border-slate-300"
                )}
              >
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-0.5">Pontual</p>
                <p className="text-[13px] font-bold text-slate-900">Avulso / Na cabeça</p>
                <p className="text-[10.5px] text-slate-500 mt-0.5">Receita única — parcelável.</p>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, revenue_type: "recorrente" })}
                className={cn(
                  "rounded-xl border-2 p-3 text-left transition",
                  form.revenue_type === "recorrente"
                    ? "border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100"
                    : "border-slate-200 bg-white hover:border-indigo-300"
                )}
              >
                <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600 mb-0.5">MRR</p>
                <p className="text-[13px] font-bold text-slate-900">Recorrência mensal</p>
                <p className="text-[10.5px] text-slate-500 mt-0.5">Valor total ÷ nº de meses = mensalidade.</p>
              </button>
            </div>
            {form.revenue_type === "recorrente" ? (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="Período de vigência (meses)">
                  <Input type="number" min={1} max={120}
                    className="h-10 bg-white border-indigo-300 shadow-sm rounded-lg font-mono"
                    value={form.recurrence_months ?? 12}
                    onChange={(e) => setForm({ ...form, recurrence_months: e.target.value })} />
                </Field>
                <Field label="Início da cobrança">
                  <Input type="date"
                    className="h-10 bg-white border-slate-200 shadow-sm rounded-lg"
                    value={form.first_due_date ?? form.sale_date}
                    onChange={(e) => setForm({ ...form, first_due_date: e.target.value })} />
                </Field>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="Nº de parcelas">
                  <Input type="number" min={1} max={60}
                    className="h-10 bg-white border-slate-200 shadow-sm rounded-lg font-mono"
                    value={form.installments_count ?? 1}
                    onChange={(e) => setForm({ ...form, installments_count: e.target.value })} />
                </Field>
                <Field label="1º vencimento">
                  <Input type="date"
                    className="h-10 bg-white border-slate-200 shadow-sm rounded-lg"
                    value={form.first_due_date ?? form.sale_date}
                    onChange={(e) => setForm({ ...form, first_due_date: e.target.value })} />
                </Field>
              </div>
            )}
            {form.id && (
              <label className="mt-3 flex items-start gap-2 text-[11.5px] text-slate-600 cursor-pointer bg-amber-50/60 border border-amber-200 rounded-lg p-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={!!form.regenerate_payments}
                  onChange={(e) => setForm({ ...form, regenerate_payments: e.target.checked })}
                />
                <span><strong>Regenerar parcelas</strong> com base nas novas configurações (substitui as faturas pendentes desta venda).</span>
              </label>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Coluna Principal */}
            <div className="lg:col-span-7 space-y-6">

              
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
                        <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wider leading-tight">Custos Internos & Prestador</p>
                        <p className="text-[10px] text-amber-700/80 leading-tight">Não visíveis ao parceiro — deduzidos do líquido</p>
                      </div>
                    </div>
                    <Field label="Prestador (repasse)">
                      <Select
                        value={form.service_provider_id ?? "none"}
                        onValueChange={(v) => setForm({ ...form, service_provider_id: v === "none" ? null : v })}
                      >
                        <SelectTrigger className="h-11 bg-white border-amber-200 shadow-sm rounded-lg">
                          <SelectValue placeholder="Nenhum prestador" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="none">Nenhum prestador</SelectItem>
                          {providers?.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}{p.specialty ? ` · ${p.specialty}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Field label="Custo Zenon (impostos)">
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
                      <Field label="Repasse ao Prestador">
                        <div className="flex gap-1.5">
                          <div className="inline-flex rounded-lg border border-amber-200 bg-white p-0.5 shadow-sm">
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, provider_cost_mode: "fixed" })}
                              className={`px-2.5 h-10 text-xs font-bold rounded-md ${(form.provider_cost_mode ?? "fixed") === "fixed" ? "bg-amber-500 text-white" : "text-amber-700"}`}
                            >R$</button>
                            <button
                              type="button"
                              onClick={() => setForm({ ...form, provider_cost_mode: "percent" })}
                              className={`px-2.5 h-10 text-xs font-bold rounded-md ${form.provider_cost_mode === "percent" ? "bg-amber-500 text-white" : "text-amber-700"}`}
                            >%</button>
                          </div>
                          <div className="relative flex-1">
                            {(form.provider_cost_mode ?? "fixed") === "fixed" ? (
                              <>
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-600 font-bold text-xs">R$</span>
                                <Input
                                  type="number" step="0.01" min="0"
                                  className="h-11 pl-9 bg-white border-amber-200 shadow-sm focus:ring-amber-500 rounded-lg font-mono text-right tabular-nums"
                                  value={form.provider_cost ?? ""}
                                  onChange={(e) => setForm({ ...form, provider_cost: e.target.value, provider_cost_percent: null })}
                                  placeholder="0,00"
                                />
                              </>
                            ) : (
                              <>
                                <Input
                                  type="number" step="0.01" min="0" max="100"
                                  className="h-11 pr-9 bg-white border-amber-200 shadow-sm focus:ring-amber-500 rounded-lg font-mono text-right tabular-nums"
                                  value={form.provider_cost_percent ?? ""}
                                  onChange={(e) => {
                                    const pct = parseFloat(e.target.value) || 0;
                                    const calc = ((Number(form.amount) || 0) * pct) / 100;
                                    setForm({ ...form, provider_cost_percent: e.target.value, provider_cost: calc.toFixed(2) });
                                  }}
                                  placeholder="0,00"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-600 font-bold text-xs">%</span>
                              </>
                            )}
                          </div>
                        </div>
                        {form.provider_cost_mode === "percent" && Number(form.provider_cost) > 0 && (
                          <p className="text-[10px] text-amber-700 mt-1">Equivale a <strong className="font-mono">{fmt(Number(form.provider_cost))}</strong></p>
                        )}
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

                  {/* Prestador de Serviço (repasse fixo) */}
                  <div className="bg-slate-100/50 p-4 rounded-2xl space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Field label="Prestador de Serviço" className="md:col-span-2">
                        <Select
                          value={form.service_provider_id ?? "none"}
                          onValueChange={(v) => setForm({ ...form, service_provider_id: v === "none" ? null : v })}
                        >
                          <SelectTrigger className="h-11 bg-white border-slate-200 shadow-sm rounded-lg">
                            <SelectValue placeholder="Nenhum prestador" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="none">Nenhum prestador</SelectItem>
                            {providers?.map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}{p.specialty ? ` · ${p.specialty}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="R$ Repasse">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">R$</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-11 pl-9 bg-white border-slate-200 shadow-sm rounded-lg font-mono text-right tabular-nums"
                            value={form.provider_cost ?? ""}
                            onChange={(e) => setForm({ ...form, provider_cost: e.target.value })}
                            placeholder="0,00"
                          />
                        </div>
                      </Field>
                    </div>
                    <p className="text-[10.5px] text-slate-500 leading-snug">
                      Valor fixo em R$ (não é %). Também aparece em "Custos Internos & Prestador" — os dois campos ficam sincronizados.
                    </p>
                  </div>

                </div>
              </Section>
            </div>

            {/* Sidebar de Informações Adicionais */}
            <div className="lg:col-span-5 space-y-6">




              <Section icon={Calendar} title="Agendamento & Status">
                <div className="space-y-5">
                  <Field label="Data da Venda">
                    <Input type="date" className="h-11 bg-white border-slate-200 shadow-sm rounded-xl" value={form.sale_date} onChange={(e) => setForm({ ...form, sale_date: e.target.value })} />
                  </Field>
                  <StageForClientField clientId={form.client_id} />
                  <Field label="Situação da Venda">
                    {form.status !== "concluida" ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-2">
                        <p className="text-[11px] font-medium leading-snug text-amber-800">
                          Enquanto estiver em negociação, esta venda fica <b>fora</b> do fluxo financeiro, comissões, metas de receita e cronograma de cobrança.
                        </p>
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, status: "concluida" })}
                          className="w-full h-9 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold uppercase tracking-wider transition-colors inline-flex items-center justify-center gap-1.5"
                        >
                          ✓ Finalizar venda agora
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold leading-snug text-emerald-800">
                          ✓ Venda finalizada — parcelas, comissões e cronograma serão gerados ao salvar.
                        </p>
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, status: "pendente" })}
                          className="text-[10px] font-bold uppercase text-emerald-700 hover:text-emerald-900 underline"
                        >
                          reverter
                        </button>
                      </div>
                    )}
                  </Field>
                </div>
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
        <DialogFooter className="px-6 sm:px-8 py-4 bg-white border-t border-slate-200/70 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting} className="rounded-lg px-5 h-10 font-semibold text-slate-600 hover:bg-slate-100">
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={submitting}
            className="rounded-lg px-6 h-10 font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2"
          >
            {submitting ? "Processando..." : (
              <>
                <CircleDollarSign className="size-4" />
                {form.id ? "Salvar alterações" : "Registrar venda"}
              </>
            )}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}

