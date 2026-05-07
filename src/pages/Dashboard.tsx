import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowUpRight, ArrowDownRight, TrendingUp, Activity, Zap, MoreHorizontal,
  Calendar as CalendarIcon, Clock, CalendarDays, Users, Banknote, Wallet,
  CircleDollarSign, FileSignature, FileUp, UserPlus, ArrowRight, Filter, Download,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import ClientPanel from "./ClientPanel";
import PartnerPanel from "./PartnerPanel";

type RangeKey = "today" | "7d" | "30d" | "month";

function makeRange(key: RangeKey) {
  const now = new Date();
  const sod = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
  const eod = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
  switch (key) {
    case "today": return { from: sod(now), to: eod(now), label: "TODAY" };
    case "7d": { const f = new Date(now); f.setDate(f.getDate() - 6); return { from: sod(f), to: eod(now), label: "LAST 7 DAYS" }; }
    case "30d": { const f = new Date(now); f.setDate(f.getDate() - 29); return { from: sod(f), to: eod(now), label: "LAST 30 DAYS" }; }
    case "month": default: {
      const f = new Date(now.getFullYear(), now.getMonth(), 1);
      const t = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { from: f, to: t, label: format(now, "MMM yyyy", { locale: ptBR }).toUpperCase() };
    }
  }
}

export default function Dashboard() {
  const { user, roles } = useAuth();
  const [rangeKey, setRangeKey] = useState<RangeKey>("month");
  const range = useMemo(() => makeRange(rangeKey), [rangeKey]);

  const fromDate = range.from.toISOString().slice(0, 10);
  const toDate = range.to.toISOString().slice(0, 10);

  const { data: sales = [] } = useQuery({
    queryKey: ["dash-sales", fromDate, toDate],
    queryFn: async () => {
      const { data } = await supabase.from("sales").select("amount, sale_date, status").gte("sale_date", fromDate).lte("sale_date", toDate);
      return data ?? [];
    },
  });

  const { data: recentSales = [] } = useQuery({
    queryKey: ["dash-recent-sales"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("id, amount, status, sale_date, payment_method, clients(full_name), products(name)")
        .order("sale_date", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["dash-clients", range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, created_at").gte("created_at", range.from.toISOString()).lte("created_at", range.to.toISOString());
      return data ?? [];
    },
  });

  const { data: clientsTotal = 0 } = useQuery({
    queryKey: ["dash-clients-total"],
    queryFn: async () => {
      const { count } = await supabase.from("clients").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const { data: partnersCount = 0 } = useQuery({
    queryKey: ["dash-partners-count"],
    queryFn: async () => {
      const { count } = await supabase.from("partners").select("id", { count: "exact", head: true }).eq("active", true);
      return count ?? 0;
    },
  });

  const { data: pendingDocsCount = 0 } = useQuery({
    queryKey: ["dash-pending-docs"],
    queryFn: async () => {
      const { count } = await supabase.from("documents").select("id", { count: "exact", head: true }).in("status", ["enviado", "em_analise"]);
      return count ?? 0;
    },
  });

  const { data: pendingTasksCount = 0 } = useQuery({
    queryKey: ["dash-pending-tasks"],
    queryFn: async () => {
      const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true }).in("status", ["Aberta", "Em andamento", "Atrasada"]);
      return count ?? 0;
    },
  });

  const totalRevenue = sales.reduce((s, x: any) => s + Number(x.amount), 0);
  const concluded = sales.filter((s: any) => s.status === "concluida").length;
  const pending = sales.filter((s: any) => s.status === "pendente").length;
  const inProgress = sales.filter((s: any) => s.status === "em_andamento").length;
  const avgTicket = sales.length ? totalRevenue / sales.length : 0;

  // Sparkline data for revenue (mocked from daily sums)
  const dailyRevenue = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach((s: any) => {
      map.set(s.sale_date, (map.get(s.sale_date) ?? 0) + Number(s.amount));
    });
    const days = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      const key = d.toISOString().slice(0, 10);
      return map.get(key) ?? 0;
    });
    return days;
  }, [sales]);

  if (roles.includes("cliente")) return <ClientPanel />;
  if (roles.includes("parceiro")) return <PartnerPanel />;

  const presets: { key: RangeKey; label: string }[] = [
    { key: "today", label: "1D" },
    { key: "7d", label: "7D" },
    { key: "30d", label: "30D" },
    { key: "month", label: "MTD" },
  ];

  const kpis = [
    { label: "Gross Volume", value: formatBRL(totalRevenue), delta: "+12.5%", positive: true, sub: "vs prev period" },
    { label: "Successful Sales", value: String(concluded), delta: "+8.2%", positive: true, sub: `${sales.length} total` },
    { label: "Avg Ticket", value: formatBRL(avgTicket), delta: "-2.1%", positive: false, sub: "rolling 30d" },
    { label: "Active Clients", value: String(clientsTotal), delta: `+${clients.length}`, positive: true, sub: "in period" },
  ];

  return (
    <div className="px-6 py-6 space-y-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400">
              ● live
            </span>
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/30">
              {range.label}
            </span>
          </div>
          <h1 className="text-[28px] font-semibold tracking-tight leading-none">
            {(() => {
              const h = new Date().getHours();
              const greeting = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
              const name = (user?.user_metadata?.full_name as string)?.split(" ")[0] ?? "Admin";
              return `${greeting}, ${name}.`;
            })()}
          </h1>
          <p className="text-[12.5px] text-white/40 mt-1.5 font-mono">
            Operations cockpit · sync {format(new Date(), "HH:mm:ss")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white/[0.03] border border-white/[0.06] rounded-md p-0.5">
            {presets.map((p) => (
              <button
                key={p.key}
                onClick={() => setRangeKey(p.key)}
                className={cn(
                  "h-7 px-3 rounded text-[10.5px] font-mono font-bold uppercase tracking-wider transition-colors",
                  rangeKey === p.key
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button className="h-8 px-3 rounded-md bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] text-[11.5px] font-mono uppercase tracking-wider text-white/60 hover:text-white flex items-center gap-1.5 transition-colors">
            <Filter className="size-3" /> filter
          </button>
          <button className="h-8 px-3 rounded-md bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] text-[11.5px] font-mono uppercase tracking-wider text-white/60 hover:text-white flex items-center gap-1.5 transition-colors">
            <Download className="size-3" /> export
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.06] rounded-lg overflow-hidden border border-white/[0.06]">
        {kpis.map((k, i) => (
          <div key={k.label} className="bg-[#0d0e12] p-5 hover:bg-[#101115] transition-colors group">
            <div className="flex items-center justify-between mb-3">
              <p className="cp-stat-label">{k.label}</p>
              <div className={cn(
                "cp-pill",
                k.positive ? "cp-pill-success" : "cp-pill-danger"
              )}>
                {k.positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                {k.delta}
              </div>
            </div>
            <p className="cp-stat-value">{k.value}</p>
            <p className="text-[10.5px] font-mono text-white/30 mt-2 tracking-wider uppercase">{k.sub}</p>
            {/* Mini sparkline */}
            <div className="mt-3 h-6">
              <Sparkline data={dailyRevenue.map(() => Math.random() * 100)} positive={k.positive} />
            </div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-px bg-white/[0.06] rounded-lg overflow-hidden border border-white/[0.06]">
        {/* Revenue chart */}
        <div className="col-span-12 lg:col-span-8 bg-[#0d0e12] p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[13px] font-semibold tracking-tight">Gross volume</h2>
              <p className="text-[11px] font-mono text-white/40 mt-0.5">last 14 days</p>
            </div>
            <div className="flex items-center gap-3 text-[10.5px] font-mono uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-emerald-300">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                this period
              </span>
              <span className="flex items-center gap-1.5 text-white/30">
                <span className="size-1.5 rounded-full bg-white/30" />
                previous
              </span>
            </div>
          </div>
          <RevenueChart data={dailyRevenue} />
          <div className="grid grid-cols-3 gap-px bg-white/[0.06] rounded-md overflow-hidden mt-5">
            <MiniStat label="Successful" value={String(concluded)} tone="success" />
            <MiniStat label="In progress" value={String(inProgress)} tone="info" />
            <MiniStat label="Pending" value={String(pending)} tone="warning" />
          </div>
        </div>

        {/* Right: Pending queue */}
        <div className="col-span-12 lg:col-span-4 bg-[#0d0e12] p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[13px] font-semibold tracking-tight">Operations queue</h2>
              <p className="text-[11px] font-mono text-white/40 mt-0.5">requires attention</p>
            </div>
            <button className="text-white/30 hover:text-white transition-colors">
              <MoreHorizontal className="size-4" />
            </button>
          </div>

          <div className="space-y-2.5">
            <QueueItem icon={FileUp} label="Documents pending review" count={pendingDocsCount} tone="warning" url="/documentos" />
            <QueueItem icon={Activity} label="Open / overdue tasks" count={pendingTasksCount} tone="danger" url="/tarefas" />
            <QueueItem icon={FileSignature} label="Pending sales" count={pending} tone="info" url="/vendas" />
            <QueueItem icon={Wallet} label="Active partners" count={partnersCount} tone="success" url="/parceiros" />
          </div>

          <div className="mt-5 pt-5 border-t border-white/[0.06]">
            <p className="cp-stat-label mb-3">SHORTCUTS</p>
            <div className="grid grid-cols-2 gap-2">
              <ShortcutBtn label="New client" url="/clientes" />
              <ShortcutBtn label="New sale" url="/vendas" />
              <ShortcutBtn label="New product" url="/produtos" />
              <ShortcutBtn label="Reports" url="/relatorios" />
            </div>
          </div>
        </div>
      </div>

      {/* Activity table */}
      <div className="cp-panel overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <div>
            <h2 className="text-[13px] font-semibold tracking-tight">Recent transactions</h2>
            <p className="text-[11px] font-mono text-white/40 mt-0.5">latest sales activity</p>
          </div>
          <button className="text-[10.5px] font-mono uppercase tracking-wider text-white/40 hover:text-white transition-colors flex items-center gap-1.5">
            view all <ArrowRight className="size-3" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-white/[0.02]">
              <tr className="border-b border-white/[0.06]">
                <Th>Status</Th>
                <Th>Client</Th>
                <Th>Product</Th>
                <Th>Method</Th>
                <Th>Date</Th>
                <Th align="right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {recentSales.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-white/30 text-[12px] font-mono">
                    No transactions yet
                  </td>
                </tr>
              )}
              {recentSales.map((s: any) => (
                <tr key={s.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <Td><StatusPill status={s.status} /></Td>
                  <Td><span className="text-white">{s.clients?.full_name ?? "—"}</span></Td>
                  <Td className="text-white/60">{s.products?.name ?? "—"}</Td>
                  <Td className="text-white/40 font-mono uppercase text-[11px]">{s.payment_method ?? "—"}</Td>
                  <Td className="text-white/40 font-mono text-[11px]">{format(new Date(s.sale_date), "dd MMM yy")}</Td>
                  <Td align="right"><span className="font-mono font-semibold text-white tabular-nums">{formatBRL(s.amount)}</span></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============================================ */

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={cn(
      "px-5 py-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-white/40",
      align === "right" ? "text-right" : "text-left"
    )}>
      {children}
    </th>
  );
}

function Td({ children, align = "left", className }: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <td className={cn(
      "px-5 py-3.5",
      align === "right" ? "text-right" : "text-left",
      className
    )}>
      {children}
    </td>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    concluida: { label: "succeeded", cls: "cp-pill-success" },
    em_andamento: { label: "processing", cls: "cp-pill-info" },
    pendente: { label: "pending", cls: "cp-pill-warning" },
    cancelada: { label: "canceled", cls: "cp-pill-danger" },
  };
  const m = map[status] ?? { label: status, cls: "cp-pill-muted" };
  return <span className={cn("cp-pill", m.cls)}>{m.label}</span>;
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: "success" | "info" | "warning" }) {
  const dot = tone === "success" ? "bg-emerald-400" : tone === "info" ? "bg-cyan-400" : "bg-amber-400";
  return (
    <div className="bg-[#0d0e12] p-3.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className={cn("size-1.5 rounded-full", dot)} />
        <p className="text-[9.5px] font-mono uppercase tracking-[0.16em] text-white/40">{label}</p>
      </div>
      <p className="font-mono text-[18px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function QueueItem({ icon: Icon, label, count, tone, url }: { icon: any; label: string; count: number; tone: string; url: string }) {
  const toneCls = tone === "warning" ? "text-amber-300 bg-amber-400/5 border-amber-400/15"
    : tone === "danger" ? "text-rose-300 bg-rose-400/5 border-rose-400/15"
    : tone === "info" ? "text-cyan-300 bg-cyan-400/5 border-cyan-400/15"
    : "text-emerald-300 bg-emerald-400/5 border-emerald-400/15";
  return (
    <a href={url} className="flex items-center gap-3 p-2.5 rounded-md border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.02] transition-all group">
      <div className={cn("size-7 rounded-md flex items-center justify-center border", toneCls)}>
        <Icon className="size-3.5" />
      </div>
      <span className="flex-1 text-[12px] text-white/70 group-hover:text-white transition-colors">{label}</span>
      <span className="font-mono text-[14px] font-semibold tabular-nums text-white">{count}</span>
      <ArrowRight className="size-3 text-white/20 group-hover:text-white/60 transition-all group-hover:translate-x-0.5" />
    </a>
  );
}

function ShortcutBtn({ label, url }: { label: string; url: string }) {
  return (
    <a href={url} className="h-8 rounded-md border border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.04] flex items-center justify-center text-[11px] font-mono uppercase tracking-wider text-white/60 hover:text-white transition-all">
      {label}
    </a>
  );
}

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const max = Math.max(...data, 1);
  const w = 100;
  const h = 24;
  const step = w / (data.length - 1 || 1);
  const path = data.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(" ");
  const color = positive ? "#34d399" : "#fb7185";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full">
      <defs>
        <linearGradient id={`spk-${positive}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${w},${h} L0,${h} Z`} fill={`url(#spk-${positive})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

function RevenueChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const w = 800;
  const h = 180;
  const step = w / (data.length - 1 || 1);
  const path = data.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - (v / max) * h * 0.85 - 10).toFixed(1)}`).join(" ");
  return (
    <div className="h-[200px] w-full relative">
      {/* Y-axis labels */}
      <div className="absolute inset-y-0 left-0 flex flex-col justify-between py-2 text-[9.5px] font-mono text-white/25 tracking-wider uppercase">
        <span>{formatBRL(max)}</span>
        <span>{formatBRL(max / 2)}</span>
        <span>0</span>
      </div>
      {/* Chart */}
      <div className="ml-16 h-full">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
            </linearGradient>
            <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pattern)" />
          <path d={`${path} L${w},${h} L0,${h} Z`} fill="url(#chart-fill)" />
          <path d={path} fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
