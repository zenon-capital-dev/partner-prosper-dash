import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { nowBR, formatBR, toBR, isTodayBR } from "@/lib/datetime";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, PieChart, Pie, LineChart, Line, AreaChart, Area, Legend } from "recharts";
import { formatBRL, formatDate } from "@/lib/format";
import { exportToPDF, exportToExcel } from "@/lib/exports";
import { FileDown, FileSpreadsheet, TrendingUp, Users, DollarSign, Award, Clock, FileText, CheckCircle2, Search as SearchIcon, Activity, Target, AlertTriangle, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PaginationControl } from "@/components/ui/PaginationControl";

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

const REPORT_QUERY_LIMIT = 300;
const DETAIL_PAGE_SIZE = 10;

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
    const d = nowBR(); d.setMonth(d.getMonth() - 1);
    return formatBR(d, "yyyy-MM-dd");
  });
  const [to, setTo] = useState(() => formatBR(nowBR(), "yyyy-MM-dd"));
  const [reportType, setReportType] = useState<ReportType>("revenue_period");
  
  // Filters
  const [filterProduct, setFilterProduct] = useState("all");
  const [filterProvider, setFilterProvider] = useState("all");
  const [filterPartner, setFilterPartner] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [from, to, reportType, filterProduct, filterProvider, filterPartner, filterStatus, filterClient]);

  const needsSales = ["revenue_period", "revenue_product", "best_selling", "clients_product"].includes(reportType);
  const needsDemands = ["demands_status", "delayed_demands", "provider_performance", "avg_completion_time"].includes(reportType);
  const needsCommissions = reportType === "commissions_partner";
  const needsClients = ["clients_status", "clients_partner", "clients_product"].includes(reportType);
  const needsDocs = reportType === "pending_docs";
  const needsPayments = reportType === "delinquency";

  // Reference data for filters
  const { data: products = [] } = useQuery({
    queryKey: ["reports-filter-products"],
    queryFn: async () => (await supabase.from("products").select("id, name").order("name").limit(500)).data ?? [],
  });
  const { data: providers = [] } = useQuery({
    queryKey: ["reports-filter-providers"],
    queryFn: async () => (await supabase.from("service_providers").select("id, name").order("name").limit(500)).data ?? [],
  });
  const { data: partners = [] } = useQuery({
    queryKey: ["reports-filter-partners"],
    queryFn: async () => (await supabase.from("partners").select("id, full_name").order("full_name").limit(500)).data ?? [],
  });
  const { data: clientsList = [] } = useQuery({
    queryKey: ["reports-filter-clients"],
    queryFn: async () => (await supabase.from("clients").select("id, full_name").order("full_name").limit(500)).data ?? [],
  });

  // Base Data Fetching
  const { data: sales = [] } = useQuery({
    queryKey: ["report-data-sales", from, to, filterProduct, filterPartner, filterClient, filterStatus],
    queryFn: async () => {
      let q = supabase.from("sales")
        .select("*, clients(full_name), products(name), partners(full_name)")
        .gte("sale_date", from).lte("sale_date", to);
      if (filterProduct !== "all") q = q.eq("product_id", filterProduct);
      if (filterPartner !== "all") q = q.eq("partner_id", filterPartner);
      if (filterClient !== "all") q = q.eq("client_id", filterClient);
      if (filterStatus !== "all") q = q.eq("status", filterStatus as any);
      return (await q.limit(REPORT_QUERY_LIMIT)).data ?? [];
    },
    enabled: needsSales,
    staleTime: 60_000,
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
      return (await q.limit(REPORT_QUERY_LIMIT)).data ?? [];
    },
    enabled: needsDemands,
    staleTime: 60_000,
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ["report-data-commissions", from, to, filterPartner, filterStatus],
    queryFn: async () => {
      let q = supabase.from("commissions")
        .select("*, partners(full_name)")
        .gte("created_at", from).lte("created_at", to + "T23:59:59");
      if (filterPartner !== "all") q = q.eq("partner_id", filterPartner);
      if (filterStatus !== "all") q = q.eq("status", filterStatus as any);
      return (await q.limit(REPORT_QUERY_LIMIT)).data ?? [];
    },
    enabled: needsCommissions,
    staleTime: 60_000,
  });

  const { data: clientsData = [] } = useQuery({
    queryKey: ["report-data-clients", from, to, filterPartner, filterStatus],
    queryFn: async () => {
      let q = supabase.from("clients")
        .select("*, partners(full_name)")
        .gte("created_at", from).lte("created_at", to + "T23:59:59");
      if (filterPartner !== "all") q = q.eq("partner_id", filterPartner);
      if (filterStatus !== "all") q = q.eq("status", filterStatus as any);
      return (await q.limit(REPORT_QUERY_LIMIT)).data ?? [];
    },
    enabled: needsClients,
    staleTime: 60_000,
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["report-data-docs", from, to, filterClient, filterStatus],
    queryFn: async () => {
      let q = supabase.from("documents")
        .select("*, clients(full_name)")
        .gte("created_at", from).lte("created_at", to + "T23:59:59");
      if (filterClient !== "all") q = q.eq("client_id", filterClient);
      if (filterStatus !== "all") q = q.eq("status", filterStatus as any);
      return (await q.limit(REPORT_QUERY_LIMIT)).data ?? [];
    },
    enabled: needsDocs,
    staleTime: 60_000,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["report-data-payments", from, to, filterStatus],
    queryFn: async () => {
      let q = supabase.from("payments")
        .select("*, clients(full_name), products(name)")
        .gte("due_date", from).lte("due_date", to);
      if (filterStatus !== "all") q = q.eq("status", filterStatus as any);
      return (await q.limit(REPORT_QUERY_LIMIT)).data ?? [];
    },
    enabled: needsPayments,
    staleTime: 60_000,
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
        const now = nowBR();
        const delayed = clientProducts.filter(p => p.deadline && toBR(p.deadline) < now && !isTodayBR(p.deadline) && p.status !== 'concluido' && p.status !== 'cancelado');
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
        const now = nowBR();
        const unpaid = payments.filter(p => p.status === 'vencido' || (p.status === 'pendente' && toBR(p.due_date) < now && !isTodayBR(p.due_date)));
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

  const detailRows = (reportConfig?.rows ?? []) as any[];
  const totalDetailPages = Math.max(1, Math.ceil(detailRows.length / DETAIL_PAGE_SIZE));
  const paginatedDetailRows = detailRows.slice((currentPage - 1) * DETAIL_PAGE_SIZE, currentPage * DETAIL_PAGE_SIZE);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  // Painel executivo agregado (independente do tipo de relatório)
  const execKpis = useMemo(() => {
    const totalRevenue = sales.reduce((s, x) => s + Number(x.amount || 0), 0);
    const totalDeals = sales.length;
    const avgTicket = totalDeals > 0 ? totalRevenue / totalDeals : 0;
    const newClients = clientsData.length;
    const completedDemands = clientProducts.filter((p: any) => p.status === "concluido").length;
    const openDemands = clientProducts.filter((p: any) => p.status !== "concluido" && p.status !== "cancelado").length;
    const conversion = newClients > 0 ? Math.round((totalDeals / newClients) * 100) : 0;
    const overdue = payments.filter((p: any) => p.status === "vencido" || (p.status === "pendente" && toBR(p.due_date) < nowBR() && !isTodayBR(p.due_date)));
    const overdueAmount = overdue.reduce((s, p: any) => s + Number(p.amount || 0), 0);
    const commissionsTotal = commissions.reduce((s, c: any) => s + Number(c.amount || 0), 0);
    return { totalRevenue, totalDeals, avgTicket, newClients, completedDemands, openDemands, conversion, overdueAmount, commissionsTotal };
  }, [sales, clientsData, clientProducts, payments, commissions]);

  // Tendência diária de receita
  const revenueTrend = useMemo(() => {
    const map: Record<string, { date: string; receita: number; vendas: number }> = {};
    sales.forEach((s: any) => {
      const k = s.sale_date;
      if (!k) return;
      (map[k] ||= { date: formatDate(k), receita: 0, vendas: 0 });
      map[k].receita += Number(s.amount || 0);
      map[k].vendas += 1;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [sales]);

  // Top 5 produtos por receita
  const topProducts = useMemo(() => {
    const map: Record<string, number> = {};
    sales.forEach((s: any) => {
      const n = s.products?.name || "Outros";
      map[n] = (map[n] || 0) + Number(s.amount || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [sales]);

  // Produtos mais vendidos (quantidade de vendas)
  const topByQuantity = useMemo(() => {
    const map: Record<string, number> = {};
    sales.forEach((s: any) => {
      const n = s.products?.name || "Outros";
      map[n] = (map[n] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [sales]);

  // Produtos com maior adesão (clientes únicos)
  const topByAdoption = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    clientProducts.forEach((p: any) => {
      const n = p.products?.name || "Outros";
      const cid = p.client_id;
      if (!cid) return;
      (map[n] ||= new Set()).add(cid);
    });
    return Object.entries(map)
      .map(([name, set]) => ({ name, value: set.size }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [clientProducts]);

  // Produtos com maior conversão efetiva (concluído / total demandas)
  const topByConversion = useMemo(() => {
    const map: Record<string, { total: number; concl: number }> = {};
    const concludedStatuses = new Set(["concluido", "concluída", "concluida", "finalizado", "entregue", "fechado"]);
    clientProducts.forEach((p: any) => {
      const n = p.products?.name || "Outros";
      (map[n] ||= { total: 0, concl: 0 });
      map[n].total += 1;
      if (concludedStatuses.has(String(p.status ?? "").toLowerCase())) map[n].concl += 1;
    });
    return Object.entries(map)
      .filter(([, v]) => v.total >= 1)
      .map(([name, v]) => ({ name, value: v.total === 0 ? 0 : Math.round((v.concl / v.total) * 1000) / 10, concl: v.concl, total: v.total }))
      .sort((a, b) => b.value - a.value || b.total - a.total)
      .slice(0, 5);
  }, [clientProducts]);

  // Demandas por status
  const demandsByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    clientProducts.forEach((p: any) => {
      const s = p.status || "indefinido";
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [clientProducts]);

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in bg-premium min-h-dvh space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-px w-8 bg-primary/40" />
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Intelligence Hub</p>
          </div>
          <h1 className="font-editorial text-5xl lg:text-7xl font-bold tracking-tighter text-slate-900 leading-[0.9]">
            Relatórios <span className="text-primary italic font-medium">Empresariais</span>.
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl pt-2">
            Painel executivo do período + relatórios detalhados com filtros, gráficos e exportação em PDF/Excel.
          </p>
        </div>
      </div>

      {/* Painel executivo — KPIs do período */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Receita", value: formatBRL(execKpis.totalRevenue), icon: DollarSign, tone: "from-emerald-500/15 text-emerald-600" },
          { label: "Vendas", value: execKpis.totalDeals, icon: Receipt, tone: "from-indigo-500/15 text-indigo-600" },
          { label: "Ticket Médio", value: formatBRL(execKpis.avgTicket), icon: TrendingUp, tone: "from-indigo-500/15 text-indigo-600" },
          { label: "Novos Clientes", value: execKpis.newClients, icon: Users, tone: "from-sky-500/15 text-sky-600" },
          { label: "Conversão", value: `${execKpis.conversion}%`, icon: Target, tone: "from-amber-500/15 text-amber-600" },
          { label: "Inadimplência", value: formatBRL(execKpis.overdueAmount), icon: AlertTriangle, tone: "from-rose-500/15 text-rose-600" },
        ].map((k) => (
          <div key={k.label} className="vx-card p-4 rounded-2xl bg-white border border-slate-100">
            <div className={`size-9 rounded-xl bg-gradient-to-br ${k.tone} flex items-center justify-center mb-2`}>
              <k.icon className="size-4" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{k.label}</p>
            <p className="font-display text-xl font-black tabular-nums text-slate-900">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Mini-painel de tendência + mix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 vx-card p-6 rounded-[24px] bg-white border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-editorial text-lg font-bold">Receita no Período</h3>
              <p className="text-xs text-muted-foreground">Evolução diária baseada nos filtros selecionados</p>
            </div>
            <Badge variant="outline" className="rounded-full">{revenueTrend.length} dias</Badge>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "none" }} formatter={(v: any) => formatBRL(Number(v))} />
                <Area type="monotone" dataKey="receita" stroke="#6366f1" strokeWidth={2} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="vx-card p-6 rounded-[24px] bg-white border border-slate-100">
          <h3 className="font-editorial text-lg font-bold mb-1">Mix de Demandas</h3>
          <p className="text-xs text-muted-foreground mb-3">Status atual</p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={demandsByStatus} cx="50%" cy="50%" innerRadius={48} outerRadius={80} paddingAngle={3} dataKey="value">
                  {demandsByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "none" }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top produtos */}
      <div className="vx-card p-6 rounded-[24px] bg-white border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-editorial text-lg font-bold">Top Produtos</h3>
            <p className="text-xs text-muted-foreground">Maiores receitas no período</p>
          </div>
          <Award className="size-5 text-amber-500" />
        </div>
        <div className="space-y-3">
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma venda no período.</p>
          ) : (
            topProducts.map((p, i) => {
              const max = topProducts[0].value || 1;
              const pct = (p.value / max) * 100;
              return (
                <div key={p.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="flex items-center gap-2">
                      <span className="size-5 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black">{i + 1}</span>
                      {p.name}
                    </span>
                    <span className="tabular-nums">{formatBRL(p.value)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-indigo-600" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Análise de produtos: quantidade, adesão, conversão */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[
          { title: "Mais Vendidos", subtitle: "Quantidade de vendas no período", data: topByQuantity, fmt: (v: number) => `${v} venda${v === 1 ? "" : "s"}`, accent: "from-indigo-500 to-indigo-600", empty: "Sem vendas no período." },
          { title: "Maior Adesão", subtitle: "Clientes únicos que aderiram", data: topByAdoption, fmt: (v: number) => `${v} cliente${v === 1 ? "" : "s"}`, accent: "from-emerald-500 to-emerald-600", empty: "Sem demandas no período." },
          { title: "Maior Conversão", subtitle: "% de demandas concluídas", data: topByConversion, fmt: (v: number, extra?: any) => `${v.toFixed(1)}% (${extra?.concl ?? 0}/${extra?.total ?? 0})`, accent: "from-amber-500 to-amber-600", empty: "Sem demandas no período." },
        ].map((card) => {
          const max = card.data[0]?.value || 1;
          return (
            <div key={card.title} className="vx-card p-6 rounded-[24px] bg-white border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-editorial text-lg font-bold">{card.title}</h3>
                  <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                </div>
                <Award className="size-5 text-slate-300" />
              </div>
              <div className="space-y-3">
                {card.data.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">{card.empty}</p>
                ) : (
                  card.data.map((p: any, i: number) => {
                    const pct = max === 0 ? 0 : (p.value / max) * 100;
                    return (
                      <div key={p.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold gap-2">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="size-5 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black shrink-0">{i + 1}</span>
                            <span className="truncate">{p.name}</span>
                          </span>
                          <span className="tabular-nums whitespace-nowrap text-slate-700">{card.fmt(p.value, p)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full bg-gradient-to-r ${card.accent}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>




      {/* FILTERS */}
      <div className="vx-card p-6 bg-white border border-slate-100 rounded-[32px] space-y-6">
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
          <div className="lg:col-span-2 vx-card p-8 bg-white border border-slate-100 rounded-[32px] space-y-6">
            <h3 className="font-editorial text-2xl font-bold text-slate-900">Visualização de Dados</h3>
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
      <div className="vx-card p-8 bg-white border border-slate-100 rounded-[32px]">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-editorial text-2xl font-bold text-slate-900">Registros Detalhados</h3>
          <Badge variant="outline" className="rounded-full px-4">{reportConfig?.rows.length ?? 0} registros encontrados</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                {reportConfig?.columns.map(c => (
                  <th key={c.dataKey} className="pb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedDetailRows.map((r: any, i) => (
                <tr key={i} className="group border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  {reportConfig?.columns.map(c => (
                    <td key={c.dataKey} className="py-4 text-sm text-slate-600">
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
        <PaginationControl currentPage={currentPage} totalPages={totalDetailPages} onPageChange={setCurrentPage} totalItems={detailRows.length} itemsPerPage={DETAIL_PAGE_SIZE} className="mt-4 rounded-2xl border border-slate-100" />
      </div>
    </div>
  );
}
