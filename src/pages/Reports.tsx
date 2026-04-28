import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { formatBRL, formatDate } from "@/lib/format";
import { exportToPDF, exportToExcel } from "@/lib/exports";
import { FileDown, FileSpreadsheet, TrendingUp, Users, DollarSign, Award } from "lucide-react";

export default function Reports() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [reportType, setReportType] = useState("sales");

  const { data: sales } = useQuery({
    queryKey: ["report-sales", from, to],
    queryFn: async () => (await supabase.from("sales")
      .select("sale_date, amount, status, clients(full_name), products(name, product_categories(name, color)), partners(full_name)")
      .gte("sale_date", from).lte("sale_date", to)
      .order("sale_date", { ascending: false })).data ?? [],
  });

  const { data: commissions } = useQuery({
    queryKey: ["report-comm", from, to],
    queryFn: async () => (await supabase.from("commissions")
      .select("amount, status, created_at, partners(full_name), sales(amount, products(name))")
      .gte("created_at", from).lte("created_at", to + "T23:59:59")).data ?? [],
  });

  const byCategory = useMemo(() => {
    const m = new Map<string, { name: string; total: number; color: string }>();
    (sales ?? []).forEach((s: any) => {
      const cat = s.products?.product_categories;
      if (!cat) return;
      const cur = m.get(cat.name) ?? { name: cat.name, total: 0, color: cat.color };
      cur.total += Number(s.amount);
      m.set(cat.name, cur);
    });
    return Array.from(m.values());
  }, [sales]);

  const byPartner = useMemo(() => {
    const m = new Map<string, { name: string; total: number }>();
    (commissions ?? []).forEach((c: any) => {
      if (!c.partners) return;
      const cur = m.get(c.partners.full_name) ?? { name: c.partners.full_name, total: 0 };
      cur.total += Number(c.amount);
      m.set(c.partners.full_name, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [commissions]);

  const totalRevenue = (sales ?? []).reduce((s, x: any) => s + Number(x.amount), 0);
  const totalCommissions = (commissions ?? []).reduce((s, x: any) => s + Number(x.amount), 0);
  const avgTicket = sales?.length ? totalRevenue / sales.length : 0;

  const exportSalesPDF = () => {
    const rows = (sales ?? []).map((s: any) => ({
      data: formatDate(s.sale_date),
      cliente: s.clients?.full_name ?? "—",
      produto: s.products?.name ?? "—",
      categoria: s.products?.product_categories?.name ?? "—",
      parceiro: s.partners?.full_name ?? "—",
      valor: formatBRL(s.amount),
      status: s.status,
    }));
    exportToPDF({
      title: "Relatório de Vendas",
      subtitle: `Período: ${formatDate(from)} a ${formatDate(to)}`,
      columns: [
        { header: "Data", dataKey: "data" },
        { header: "Cliente", dataKey: "cliente" },
        { header: "Produto", dataKey: "produto" },
        { header: "Categoria", dataKey: "categoria" },
        { header: "Parceiro", dataKey: "parceiro" },
        { header: "Valor", dataKey: "valor" },
        { header: "Status", dataKey: "status" },
      ],
      rows,
      totals: [
        { label: "Total de vendas", value: String(rows.length) },
        { label: "Faturamento total", value: formatBRL(totalRevenue) },
        { label: "Ticket médio", value: formatBRL(avgTicket) },
      ],
      filename: `relatorio-vendas-${from}-a-${to}.pdf`,
    });
  };

  const exportSalesExcel = () => {
    const rows = (sales ?? []).map((s: any) => ({
      data: formatDate(s.sale_date),
      cliente: s.clients?.full_name ?? "",
      produto: s.products?.name ?? "",
      categoria: s.products?.product_categories?.name ?? "",
      parceiro: s.partners?.full_name ?? "",
      valor: Number(s.amount),
      status: s.status,
    }));
    exportToExcel({
      sheetName: "Vendas",
      title: `Relatório de Vendas — ${formatDate(from)} a ${formatDate(to)}`,
      columns: [
        { header: "Data", dataKey: "data", width: 12 },
        { header: "Cliente", dataKey: "cliente", width: 28 },
        { header: "Produto", dataKey: "produto", width: 24 },
        { header: "Categoria", dataKey: "categoria", width: 16 },
        { header: "Parceiro", dataKey: "parceiro", width: 22 },
        { header: "Valor (R$)", dataKey: "valor", width: 14 },
        { header: "Status", dataKey: "status", width: 14 },
      ],
      rows,
      filename: `relatorio-vendas-${from}-a-${to}.xlsx`,
    });
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in">
      <PageHeader title="Relatórios" description="Análise consolidada e exportação para PDF / Excel." />

      <div className="vx-card p-5 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="space-y-2">
          <Label>De</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Até</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sales">Vendas</SelectItem>
              <SelectItem value="partners">Performance de parceiros</SelectItem>
              <SelectItem value="categories">Por categoria</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportSalesPDF} className="gap-2 flex-1 bg-gradient-primary hover:opacity-90"><FileDown className="size-4" /> PDF</Button>
          <Button onClick={exportSalesExcel} variant="outline" className="gap-2 flex-1"><FileSpreadsheet className="size-4" /> Excel</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Faturamento" value={formatBRL(totalRevenue)} icon={DollarSign} iconColor="primary" />
        <StatCard label="Vendas no período" value={String(sales?.length ?? 0)} icon={TrendingUp} iconColor="success" />
        <StatCard label="Ticket médio" value={formatBRL(avgTicket)} icon={Users} iconColor="info" />
        <StatCard label="Comissões geradas" value={formatBRL(totalCommissions)} icon={Award} iconColor="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="vx-card p-6">
          <p className="text-sm font-semibold mb-6">Faturamento por categoria</p>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={byCategory}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                  {byCategory.map((c, i) => <Cell key={i} fill={c.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="vx-card p-6">
          <p className="text-sm font-semibold mb-6">Ranking de parceiros (comissão)</p>
          <div className="space-y-3">
            {byPartner.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-12">Sem comissões no período</p>
            ) : byPartner.slice(0, 8).map((p, i) => {
              const max = byPartner[0].total;
              const pct = max ? (p.total / max) * 100 : 0;
              return (
                <div key={p.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium flex items-center gap-2">
                      <span className="size-5 rounded bg-muted text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                      {p.name}
                    </span>
                    <span className="vx-mono font-semibold">{formatBRL(p.total)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-gradient-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
