import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Search, MoreHorizontal, Eye, Trash2, Users, UserCheck, UserPlus,
  TrendingUp, LayoutGrid, List, SlidersHorizontal, Download, 
  ArrowUpRight, Crown, X, Pencil, Filter,
} from "lucide-react";
import { formatBRL, initials } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { PageHero } from "@/components/PageHero";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ViewMode = "list" | "grid";
type StatusFilter = "todos" | "ativo" | "prospecto" | "inativo";
type SortKey = "recent" | "name" | "revenue" | "sales";

export default function Clients() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ViewMode>("list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [partnerFilter, setPartnerFilter] = useState<string>("todos");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: partnersList = [] } = useQuery({
    queryKey: ["partners-filter"],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, full_name").order("full_name");
      return data ?? [];
    },
  });

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients-rich"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(`
          id, full_name, email, phone, company, status, created_at, tags, city, state,
          partner_id, partners(id, full_name),
          sales(id, amount, status, sale_date)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const enriched = useMemo(() => {
    return (clients ?? []).map((c: any) => {
      const sales = c.sales ?? [];
      const ltv = sales.reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
      const salesCount = sales.length;
      return {
        ...c,
        _ltv: ltv,
        _salesCount: salesCount,
      };
    });
  }, [clients]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c: any) =>
          c.full_name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.phone?.includes(q),
      );
    }
    if (statusFilter !== "todos") list = list.filter((c: any) => c.status === statusFilter);
    if (partnerFilter === "sem") list = list.filter((c: any) => !c.partner_id);
    else if (partnerFilter !== "todos") list = list.filter((c: any) => c.partner_id === partnerFilter);

    const sorted = [...list];
    if (sortBy === "name") sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
    else if (sortBy === "revenue") sorted.sort((a, b) => b._ltv - a._ltv);
    else if (sortBy === "sales") sorted.sort((a, b) => b._salesCount - a._salesCount);
    else sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return sorted;
  }, [enriched, search, statusFilter, partnerFilter, sortBy]);

  const kpis = useMemo(() => {
    const total = enriched.length;
    const active = enriched.filter((c: any) => c.status === "ativo").length;
    const prospects = enriched.filter((c: any) => c.status === "prospecto").length;
    const totalLTV = enriched.reduce((s: number, c: any) => s + c._ltv, 0);
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth = enriched.filter((c: any) => new Date(c.created_at) >= startMonth).length;
    return { total, active, prospects, totalLTV, newThisMonth };
  }, [enriched]);

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este cliente?")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Cliente excluído");
      qc.invalidateQueries({ queryKey: ["clients-rich"] });
    }
  };

  const exportCSV = () => {
    const rows = [
      ["Nome", "Email", "Telefone", "Empresa", "Status", "Parceiro", "Vendas", "LTV"],
      ...filtered.map((c: any) => [
        c.full_name, c.email ?? "", c.phone ?? "", c.company ?? "",
        c.status, c.partners?.full_name ?? "", c._salesCount, c._ltv.toFixed(2),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "clientes.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("todos");
    setPartnerFilter("todos");
    setSortBy("recent");
  };
  const hasFilters = !!search || statusFilter !== "todos" || partnerFilter !== "todos" || sortBy !== "recent";

  return (
    <div className="page-shell space-y-8 animate-fade-up">
      <PageHero
        eyebrow="Management"
        category="Client Portfolio"
        title="Clientes"
        description={`${enriched.length} registros sincronizados em tempo real. Gerencie carteira, indicações e LTV em um só lugar.`}
        icon={<Users className="size-6" />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCSV} className="h-10 px-4 gap-2">
              <Download className="size-4" /> Exportar
            </Button>
            <Button size="sm" onClick={() => setOpen(true)} className="btn-premium h-10 px-5 gap-2 font-semibold">
              <Plus className="size-4" strokeWidth={2.5} /> Novo Cliente
            </Button>
          </>
        }
        kpis={[
          { label: "Total Clientes", value: kpis.total, tone: "primary", icon: <Users className="size-4" /> },
          { label: "Ativos", value: kpis.active, tone: "success", icon: <UserCheck className="size-4" /> },
          { label: "Prospects", value: kpis.prospects, tone: "warning", icon: <UserPlus className="size-4" /> },
          { label: "Novos no mês", value: kpis.newThisMonth, tone: "info", icon: <TrendingUp className="size-4" /> },
          { label: "Portfolio LTV", value: formatBRL(kpis.totalLTV), tone: "primary", icon: <Crown className="size-4" /> },
        ]}
      />


      {/* Filter Bar */}
      <div className="toolbar">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="Buscar por nome, email, empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-background/60 border-border h-10 pl-10 pr-4 text-sm rounded-xl"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="h-10 w-[140px] bg-background/60 rounded-xl text-xs font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="prospecto">Prospects</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="h-10 w-[160px] bg-background/60 rounded-xl text-xs font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="name">Nome A-Z</SelectItem>
              <SelectItem value="revenue">Maior LTV</SelectItem>
              <SelectItem value="sales">Mais vendas</SelectItem>
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="icon" onClick={clearFilters} className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </Button>
          )}

          <div className="flex items-center bg-muted/40 border border-border/60 rounded-xl p-1 ml-1">
            <button onClick={() => setView("list")} className={cn("size-8 rounded-lg flex items-center justify-center transition-all", view === "list" ? "bg-background text-primary shadow-sm" : "text-muted-foreground/60 hover:text-foreground")}>
              <List className="size-4" />
            </button>
            <button onClick={() => setView("grid")} className={cn("size-8 rounded-lg flex items-center justify-center transition-all", view === "grid" ? "bg-background text-primary shadow-sm" : "text-muted-foreground/60 hover:text-foreground")}>
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="vx-card overflow-hidden">
        {isLoading ? (
          <div className="py-32 text-center text-muted-foreground/30 font-mono text-[13px] animate-pulse">Synchronizing data...</div>
        ) : filtered.length === 0 ? (
          <div className="py-32 text-center text-muted-foreground/30 font-mono text-[13px]">No records found.</div>
        ) : view === "list" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <Th>Client / Account</Th>
                  <Th>Status</Th>
                  <Th>Indication</Th>
                  <Th align="right">LTV</Th>
                  <Th align="right">Sales</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filtered.map((c: any) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors group">
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-md bg-muted border border-border/50 flex items-center justify-center text-[11px] font-mono text-muted-foreground group-hover:text-primary group-hover:border-primary/20 transition-all">
                          {initials(c.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate cursor-pointer hover:text-primary transition-colors" onClick={() => navigate(`/clientes/${c.id}`)}>
                            {c.full_name}
                          </p>
                          <p className="text-[11px] text-muted-foreground/50 truncate font-mono uppercase tracking-wider">{c.company || "Personal Account"}</p>
                        </div>
                      </div>
                    </Td>
                    <Td><StatusPill status={c.status} /></Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">{c.partners?.full_name || "Direct"}</span>
                      </div>
                    </Td>
                    <Td align="right"><span className="font-mono font-semibold tabular-nums">{formatBRL(c._ltv)}</span></Td>
                    <Td align="right"><span className="font-mono text-muted-foreground/60 tabular-nums">{c._salesCount}</span></Td>
                    <Td align="right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground/40 hover:text-foreground">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/clientes/${c.id}`)}><Eye className="size-3.5 mr-2" /> View Details</DropdownMenuItem>
                          <DropdownMenuItem><Pencil className="size-3.5 mr-2" /> Edit Info</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(c.id)} className="text-destructive focus:text-destructive"><Trash2 className="size-3.5 mr-2" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-border/20">
            {filtered.map((c: any) => (
              <div key={c.id} className="bg-background p-5 hover:bg-muted/10 transition-colors group relative border-r border-b border-border/20">
                <div className="flex items-start justify-between mb-4">
                  <div className="size-10 rounded-lg bg-muted border border-border/50 flex items-center justify-center text-[13px] font-mono text-muted-foreground group-hover:text-primary group-hover:border-primary/20 transition-all">
                    {initials(c.full_name)}
                  </div>
                  <StatusPill status={c.status} />
                </div>
                <h3 className="font-semibold truncate hover:text-primary cursor-pointer transition-colors" onClick={() => navigate(`/clientes/${c.id}`)}>{c.full_name}</h3>
                <p className="text-[11px] text-muted-foreground/50 font-mono uppercase tracking-wider mt-1 truncate">{c.company || "Personal Account"}</p>
                <div className="mt-6 pt-4 border-t border-border/20 flex items-center justify-between">
                   <div>
                     <p className="vx-kpi-label">LTV</p>
                     <p className="font-mono font-bold text-[15px] tabular-nums mt-0.5">{formatBRL(c._ltv)}</p>
                   </div>
                   <div className="text-right">
                     <p className="vx-kpi-label">Sales</p>
                     <p className="font-mono text-muted-foreground/60 text-[15px] tabular-nums mt-0.5">{c._salesCount}</p>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ClientFormDialog open={open} onOpenChange={setOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["clients-rich"] })} />
    </div>
  );
}

function MiniKpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-card p-6">
      <p className="vx-kpi-label mb-2.5 opacity-40">{label}</p>
      <div className="flex items-center justify-between">
        <p className={cn("vx-kpi-value text-2xl tracking-tight font-bold", 
          tone === "primary" ? "text-primary" : 
          tone === "success" ? "text-success" :
          tone === "warning" ? "text-warning" :
          tone === "info" ? "text-info" : ""
        )}>{value}</p>
        <TrendingUp className={cn("size-4", tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-muted-foreground/10")} />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ativo: { label: "active", cls: "vx-pill-success" },
    prospecto: { label: "prospect", cls: "vx-pill-warning" },
    inativo: { label: "inactive", cls: "vx-pill-danger" },
  };
  const m = map[status] ?? { label: status, cls: "vx-pill" };
  return <span className={cn("vx-pill px-2 py-0.5 text-[9px] font-black tracking-[0.1em]", m.cls)}>{m.label}</span>;
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={cn(
      "px-5 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-muted-foreground/40",
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
