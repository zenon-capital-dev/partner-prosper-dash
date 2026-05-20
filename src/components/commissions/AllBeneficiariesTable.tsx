import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

const TYPE_LABEL: Record<string, { label: string; cls: string }> = {
  partner: { label: "Parceiro", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  referrer: { label: "Indicador", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  collaborator: { label: "Colaborador", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  pago: { label: "Pago", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelado: { label: "Cancelado", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

export function AllBeneficiariesTable() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["commission-splits-unified"],
    queryFn: async () => {
      const { data } = await supabase
        .from("v_commissions_unified" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      return (data as any[]) ?? [];
    },
  });

  return (
    <div className="vx-card overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200/70 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">Comissões por beneficiário</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Visão unificada de parceiros, indicadores e colaboradores (gerada automaticamente em cada venda).
          </p>
        </div>
        <Badge variant="secondary" className="vx-mono">{data.length}</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/60">
            <tr className="text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 text-left font-semibold">Tipo</th>
              <th className="px-4 py-3 text-left font-semibold">Beneficiário</th>
              <th className="px-4 py-3 text-left font-semibold">Cliente / Produto</th>
              <th className="px-4 py-3 text-right font-semibold">Base</th>
              <th className="px-4 py-3 text-right font-semibold">%</th>
              <th className="px-4 py-3 text-right font-semibold">Comissão</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">Pago em</th>
              <th className="px-4 py-3 text-left font-semibold">Venda</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70">
            {isLoading && (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">Carregando…</td></tr>
            )}
            {!isLoading && data.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">Nenhuma comissão registrada.</td></tr>
            )}
            {data.map((r: any) => {
              const t = TYPE_LABEL[r.beneficiary_type] ?? { label: r.beneficiary_type, cls: "" };
              const s = STATUS_LABEL[r.status] ?? { label: r.status, cls: "bg-slate-100 text-slate-600" };
              return (
                <tr key={r.id} className="hover:bg-slate-50/40">
                  <td className="px-4 py-3"><Badge variant="outline" className={t.cls}>{t.label}</Badge></td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.beneficiary_name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700">
                    <div>{r.client_name ?? "—"}</div>
                    <div className="text-xs text-slate-500">{r.product_name ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-right vx-mono">{formatBRL(Number(r.sale_amount ?? 0))}</td>
                  <td className="px-4 py-3 text-right vx-mono">{Number(r.percent ?? 0).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right vx-mono font-semibold">{formatBRL(Number(r.amount ?? 0))}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className={s.cls}>{s.label}</Badge></td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.paid_at ? formatDate(r.paid_at) : "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.sale_date ? formatDate(r.sale_date) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
