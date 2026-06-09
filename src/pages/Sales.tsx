import { useMemo, useState, useEffect } from "react";
import { subDays, startOfMonth, startOfToday, endOfDay, parseISO } from "date-fns";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Search, Download, MoreHorizontal, CheckCircle2, XCircle, PlayCircle,
  Clock3, Trash2, Eye, ShoppingBag, X, CircleDollarSign,
  CalendarRange, Sparkles, ArrowUp, ArrowDown, TrendingUp, BarChart3,
  Users, Trophy, Inbox, Pencil
} from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { formatBRDate, formatBR, nowBR, toBR } from "@/lib/datetime";
import { SaleFormDialog } from "@/components/sales/SaleFormDialog";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ComposedChart, Area, Bar, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { confirmAction } from "@/lib/confirm";
import { useAuth } from "@/hooks/useAuth";

type StatusKey = "todos" | "pendente" | "em_andamento" | "concluida" | "cancelada";
type SortKey = "sale_date" | "client" | "product" | "partner" | "amount" | "commission" | "status";
type SortDir = "asc" | "desc";

const norm = (s: any) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const onlyDigits = (s: any) => String(s ?? "").replace(/\D+/g, "");

export default function Sales() {
  const { isAdmin, isAdminSecondary } = useAuth();
  const canManage = isAdmin || isAdminSecondary;
  const [open, setOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [rangeKey, setRangeKey] = useState<"HOJE" | "7 DIAS" | "30 DIAS" | "MÊS" | "TUDO">("30 DIAS");
  const [status, setStatus] = useState<StatusKey>("todos");
  const [partnerFilter, setPartnerFilter] = useState("todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sale_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("new") === "1") setOpen(true);
  }, [searchParams]);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales-rich-v2"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, clients(id, full_name, email, document, company), products(name), partners(full_name, pix_key), referrers(full_name)")
        .order("sale_date", { ascending: false });
      if (error) {
        console.error("[Sales] query error:", error);
        toast.error("Erro ao carregar vendas: " + error.message);
        return [];
      }
      return data ?? [];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const { data: partnersList = [] } = useQuery({
    queryKey: ["partners-filter-sales"],
    queryFn: async () => (await supabase.from("partners").select("id, full_name").order("full_name")).data ?? [],
  });

  const { data: allSplits = [] } = useQuery({
    queryKey: ["sales-commission-splits"],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_splits")
        .select("sale_id, amount, percent, beneficiary_type, status");
      return (data as any[]) ?? [];
    },
  });

  const splitsBySale = useMemo(() => {
    const m = new Map<string, any[]>();
    allSplits.forEach((s: any) => {
      if (!s.sale_id) return;
      const arr = m.get(s.sale_id) ?? [];
      arr.push(s);
      m.set(s.sale_id, arr);
    });
    return m;
  }, [allSplits]);

  const usingManualRange = !!dateFrom || !!dateTo;

  const filtered = useMemo(() => {
    const today = nowBR();
    let start: Date = startOfToday();
    let end: Date = endOfDay(today);

    if (usingManualRange) {
      start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : new Date(0);
      end = dateTo ? new Date(`${dateTo}T23:59:59`) : new Date(8640000000000000);
    } else if (rangeKey === "7 DIAS") {
      start = subDays(today, 6);
    } else if (rangeKey === "30 DIAS") {
      start = subDays(today, 29);
    } else if (rangeKey === "MÊS") {
      start = startOfMonth(today);
    } else if (rangeKey === "TUDO") {
      start = new Date(0);
      end = new Date(8640000000000000);
    }

    const q = norm(search);
    const qDigits = onlyDigits(search);

    return sales.filter((s: any) => {
      const saleDate = s.sale_date ? parseISO(s.sale_date) : null;
      if (!saleDate) return false;
      if (saleDate < start || saleDate > end) return false;
      if (status !== "todos" && s.status !== status) return false;
      if (partnerFilter === "sem" && s.partner_id) return false;
      if (partnerFilter !== "todos" && partnerFilter !== "sem" && s.partner_id !== partnerFilter) return false;
      if (q) {
        const hay = norm(
          `${s.clients?.full_name ?? ""} ${s.clients?.company ?? ""} ${s.clients?.email ?? ""} ${s.products?.name ?? ""} ${s.partners?.full_name ?? ""}`
        );
        const docHay = onlyDigits(s.clients?.document ?? "");
        const matches = hay.includes(q) || (qDigits && docHay.includes(qDigits));
        if (!matches) return false;
      }
      return true;
    });
  }, [sales, status, partnerFilter, dateFrom, dateTo, search, rangeKey, usingManualRange]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a: any, b: any) => {
      const v = (x: any) => {
        switch (sortKey) {
          case "sale_date": return new Date(x.sale_date).getTime();
          case "client": return norm(x.clients?.full_name);
          case "product": return norm(x.products?.name);
          case "partner": return norm(x.partners?.full_name);
          case "amount": return Number(x.amount || 0);
          case "commission": return (splitsBySale.get(x.id) ?? []).reduce((s: number, sp: any) => s + Number(sp.amount || 0), 0);
          case "status": return String(x.status || "");
        }
      };
      const va = v(a), vb = v(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir, splitsBySale]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "sale_date" || key === "amount" || key === "commission" ? "desc" : "asc"); }
  };

  const kpis = useMemo(() => {
    const acc = { total: 0, concluida: 0, pendente: 0, em_andamento: 0, cancelada: 0, count: filtered.length, comissao: 0, zenon: 0, provider: 0, custos: 0, liquido: 0 };
    filtered.forEach((s: any) => {
      const v = Number(s.amount || 0);
      const z = Number(s.zenon_cost || 0);
      const pc = Number(s.provider_cost || 0);
      const comm = (splitsBySale.get(s.id) ?? []).reduce((sum: number, sp: any) => sum + Number(sp.amount || 0), 0);
      acc.total += v;
      acc.zenon += z;
      acc.provider += pc;
      acc.custos += z + pc;
      acc.comissao += comm;
      acc.liquido += v - z - pc - comm;
      if (s.status === "concluida") acc.concluida += v;
      else if (s.status === "pendente") acc.pendente += v;
      else if (s.status === "em_andamento") acc.em_andamento += v;
      else if (s.status === "cancelada") acc.cancelada += v;
    });
    return acc;
  }, [filtered, splitsBySale]);

  const chartSeries = useMemo(() => {
    const today = nowBR();
    let start: Date;
    let end: Date = endOfDay(today);

    if (usingManualRange) {
      start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : subDays(today, 29);
      end = dateTo ? new Date(`${dateTo}T23:59:59`) : endOfDay(today);
    } else if (rangeKey === "HOJE") {
      start = startOfToday();
    } else if (rangeKey === "7 DIAS") {
      start = subDays(today, 6);
    } else if (rangeKey === "MÊS") {
      start = startOfMonth(today);
    } else if (rangeKey === "TUDO") {
      // fallback: últimos 90 dias para o gráfico não ficar gigante
      const earliest = filtered.reduce((acc: Date | null, s: any) => {
        const d = s.sale_date ? parseISO(s.sale_date) : null;
        if (!d) return acc;
        return !acc || d < acc ? d : acc;
      }, null as Date | null);
      start = earliest ?? subDays(today, 89);
    } else {
      start = subDays(today, 29);
    }

    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / dayMs) + 1);
    const days: { key: string; label: string; bruto: number; concluida: number; pendente: number; count: number }[] = [];
    const base = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      days.push({
        key,
        label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }),
        bruto: 0,
        concluida: 0,
        pendente: 0,
        count: 0,
      });
    }
    const idx = Object.fromEntries(days.map((d, i) => [d.key, i]));
    filtered.forEach((s: any) => {
      if (!s.sale_date) return;
      const key = String(s.sale_date).slice(0, 10);
      const i = idx[key];
      if (i === undefined) return;
      const v = Number(s.amount || 0);
      days[i].bruto += v;
      days[i].count += 1;
      if (s.status === "concluida") days[i].concluida += v;
      else if (s.status === "pendente" || s.status === "em_andamento") days[i].pendente += v;
    });
    return days;
  }, [filtered, rangeKey, usingManualRange, dateFrom, dateTo]);

  const chartTotals = useMemo(() => {
    const t = chartSeries.reduce(
      (acc, d) => {
        acc.bruto += d.bruto;
        acc.concluida += d.concluida;
        acc.count += d.count;
        return acc;
      },
      { bruto: 0, concluida: 0, count: 0 }
    );
    const ticket = t.count > 0 ? t.bruto / t.count : 0;
    return { ...t, ticket };
  }, [chartSeries]);

  const chartInterval = chartSeries.length > 60 ? Math.floor(chartSeries.length / 10) : chartSeries.length > 14 ? Math.floor(chartSeries.length / 8) : 0;

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

  const statusBreakdown = useMemo(() => {
    const total = kpis.total || 1;
    return [
      { key: "concluida", label: "Concluídas", value: kpis.concluida, pct: (kpis.concluida / total) * 100, color: "bg-emerald-500" },
      { key: "em_andamento", label: "Em andamento", value: kpis.em_andamento, pct: (kpis.em_andamento / total) * 100, color: "bg-sky-500" },
      { key: "pendente", label: "Pendentes", value: kpis.pendente, pct: (kpis.pendente / total) * 100, color: "bg-amber-500" },
      { key: "cancelada", label: "Canceladas", value: kpis.cancelada, pct: (kpis.cancelada / total) * 100, color: "bg-rose-500" },
    ];
  }, [kpis]);

  const invalidateRelated = async () => {
    await Promise.all([
      qc.refetchQueries({ queryKey: ["sales-rich-v2"], type: "active" }),
      qc.refetchQueries({ queryKey: ["sales-commission-splits"], type: "active" }),
    ]);
    qc.invalidateQueries({ queryKey: ["commissions"] });
    qc.invalidateQueries({ queryKey: ["payments"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    qc.invalidateQueries({ queryKey: ["admin-dashboard-snapshot"] });
    qc.invalidateQueries({ queryKey: ["admin-demands"] });
    qc.invalidateQueries({ queryKey: ["client-sales"] });
    qc.invalidateQueries({ queryKey: ["client-payments"] });
    qc.invalidateQueries({ queryKey: ["client-products"] });
  };

  const updateStatus = async (s: any, next: Exclude<StatusKey, "todos">) => {
    if (!canManage) return;
    if (s.status === next) { toast.info("Status já está aplicado"); return; }
    if (s.status === "concluida" && next === "cancelada") {
      if (!(await confirmAction("Cancelar uma venda já concluída pode afetar comissões. Continuar?"))) return;
    }
    if (next === "cancelada" && !(await confirmAction("Marcar venda como cancelada?"))) return;
    const { error } = await supabase.from("sales").update({ status: next }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Status atualizado");
    invalidateRelated();
  };

  const editOne = (s: any) => {
    setEditingSale(s);
    setOpen(true);
  };

  const removeOne = async (s: any) => {
    if (!canManage) return;
    if (!(await confirmAction(`Excluir venda de ${formatBRL(s.amount)}? Esta ação não pode ser desfeita.`))) return;
    const { error } = await supabase.from("sales").delete().eq("id", s.id);
    if (error) toast.error(error.message);
    else { toast.success("Venda excluída"); invalidateRelated(); }
  };

  const exportCSV = () => {
    const headers = ["Data", "Cliente", "Empresa", "Produto", "Parceiro", "Valor", "Comissão %", "Comissão R$", "Status"];
    const rows = sorted.map((s: any) => {
      const splits = splitsBySale.get(s.id) ?? [];
      const com = splits.reduce((x: number, sp: any) => x + Number(sp.amount || 0), 0);
      const baseAmt = Number(s.amount || 0);
      const pct = baseAmt > 0 ? (com / baseAmt) * 100 : 0;
      return [
        s.sale_date,
        s.clients?.full_name ?? "",
        s.clients?.company ?? "",
        s.products?.name ?? "",
        s.partners?.full_name ?? "",
        baseAmt.toFixed(2),
        pct.toFixed(2),
        com.toFixed(2),
        s.status,
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `vendas-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => { setSearch(""); setStatus("todos"); setPartnerFilter("todos"); setDateFrom(""); setDateTo(""); };
  const activeChips: { label: string; clear: () => void }[] = [];
  if (search) activeChips.push({ label: `Busca: ${search}`, clear: () => setSearch("") });
  if (status !== "todos") activeChips.push({ label: `Status: ${status}`, clear: () => setStatus("todos") });
  if (partnerFilter !== "todos") {
    const name = partnerFilter === "sem" ? "Sem parceiro" : (partnersList.find((p: any) => p.id === partnerFilter)?.full_name ?? "Parceiro");
    activeChips.push({ label: `Parceiro: ${name}`, clear: () => setPartnerFilter("todos") });
  }
  if (dateFrom) activeChips.push({ label: `De: ${dateFrom}`, clear: () => setDateFrom("") });
  if (dateTo) activeChips.push({ label: `Até: ${dateTo}`, clear: () => setDateTo("") });
  const hasActiveFilters = activeChips.length > 0;

  return (
    <div className="min-h-dvh bg-slate-50/60 text-slate-900 font-sans admin-shell">
      <PageHero
        eyebrow="Ledger"
        category="Sales Activity"
        title="Vendas"
        description="Log operacional de transações sincronizado em tempo real."
        icon={<ShoppingBag className="size-6" />}
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex bg-white p-1 rounded-lg border border-slate-200/70 shadow-sm">
              {(["HOJE", "7 DIAS", "30 DIAS", "MÊS", "TUDO"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => { setRangeKey(k); setDateFrom(""); setDateTo(""); }}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[10px] font-bold transition-all uppercase tracking-wider",
                    !usingManualRange && rangeKey === k
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={exportCSV} className="h-10 px-4 gap-2 border-slate-200/70 bg-white hover:bg-slate-50">
              <Download className="size-4" /> Exportar
            </Button>
            {canManage && (
              <Button size="sm" onClick={() => setOpen(true)} className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                <Plus className="size-4" /> Nova Venda
              </Button>
            )}
          </div>
        }
        kpis={[
          { label: "Volume Bruto", value: formatBRL(kpis.total), tone: "primary", icon: <CircleDollarSign className="size-4" /> },
          { label: "Líquido", value: formatBRL(kpis.liquido), tone: "success", icon: <Sparkles className="size-4" />, hint: kpis.total > 0 ? `${((kpis.liquido / kpis.total) * 100).toFixed(1)}% margem` : undefined },
          { label: "Custos (Zenon + Prestador)", value: formatBRL(kpis.custos), tone: "warning", icon: <Wallet className="size-4" />, hint: kpis.provider > 0 ? `Prestador ${formatBRL(kpis.provider)}` : undefined },
          { label: "Comissões", value: formatBRL(kpis.comissao), tone: "info", icon: <Handshake className="size-4" /> },
          { label: "Concluídas", value: formatBRL(kpis.concluida), tone: "success", icon: <CheckCircle2 className="size-4" /> },
          { label: "Pendentes", value: formatBRL(kpis.pendente), tone: "warning", icon: <Clock3 className="size-4" /> },
          { label: "Total Registros", value: String(kpis.count), tone: "primary", icon: <TrendingUp className="size-4" /> },
        ]}
      />

      {/* INSIGHTS */}
      <section className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 px-5 lg:px-8 mt-4">
        <div className="lg:col-span-7 bg-white border border-slate-200/70 rounded-lg shadow-sm p-5">
          <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.22em] font-bold text-slate-500">
                <BarChart3 className="size-3 text-indigo-500" /> Performance · {usingManualRange ? "Período personalizado" : rangeKey}
              </div>
              <h3 className="text-base font-bold mt-1 text-slate-900">Fluxo de Receita Diário</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Bruto vs. Concluído · {chartSeries.length} {chartSeries.length === 1 ? "dia" : "dias"}</p>
            </div>
            <div className="flex items-center gap-5">
              <div className="text-right">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Bruto</p>
                <p className="text-base font-bold font-mono text-indigo-700">{formatBRL(chartTotals.bruto)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Concluído</p>
                <p className="text-base font-bold font-mono text-emerald-600">{formatBRL(chartTotals.concluida)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Ticket médio</p>
                <p className="text-base font-bold font-mono text-slate-900">{formatBRL(chartTotals.ticket)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Vendas</p>
                <p className="text-base font-bold font-mono text-slate-900">{chartTotals.count}</p>
              </div>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartSeries} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradBruto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  interval={chartInterval}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000
                      ? `R$ ${(v / 1_000_000).toFixed(1)}M`
                      : v >= 1_000
                      ? `R$ ${(v / 1_000).toFixed(0)}k`
                      : `R$ ${v}`
                  }
                />
                <Tooltip
                  formatter={(v: any, name: any) => [formatBRL(Number(v)), name]}
                  contentStyle={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, boxShadow: "0 4px 12px rgba(15,23,42,0.08)" }}
                  labelStyle={{ fontSize: 11, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}
                  cursor={{ fill: "rgba(99,102,241,0.06)" }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  iconType="circle"
                  iconSize={8}
                />
                <Bar dataKey="bruto" name="Bruto" fill="url(#salesGradBruto)" stroke="#6366f1" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line type="monotone" dataKey="concluida" name="Concluído" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: "#10b981" }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="pendente" name="Pend./Andamento" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>


        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-5">
            <div className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.22em] font-bold text-slate-500 mb-3">
              <Sparkles className="size-3 text-indigo-500" /> Distribuição por Status
            </div>
            <div className="space-y-2.5">
              {statusBreakdown.map((row) => (
                <div key={row.key}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-semibold text-slate-700">{row.label}</span>
                    <span className="font-mono font-bold text-slate-900">{formatBRL(row.value)} <span className="text-slate-400 font-medium ml-1">({row.pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", row.color)} style={{ width: `${Math.min(100, row.pct)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.22em] font-bold text-slate-500">
                <Trophy className="size-3 text-amber-500" /> Top Parceiros
              </div>
              <Users className="size-3.5 text-slate-300" />
            </div>
            {topPartners.length === 0 ? (
              <p className="text-[12px] text-slate-400 text-center py-3">Sem vendas via parceiros no período.</p>
            ) : (
              <div className="space-y-2">
                {topPartners.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <div className={cn(
                      "size-7 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0",
                      i === 0 && "bg-amber-100 text-amber-700",
                      i === 1 && "bg-slate-100 text-slate-700",
                      i === 2 && "bg-orange-100 text-orange-700",
                      i > 2 && "bg-slate-50 text-slate-600",
                    )}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold text-slate-800 truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-500">{p.deals} {p.deals === 1 ? "venda" : "vendas"}</p>
                    </div>
                    <p className="text-[12px] font-bold font-mono text-indigo-700">{formatBRL(p.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <div className="max-w-[1600px] mx-auto px-5 lg:px-8 mt-4">
        <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por cliente, empresa, produto, parceiro, documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border-slate-200 h-10 pl-10 pr-4 text-sm rounded-md"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as StatusKey)}>
            <SelectTrigger className="h-10 w-[150px] rounded-md bg-white border-slate-200 text-xs font-medium">
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

          <Select value={partnerFilter} onValueChange={setPartnerFilter}>
            <SelectTrigger className="h-10 w-[170px] rounded-md bg-white border-slate-200 text-xs font-medium">
              <SelectValue placeholder="Parceiro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos parceiros</SelectItem>
              <SelectItem value="sem">Sem parceiro (Direto)</SelectItem>
              {partnersList.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2.5 h-10">
            <CalendarRange className="size-3.5 text-slate-400" />
            <input type="date" value={dateFrom} onChange={(e) => {
              setDateFrom(e.target.value);
              if (dateTo && e.target.value && e.target.value > dateTo) setDateTo(e.target.value);
            }} className="bg-transparent text-xs text-slate-700 outline-none w-[120px]" />
            <span className="text-slate-300">→</span>
            <input type="date" value={dateTo} onChange={(e) => {
              setDateTo(e.target.value);
              if (dateFrom && e.target.value && e.target.value < dateFrom) setDateFrom(e.target.value);
            }} className="bg-transparent text-xs text-slate-700 outline-none w-[120px]" />
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 text-slate-500 hover:text-slate-900">
              <X className="size-3.5 mr-1" /> Limpar
            </Button>
          )}
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {activeChips.map((c, i) => (
              <button
                key={i}
                onClick={c.clear}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-semibold border border-indigo-100 hover:bg-indigo-100"
              >
                {c.label}
                <X className="size-3" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="max-w-[1600px] mx-auto px-5 lg:px-8 mt-4 mb-10">
        <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[1100px]">
              <thead>
                <tr className="border-b border-slate-200/70 bg-slate-50/60">
                  <SortableTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <SortableTh label="Cliente" k="client" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <SortableTh label="Produto" k="product" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <SortableTh label="Parceiro" k="partner" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <SortableTh label="Data" k="sale_date" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                  <SortableTh label="Valor" k="amount" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                  <SortableTh label="Comissão" k="commission" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                  <Th align="right">Líquido</Th>
                  <Th align="right">Ações</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 9 }).map((__, j) => (
                        <td key={j} className="px-5 py-4"><div className="h-3 bg-slate-100 rounded w-3/4" /></td>
                      ))}
                    </tr>
                  ))
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Inbox className="size-8" />
                        <p className="text-sm font-medium">
                          {hasActiveFilters ? "Nenhuma venda encontrada com esses filtros." : "Nenhuma venda registrada ainda."}
                        </p>
                        {hasActiveFilters && (
                          <Button variant="link" size="sm" onClick={clearFilters} className="text-indigo-600">Limpar filtros</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : sorted.map((s: any) => {
                  const splits = splitsBySale.get(s.id) ?? [];
                  const commissionVal = splits.reduce((x: number, sp: any) => x + Number(sp.amount || 0), 0);
                  const baseAmt = Number(s.amount || 0);
                  const zenonCost = Number(s.zenon_cost || 0);
                  const providerCost = Number(s.provider_cost || 0);
                  const totalCustos = zenonCost + providerCost;
                  const liquido = baseAmt - totalCustos - commissionVal;
                  const liquidoPct = baseAmt > 0 ? (liquido / baseAmt) * 100 : 0;
                  const commissionPct = baseAmt > 0 ? (commissionVal / baseAmt) * 100 : 0;
                  const paidCount = splits.filter((sp: any) => sp.status === "pago").length;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors group">
                      <Td><StatusPill status={s.status} /></Td>
                      <Td>
                        <div className="min-w-0">
                          <button
                            className="font-semibold text-slate-900 truncate hover:text-indigo-700 transition-colors text-left"
                            onClick={() => s.clients?.id && navigate(`/clientes/${s.clients.id}`)}
                          >
                            {s.clients?.full_name ?? "—"}
                          </button>
                          <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">{s.clients?.company || "Conta Pessoal"}</p>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-700">{s.products?.name ?? "—"}</span>
                        </div>
                      </Td>
                      <Td>
                        {s.partners?.full_name ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-semibold border border-indigo-100">
                            <span className="size-1.5 rounded-full bg-indigo-500" />
                            {s.partners.full_name}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Direto</span>
                        )}
                      </Td>
                      <Td className="text-slate-600 text-xs font-mono">{s.sale_date ? formatBRDate(parseISO(s.sale_date)) : "—"}</Td>
                      <Td align="right"><span className="font-semibold text-slate-900 font-mono">{formatBRL(s.amount)}</span></Td>
                      <Td align="right">
                        {commissionVal > 0 ? (
                          <div className="inline-flex flex-col items-end gap-0.5">
                            <span className="font-bold font-mono text-[12.5px] text-emerald-700 tabular-nums leading-none">
                              {formatBRL(commissionVal)}
                            </span>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="inline-flex items-center px-1.5 py-px rounded bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9.5px] font-bold font-mono tabular-nums tracking-tight">
                                {commissionPct.toFixed(1)}%
                              </span>
                              <span className="inline-flex items-center px-1.5 py-px rounded bg-slate-50 text-slate-600 border border-slate-200 text-[9.5px] font-semibold tabular-nums">
                                {splits.length}
                              </span>
                              {paidCount > 0 && (
                                <span
                                  title={`${paidCount} pago${paidCount > 1 ? "s" : ""}`}
                                  className="inline-flex items-center px-1.5 py-px rounded bg-emerald-600 text-white text-[9.5px] font-bold tabular-nums"
                                >
                                  ✓ {paidCount}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </Td>
                      <Td align="right">
                        {baseAmt > 0 ? (
                          <div className="inline-flex flex-col items-end gap-0.5">
                            <span className={cn(
                              "font-bold font-mono text-[12.5px] tabular-nums leading-none",
                              liquido > 0 ? "text-indigo-700" : liquido < 0 ? "text-rose-600" : "text-slate-500"
                            )}>
                              {formatBRL(liquido)}
                            </span>
                            <div className="flex items-center gap-1 mt-1">
                              <span className={cn(
                                "inline-flex items-center px-1.5 py-px rounded border text-[9.5px] font-bold font-mono tabular-nums tracking-tight",
                                liquidoPct >= 50 ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                                liquidoPct >= 0 ? "bg-slate-50 text-slate-600 border-slate-200" :
                                "bg-rose-50 text-rose-700 border-rose-100"
                              )}>
                                {liquidoPct.toFixed(1)}%
                              </span>
                              {zenonCost > 0 && (
                                <span
                                  title={`Custo Zenon ${formatBRL(zenonCost)}`}
                                  className="inline-flex items-center px-1.5 py-px rounded bg-amber-50 text-amber-700 border border-amber-100 text-[9.5px] font-semibold font-mono tabular-nums"
                                >
                                  −Z
                                </span>
                              )}
                              {providerCost > 0 && (
                                <span
                                  title={`Custo Prestador ${formatBRL(providerCost)}`}
                                  className="inline-flex items-center px-1.5 py-px rounded bg-orange-50 text-orange-700 border border-orange-100 text-[9.5px] font-semibold font-mono tabular-nums"
                                >
                                  −P
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </Td>
                      <Td align="right">
                        {canManage ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Mais ações" className="size-8 text-slate-400 hover:text-slate-900 hover:bg-slate-100">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {s.clients?.id && (
                                <DropdownMenuItem onClick={() => navigate(`/clientes/${s.clients.id}`)}>
                                  <Eye className="size-3.5 mr-2" /> Ver Cliente
                                </DropdownMenuItem>
                              )}
                               <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => editOne(s)}>
                                <Pencil className="size-3.5 mr-2 text-indigo-600" /> Editar Venda
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem disabled={s.status === "concluida"} onClick={() => updateStatus(s, "concluida")}>
                                <CheckCircle2 className="size-3.5 mr-2 text-emerald-600" /> Marcar concluída
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled={s.status === "em_andamento"} onClick={() => updateStatus(s, "em_andamento")}>
                                <PlayCircle className="size-3.5 mr-2 text-sky-600" /> Em andamento
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled={s.status === "pendente"} onClick={() => updateStatus(s, "pendente")}>
                                <Clock3 className="size-3.5 mr-2 text-amber-600" /> Pendente
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled={s.status === "cancelada"} onClick={() => updateStatus(s, "cancelada")}>
                                <XCircle className="size-3.5 mr-2 text-rose-600" /> Cancelar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => removeOne(s)} className="text-rose-600 focus:text-rose-700">
                                <Trash2 className="size-3.5 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          s.clients?.id && (
                            <Button variant="ghost" size="icon" aria-label="Ver cliente" className="size-8 text-slate-400 hover:text-slate-900" onClick={() => navigate(`/clientes/${s.clients.id}`)}>
                              <Eye className="size-4" />
                            </Button>
                          )
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <SaleFormDialog 
        open={open} 
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditingSale(null);
        }} 
        onCreated={invalidateRelated}
        sale={editingSale}
      />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    concluida: { label: "concluída", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    em_andamento: { label: "em andamento", cls: "bg-sky-50 text-sky-700 border-sky-200" },
    pendente: { label: "pendente", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    cancelada: { label: "cancelada", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  };
  const m = map[status] ?? { label: status, cls: "bg-slate-50 text-slate-600 border-slate-200" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md border text-[10.5px] font-bold uppercase tracking-wider", m.cls)}>
      {m.label}
    </span>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={cn(
      "px-5 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500",
      align === "right" ? "text-right" : "text-left"
    )}>
      {children}
    </th>
  );
}

function SortableTh({
  label, k, sortKey, sortDir, onClick, align = "left",
}: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: SortDir; onClick: (k: SortKey) => void; align?: "left" | "right";
}) {
  const active = sortKey === k;
  return (
    <th className={cn("px-5 py-3", align === "right" ? "text-right" : "text-left")}>
      <button
        onClick={() => onClick(k)}
        className={cn(
          "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors",
          active ? "text-indigo-700" : "text-slate-500 hover:text-slate-900",
          align === "right" && "flex-row-reverse"
        )}
      >
        {label}
        {active && (sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
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
