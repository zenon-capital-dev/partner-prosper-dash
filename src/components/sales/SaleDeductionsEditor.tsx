import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { deductionAmount, deductionTotals, partnerBase, type DeductionModel, type DeductionRow, type DeductionType } from "@/lib/deductions";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  gross: number;
  rows: DeductionRow[];
  types: DeductionType[];
  model: DeductionModel;
  onChange: (rows: DeductionRow[]) => void;
}

/**
 * Cascata de deduções da venda: bruto, cada dedução, base de cálculo.
 * Uso interno do admin. Nada disto chega ao parceiro ou ao prestador.
 */
export function SaleDeductionsEditor({ gross, rows, types, model, onChange }: Props) {
  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const unused = useMemo(
    () => types.filter((t) => t.active && !rows.some((r) => r.deduction_type_id === t.id)),
    [types, rows],
  );
  const totals = deductionTotals(rows, types, gross);
  const base = partnerBase(gross, totals.zenonCost, totals.providerCost, model);
  const basePct = gross > 0 ? (base / gross) * 100 : 0;

  const update = (i: number, patch: Partial<DeductionRow>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const add = (typeId: string) => {
    const t = typeById.get(typeId);
    if (!t) return;
    const fixed = t.default_percent == null && t.default_fixed_amount != null;
    onChange([
      ...rows,
      {
        deduction_type_id: t.id,
        mode: fixed ? "fixed" : "percent",
        percent: fixed ? null : Number(t.default_percent ?? 0),
        fixed_amount: fixed ? Number(t.default_fixed_amount) : null,
      },
    ]);
  };

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-amber-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 text-[12px] border-b border-amber-100">
          <span className="text-slate-600">Receita bruta</span>
          <span className="font-mono tabular-nums font-semibold text-slate-900">{fmt(gross)}</span>
        </div>

        {rows.length === 0 && (
          <p className="px-3 py-3 text-[11.5px] text-slate-500">Nenhuma dedução. Adicione abaixo ou cadastre o padrão do produto em Configurações › Deduções.</p>
        )}

        {rows.map((r, i) => {
          const t = typeById.get(r.deduction_type_id);
          const amt = deductionAmount(r, gross);
          return (
            <div key={r.deduction_type_id} className="flex items-center gap-2 px-3 py-1.5 border-b border-amber-50">
              <span className="flex-1 min-w-0 truncate text-[12.5px] text-slate-800">{t?.name ?? "Dedução"}</span>
              <div className="inline-flex rounded-md border border-amber-200 p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => update(i, { mode: "percent", percent: r.percent ?? (gross > 0 ? Number(((amt / gross) * 100).toFixed(4)) : 0), fixed_amount: null })}
                  className={`px-2 h-7 text-[11px] font-bold rounded ${r.mode === "percent" ? "bg-amber-500 text-white" : "text-amber-700"}`}
                >%</button>
                <button
                  type="button"
                  onClick={() => update(i, { mode: "fixed", fixed_amount: r.fixed_amount ?? amt, percent: null })}
                  className={`px-2 h-7 text-[11px] font-bold rounded ${r.mode === "fixed" ? "bg-amber-500 text-white" : "text-amber-700"}`}
                >R$</button>
              </div>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={r.mode === "percent" ? 100 : undefined}
                aria-label={r.mode === "percent" ? `${t?.name} em %` : `${t?.name} em R$`}
                className="h-8 w-24 text-right font-mono tabular-nums text-[12.5px] border-amber-200"
                value={r.mode === "percent" ? (r.percent ?? "") : (r.fixed_amount ?? "")}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  update(i, r.mode === "percent" ? { percent: v } : { fixed_amount: v });
                }}
              />
              <span className="w-28 text-right font-mono tabular-nums text-[12.5px] text-rose-700 shrink-0">− {fmt(amt)}</span>
              <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => remove(i)} aria-label={`Remover ${t?.name}`}>
                <X className="size-3.5" />
              </Button>
            </div>
          );
        })}

        <div className="flex items-center justify-between px-3 py-2 text-[12px] border-t border-amber-100 bg-amber-50/40">
          <span className="text-slate-600">Total de deduções</span>
          <span className="font-mono tabular-nums text-rose-700">− {fmt(totals.total)}</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2.5 border-t border-amber-200">
          <span className="text-[12.5px] font-bold text-slate-900">Base de cálculo do parceiro</span>
          <span className="font-mono tabular-nums font-bold text-slate-900">
            {fmt(base)} <span className="text-[11px] font-medium text-slate-500">({basePct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)</span>
          </span>
        </div>
      </div>

      {unused.length > 0 && (
        <Select value="" onValueChange={add}>
          <SelectTrigger className="h-9 bg-white border-dashed border-amber-300 text-amber-800 text-[12px] rounded-lg">
            <span className="inline-flex items-center gap-1.5"><Plus className="size-3.5" /><SelectValue placeholder="Adicionar dedução" /></span>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {unused.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}{t.default_percent != null ? ` · ${t.default_percent}%` : t.default_fixed_amount != null ? ` · ${fmt(Number(t.default_fixed_amount))}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {model === "legado" && (
        <p className="text-[10.5px] text-amber-800 leading-snug">
          Venda anterior à cascata: a base do parceiro desconta só os custos que não são de prestador, como foi fechada.
        </p>
      )}
    </div>
  );
}
