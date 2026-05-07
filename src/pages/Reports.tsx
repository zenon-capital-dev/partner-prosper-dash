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

type ReportType = "sales" | "partners" | "products" | "leads" | "tasks" | "docs" | "team";

const REPORT_LABELS: Record<ReportType, string> = {
  sales: "Vendas",
  partners: "Parceiros e Comissões",
  products: "Produtos Vendidos",
  leads: "Origem de Leads",
  tasks: "Tarefas e Pendências",
  docs: "Documentos e Contratos",
  team: "Colaboradores e Prestadores",
};

export default function Reports() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [reportType, setReportType] = useState<ReportType>("sales");

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

  const { data: leads } = useQuery({
    queryKey: ["report-leads", from, to],
    queryFn: async () => (await supabase.from("leads")
      .select("full_name, source, status, created_at, email, phone")
      .gte("created_at", from).lte("created_at", to + "T23:59:59")).data ?? [],
  });

  const { data: tasks } = useQuery({
    queryKey: ["report-tasks", from, to],
    queryFn: async () => (await supabase.from("tasks")
      .select("title, status, priority, due_date, created_at, profiles!tasks_assigned_to_fkey(full_name)")
      .gte("created_at", from).lte("created_at", to + "T23:59:59")).data ?? [],
  });

  const { data: documents } = useQuery({
    queryKey: ["report-docs", from, to],
    queryFn: async () => (await supabase.from("documents")
      .select("title, file_name, status, created_at, clients(full_name)")
      .gte("created_at", from).lte("created_at", to + "T23:59:59")).data ?? [],
  });

  const { data: contracts } = useQuery({
    queryKey: ["report-contracts", from, to],
    queryFn: async () => (await supabase.from("contracts")
      .select("title, status, value, created_at, clients(full_name)")
      .gte("created_at", from).lte("created_at", to + "T23:59:59")).data ?? [],
  });

  const { data: collaborators } = useQuery({
    queryKey: ["report-collab"],
    queryFn: async () => (await supabase.from("collaborators")
      .select("full_name, role, email, status, created_at")).data ?? [],
    enabled: reportType === "team",
  });

  const { data: providers } = useQuery({
    queryKey: ["report-providers"],
    queryFn: async () => (await supabase.from("providers")
      .select("full_name, specialty, email, status, created_at")).data ?? [],
    enabled: reportType === "team",
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

  const byProduct = useMemo(() => {
    const m = new Map<string, { name: string; qty: number; total: number }>();
    (sales ?? []).forEach((s: any) => {
      const n = s.products?.name ?? "—";
      const cur = m.get(n) ?? { name: n, qty: 0, total: 0 };
      cur.qty += 1;
      cur.total += Number(s.amount);
      m.set(n, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [sales]);

  const bySource = useMemo(() => {
    const m = new Map<string, { name: string; qty: number }>();
    (leads ?? []).forEach((l: any) => {
      const n = l.source ?? "Outros";
      const cur = m.get(n) ?? { name: n, qty: 0 };
      cur.qty += 1;
      m.set(n, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.qty - a.qty);
  }, [leads]);

  const totalRevenue = (sales ?? []).reduce((s, x: any) => s + Number(x.amount), 0);
  const totalCommissions = (commissions ?? []).reduce((s, x: any) => s + Number(x.amount), 0);
  const avgTicket = sales?.length ? totalRevenue / sales.length : 0;

  // Build current report config
  const reportConfig = useMemo(() => {
    switch (reportType) {
      case "sales":
        return {
          title: "Relatório de Vendas",
          columns: [
            { header: "Data", dataKey: "data", width: 12 },
            { header: "Cliente", dataKey: "cliente", width: 28 },
            { header: "Produto", dataKey: "produto", width: 24 },
            { header: "Categoria", dataKey: "categoria", width: 16 },
            { header: "Parceiro", dataKey: "parceiro", width: 22 },
            { header: "Valor", dataKey: "valor", width: 14 },
            { header: "Status", dataKey: "status", width: 14 },
          ],
          rows: (sales ?? []).map((s: any) => ({
            data: formatDate(s.sale_date),
            cliente: s.clients?.full_name ?? "—",
            produto: s.products?.name ?? "—",
            categoria: s.products?.product_categories?.name ?? "—",
            parceiro: s.partners?.full_name ?? "—",
            valor: formatBRL(s.amount),
            status: s.status,
          })),
          totals: [
            { label: "Total de vendas", value: String(sales?.length ?? 0) },
            { label: "Faturamento total", value: formatBRL(totalRevenue) },
            { label: "Ticket médio", value: formatBRL(avgTicket) },
          ],
        };
      case "partners":
        return {
          title: "Parceiros e Comissões",
          columns: [
            { header: "Parceiro", dataKey: "parceiro", width: 28 },
            { header: "Comissões geradas", dataKey: "qty", width: 18 },
            { header: "Total", dataKey: "total", width: 16 },
          ],
          rows: byPartner.map((p) => ({
            parceiro: p.name,
            qty: (commissions ?? []).filter((c: any) => c.partners?.full_name === p.name).length,
            total: formatBRL(p.total),
          })),
          totals: [{ label: "Total de comissões", value: formatBRL(totalCommissions) }],
        };
      case "products":
        return {
          title: "Produtos Vendidos",
          columns: [
            { header: "Produto", dataKey: "produto", width: 28 },
            { header: "Qtde", dataKey: "qty", width: 10 },
            { header: "Faturamento", dataKey: "total", width: 16 },
          ],
          rows: byProduct.map((p) => ({ produto: p.name, qty: p.qty, total: formatBRL(p.total) })),
          totals: [{ label: "Faturamento total", value: formatBRL(totalRevenue) }],
        };
      case "leads":
        return {
          title: "Origem de Leads",
          columns: [
            { header: "Data", dataKey: "data", width: 12 },
            { header: "Nome", dataKey: "nome", width: 24 },
            { header: "Email", dataKey: "email", width: 24 },
            { header: "Telefone", dataKey: "fone", width: 16 },
            { header: "Origem", dataKey: "origem", width: 16 },
            { header: "Status", dataKey: "status", width: 14 },
          ],
          rows: (leads ?? []).map((l: any) => ({
            data: formatDate(l.created_at),
            nome: l.full_name ?? "—",
            email: l.email ?? "—",
            fone: l.phone ?? "—",
            origem: l.source ?? "—",
            status: l.status,
          })),
          totals: [{ label: "Total de leads", value: String(leads?.length ?? 0) }],
        };
      case "tasks":
        return {
          title: "Tarefas e Pendências",
          columns: [
            { header: "Tarefa", dataKey: "tarefa", width: 32 },
            { header: "Responsável", dataKey: "resp", width: 22 },
            { header: "Prioridade", dataKey: "pri", width: 12 },
            { header: "Vencimento", dataKey: "venc", width: 14 },
            { header: "Status", dataKey: "status", width: 14 },
          ],
          rows: (tasks ?? []).map((t: any) => ({
            tarefa: t.title,
            resp: t.profiles?.full_name ?? "—",
            pri: t.priority ?? "—",
            venc: t.due_date ? formatDate(t.due_date) : "—",
            status: t.status,
          })),
          totals: [
            { label: "Total", value: String(tasks?.length ?? 0) },
            { label: "Pendentes", value: String((tasks ?? []).filter((t: any) => t.status !== "concluida").length) },
          ],
        };
      case "docs":
        return {
          title: "Documentos e Contratos",
          columns: [
            { header: "Tipo", dataKey: "tipo", width: 12 },
            { header: "Título", dataKey: "titulo", width: 32 },
            { header: "Cliente", dataKey: "cliente", width: 24 },
            { header: "Valor", dataKey: "valor", width: 14 },
            { header: "Status", dataKey: "status", width: 14 },
            { header: "Data", dataKey: "data", width: 12 },
          ],
          rows: [
            ...(documents ?? []).map((d: any) => ({
              tipo: "Doc",
              titulo: d.title ?? d.file_name,
              cliente: d.clients?.full_name ?? "—",
              valor: "—",
              status: d.status,
              data: formatDate(d.created_at),
            })),
            ...(contracts ?? []).map((c: any) => ({
              tipo: "Contrato",
              titulo: c.title,
              cliente: c.clients?.full_name ?? "—",
              valor: c.value ? formatBRL(c.value) : "—",
              status: c.status,
              data: formatDate(c.created_at),
            })),
          ],
          totals: [
            { label: "Documentos", value: String(documents?.length ?? 0) },
            { label: "Contratos", value: String(contracts?.length ?? 0) },
          ],
        };
      case "team":
        return {
          title: "Colaboradores e Prestadores",
          columns: [
            { header: "Tipo", dataKey: "tipo", width: 14 },
            { header: "Nome", dataKey: "nome", width: 28 },
            { header: "Função / Especialidade", dataKey: "funcao", width: 24 },
            { header: "Email", dataKey: "email", width: 24 },
            { header: "Status", dataKey: "status", width: 12 },
          ],
          rows: [
            ...(collaborators ?? []).map((c: any) => ({
              tipo: "Colaborador", nome: c.full_name, funcao: c.role ?? "—", email: c.email ?? "—", status: c.status ?? "—",
            })),
            ...(providers ?? []).map((p: any) => ({
              tipo: "Prestador", nome: p.full_name, funcao: p.specialty ?? "—", email: p.email ?? "—", status: p.status ?? "—",
            })),
          ],
          totals: [
            { label: "Colaboradores", value: String(collaborators?.length ?? 0) },
            { label: "Prestadores", value: String(providers?.length ?? 0) },
          ],
        };
    }
  }, [reportType, sales, commissions, byPartner, byProduct, leads, tasks, documents, contracts, collaborators, providers, totalRevenue, totalCommissions, avgTicket]);

  const exportPDF = () => {
    if (!reportConfig) return;
    exportToPDF({
      title: reportConfig.title,
      subtitle: `Período: ${formatDate(from)} a ${formatDate(to)}`,
      columns: reportConfig.columns.map((c) => ({ header: c.header, dataKey: c.dataKey })),
      rows: reportConfig.rows,
      totals: reportConfig.totals,
      filename: `${reportType}-${from}-a-${to}.pdf`,
    });
  };

  const exportExcel = () => {
    if (!reportConfig) return;
    exportToExcel({
      sheetName: REPORT_LABELS[reportType],
      title: `${reportConfig.title} — ${formatDate(from)} a ${formatDate(to)}`,
      columns: reportConfig.columns,
      rows: reportConfig.rows,
      filename: `${reportType}-${from}-a-${to}.xlsx`,
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
          <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(REPORT_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportPDF} className="gap-2 flex-1 bg-gradient-primary hover:opacity-90"><FileDown className="size-4" /> PDF</Button>
          <Button onClick={exportExcel} variant="outline" className="gap-2 flex-1"><FileSpreadsheet className="size-4" /> Excel</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Faturamento" value={formatBRL(totalRevenue)} icon={DollarSign} iconColor="primary" />
        <StatCard label="Vendas no período" value={String(sales?.length ?? 0)} icon={TrendingUp} iconColor="success" />
        <StatCard label="Ticket médio" value={formatBRL(avgTicket)} icon={Users} iconColor="info" />
        <StatCard label="Comissões geradas" value={formatBRL(totalCommissions)} icon={Award} iconColor="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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
          <p className="text-sm font-semibold mb-6">
            {reportType === "leads" ? "Leads por origem" : "Ranking de parceiros (comissão)"}
          </p>
          <div className="space-y-3">
            {(reportType === "leads" ? bySource : byPartner).length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-12">Sem dados no período</p>
            ) : (reportType === "leads" ? bySource : byPartner).slice(0, 8).map((p: any, i) => {
              const list = reportType === "leads" ? bySource : byPartner;
              const valueKey = reportType === "leads" ? "qty" : "total";
              const max = (list[0] as any)[valueKey];
              const pct = max ? (p[valueKey] / max) * 100 : 0;
              return (
                <div key={p.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium flex items-center gap-2">
                      <span className="size-5 rounded bg-muted text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                      {p.name}
                    </span>
                    <span className="vx-mono font-semibold">
                      {reportType === "leads" ? `${p.qty} leads` : formatBRL(p.total)}
                    </span>
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

      <div className="vx-card p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold">Pré-visualização — {reportConfig?.title}</p>
          <p className="text-xs text-muted-foreground">{reportConfig?.rows.length ?? 0} registros</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border">
              <tr>
                {reportConfig?.columns.map((c) => (
                  <th key={c.dataKey} className="text-left font-semibold p-2 text-muted-foreground">{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(reportConfig?.rows ?? []).slice(0, 50).map((r, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                  {reportConfig?.columns.map((c) => (
                    <td key={c.dataKey} className="p-2">{String(r[c.dataKey] ?? "—")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {(reportConfig?.rows.length ?? 0) > 50 && (
            <p className="text-[11px] text-muted-foreground text-center py-3">
              Mostrando 50 de {reportConfig?.rows.length}. Exporte para ver todos.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
