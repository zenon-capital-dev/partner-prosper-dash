import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { SaleFormDialog } from "@/components/sales/SaleFormDialog";
import { useNavigate } from "react-router-dom";

export default function Sales() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: sales } = useQuery({
    queryKey: ["sales-list"],
    queryFn: async () => (await supabase.from("sales").select("*, clients(id, full_name), products(name, product_categories(name, color)), partners(full_name)").order("sale_date", { ascending: false })).data ?? [],
  });

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in">
      <PageHeader title="Vendas" description="Histórico completo de vendas registradas."
        actions={<Button onClick={() => setOpen(true)} className="gap-2 bg-gradient-primary hover:opacity-90"><Plus className="size-4" /> Nova Venda</Button>} />

      <div className="vx-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 text-left font-semibold">Data</th>
                <th className="px-6 py-3 text-left font-semibold">Cliente</th>
                <th className="px-6 py-3 text-left font-semibold">Produto</th>
                <th className="px-6 py-3 text-left font-semibold">Parceiro</th>
                <th className="px-6 py-3 text-left font-semibold">Valor</th>
                <th className="px-6 py-3 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(sales ?? []).length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-16 text-center text-muted-foreground text-sm">Nenhuma venda registrada</td></tr>
              ) : sales?.map((s: any) => (
                <tr key={s.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => s.clients && navigate(`/clientes/${s.clients.id}`)}>
                  <td className="px-6 py-4 text-xs text-muted-foreground">{formatDate(s.sale_date)}</td>
                  <td className="px-6 py-4 font-medium">{s.clients?.full_name ?? "—"}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase" style={{ background: `${s.products?.product_categories?.color}20`, color: s.products?.product_categories?.color }}>
                        {s.products?.product_categories?.name}
                      </span>
                      <span>{s.products?.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{s.partners?.full_name ?? "—"}</td>
                  <td className="px-6 py-4 vx-mono font-semibold">{formatBRL(s.amount)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold ${
                      s.status === "concluida" ? "bg-success-muted text-success" :
                      s.status === "em_andamento" ? "bg-info-muted text-info" :
                      s.status === "cancelada" ? "bg-destructive-muted text-destructive" :
                      "bg-warning-muted text-warning"
                    }`}>{s.status.replace("_", " ")}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SaleFormDialog open={open} onOpenChange={setOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["sales-list"] })} />
    </div>
  );
}
