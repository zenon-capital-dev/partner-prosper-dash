import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus, Search, Download, MoreHorizontal, CheckCircle2, XCircle, PlayCircle,
  Clock3, Trash2, Eye, ShoppingBag, X, SlidersHorizontal,
  CalendarRange, Sparkles, Filter, ArrowUpRight,
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

type StatusKey = "todos" | "pendente" | "em_andamento" | "concluida" | "cancelada";

export default function Sales() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusKey>("todos");
  const [partnerFilter, setPartnerFilter] = useState("todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const qc = useQueryClient();
  const navigate = useNavigate();

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
    return sales.filter((s: any) => {
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
  }, [sales, status, partnerFilter, dateFrom, dateTo, search]);

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

  const removeOne = async (s: any) => {
    if (!confirm(`Excluir venda de ${formatBRL(s.amount)}?`)) return;
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
    <div className="px-6 py-6 space-y-6 max-w-[1600px] admin-shell">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400">● ledger</span>
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/30">SALES ACTIVITY</span>
          </div>
          <h1 className="text-[28px] font-semibold tracking-tight leading-none text-white">Sales</h1>
          <p className="text-[12.5px] text-white/40 mt-1.5 font-mono">
            Operational transaction log · sync live
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="h-8 px-3 rounded-md bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] text-[11.5px] font-mono uppercase tracking-wider text-white/60 hover:text-white flex items-center gap-1.5 transition-colors">
            <Download className="size-3" /> export
          </button>
          <button onClick={() => setOpen(true)} className="h-8 px-4 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold uppercase tracking-wider text-[11.5px] flex items-center gap-1.5 transition-colors">
            <Plus className="size-3.5" strokeWidth={3} /> New Sale
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-white/[0.06] rounded-lg overflow-hidden border border-white/[0.06]">
        <MiniKpi label="Gross Volume" value={formatBRL(kpis.total)} />
        <MiniKpi label="Succeeded" value={formatBRL(kpis.concluida)} tone="success" />
        <MiniKpi label="Processing" value={formatBRL(kpis.em_andamento)} tone="info" />
        <MiniKpi label="Pending" value={formatBRL(kpis.pendente)} tone="warning" />
        <MiniKpi label="Total Count" value={String(kpis.count)} />
      </div>

      {/* Filter Bar */}
      <div className="cp-panel p-3 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1">
          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-md h-9 pl-9 pr-4 text-[13px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as StatusKey)}>
            <SelectTrigger className="h-9 w-[130px] bg-white/[0.03] border-white/[0.06] text-white/60 text-[11px] font-mono uppercase tracking-wider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#12141a] border-white/[0.1] text-white">
              <SelectItem value="todos">All Status</SelectItem>
              <SelectItem value="concluida">Succeeded</SelectItem>
              <SelectItem value="em_andamento">Processing</SelectItem>
              <SelectItem value="pendente">Pending</SelectItem>
              <SelectItem value="cancelada">Canceled</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-md px-2 h-9">
            <CalendarRange className="size-3.5 text-white/20" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-transparent text-[11px] text-white/60 font-mono outline-none" />
            <span className="text-white/20">/</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-transparent text-[11px] text-white/60 font-mono outline-none" />
          </div>

          {hasActiveFilters && (
            <button onClick={clearFilters} className="h-9 px-3 text-white/40 hover:text-white transition-colors">
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Table Content */}
      <div className="cp-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-white/[0.02]">
              <tr className="border-b border-white/[0.06]">
                <Th>Status</Th>
                <Th>Account / Client</Th>
                <Th>Product</Th>
                <Th>Date</Th>
                <Th align="right">Amount</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="py-24 text-center text-white/20 font-mono">Syncing transactions...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-24 text-center text-white/20 font-mono">No transactions found.</td></tr>
              ) : filtered.map((s: any) => (
                <tr key={s.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                  <Td><StatusPill status={s.status} /></Td>
                  <Td>
                    <div className="min-w-0">
                      <p className="font-semibold text-white truncate cursor-pointer hover:underline" onClick={() => navigate(`/clientes/${s.clients?.id}`)}>
                        {s.clients?.full_name ?? "—"}
                      </p>
                      <p className="text-[11px] text-white/30 truncate font-mono uppercase tracking-wider">{s.clients?.company || "Personal Account"}</p>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                       {s.products?.product_categories && (
                         <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border" style={{ borderColor: `${s.products.product_categories.color}30`, color: s.products.product_categories.color }}>
                           {s.products.product_categories.name.toUpperCase()}
                         </span>
                       )}
                       <span className="text-white/60">{s.products?.name ?? "—"}</span>
                    </div>
                  </Td>
                  <Td className="text-white/40 font-mono text-[11px] uppercase tracking-wider">{formatDate(s.sale_date)}</Td>
                  <Td align="right"><span className="font-mono font-semibold text-white tabular-nums">{formatBRL(s.amount)}</span></Td>
                  <Td align="right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="size-8 rounded-md hover:bg-white/5 flex items-center justify-center text-white/20 hover:text-white transition-colors">
                          <MoreHorizontal className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#12141a] border-white/[0.1] text-white">
                        <DropdownMenuItem onClick={() => navigate(`/clientes/${s.clients?.id}`)}><Eye className="size-3.5 mr-2" /> View Client</DropdownMenuItem>
                        <DropdownMenuItem><Clock3 className="size-3.5 mr-2" /> Change Status</DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/[0.06]" />
                        <DropdownMenuItem onClick={() => removeOne(s)} className="text-rose-400 focus:text-rose-400 focus:bg-rose-400/10"><Trash2 className="size-3.5 mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SaleFormDialog open={open} onOpenChange={setOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["sales-rich"] })} />
    </div>
  );
}

function MiniKpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-[#0d0e12] p-4 lg:p-5">
      <p className="cp-stat-label mb-2">{label}</p>
      <div className="flex items-center justify-between">
        <p className={cn("cp-stat-value text-[20px] lg:text-[22px]", tone === "success" && "text-emerald-400", tone === "info" && "text-cyan-400", tone === "warning" && "text-amber-400")}>{value}</p>
        <ArrowUpRight className={cn("size-3.5", tone === "success" ? "text-emerald-400" : "text-white/10")} />
      </div>
    </div>
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
  return <span className={cn("cp-pill uppercase tracking-widest text-[9px]", m.cls)}>{m.label}</span>;
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={cn(
      "px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-white/40",
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
