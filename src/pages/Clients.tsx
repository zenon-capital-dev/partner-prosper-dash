import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Search, Eye, Trash2, Users, UserCheck, UserPlus,
  TrendingUp, LayoutGrid, List, Download, Crown, X, Pencil,
  ArrowUpRight, MoreHorizontal
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
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const navigate = useNavigate();
  const qc = useQueryClient();

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

    const sorted = [...list];
    if (sortBy === "name") sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
    else if (sortBy === "revenue") sorted.sort((a, b) => b._ltv - a._ltv);
    else if (sortBy === "sales") sorted.sort((a, b) => b._salesCount - a._salesCount);
    else sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return sorted;
  }, [enriched, search, statusFilter, sortBy]);

  const kpis = useMemo(() => {
    const total = enriched.length;
    const active = enriched.filter((c: any) => c.status === "ativo").length;
    const prospects = enriched.filter((c: any) => c.status === "prospecto").length;
    const totalLTV = enriched.reduce((s: number, c: any) => s + c._ltv, 0);
    return { total, active, prospects, totalLTV };
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

  return (
    <div className="page-shell space-y-10 animate-fade-up">
      <PageHero
        eyebrow="Portfolio"
        category="Account Management"
        title="Clientes"
        description="Gestão 360º da carteira de clientes, acompanhamento de LTV e jornada de sucesso."
        icon={<Users className="size-6" />}
        actions={
          <Button size="sm" onClick={() => setOpen(true)} className="action-button btn-primary shadow-xl">
            <Plus className="size-4" strokeWidth={3} /> Novo Cliente
          </Button>
        }
        kpis={[
          { label: "Total Carteira", value: kpis.total, tone: "primary", icon: <Users className="size-4" /> },
          { label: "Clientes Ativos", value: kpis.active, tone: "success", icon: <UserCheck className="size-4" /> },
          { label: "Prospectos", value: kpis.prospects, tone: "warning", icon: <UserPlus className="size-4" /> },
          { label: "Portfolio LTV", value: formatBRL(kpis.totalLTV), tone: "primary", icon: <Crown className="size-4" /> },
        ]}
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
          <Input
            placeholder="Buscar por nome, empresa ou email..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 bg-white/[0.02] border-white/[0.05] rounded-xl focus:border-primary/50 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="h-11 w-[140px] bg-white/[0.02] border-white/[0.05] rounded-xl text-xs font-bold uppercase tracking-wider"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Status</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="prospecto">Prospectos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center bg-white/[0.02] border border-white/[0.05] rounded-xl p-1">
            <button onClick={() => setView("list")} className={cn("size-9 rounded-lg flex items-center justify-center transition-all", view === "list" ? "bg-white/[0.08] text-white" : "text-white/20 hover:text-white")}>
              <List className="size-4" />
            </button>
            <button onClick={() => setView("grid")} className={cn("size-9 rounded-lg flex items-center justify-center transition-all", view === "grid" ? "bg-white/[0.08] text-white" : "text-white/20 hover:text-white")}>
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {view === "list" ? (
        <div className="bg-white/[0.01] border border-white/[0.05] rounded-2xl overflow-hidden shadow-2xl">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.05] bg-white/[0.01]">
                <th className="px-6 py-5 text-left editorial-label">Cliente / Empresa</th>
                <th className="px-6 py-5 text-left editorial-label">Status</th>
                <th className="px-6 py-5 text-left editorial-label">Indicação</th>
                <th className="px-6 py-5 text-right editorial-label">Portfolio LTV</th>
                <th className="px-6 py-5 text-right editorial-label">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {filtered.map((c: any) => (
                <tr key={c.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="size-11 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-sm font-bold shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]">
                        {initials(c.full_name)}
                      </div>
                      <div>
                        <p className="font-bold text-white group-hover:text-primary transition-colors text-base cursor-pointer" onClick={() => navigate(`/clientes/${c.id}`)}>
                          {c.full_name}
                        </p>
                        <p className="text-[11px] text-white/20 font-mono uppercase tracking-widest">{c.company || "Conta Pessoal"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <StatusPill status={c.status} />
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-white/40 text-xs font-bold uppercase tracking-wider">{c.partners?.full_name || "Direto"}</span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <p className="font-mono font-bold text-primary text-base">{formatBRL(c._ltv)}</p>
                    <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">{c._salesCount} Vendas</p>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => navigate(`/clientes/${c.id}`)} className="action-button btn-outline h-9 w-9 p-0">
                        <ArrowUpRight className="size-4" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="size-9 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-all">
                            <MoreHorizontal className="size-4 text-white/40" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                           <DropdownMenuItem onClick={() => navigate(`/clientes/${c.id}`)} className="text-xs uppercase font-bold tracking-wider"><Eye className="size-3.5 mr-2" /> Visualizar</DropdownMenuItem>
                           <DropdownMenuItem className="text-xs uppercase font-bold tracking-wider"><Pencil className="size-3.5 mr-2" /> Editar</DropdownMenuItem>
                           <DropdownMenuSeparator className="bg-white/[0.05]" />
                           <DropdownMenuItem onClick={() => handleDelete(c.id)} className="text-xs uppercase font-bold tracking-wider text-destructive"><Trash2 className="size-3.5 mr-2" /> Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {filtered.map((c: any) => (
            <div key={c.id} className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 hover:border-primary/30 transition-all group cursor-pointer" onClick={() => navigate(`/clientes/${c.id}`)}>
               <div className="flex items-start justify-between mb-8">
                  <div className="size-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-xl font-bold">
                    {initials(c.full_name)}
                  </div>
                  <StatusPill status={c.status} />
               </div>
               <h3 className="text-xl font-bold text-white mb-1 group-hover:text-primary transition-colors">{c.full_name}</h3>
               <p className="editorial-label mb-6">{c.company || "Conta Pessoal"}</p>
               <div className="pt-6 border-t border-white/5">
                  <p className="editorial-label mb-1">Portfolio LTV</p>
                  <p className="text-lg font-bold font-mono text-primary">{formatBRL(c._ltv)}</p>
               </div>
            </div>
          ))}
        </div>
      )}

      <ClientFormDialog open={open} onOpenChange={setOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["clients-rich"] })} />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: any = {
    ativo: { label: "active", cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
    prospecto: { label: "prospect", cls: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
    inativo: { label: "inactive", cls: "text-white/20 bg-white/[0.03] border-white/[0.05]" },
  };
  const m = map[status] || { label: status, cls: "text-white/40 bg-white/[0.03] border-white/[0.05]" };
  return (
    <span className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border", m.cls)}>
      {m.label}
    </span>
  );
}
