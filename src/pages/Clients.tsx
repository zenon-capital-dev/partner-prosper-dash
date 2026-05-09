import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Search, Trash2, Users, UserCheck, UserPlus,
  LayoutGrid, List, MoreHorizontal, ArrowUpRight,
  Filter, Calendar, Building2, MapPin, CreditCard,
  User, Mail, Phone, ShoppingBag
} from "lucide-react";
import { formatBRL, initials, formatDoc } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { PageHero } from "@/components/PageHero";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DateRange } from "react-day-picker";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

type ViewMode = "list" | "grid";

export default function Clients() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ViewMode>("list");
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [partnerFilter, setPartnerFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients-admin-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(`
          *,
          partners(id, full_name),
          client_products(
            id,
            value,
            status,
            product_id,
            products(id, name)
          ),
          payments(
            id,
            amount,
            amount_paid,
            status
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-minimal"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name").eq("active", true);
      return data ?? [];
    }
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["partners-minimal"],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, full_name");
      return data ?? [];
    }
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["providers-minimal"],
    queryFn: async () => {
      const { data } = await supabase.from("service_providers").select("id, name").eq("active", true);
      return data ?? [];
    }
  });

  const cities = useMemo(() => {
    const set = new Set(clients.map(c => c.city).filter(Boolean));
    return Array.from(set).sort();
  }, [clients]);

  const enriched = useMemo(() => {
    return clients.map((c: any) => {
      const totalContracted = c.client_products?.reduce((acc: number, p: any) => acc + Number(p.value || 0), 0) || 0;
      const totalPaid = c.payments?.filter((p: any) => p.status === "pago").reduce((acc: number, p: any) => acc + Number(p.amount_paid || p.amount || 0), 0) || 0;
      const totalPending = Math.max(0, totalContracted - totalPaid);
      const productNames = c.client_products?.map((p: any) => p.products?.name).filter(Boolean) || [];
      
      return {
        ...c,
        _totalContracted: totalContracted,
        _totalPaid: totalPaid,
        _totalPending: totalPending,
        _productNames: productNames,
      };
    });
  }, [clients]);

  const filtered = useMemo(() => {
    return enriched.filter((c: any) => {
      if (search) {
        const q = search.toLowerCase();
        const matches = 
          c.full_name?.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.document?.includes(q);
        if (!matches) return false;
      }

      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      
      if (productFilter !== "all") {
        const hasProduct = c.client_products?.some((p: any) => p.product_id === productFilter);
        if (!hasProduct) return false;
      }

      if (partnerFilter !== "all" && c.partner_id !== partnerFilter) return false;
      
      if (providerFilter !== "all" && c.service_provider_id !== providerFilter) return false;

      if (cityFilter !== "all" && c.city !== cityFilter) return false;

      if (paymentFilter !== "all") {
        if (paymentFilter === "pago" && c._totalPending > 0) return false;
        if (paymentFilter === "pendente" && c._totalPending === 0) return false;
      }

      if (dateRange?.from) {
        const createdAt = new Date(c.created_at);
        if (createdAt < dateRange.from) return false;
        if (dateRange.to && createdAt > dateRange.to) return false;
      }

      return true;
    });
  }, [enriched, search, statusFilter, productFilter, partnerFilter, providerFilter, cityFilter, paymentFilter, dateRange]);

  const kpis = useMemo(() => {
    const total = enriched.length;
    const active = enriched.filter((c: any) => c.status === "ativo").length;
    const prospects = enriched.filter((c: any) => c.status === "prospecto").length;
    const totalRevenue = enriched.reduce((s: number, c: any) => s + c._totalContracted, 0);
    return { total, active, prospects, totalRevenue };
  }, [enriched]);

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este cliente permanentemente?")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Cliente removido com sucesso");
      qc.invalidateQueries({ queryKey: ["clients-admin-list"] });
    }
  };

  const resetFilters = () => {
    setStatusFilter("all");
    setProductFilter("all");
    setPartnerFilter("all");
    setProviderFilter("all");
    setCityFilter("all");
    setPaymentFilter("all");
    setDateRange(undefined);
  };

  return (
    <div className="page-shell space-y-10 animate-fade-up">
      <PageHero
        eyebrow="CRM"
        category="Management"
        title="Gestão de Clientes"
        description="Controle total da carteira de clientes, produtos contratados e saúde financeira."
        icon={<Users className="size-6" />}
        actions={
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" className="action-button border-white/10 text-white/60 hover:text-white" onClick={resetFilters}>
              Limpar Filtros
            </Button>
            <Button size="sm" onClick={() => setOpen(true)} className="action-button btn-primary shadow-xl">
              <Plus className="size-4 mr-2" strokeWidth={3} /> Novo Cliente
            </Button>
          </div>
        }
        kpis={[
          { label: "Total Clientes", value: kpis.total, tone: "primary", icon: <Users className="size-4" /> },
          { label: "Ativos", value: kpis.active, tone: "success", icon: <UserCheck className="size-4" /> },
          { label: "Prospectos", value: kpis.prospects, tone: "warning", icon: <UserPlus className="size-4" /> },
          { label: "Faturamento", value: formatBRL(kpis.totalRevenue), tone: "primary", icon: <CreditCard className="size-4" /> },
        ]}
      />

      {/* Advanced Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <div className="relative col-span-1 md:col-span-2">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
          <Input
            placeholder="Buscar por nome, empresa, documento ou email..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 bg-white/[0.02] border-white/[0.05] rounded-xl focus:border-primary/50 transition-all"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11 bg-white/[0.02] border-white/[0.05] rounded-xl text-xs font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <Filter className="size-3.5 text-white/20" />
              <SelectValue placeholder="Status" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="prospecto">Prospecto</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>

        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="h-11 bg-white/[0.02] border-white/[0.05] rounded-xl text-xs font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <ShoppingBag className="size-3.5 text-white/20" />
              <SelectValue placeholder="Produto" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Produtos</SelectItem>
            {products.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={partnerFilter} onValueChange={setPartnerFilter}>
          <SelectTrigger className="h-11 bg-white/[0.02] border-white/[0.05] rounded-xl text-xs font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <UserPlus className="size-3.5 text-white/20" />
              <SelectValue placeholder="Parceiro" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Parceiros</SelectItem>
            <SelectItem value="null">Direto (Sem Parceiro)</SelectItem>
            {partners.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={providerFilter} onValueChange={setProviderFilter}>
          <SelectTrigger className="h-11 bg-white/[0.02] border-white/[0.05] rounded-xl text-xs font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <User className="size-3.5 text-white/20" />
              <SelectValue placeholder="Prestador" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Prestadores</SelectItem>
            {providers.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="h-11 bg-white/[0.02] border-white/[0.05] rounded-xl text-xs font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <MapPin className="size-3.5 text-white/20" />
              <SelectValue placeholder="Cidade" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Cidades</SelectItem>
            {cities.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="h-11 bg-white/[0.02] border-white/[0.05] rounded-xl text-xs font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <CreditCard className="size-3.5 text-white/20" />
              <SelectValue placeholder="Pagamento" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Pagamentos</SelectItem>
            <SelectItem value="pago">Totalmente Pago</SelectItem>
            <SelectItem value="pendente">Com Pendência</SelectItem>
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("h-11 bg-white/[0.02] border-white/[0.05] rounded-xl text-xs font-bold uppercase tracking-wider justify-start", !dateRange && "text-white/20")}>
              <Calendar className="size-3.5 mr-2" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "dd/MM", { locale: ptBR })} - {format(dateRange.to, "dd/MM", { locale: ptBR })}
                  </>
                ) : (
                  format(dateRange.from, "dd/MM", { locale: ptBR })
                )
              ) : (
                "Data Cadastro"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        <div className="flex items-center bg-white/[0.02] border border-white/[0.05] rounded-xl p-1">
          <button onClick={() => setView("list")} className={cn("flex-1 h-9 rounded-lg flex items-center justify-center transition-all", view === "list" ? "bg-white/[0.08] text-white" : "text-white/20 hover:text-white")}>
            <List className="size-4" />
          </button>
          <button onClick={() => setView("grid")} className={cn("flex-1 h-9 rounded-lg flex items-center justify-center transition-all", view === "grid" ? "bg-white/[0.08] text-white" : "text-white/20 hover:text-white")}>
            <LayoutGrid className="size-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/20 font-mono animate-pulse">
           <div className="size-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin mb-4" />
           Sincronizando base de clientes...
        </div>
      ) : view === "list" ? (
        <div className="bg-white/[0.01] border border-white/[0.05] rounded-2xl overflow-x-auto shadow-2xl">
          <table className="w-full text-[13px] min-w-[1200px]">
            <thead>
              <tr className="border-b border-white/[0.05] bg-white/[0.01]">
                <th className="px-6 py-5 text-left editorial-label">Cliente / Empresa</th>
                <th className="px-6 py-5 text-left editorial-label">Documento / Contato</th>
                <th className="px-6 py-5 text-left editorial-label">Localização</th>
                <th className="px-6 py-5 text-left editorial-label">Origem / Parceiro</th>
                <th className="px-6 py-5 text-left editorial-label">Produtos</th>
                <th className="px-6 py-5 text-left editorial-label">Status</th>
                <th className="px-6 py-5 text-right editorial-label">Financeiro</th>
                <th className="px-6 py-5 text-right editorial-label">Cadastro</th>
                <th className="px-6 py-5 text-right editorial-label">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {filtered.map((c: any) => (
                <tr key={c.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="px-6 py-5 max-w-[250px]">
                    <div className="flex items-center gap-4">
                      <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {initials(c.full_name)}
                      </div>
                      <div className="truncate">
                        <p className="font-bold text-white group-hover:text-primary transition-colors text-sm cursor-pointer" onClick={() => navigate(`/clientes/${c.id}`)}>
                          {c.full_name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                           <Building2 className="size-3 text-white/20" />
                           <p className="text-[10px] text-white/40 font-mono uppercase tracking-wider truncate">{c.company || "Conta Pessoal"}</p>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-1">
                      <p className="text-white/60 font-mono text-[11px]">{formatDoc(c.document)}</p>
                      <div className="flex items-center gap-3">
                         <div className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors cursor-pointer">
                            <Phone className="size-3" /> {c.phone || "N/A"}
                         </div>
                         <div className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors cursor-pointer">
                            <Mail className="size-3" />
                         </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-1.5">
                       <MapPin className="size-3 text-white/20" />
                       <span className="text-white/60 text-xs">{c.city || "-"}{c.state ? `, ${c.state}` : ""}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black uppercase tracking-widest text-white/20">{c.origin || "Manual"}</p>
                       <p className="text-white/60 text-xs font-medium">{c.partners?.full_name || "Direto"}</p>
                    </div>
                  </td>
                  <td className="px-6 py-5 max-w-[200px]">
                     <div className="flex flex-wrap gap-1">
                        {c._productNames.length > 0 ? (
                          c._productNames.slice(0, 2).map((p: string, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.05] text-[10px] text-white/40 whitespace-nowrap">
                              {p}
                            </span>
                          ))
                        ) : (
                          <span className="text-white/20 text-[10px]">Nenhum</span>
                        )}
                        {c._productNames.length > 2 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.05] text-[10px] text-white/40">
                            +{c._productNames.length - 2}
                          </span>
                        )}
                     </div>
                  </td>
                  <td className="px-6 py-5">
                    <StatusPill status={c.status} />
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="space-y-1">
                       <p className="font-mono font-bold text-white text-sm">{formatBRL(c._totalContracted)}</p>
                       <div className="flex items-center justify-end gap-2 text-[10px] font-bold">
                          <span className="text-emerald-400">P: {formatBRL(c._totalPaid)}</span>
                          <span className={cn(c._totalPending > 0 ? "text-amber-400" : "text-white/20")}>
                            {c._totalPending > 0 ? `D: ${formatBRL(c._totalPending)}` : "Quitado"}
                          </span>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <p className="text-white/60 text-xs">{format(new Date(c.created_at), "dd/MM/yyyy")}</p>
                    <p className="text-[10px] text-white/20 font-mono mt-0.5">{format(new Date(c.created_at), "HH:mm")}</p>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => navigate(`/clientes/${c.id}`)} className="h-8 w-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-all text-white/40 hover:text-white">
                        <ArrowUpRight className="size-4" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-8 w-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center hover:bg-white/[0.1] transition-all">
                            <MoreHorizontal className="size-4 text-white/40" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                           <DropdownMenuItem onClick={() => navigate(`/clientes/${c.id}`)} className="text-xs uppercase font-bold tracking-wider py-2.5">
                             <User className="size-3.5 mr-2 opacity-50" /> Ver Perfil
                           </DropdownMenuItem>
                           <DropdownMenuItem onClick={() => navigate(`/clientes/${c.id}?tab=financeiro`)} className="text-xs uppercase font-bold tracking-wider py-2.5">
                             <CreditCard className="size-3.5 mr-2 opacity-50" /> Financeiro
                           </DropdownMenuItem>
                           <DropdownMenuSeparator className="bg-white/[0.05]" />
                           <DropdownMenuItem onClick={() => handleDelete(c.id)} className="text-xs uppercase font-bold tracking-wider py-2.5 text-destructive">
                             <Trash2 className="size-3.5 mr-2" /> Deletar
                           </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-20 text-center">
               <Users className="size-12 text-white/5 mx-auto mb-4" />
               <p className="text-white/40 font-medium">Nenhum cliente encontrado com estes filtros.</p>
               <button onClick={resetFilters} className="text-primary text-xs font-bold uppercase tracking-widest mt-2 hover:underline">Limpar Filtros</button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((c: any) => (
            <div key={c.id} className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-6 hover:border-primary/30 transition-all group cursor-pointer flex flex-col h-full" onClick={() => navigate(`/clientes/${c.id}`)}>
               <div className="flex items-start justify-between mb-6">
                  <div className="size-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-lg font-bold">
                    {initials(c.full_name)}
                  </div>
                  <StatusPill status={c.status} />
               </div>
               
               <h3 className="text-lg font-bold text-white mb-1 group-hover:text-primary transition-colors line-clamp-1">{c.full_name}</h3>
               <p className="text-xs text-white/40 font-mono uppercase tracking-widest mb-4 truncate">{c.company || "Conta Pessoal"}</p>
               
               <div className="space-y-3 mb-6 flex-grow">
                  <div className="flex items-center justify-between text-[11px]">
                     <span className="text-white/20 font-bold uppercase tracking-tighter">Produtos</span>
                     <span className="text-white/60 font-medium">{c._productNames.length} itens</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                     <span className="text-white/20 font-bold uppercase tracking-tighter">Cidade</span>
                     <span className="text-white/60 font-medium truncate ml-4">{c.city || "-"}</span>
                  </div>
               </div>

               <div className="pt-5 border-t border-white/5 mt-auto">
                  <div className="flex items-center justify-between">
                     <div>
                        <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest mb-1">Portfolio LTV</p>
                        <p className="text-base font-bold font-mono text-primary">{formatBRL(c._totalContracted)}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest mb-1">Pendência</p>
                        <p className={cn("text-sm font-bold font-mono", c._totalPending > 0 ? "text-amber-400" : "text-emerald-400")}>
                           {c._totalPending > 0 ? formatBRL(c._totalPending) : "R$ 0,00"}
                        </p>
                     </div>
                  </div>
               </div>
            </div>
          ))}
        </div>
      )}

      <ClientFormDialog open={open} onOpenChange={setOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["clients-admin-list"] })} />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: any = {
    ativo: { label: "ativo", cls: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20 shadow-[0_0_15px_rgba(52,211,153,0.1)]" },
    prospecto: { label: "prospecto", cls: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
    inativo: { label: "inativo", cls: "text-white/20 bg-white/[0.03] border-white/[0.05]" },
  };
  const m = map[status] || { label: status, cls: "text-white/40 bg-white/[0.03] border-white/[0.05]" };
  return (
    <span className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border", m.cls)}>
      {m.label}
    </span>
  );
}
