import { useMemo, useState } from "react";
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
    <div className="page-shell space-y-8 animate-fade-up">
      <PageHero
        eyebrow="Ledger"
        category="Sales Activity"
        title="Vendas"
        description="Log operacional de transações sincronizado em tempo real."
        icon={<ShoppingBag className="size-6" />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCSV} className="h-10 px-4 gap-2">
              <Download className="size-4" /> Exportar
            </Button>
            <Button size="sm" onClick={() => setOpen(true)} className="action-button btn-primary shadow-xl">
              <Plus className="size-4" strokeWidth={3} /> Nova Venda
            </Button>

          </>
        }
        kpis={[
          { label: "Volume Bruto", value: formatBRL(kpis.total), tone: "primary", icon: <CircleDollarSign className="size-4" /> },
          { label: "Concluídas", value: formatBRL(kpis.concluida), tone: "success", icon: <CheckCircle2 className="size-4" /> },
          { label: "Em Andamento", value: formatBRL(kpis.em_andamento), tone: "info", icon: <PlayCircle className="size-4" /> },
          { label: "Pendentes", value: formatBRL(kpis.pendente), tone: "warning", icon: <Clock3 className="size-4" /> },
          { label: "Total Registros", value: String(kpis.count), tone: "primary", icon: <TrendingUp className="size-4" /> },
        ]}
      />

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
                <Th>Data</Th>
                <Th align="right">Valor</Th>
                <Th align="right">Ações</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading ? (
                <tr><td colSpan={6} className="py-24 text-center text-muted-foreground/50 animate-pulse">Sincronizando transações...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-24 text-center text-muted-foreground/50">Nenhuma transação encontrada.</td></tr>
              ) : filtered.map((s: any) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors group">
                  <Td><StatusPill status={s.status} /></Td>
                  <Td>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate cursor-pointer hover:text-primary transition-colors" onClick={() => navigate(`/clientes/${s.clients?.id}`)}>
                        {s.clients?.full_name ?? "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground/60 truncate uppercase tracking-wider mt-0.5">{s.clients?.company || "Conta Pessoal"}</p>
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
                  <Td className="text-muted-foreground text-xs">{formatDate(s.sale_date)}</Td>
                  <Td align="right"><span className="font-semibold text-foreground tabular-nums">{formatBRL(s.amount)}</span></Td>
                  <Td align="right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground/40 hover:text-foreground">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/clientes/${s.clients?.id}`)}><Eye className="size-3.5 mr-2" /> Ver Cliente</DropdownMenuItem>
                        <DropdownMenuItem><Clock3 className="size-3.5 mr-2" /> Mudar Status</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => removeOne(s)} className="text-destructive focus:text-destructive"><Trash2 className="size-3.5 mr-2" /> Excluir</DropdownMenuItem>
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
