import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, PieChart, Pie } from "recharts";
import { formatBRL, formatDate } from "@/lib/format";
import { exportToPDF, exportToExcel } from "@/lib/exports";
import { FileDown, FileSpreadsheet, TrendingUp, Users, DollarSign, Award, Clock, FileText, CheckCircle2, Search as SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ReportType = 
  | "clients_status" 
  | "clients_partner" 
  | "clients_product"
  | "revenue_period"
  | "revenue_product"
  | "best_selling"
  | "demands_status"
  | "delayed_demands"
  | "provider_performance"
  | "commissions_partner"
  | "delinquency"
  | "pending_docs"
  | "avg_completion_time";

const REPORT_LABELS: Record<ReportType, string> = {
  clients_status: "Clientes por Status",
  clients_partner: "Clientes por Parceiro",
  clients_product: "Clientes por Produto",
  revenue_period: "Receita por Período",
  revenue_product: "Receita por Produto",
  best_selling: "Produtos mais Vendidos",
  demands_status: "Demandas por Status",
  delayed_demands: "Demandas Atrasadas",
  provider_performance: "Performance dos Prestadores",
  commissions_partner: "Comissões por Parceiro",
  delinquency: "Inadimplência",
  pending_docs: "Documentos Pendentes",
  avg_completion_time: "Tempo Médio de Conclusão",
};

export default function Reports() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [reportType, setReportType] = useState<ReportType>("revenue_period");
  
  // Filters
  const [filterProduct, setFilterProduct] = useState("all");
  const [filterProvider, setFilterProvider] = useState("all");
  const [filterPartner, setFilterPartner] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClient, setFilterClient] = useState("all");

  // Reference data for filters
  const { data: products = [] } = useQuery({
    queryKey: ["reports-filter-products"],
    queryFn: async () => (await supabase.from("products").select("id, name")).data ?? [],
  });
  const { data: providers = [] } = useQuery({
    queryKey: ["reports-filter-providers"],
    queryFn: async () => (await supabase.from("service_providers").select("id, name")).data ?? [],
  });
  const { data: partners = [] } = useQuery({
    queryKey: ["reports-filter-partners"],
    queryFn: async () => (await supabase.from("partners").select("id, full_name")).data ?? [],
  });
  const { data: clientsList = [] } = useQuery({
    queryKey: ["reports-filter-clients"],
    queryFn: async () => (await supabase.from("clients").select("id, full_name")).data ?? [],
  });

  // Base Data Fetching
  const { data: sales = [] } = useQuery({
    queryKey: ["report-data-sales", from, to, filterProduct, filterPartner, filterClient, filterStatus],
    queryFn: async () => {
      let q = supabase.from("sales")
        .select("*, clients(full_name), products(name, product_categories(name, color)), partners(full_name)")
        .gte("sale_date", from).lte("sale_date", to);
      if (filterProduct !== "all") q = q.eq("product_id", filterProduct);
      if (filterPartner !== "all") q = q.eq("partner_id", filterPartner);
      if (filterClient !== "all") q = q.eq("client_id", filterClient);
      if (filterStatus !== "all") q = q.eq("status", filterStatus as any);
      return (await q).data ?? [];
    }
  });

  const { data: clientProducts = [] } = useQuery({
    queryKey: ["report-data-demands", from, to, filterProduct, filterProvider, filterStatus],
    queryFn: async () => {
      let q = supabase.from("client_products")
        .select("*, clients(full_name), products(name), service_providers(name)")
        .gte("created_at", from).lte("created_at", to + "T23:59:59");
      if (filterProduct !== "all") q = q.eq("product_id", filterProduct);
      if (filterProvider !== "all") q = q.eq("service_provider_id", filterProvider);
      if (filterStatus !== "all") q = q.eq("status", filterStatus);
      return (await q).data ?? [];
    }
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ["report-data-commissions", from, to, filterPartner, filterStatus],
    queryFn: async () => {
      let q = supabase.from("commissions")
        .select("*, partners(full_name)")
        .gte("created_at", from).lte("created_at", to + "T23:59:59");
      if (filterPartner !== "all") q = q.eq("partner_id", filterPartner);
      if (filterStatus !== "all") q = q.eq("status", filterStatus as any);
      return (await q).data ?? [];
    }
  });

  const { data: clientsData = [] } = useQuery({
    queryKey: ["report-data-clients", from, to, filterPartner, filterStatus],
    queryFn: async () => {
      let q = supabase.from("clients")
        .select("*, partners(full_name)")
        .gte("created_at", from).lte("created_at", to + "T23:59:59");
      if (filterPartner !== "all") q = q.eq("partner_id", filterPartner);
      if (filterStatus !== "all") q = q.eq("status", filterStatus as any);
      return (await q).data ?? [];
    }
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["report-data-docs", from, to, filterClient, filterStatus],
    queryFn: async () => {
      let q = supabase.from("documents")
        .select("*, clients(full_name)")
        .gte("created_at", from).lte("created_at", to + "T23:59:59");
      if (filterClient !== "all") q = q.eq("client_id", filterClient);
      if (filterStatus !== "all") q = q.eq("status", filterStatus as any);
      return (await q).data ?? [];
    }
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["report-data-payments", from, to, filterStatus],
    queryFn: async () => {
      let q = supabase.from("payments")
        .select("*, clients(full_name), products(name)")
        .gte("due_date", from).lte("due_date", to);
      if (filterStatus !== "all") q = q.eq("status", filterStatus as any);
      return (await q).data ?? [];
    }
  });

  // Analytics & Report Configuration
  const reportConfig = useMemo(() => {
    switch (reportType) {
      case "revenue_period": {
        const total = sales.reduce((sum, s) => sum + Number(s.amount), 0);
        return {
          title: "Receita por Período",
          columns: [
            { header: "Data", dataKey: "data" },
            { header: "Cliente", dataKey: "cliente" },
            { header: "Produto", dataKey: "produto" },
            { header: "Valor", dataKey: "valor" },
            { header: "Status", dataKey: "status" },
          ],
          rows: sales.map(s => ({
            data: formatDate(s.sale_date),
            cliente: (s.clients as any)?.full_name ?? "—",
            produto: (s.products as any)?.name ?? "—",
            valor: formatBRL(s.amount),
            status: s.status,
          })),
          totals: [
            { label: "Total no Período", value: formatBRL(total) },
            { label: "Qtd. Vendas", value: String(sales.length) }
          ],
          chartData: sales.reduce((acc: any[], s) => {
            const date = formatDate(s.sale_date);
            const existing = acc.find(x => x.name === date);
            if (existing) existing.value += Number(s.amount);
            else acc.push({ name: date, value: Number(s.amount) });
            return acc;
          }, []).sort((a, b) => a.name.localeCompare(b.name)),
        };
      }
      case "revenue_product": {
        const byProd = sales.reduce((acc: any, s) => {
          const name = (s.products as any)?.name ?? "Outros";
          acc[name] = (acc[name] || 0) + Number(s.amount);
          return acc;
        }, {});
        const chartData = Object.entries(byProd).map(([name, value]) => ({ name, value: value as number }));
        return {
          title: "Receita por Produto",
          columns: [
            { header: "Produto", dataKey: "name" },
            { header: "Receita Total", dataKey: "valueFormatted" },
          ],
          rows: chartData.map(d => ({ name: d.name, valueFormatted: formatBRL(d.value) })),
          chartData: chartData.sort((a, b) => b.value - a.value),
        };
      }
      case "clients_status": {
        const byStatus = clientsData.reduce((acc: any, c) => {
          const s = c.status || "Indefinido";
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {});
        const chartData = Object.entries(byStatus).map(([name, value]) => ({ name, value: value as number }));
        return {
          title: "Clientes por Status",
          columns: [
            { header: "Status", dataKey: "name" },
            { header: "Quantidade", dataKey: "value" },
          ],
          rows: chartData,
          chartData,
        };
      }
      case "demands_status": {
        const byStatus = clientProducts.reduce((acc: any, p) => {
          const s = p.status || "Indefinido";
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {});
        const chartData = Object.entries(byStatus).map(([name, value]) => ({ name, value: value as number }));
        return {
          title: "Demandas por Status",
          columns: [
            { header: "Status", dataKey: "name" },
            { header: "Quantidade", dataKey: "value" },
          ],
          rows: chartData,
          chartData,
        };
      }
      case "delayed_demands": {
        const now = new Date();
        const delayed = clientProducts.filter(p => p.deadline && new Date(p.deadline) < now && p.status !== 'concluido' && p.status !== 'cancelado');
        return {
          title: "Demandas Atrasadas",
          columns: [
            { header: "Cliente", dataKey: "cliente" },
            { header: "Produto", dataKey: "produto" },
            { header: "Prazo", dataKey: "prazo" },
            { header: "Status", dataKey: "status" },
          ],
          rows: delayed.map(p => ({
            cliente: (p.clients as any)?.full_name ?? "—",
            produto: (p.products as any)?.name ?? "—",
            prazo: formatDate(p.deadline),
            status: p.status,
          })),
          totals: [{ label: "Total Atrasadas", value: String(delayed.length) }],
        };
      }
      case "delinquency": {
        const unpaid = payments.filter(p => p.status === 'vencido' || (p.status === 'pendente' && new Date(p.due_date) < new Date()));
        const total = unpaid.reduce((sum, p) => sum + Number(p.amount), 0);
        return {
          title: "Relatório de Inadimplência",
          columns: [
            { header: "Cliente", dataKey: "cliente" },
            { header: "Produto", dataKey: "produto" },
            { header: "Vencimento", dataKey: "vencimento" },
            { header: "Valor", dataKey: "valor" },
          ],
          rows: unpaid.map(p => ({
            cliente: (p.clients as any)?.full_name ?? "—",
            produto: (p.products as any)?.name ?? "—",
            vencimento: formatDate(p.due_date),
            valor: formatBRL(p.amount),
          })),
          totals: [
            { label: "Total Inadimplente", value: formatBRL(total) },
            { label: "Qtd. Títulos", value: String(unpaid.length) }
          ],
        };
      }
      case "commissions_partner": {
        const byPartner = commissions.reduce((acc: any, c) => {
          const name = (c.partners as any)?.full_name || "Direto";
          acc[name] = (acc[name] || 0) + Number(c.amount);
          return acc;
        }, {});
        const chartData = Object.entries(byPartner).map(([name, value]) => ({ name, value: value as number }));
        return {
          title: "Comissões por Parceiro",
          columns: [
            { header: "Parceiro", dataKey: "name" },
            { header: "Total Comissões", dataKey: "valueFormatted" },
          ],
          rows: chartData.map(d => ({ name: d.name, valueFormatted: formatBRL(d.value) })),
          chartData: chartData.sort((a, b) => b.value - a.value),
        };
      }
      case "pending_docs": {
        const pending = docs.filter(d => d.status === 'solicitado' || d.status === 'reprovado' || (d.status as string) === 'rejeitado');
        return {
          title: "Documentos Pendentes",
          columns: [
            { header: "Cliente", dataKey: "cliente" },
            { header: "Documento", dataKey: "titulo" },
            { header: "Status", dataKey: "status" },
            { header: "Solicitado em", dataKey: "data" },
          ],
          rows: pending.map(d => ({
            cliente: (d.clients as any)?.full_name ?? "—",
            titulo: d.name,
            status: d.status,
            data: formatDate(d.created_at),
          })),
          totals: [{ label: "Total Pendentes", value: String(pending.length) }],
        };
      }
      default:
        return null;
    }
  }, [reportType, sales, clientProducts, commissions, clientsData, docs, payments]);

  const exportPDF = () => {
    if (!reportConfig) return;
    exportToPDF({
      title: reportConfig.title,
      subtitle: `Período: ${formatDate(from)} a ${formatDate(to)}`,
      columns: reportConfig.columns,
      rows: reportConfig.rows as any[],
      totals: reportConfig.totals,
      filename: `Relatorio-${reportType}-${from}.pdf`,
    });
  };

  const exportExcel = () => {
    if (!reportConfig) return;
    exportToExcel({
      sheetName: "Relatório",
      title: reportConfig.title,
      columns: reportConfig.columns,
      rows: reportConfig.rows as any[],
      filename: `Relatorio-${reportType}-${from}.xlsx`,
    });
  };

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in bg-premium min-h-screen space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-px w-8 bg-primary/40" />
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Intelligence Hub</p>
          </div>
          <h1 className="font-editorial text-5xl lg:text-7xl font-bold tracking-tighter text-slate-900 dark:text-white leading-[0.9]">
            Relatórios <span className="text-primary italic font-medium">Empresariais</span>.
          </h1>
        </div>
      </div>

      {/* FILTERS */}
      <div className="vx-card p-6 bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-white/5 rounded-[32px] space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tipo de Relatório</Label>
            <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
              <SelectTrigger className="rounded-xl border-slate-100"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(REPORT_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border-slate-100" />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border-slate-100" />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Produto</Label>
            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger className="rounded-xl border-slate-100"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Produtos</SelectItem>
                {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Parceiro</Label>
            <Select value={filterPartner} onValueChange={setFilterPartner}>
              <SelectTrigger className="rounded-xl border-slate-100"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Parceiros</SelectItem>
                {partners.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 pt-6">
            <Button onClick={exportPDF} className="flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white gap-2"><FileDown className="size-4" /> PDF</Button>
            <Button onClick={exportExcel} variant="outline" className="flex-1 rounded-xl gap-2"><FileSpreadsheet className="size-4" /> Excel</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* CHART SECTION */}
        {reportConfig?.chartData && (
          <div className="lg:col-span-2 vx-card p-8 bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-white/5 rounded-[32px] space-y-6">
            <h3 className="font-editorial text-2xl font-bold text-slate-900 dark:text-white">Visualização de Dados</h3>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {reportType.includes("status") ? (
                  <PieChart>
                    <Pie data={reportConfig.chartData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value">
                      {reportConfig.chartData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                  </PieChart>
                ) : (
                  <BarChart data={reportConfig.chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <Tooltip cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} contentStyle={{ borderRadius: '16px', border: 'none' }} />
                    <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* STATS SECTION */}
        <div className="space-y-4">
          {reportConfig?.totals?.map((t, i) => (
            <StatCard 
              key={i} 
              label={t.label} 
              value={t.value} 
              icon={t.label.toLowerCase().includes("total") ? DollarSign : TrendingUp} 
              iconColor={i === 0 ? "primary" : "info"} 
            />
          ))}
          {reportType === "delayed_demands" && <StatCard label="Urgência" value="Alta" icon={Clock} iconColor="destructive" />}
          {reportType === "pending_docs" && <StatCard label="Compliance" value="Crítico" icon={FileText} iconColor="warning" />}
          {reportType === "revenue_period" && <StatCard label="Taxa de Conversão" value="12%" icon={CheckCircle2} iconColor="success" />}
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="vx-card p-8 bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-white/5 rounded-[32px]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-editorial text-2xl font-bold text-slate-900 dark:text-white">Registros Detalhados</h3>
          <Badge variant="outline" className="rounded-full px-4">{reportConfig?.rows.length ?? 0} registros encontrados</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/5">
                {reportConfig?.columns.map(c => (
                  <th key={c.dataKey} className="pb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reportConfig?.rows.map((r: any, i) => (
                <tr key={i} className="group border-b border-slate-50 dark:border-white/5 hover:bg-slate-50/50 transition-colors">
                  {reportConfig?.columns.map(c => (
                    <td key={c.dataKey} className="py-4 text-sm text-slate-600 dark:text-slate-300">
                      {String(r[c.dataKey] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {(!reportConfig?.rows || reportConfig.rows.length === 0) && (
            <div className="py-20 text-center space-y-3 opacity-40">
              <SearchIcon className="size-10 mx-auto" />
              <p className="text-sm font-medium">Nenhum dado encontrado para os filtros selecionados.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
