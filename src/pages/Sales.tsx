import { useMemo, useState, useEffect } from "react";
import { format, subDays, startOfMonth, startOfToday, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Search, Download, MoreHorizontal, CheckCircle2, XCircle, PlayCircle,
  Clock3, Trash2, Eye, ShoppingBag, X, SlidersHorizontal, CircleDollarSign,
  CalendarRange, Sparkles, Filter, ArrowUpRight, TrendingUp, Award, BarChart3,
  Users, Trophy,
} from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { SaleFormDialog } from "@/components/sales/SaleFormDialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { confirmAction } from "@/lib/confirm";

type StatusKey = "todos" | "pendente" | "em_andamento" | "concluida" | "cancelada";

export default function Sales() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [rangeKey, setRangeKey] = useState<"HOJE" | "7 DIAS" | "30 DIAS" | "MÊS" | "TUDO">("HOJE");
  const [status, setStatus] = useState<StatusKey>("todos");
  const [partnerFilter, setPartnerFilter] = useState("todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setOpen(true);
    }
  }, [searchParams]);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales-rich"],
    queryFn: async () => (await supabase
      .from("sales")
      .select("*, clients(id, full_name, email, document, company), products(name, product_categories(name, color)), partners(full_name, pix_key)")
      .order("sale_date", { ascending: false })).data ?? [],
  });

  const { data: partnersList = [] } = useQuery({
    queryKey: ["partners-filter-sales"],
    queryFn: async () => (await supabase.from("partners").select("id, full_name").order("full_name")).data ?? [],
  });

  const filtered = useMemo(() => {
    const today = startOfToday();
    let start = today;
    let end = endOfDay(today);

    if (rangeKey === "7 DIAS") {
      start = subDays(today, 6);
    } else if (rangeKey === "30 DIAS") {
      start = subDays(today, 29);
    } else if (rangeKey === "MÊS") {
      start = startOfMonth(today);
    } else if (rangeKey === "TUDO") {
      start = new Date(0);
      end = new Date(8640000000000000);
    }

    return sales.filter((s: any) => {
      const saleDate = new Date(s.sale_date);
      if (rangeKey !== "TUDO" && (saleDate < start || saleDate > end)) return false;
      if (status !== "todos" && s.status !== status) return false;
      if (partnerFilter === "sem" && s.partner_id) return false;
      if (partnerFilter !== "todos" && partnerFilter !== "sem" && s.partner_id !== partnerFilter) return false;
      if (dateFrom && s.sale_date < dateFrom) return false;
      if (dateTo && s.sale_date > dateTo) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${s.clients?.full_name ?? ""} ${s.clients?.company ?? ""} ${s.products?.name ?? ""} ${s.partners?.full_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sales, status, partnerFilter, dateFrom, dateTo, search, rangeKey]);

  const kpis = useMemo(() => {
    const acc = { total: 0, concluida: 0, pendente: 0, em_andamento: 0, cancelada: 0, count: filtered.length };
    filtered.forEach((s: any) => {
      const v = Number(s.amount || 0);
      acc.total += v;
      if (s.status === "concluida") acc.concluida += v;
      else if (s.status === "pendente") acc.pendente += v;
      else if (s.status === "em_andamento") acc.em_andamento += v;
      else if (s.status === "cancelada") acc.cancelada += v;
    });
    return acc;
  }, [filtered]);

  // 📈 Série de receita por dia (últimos 30 dias)
  const series30d = useMemo(() => {
    const days: { label: string; v: number; key: string }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ key, label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), v: 0 });
    }
    const idx = Object.fromEntries(days.map((d, i) => [d.key, i]));
    filtered.forEach((s: any) => {
      if (!s.sale_date) return;
      const key = String(s.sale_date).slice(0, 10);
      if (idx[key] !== undefined) days[idx[key]].v += Number(s.amount || 0);
    });
    return days;
  }, [filtered]);

  // 🏆 Top 5 parceiros por volume fechado
  const topPartners = useMemo(() => {
    const m = new Map<string, { name: string; total: number; deals: number }>();
    filtered.forEach((s: any) => {
      if (!s.partner_id || !s.partners?.full_name) return;
      const cur = m.get(s.partner_id) || { name: s.partners.full_name, total: 0, deals: 0 };
      cur.total += Number(s.amount || 0);
      cur.deals += 1;
      m.set(s.partner_id, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [filtered]);

  // 📊 Distribuição por status (%)
  const statusBreakdown = useMemo(() => {
    const total = kpis.total || 1;
    return [
      { key: "concluida", label: "Concluídas", value: kpis.concluida, pct: (kpis.concluida / total) * 100, color: "bg-emerald-500" },
      { key: "em_andamento", label: "Em andamento", value: kpis.em_andamento, pct: (kpis.em_andamento / total) * 100, color: "bg-sky-500" },
      { key: "pendente", label: "Pendentes", value: kpis.pendente, pct: (kpis.pendente / total) * 100, color: "bg-amber-500" },
      { key: "cancelada", label: "Canceladas", value: kpis.cancelada, pct: (kpis.cancelada / total) * 100, color: "bg-rose-500" },
    ];
  }, [kpis]);

  const removeOne = async (s: any) => {
    if (!(await confirmAction(`Excluir venda de ${formatBRL(s.amount)}?`))) return;
    const { error } = await supabase.from("sales").delete().eq("id", s.id);
    if (error) toast.error(error.message);
    else { toast.success("Venda excluída"); qc.invalidateQueries({ queryKey: ["sales-rich"] }); }
  };

  const exportCSV = () => {
    const headers = ["Data", "Cliente", "Produto", "Valor", "Status"];
    const rows = filtered.map((s: any) => [
      s.sale_date, s.clients?.full_name ?? "", s.products?.name ?? "", Number(s.amount).toFixed(2), s.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "vendas.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => { setSearch(""); setStatus("todos"); setPartnerFilter("todos"); setDateFrom(""); setDateTo(""); };
  const hasActiveFilters = !!search || status !== "todos" || partnerFilter !== "todos" || !!dateFrom || !!dateTo;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#060608] text-slate-900 dark:text-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900 admin-shell">
      <PageHero
        eyebrow="Ledger"
        category="Sales Activity"
        title="Vendas"
        description="Log operacional de transações sincronizado em tempo real."
        icon={<ShoppingBag className="size-6" />}
        actions={
          <div className="flex items-center gap-3">
            <div className="flex bg-white dark:bg-card p-1 rounded-2xl border border-slate-200 dark:border-border shadow-sm mr-2">
              {(["HOJE", "7 DIAS", "30 DIAS", "MÊS", "TUDO"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setRangeKey(k)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black transition-all uppercase",
                    rangeKey === k ? "bg-slate-900 dark:bg-white text-white dark:text-black shadow-lg" : "text-slate-400 dark:text-muted-foreground hover:text-slate-600 dark:hover:text-foreground"
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={exportCSV} className="h-10 px-4 gap-2">
              <Download className="size-4" /> Exportar
            </Button>
            <Button size="sm" onClick={() => setOpen(true)} className="action-button btn-primary shadow-xl">
              <Plus className="size-4" strokeWidth={3} /> Nova Venda
            </Button>
          </div>
        }
        kpis={[
          { label: "Volume Bruto", value: formatBRL(kpis.total), tone: "primary", icon: <CircleDollarSign className="size-4" /> },
          { label: "Concluídas", value: formatBRL(kpis.concluida), tone: "success", icon: <CheckCircle2 className="size-4" /> },
          { label: "Em Andamento", value: formatBRL(kpis.em_andamento), tone: "info", icon: <PlayCircle className="size-4" /> },
          { label: "Pendentes", value: formatBRL(kpis.pendente), tone: "warning", icon: <Clock3 className="size-4" /> },
          { label: "Total Registros", value: String(kpis.count), tone: "primary", icon: <TrendingUp className="size-4" /> },
        ]}
      />

      {/* ============ INSIGHTS ROW ============ */}
      <section className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 px-5 lg:px-8">
        <div className="lg:col-span-7 vx-card p-5 relative overflow-hidden bg-white dark:bg-card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.22em] font-bold text-slate-600">
                <BarChart3 className="size-3 text-indigo-500" /> Performance · 30 dias
              </div>
              <h3 className="font-display text-base font-bold mt-1 text-slate-950 dark:text-foreground">Fluxo de Receita Diário</h3>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total no período</p>
              <p className="font-display text-lg font-bold tabular-nums text-indigo-800">{formatBRL(series30d.reduce((a, d) => a + d.v, 0))}</p>
            </div>
          </div>
          <div className="h-[160px] -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series30d} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "currentColor", opacity: 0.7 }} interval={4} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(v: any) => formatBRL(Number(v))}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ fontSize: 10, fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={2} fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="vx-card p-5">
            <div className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.22em] font-bold text-slate-600 mb-3">
              <Sparkles className="size-3 text-indigo-500" /> Distribuição por Status
            </div>
            <div className="space-y-2.5">
              {statusBreakdown.map((row) => (
                <div key={row.key}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-semibold text-slate-700">{row.label}</span>
                    <span className="tabular-nums font-bold text-slate-950">{formatBRL(row.value)} <span className="text-muted-foreground font-medium ml-1">({row.pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", row.color)} style={{ width: `${Math.min(100, row.pct)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="vx-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.22em] font-bold text-slate-600">
                <Trophy className="size-3 text-amber-500" /> Top Parceiros
              </div>
              <Users className="size-3.5 text-muted-foreground/40" />
            </div>
            {topPartners.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-3">Sem vendas via parceiros ainda.</p>
            ) : (
              <div className="space-y-2">
                {topPartners.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <div className={cn(
                      "size-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0",
                      i === 0 && "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md",
                      i === 1 && "bg-gradient-to-br from-slate-300 to-slate-500 text-white",
                      i === 2 && "bg-gradient-to-br from-amber-700 to-amber-900 text-white",
                      i > 2 && "bg-slate-100 text-slate-800",
                    )}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold text-slate-800 truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.deals} {p.deals === 1 ? "venda" : "vendas"}</p>
                    </div>
                    <p className="text-[12px] font-bold tabular-nums text-indigo-800">{formatBRL(p.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="toolbar">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="Buscar transações..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-background/60 border-border h-10 pl-10 pr-4 text-sm rounded-xl"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={status} onValueChange={(v) => setStatus(v as StatusKey)}>
            <SelectTrigger className="h-10 w-[140px] rounded-xl bg-background/60 text-xs font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="concluida">Concluídas</SelectItem>
              <SelectItem value="em_andamento">Em andamento</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="cancelada">Canceladas</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5 bg-background/60 border border-border rounded-xl px-2.5 h-10">
            <CalendarRange className="size-3.5 text-muted-foreground/60" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-transparent text-xs text-foreground outline-none w-[110px]" />
            <span className="text-muted-foreground/40">→</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-transparent text-xs text-foreground outline-none w-[110px]" />
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="icon" onClick={clearFilters} className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Table Content */}
      <div className="vx-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <Th>Status</Th>
                <Th>Cliente</Th>
                <Th>Produto</Th>
                <Th>Parceiro</Th>
                <Th>Data</Th>
                <Th align="right">Valor</Th>
                <Th align="right">Comissão</Th>
                <Th align="right">Ações</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading ? (
                <tr><td colSpan={8} className="py-24 text-center text-muted-foreground/50 animate-pulse">Sincronizando transações...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-24 text-center text-muted-foreground/50">Nenhuma transação encontrada.</td></tr>
              ) : filtered.map((s: any) => {
                const commissionPct = Number(s.commission_percent || 0);
                const commissionVal = (Number(s.amount || 0) * commissionPct) / 100;
                return (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors group">
                  <Td><StatusPill status={s.status} /></Td>
                  <Td>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-950 truncate cursor-pointer hover:text-indigo-800 transition-colors" onClick={() => navigate(`/clientes/${s.clients?.id}`)}>
                        {s.clients?.full_name ?? "—"}
                      </p>
                      <p className="text-[11px] font-bold text-slate-500 truncate uppercase tracking-wider mt-0.5">{s.clients?.company || "Conta Pessoal"}</p>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      {s.products?.product_categories && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border" style={{ borderColor: `${s.products.product_categories.color}40`, color: s.products.product_categories.color, backgroundColor: `${s.products.product_categories.color}10` }}>
                          {s.products.product_categories.name.toUpperCase()}
                        </span>
                      )}
                      <span className="text-foreground/80">{s.products?.name ?? "—"}</span>
                    </div>
                  </Td>
                  <Td>
                    {s.partners?.full_name ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-800 text-[11px] font-semibold">
                        <span className="size-1.5 rounded-full bg-indigo-500" />
                        {s.partners.full_name}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/60 italic">Direto</span>
                    )}
                  </Td>
                  <Td className="text-muted-foreground text-xs">{formatDate(s.sale_date)}</Td>
                  <Td align="right"><span className="font-semibold text-foreground tabular-nums">{formatBRL(s.amount)}</span></Td>
                  <Td align="right">
                    {commissionVal > 0 ? (
                      <div>
                        <p className="font-semibold text-emerald-800 tabular-nums text-[12px]">{formatBRL(commissionVal)}</p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">{commissionPct}%</p>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/60">—</span>
                    )}
                  </Td>
                  <Td align="right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground/40 hover:text-foreground">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/clientes/${s.clients?.id}`)}><Eye className="size-3.5 mr-2" /> Ver Cliente</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={async () => { await supabase.from("sales").update({ status: "concluida" }).eq("id", s.id); qc.invalidateQueries({ queryKey: ["sales-rich"] }); toast.success("Marcada como concluída"); }}>
                          <CheckCircle2 className="size-3.5 mr-2" /> Marcar concluída
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={async () => { await supabase.from("sales").update({ status: "em_andamento" }).eq("id", s.id); qc.invalidateQueries({ queryKey: ["sales-rich"] }); toast.success("Em andamento"); }}>
                          <PlayCircle className="size-3.5 mr-2" /> Em andamento
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={async () => { await supabase.from("sales").update({ status: "cancelada" }).eq("id", s.id); qc.invalidateQueries({ queryKey: ["sales-rich"] }); toast.success("Cancelada"); }}>
                          <XCircle className="size-3.5 mr-2" /> Cancelar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => removeOne(s)} className="text-destructive focus:text-destructive"><Trash2 className="size-3.5 mr-2" /> Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <SaleFormDialog open={open} onOpenChange={setOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["sales-rich"] })} />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    concluida: { label: "concluída", cls: "vx-pill-success" },
    em_andamento: { label: "em andamento", cls: "vx-pill-info" },
    pendente: { label: "pendente", cls: "vx-pill-warning" },
    cancelada: { label: "cancelada", cls: "vx-pill-danger" },
  };
  const m = map[status] ?? { label: status, cls: "vx-pill" };
  return <span className={cn("vx-pill", m.cls)}>{m.label}</span>;
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={cn(
      "px-5 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/60",
      align === "right" ? "text-right" : "text-left"
    )}>
      {children}
    </th>
  );
}

function Td({ children, align = "left", className }: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <td className={cn(
      "px-5 py-4",
      align === "right" ? "text-right" : "text-left",
      className
    )}>
      {children}
    </td>
  );
}
