import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatBRL } from "@/lib/format";

export default function Reports() {
  const { data: byCategory } = useQuery({
    queryKey: ["report-cat"],
    queryFn: async () => {
      const { data } = await supabase.from("sales").select("amount, products(product_categories(name, color))");
      const map = new Map<string, { name: string; total: number; color: string }>();
      (data ?? []).forEach((s: any) => {
        const cat = s.products?.product_categories;
        if (!cat) return;
        const cur = map.get(cat.name) ?? { name: cat.name, total: 0, color: cat.color };
        cur.total += Number(s.amount);
        map.set(cat.name, cur);
      });
      return Array.from(map.values());
    },
  });

  const exportCSV = async () => {
    const { data } = await supabase.from("sales").select("sale_date, amount, status, clients(full_name), products(name), partners(full_name)").order("sale_date", { ascending: false });
    const rows = [["Data", "Cliente", "Produto", "Parceiro", "Valor", "Status"]];
    (data ?? []).forEach((s: any) => rows.push([s.sale_date, s.clients?.full_name ?? "", s.products?.name ?? "", s.partners?.full_name ?? "", String(s.amount), s.status]));
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `vendas-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in">
      <PageHeader title="Relatórios" description="Análise de vendas e exportação de dados."
        actions={<button onClick={exportCSV} className="px-4 h-9 rounded-lg bg-gradient-primary text-white text-sm font-medium hover:opacity-90">Exportar CSV de vendas</button>} />

      <div className="vx-card p-6">
        <p className="text-sm font-semibold mb-6">Faturamento por categoria</p>
        <div className="h-80">
          <ResponsiveContainer>
            <BarChart data={byCategory ?? []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                {(byCategory ?? []).map((c, i) => <rect key={i} fill={c.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
