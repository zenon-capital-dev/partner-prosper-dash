import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Search, Trash2, Users, UserCheck, UserPlus,
  MoreHorizontal, ArrowUpRight, Filter, Calendar, Building2,
  MapPin, CreditCard, User, Mail, Phone, ShoppingBag,
  ChevronDown, ChevronUp, Activity, AlertTriangle, TrendingUp,
  Eye, FileText, MessageSquare,
} from "lucide-react";
import { formatBRL, initials, formatDoc } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
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
import { PageHeader } from "@/components/PageHeader";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { confirmAction } from "@/lib/confirm";

export default function Clients() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<"grid" | "table">("grid");

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [partnerFilter, setPartnerFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
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
          client_products(id, value, status, product_id, products(id, name)),
          payments(id, amount, amount_paid, status, due_date)
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
    },
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["partners-minimal"],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, full_name");
      return data ?? [];
    },
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["providers-minimal"],
    queryFn: async () => {
      const { data } = await supabase.from("service_providers").select("id, name").eq("active", true);
      return data ?? [];
    },
  });

  const cities = useMemo(() => {
    const set = new Set(clients.map((c) => c.city).filter(Boolean));
    return Array.from(set).sort();
  }, [clients]);

  const enriched = useMemo(() => {
    return clients.map((c: any) => {
      const totalContracted = c.client_products?.reduce((acc: number, p: any) => acc + Number(p.value || 0), 0) || 0;
      const totalPaid = c.payments?.filter((p: any) => p.status === "pago")
        .reduce((acc: number, p: any) => acc + Number(p.amount_paid || p.amount || 0), 0) || 0;
      const totalPending = Math.max(0, totalContracted - totalPaid);
      const productNames = c.client_products?.map((p: any) => p.products?.name).filter(Boolean) || [];
      const overdue = c.payments?.filter((p: any) =>
        p.status !== "pago" && p.due_date && new Date(p.due_date) < new Date()
      ).length || 0;

      // Health score: 100 base, penalize overdue & inactivity
      let health = 100;
      if (c.status === "inativo") health -= 50;
      if (c.status === "prospecto") health -= 20;
      health -= Math.min(40, overdue * 12);
      if (totalContracted > 0 && totalPaid / totalContracted < 0.3) health -= 10;
      health = Math.max(5, Math.min(100, health));

      const risk: "low" | "med" | "high" =
        health >= 75 ? "low" : health >= 50 ? "med" : "high";

      const tags = Array.isArray((c as any).tags) ? (c as any).tags : [];

      return {
        ...c,
        _totalContracted: totalContracted,
        _totalPaid: totalPaid,
        _totalPending: totalPending,
        _productNames: productNames,
        _overdue: overdue,
        _health: health,
        _risk: risk,
        _tags: tags,
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
          c.document?.includes(q) ||
          c.phone?.includes(q);
        if (!matches) return false;
      }
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (productFilter !== "all") {
        const has = c.client_products?.some((p: any) => p.product_id === productFilter);
        if (!has) return false;
      }
      if (partnerFilter !== "all" && c.partner_id !== partnerFilter) return false;
      if (providerFilter !== "all" && c.service_provider_id !== providerFilter) return false;
      if (cityFilter !== "all" && c.city !== cityFilter) return false;
      if (paymentFilter !== "all") {
        if (paymentFilter === "pago" && c._totalPending > 0) return false;
        if (paymentFilter === "pendente" && c._totalPending === 0) return false;
      }
      if (riskFilter !== "all" && c._risk !== riskFilter) return false;
      if (dateRange?.from) {
        const createdAt = new Date(c.created_at);
        if (createdAt < dateRange.from) return false;
        if (dateRange.to && createdAt > dateRange.to) return false;
      }
      return true;
    });
  }, [enriched, search, statusFilter, productFilter, partnerFilter, providerFilter, cityFilter, paymentFilter, riskFilter, dateRange]);

  const kpis = useMemo(() => {
    const total = enriched.length;
    const active = enriched.filter((c: any) => c.status === "ativo").length;
    const prospects = enriched.filter((c: any) => c.status === "prospecto").length;
    const atRisk = enriched.filter((c: any) => c._risk === "high").length;
    const totalRevenue = enriched.reduce((s: number, c: any) => s + c._totalContracted, 0);
    const totalPending = enriched.reduce((s: number, c: any) => s + c._totalPending, 0);
    const avgHealth = total > 0 ? Math.round(enriched.reduce((s: number, c: any) => s + c._health, 0) / total) : 0;
    return { total, active, prospects, atRisk, totalRevenue, totalPending, avgHealth };
  }, [enriched]);

  const handleDelete = async (id: string) => {
    if (!(await confirmAction("Excluir este cliente permanentemente?"))) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Cliente removido");
      qc.invalidateQueries({ queryKey: ["clients-admin-list"] });
    }
  };

  const resetFilters = () => {
    setStatusFilter("all"); setProductFilter("all"); setPartnerFilter("all");
    setProviderFilter("all"); setCityFilter("all"); setPaymentFilter("all");
    setRiskFilter("all"); setDateRange(undefined); setSearch("");
  };

  const activeFiltersCount = [
    statusFilter, productFilter, partnerFilter, providerFilter,
    cityFilter, paymentFilter, riskFilter,
  ].filter((v) => v !== "all").length + (dateRange?.from ? 1 : 0);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="page-shell space-y-6 animate-fade-up">
        <PageHeader
          eyebrow="CRM"
          title="Clientes"
          description="Carteira completa, engajamento e risco de cancelamento."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={resetFilters} disabled={activeFiltersCount === 0 && !search}>
                Limpar
              </Button>
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="size-4 mr-2" /> Novo cliente
              </Button>
            </div>
          }
        />

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
          <SummaryCard
            label="Total de clientes" value={kpis.total.toString()}
            sublabel={`${kpis.active} ativos · ${kpis.prospects} prospectos`}
            icon={<Users className="size-4" />} tone="default"
          />
          <SummaryCard
            label="Em risco" value={kpis.atRisk.toString()}
            sublabel={kpis.total > 0 ? `${Math.round((kpis.atRisk / kpis.total) * 100)}% da base` : "—"}
            icon={<AlertTriangle className="size-4" />} tone="danger"
          />
          <SummaryCard
            label="Engajamento médio" value={`${kpis.avgHealth}`}
            sublabel="Pontuação consolidada da carteira"
            icon={<Activity className="size-4" />} tone={kpis.avgHealth >= 70 ? "success" : kpis.avgHealth >= 50 ? "warning" : "danger"}
          />
          <SummaryCard
            label="Receita contratada" value={formatBRL(kpis.totalRevenue)}
            sublabel={`Pendência ${formatBRL(kpis.totalPending)}`}
            icon={<TrendingUp className="size-4" />} tone="primary"
          />
        </div>

        {/* Toolbar: search + filter toggle + view toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              placeholder="Buscar nome, empresa, CNPJ..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-xl border border-border/60 bg-card/40 p-1 h-10 shrink-0">
              <button
                onClick={() => setView("grid")}
                className={cn("h-8 px-3 rounded-lg text-xs font-bold transition-all", view === "grid" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
              >Cards</button>
              <button
                onClick={() => setView("table")}
                className={cn("h-8 px-3 rounded-lg text-xs font-bold transition-all", view === "table" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
              >Tabela</button>
            </div>
            <Button
              variant="outline" size="sm"
              onClick={() => setShowFilters((v) => !v)}
              className="h-10 gap-2 flex-1 sm:flex-none"
            >
              <Filter className="size-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center rounded-md bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-bold">
                  {activeFiltersCount}
                </span>
              )}
              {showFilters ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="rounded-xl border border-border/60 bg-card/40 p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 animate-fade-in">
            <FilterField label="Status">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="prospecto">Prospecto</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Risco">
              <Select value={riskFilter} onValueChange={setRiskFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="low">Baixo</SelectItem>
                  <SelectItem value="med">Médio</SelectItem>
                  <SelectItem value="high">Alto</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Produto">
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Parceiro">
              <Select value={partnerFilter} onValueChange={setPartnerFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {partners.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Prestador">
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {providers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Cidade">
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {cities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Pagamento">
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pago">Quitado</SelectItem>
                  <SelectItem value="pendente">Com pendência</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Cadastro">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-9 w-full justify-start font-normal", !dateRange && "text-muted-foreground")}>
                    <Calendar className="size-3.5 mr-2" />
                    {dateRange?.from ? (
                      dateRange.to
                        ? `${format(dateRange.from, "dd/MM", { locale: ptBR })} – ${format(dateRange.to, "dd/MM", { locale: ptBR })}`
                        : format(dateRange.from, "dd/MM", { locale: ptBR })
                    ) : "Selecionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                </PopoverContent>
              </Popover>
            </FilterField>
          </div>
        )}

        {/* Lista — grid ou tabela */}
        {isLoading ? (
          <div className="rounded-xl border border-border/60 bg-card/40 py-20 flex flex-col items-center justify-center text-muted-foreground">
            <div className="size-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin mb-3" />
            <p className="text-sm">Carregando clientes...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border/60 bg-card/40 py-16 text-center">
            <Users className="size-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
            <button onClick={resetFilters} className="text-primary text-xs font-semibold mt-2 hover:underline">
              Limpar filtros
            </button>
          </div>
        ) : view === "grid" ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {filtered.map((c: any) => (
                <div
                  key={c.id}
                  onClick={() => navigate(`/clientes/${c.id}`)}
                  className="group relative rounded-2xl border border-border/60 bg-card/40 p-4 sm:p-5 hover:border-primary/40 hover:shadow-lg active:scale-[0.99] transition-all cursor-pointer overflow-hidden"
                >
                  {/* Indicador de engajamento */}
                  <div
                    className={cn(
                      "absolute top-0 left-0 right-0 h-1",
                      c._risk === "high" && "bg-destructive",
                      c._risk === "med" && "bg-warning",
                      c._risk === "low" && "bg-success"
                    )}
                  />

                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-12 rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/20 border border-primary/20 text-primary flex items-center justify-center text-sm font-black shrink-0">
                        {initials(c.full_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground truncate group-hover:text-primary transition-colors">
                          {c.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Building2 className="size-3" />
                          {c.company || "Pessoa física"}
                        </p>
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors sm:opacity-0 sm:group-hover:opacity-100">
                            <MoreHorizontal className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => navigate(`/clientes/${c.id}`)}>
                            <Eye className="size-3.5 mr-2" /> Ver perfil
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/clientes/${c.id}?tab=financeiro`)}>
                            <CreditCard className="size-3.5 mr-2" /> Financeiro
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/clientes/${c.id}?tab=documentos`)}>
                            <FileText className="size-3.5 mr-2" /> Documentos
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(c.id)} className="text-destructive">
                            <Trash2 className="size-3.5 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <StatusBadge status={c.status} />
                    <RiskBadge risk={c._risk} overdue={c._overdue} />
                  </div>

                  <div className="space-y-2.5 text-xs mb-4">
                    {c.email && (
                      <div className="flex items-center gap-2 text-muted-foreground truncate">
                        <Mail className="size-3 shrink-0" /> {c.email}
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="size-3" /> {c.phone}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="size-3" /> {c.partners?.full_name || "Direto"}
                    </div>
                  </div>

                  {c._productNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4 pt-3 border-t border-border/40">
                      {c._productNames.slice(0, 3).map((p: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded-md bg-primary/5 text-primary border border-primary/20 text-[10px] font-bold whitespace-nowrap">
                          {p}
                        </span>
                      ))}
                      {c._productNames.length > 3 && (
                        <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-bold">
                          +{c._productNames.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/40">
                    <div>
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Receita</p>
                      <p className="font-display font-bold text-sm tabular-nums text-foreground">{formatBRL(c._totalContracted)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Engajamento</p>
                      <p className={cn(
                        "font-display font-bold text-sm tabular-nums",
                        c._health >= 75 ? "text-success" : c._health >= 50 ? "text-warning" : "text-destructive"
                      )}>{c._health}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 text-xs text-muted-foreground flex items-center justify-between">
              <span>{filtered.length} de {enriched.length} clientes</span>
              <span className="font-mono">Receita visível: {formatBRL(filtered.reduce((s: number, c: any) => s + c._totalContracted, 0))}</span>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1400px]">
                <thead className="sticky top-0 bg-muted/40 backdrop-blur-sm">
                  <tr className="border-b border-border/60">
                    <Th>Cliente</Th>
                    <Th>Documento / Contato</Th>
                    <Th>Status</Th>
                    <Th>Engajamento</Th>
                    <Th>Risco</Th>
                    <Th>Produtos</Th>
                    <Th>Responsável</Th>
                    <Th align="right">Receita</Th>
                    <Th align="right">Cadastro</Th>
                    <Th align="right">Ações</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filtered.map((c: any) => (
                    <tr
                      key={c.id}
                      className="group hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/clientes/${c.id}`)}
                    >
                      <td className="px-4 py-3.5 max-w-[280px]">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-[11px] font-bold shrink-0">
                            {initials(c.full_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                              {c.full_name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Building2 className="size-3 text-muted-foreground/60" />
                              <p className="text-xs text-muted-foreground truncate">{c.company || "Pessoa física"}</p>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-xs font-mono text-muted-foreground">{formatDoc(c.document) || "—"}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Phone className="size-3" /> {c.phone || "—"}</span>
                          {c.email && <Mail className="size-3" />}
                        </div>
                      </td>
                      <td className="px-4 py-3.5"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3.5"><HealthBar value={c._health} /></td>
                      <td className="px-4 py-3.5"><RiskBadge risk={c._risk} overdue={c._overdue} /></td>
                      <td className="px-4 py-3.5 max-w-[180px]">
                        <div className="flex flex-wrap gap-1">
                          {c._productNames.length > 0 ? (
                            <>
                              {c._productNames.slice(0, 2).map((p: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 rounded-md bg-muted/60 border border-border/40 text-[11px] text-foreground/80 whitespace-nowrap">{p}</span>
                              ))}
                              {c._productNames.length > 2 && <span className="px-2 py-0.5 rounded-md bg-muted/60 text-[11px] text-muted-foreground">+{c._productNames.length - 2}</span>}
                            </>
                          ) : <span className="text-xs text-muted-foreground/60">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5"><span className="text-xs text-foreground/80">{c.partners?.full_name || "Direto"}</span></td>
                      <td className="px-4 py-3.5 text-right">
                        <p className="font-mono font-semibold text-foreground">{formatBRL(c._totalContracted)}</p>
                        <p className={cn("text-[11px] font-mono mt-0.5", c._totalPending > 0 ? "text-warning" : "text-success")}>
                          {c._totalPending > 0 ? `${formatBRL(c._totalPending)} pend.` : "Quitado"}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <p className="text-xs text-foreground/80">{format(new Date(c.created_at), "dd/MM/yyyy")}</p>
                      </td>
                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                              <MoreHorizontal className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => navigate(`/clientes/${c.id}`)}><Eye className="size-3.5 mr-2" /> Ver perfil</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/clientes/${c.id}?tab=financeiro`)}><CreditCard className="size-3.5 mr-2" /> Financeiro</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(c.id)} className="text-destructive"><Trash2 className="size-3.5 mr-2" /> Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-border/60 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
                <span>{filtered.length} de {enriched.length} clientes</span>
                <span className="font-mono">Receita visível: {formatBRL(filtered.reduce((s: number, c: any) => s + c._totalContracted, 0))}</span>
              </div>
            )}
          </div>
        )}

        <ClientFormDialog open={open} onOpenChange={setOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["clients-admin-list"] })} />
      </div>
    </TooltipProvider>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={cn(
      "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
      align === "right" ? "text-right" : "text-left"
    )}>
      {children}
    </th>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function SummaryCard({
  label, value, sublabel, icon, tone = "default",
}: {
  label: string; value: string; sublabel?: string;
  icon?: React.ReactNode;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
}) {
  const toneCls = {
    default: "text-foreground",
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[tone];
  const iconBg = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-3 sm:p-4 hover:border-border transition-colors">
      <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
        <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight">{label}</span>
        <div className={cn("size-6 sm:size-7 rounded-md flex items-center justify-center shrink-0", iconBg)}>{icon}</div>
      </div>
      <p className={cn("text-lg sm:text-2xl font-bold tracking-tight font-mono truncate", toneCls)}>{value}</p>
      {sublabel && <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 line-clamp-2">{sublabel}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ativo: { label: "Ativo", cls: "bg-success/10 text-success border-success/20" },
    prospecto: { label: "Prospecto", cls: "bg-warning/10 text-warning border-warning/20" },
    inativo: { label: "Inativo", cls: "bg-muted text-muted-foreground border-border" },
  };
  const m = map[status] || { label: status || "—", cls: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold", m.cls)}>
      <span className="size-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      {m.label}
    </span>
  );
}

function RiskBadge({ risk, overdue }: { risk: "low" | "med" | "high"; overdue: number }) {
  const map = {
    low: { label: "Baixo", cls: "bg-success/10 text-success border-success/20" },
    med: { label: "Médio", cls: "bg-warning/10 text-warning border-warning/20" },
    high: { label: "Alto", cls: "bg-destructive/10 text-destructive border-destructive/20" },
  };
  const m = map[risk];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold", m.cls)}>
          {m.label}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        Risco de cancelamento {m.label.toLowerCase()}
        {overdue > 0 && ` · ${overdue} pagamento(s) vencido(s)`}
      </TooltipContent>
    </Tooltip>
  );
}

function HealthBar({ value }: { value: number }) {
  const tone = value >= 75 ? "bg-success" : value >= 50 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[11px] font-mono font-semibold text-foreground/80 w-8 text-right">{value}</span>
    </div>
  );
}
