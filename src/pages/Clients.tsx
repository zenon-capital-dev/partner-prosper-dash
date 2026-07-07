import { formatBR as format } from "@/lib/datetime";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/use-debounce";
import { useProductsRef, usePartnersRef, useProvidersRef } from "@/hooks/useReferenceData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Search, Trash2, Users, MoreHorizontal, Filter, Calendar, Building2,
  CreditCard, User, Mail, Phone, CalendarClock,
  ChevronDown, ChevronUp, Activity, AlertTriangle, TrendingUp,
  Eye, FileText, Pencil, Archive, ArchiveRestore, X, ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import { formatBRL, initials, formatDoc } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { endOfDay, startOfDay, startOfToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FilterPresets } from "@/components/filters/FilterPresets";
import { StageFilterBar } from "@/components/filters/StageFilterBar";
import { useSharedStageFilter } from "@/hooks/useSharedStageFilter";
import { DateRange } from "react-day-picker";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { PageHero } from "@/components/PageHero";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { confirmAction } from "@/lib/confirm";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { EmptyState } from "@/components/EmptyState";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageSize } from "@/hooks/usePageSize";
import { InlineStageSelect } from "@/components/clients/InlineStageSelect";
import { QuickTaskDialog } from "@/components/tasks/QuickTaskDialog";

type SortKey = "name" | "revenue" | "created" | "health";
type SortDir = "asc" | "desc";

const onlyDigits = (s: string | null | undefined) => (s || "").replace(/\D+/g, "");
const ilikeTerm = (s: string) => s.replace(/[%,]/g, " ").trim();

export default function Clients() {
  const { isAdmin, isAdminSecondary } = useAuth();
  const canWrite = isAdmin || isAdminSecondary;
  const FK = "clients:filters:v1";
  const saved = (() => {
    try { return JSON.parse(sessionStorage.getItem(FK) || "{}"); } catch { return {}; }
  })();
  const [search, setSearch] = useState<string>(saved.search ?? "");
  const debouncedSearch = useDebounce(search, 400);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [showFilters, setShowFilters] = useState<boolean>(saved.showFilters ?? false);
  const [view, setView] = useState<"grid" | "table">(saved.view ?? "grid");
  const [currentPage, setCurrentPage] = useState<number>(saved.currentPage ?? 1);
  const { pageSize: __ps, setPageSize } = usePageSize();
  const itemsPerPage = __ps === -1 ? Number.MAX_SAFE_INTEGER : __ps;

  const [statusFilter, setStatusFilter] = useState<string>(saved.statusFilter ?? "all");
  const [productFilter, setProductFilter] = useState<string>(saved.productFilter ?? "all");
  const [partnerFilter, setPartnerFilter] = useState<string>(saved.partnerFilter ?? "all");
  const [providerFilter, setProviderFilter] = useState<string>(saved.providerFilter ?? "all");
  const [cityFilter, setCityFilter] = useState<string>(saved.cityFilter ?? "all");
  const [paymentFilter, setPaymentFilter] = useState<string>(saved.paymentFilter ?? "all");
  const [riskFilter, setRiskFilter] = useState<string>(saved.riskFilter ?? "all");
  const [salesFilter, setSalesFilter] = useState<string>(saved.salesFilter ?? "all");
  const { stageIds } = useSharedStageFilter();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    if (!saved.dateRange) return undefined;
    return {
      from: saved.dateRange.from ? new Date(saved.dateRange.from) : undefined,
      to: saved.dateRange.to ? new Date(saved.dateRange.to) : undefined,
    } as DateRange;
  });

  const [sortKey, setSortKey] = useState<SortKey>(saved.sortKey ?? "created");
  const [sortDir, setSortDir] = useState<SortDir>(saved.sortDir ?? "desc");

  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, productFilter, partnerFilter, providerFilter, cityFilter, paymentFilter, riskFilter, salesFilter, dateRange, view, stageIds]);

  useEffect(() => {
    try {
      sessionStorage.setItem(FK, JSON.stringify({
        search, showFilters, view, currentPage,
        statusFilter, productFilter, partnerFilter, providerFilter,
        cityFilter, paymentFilter, riskFilter, salesFilter, sortKey, sortDir,
        dateRange: dateRange ? { from: dateRange.from, to: dateRange.to } : undefined,
      }));
    } catch {}
  }, [search, showFilters, view, currentPage, statusFilter, productFilter, partnerFilter, providerFilter, cityFilter, paymentFilter, riskFilter, salesFilter, sortKey, sortDir, dateRange]);


  const { data: clients = [], isLoading: isLoadingClients } = useQuery({
    queryKey: ["clients-admin-list", debouncedSearch, statusFilter, partnerFilter, providerFilter, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from("clients")
        .select(`
          id, full_name, company, email, phone, document, status, source, birth_date,
          address_street, address_number, address_complement, address_neighborhood, address_zip_code,
          city, state, notes, tags, partner_id, referrer_id, collaborator_id, service_provider_id, created_at,
          journey_stage_id,
          partners(id, full_name)
        `);

      const qRaw = ilikeTerm(debouncedSearch);
      const qDigits = onlyDigits(debouncedSearch);
      if (qRaw) {
        const term = `%${qRaw}%`;
        const parts = [`full_name.ilike.${term}`, `company.ilike.${term}`, `email.ilike.${term}`, `phone.ilike.${term}`];
        if (qDigits) parts.push(`document.ilike.%${qDigits}%`);
        query = query.or(parts.join(","));
      }
      if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
      if (partnerFilter !== "all") query = query.eq("partner_id", partnerFilter);
      if (providerFilter !== "all") query = query.eq("service_provider_id", providerFilter);
      if (dateRange?.from) query = query.gte("created_at", startOfDay(dateRange.from).toISOString());
      if (dateRange?.to) query = query.lte("created_at", endOfDay(dateRange.to).toISOString());

      const { data, error } = await query.order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60_000,
  });

  const clientIds = useMemo(() => clients.map((c: any) => c.id).filter(Boolean), [clients]);

  const { data: clientProductsSummary = [], isLoading: isLoadingClientProducts } = useQuery({
    queryKey: ["clients-admin-products-summary", clientIds.join(",")],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_products")
        .select("id, client_id, value, status, product_id, products(id, name)")
        .in("client_id", clientIds)
        .limit(Math.min(1000, Math.max(100, clientIds.length * 12)));
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60_000,
  });

  const { data: paymentsSummary = [], isLoading: isLoadingPayments } = useQuery({
    queryKey: ["clients-admin-payments-summary", clientIds.join(",")],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, client_id, amount, amount_paid, status, due_date")
        .in("client_id", clientIds)
        .limit(Math.min(1000, Math.max(100, clientIds.length * 12)));
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60_000,
  });

  // Vendas reais (mesma fonte da página Vendas) para o filtro "Vendas" bater com o que aparece lá
  const { data: salesSummary = [] } = useQuery({
    queryKey: ["clients-admin-sales-summary", clientIds.join(",")],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, client_id, status, amount")
        .in("client_id", clientIds)
        .limit(Math.min(2000, Math.max(200, clientIds.length * 12)));
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 2 * 60_000,
  });


  const isLoading = isLoadingClients;

  const { data: productsAll = [] } = useProductsRef();
  const { data: partnersAll = [] } = usePartnersRef();
  const { data: providersAll = [] } = useProvidersRef();
  // active-only filtering moved client-side (server filter was equivalent)
  const products = useMemo(() => (productsAll as any[]).filter((p) => p.active !== false), [productsAll]);
  const partners = useMemo(() => partnersAll as any[], [partnersAll]);
  const providers = useMemo(() => (providersAll as any[]).filter((p) => p.active !== false), [providersAll]);

  const cities = useMemo(() => {
    const set = new Set(clients.map((c) => c.city).filter(Boolean));
    return Array.from(set).sort();
  }, [clients]);

  // Status: lista fixa e explícita (evita opções fantasmas e garante "Ativo/Inativo" sempre visíveis)
  const statusOptions = useMemo(() => ["ativo", "novo_cliente", "prospecto", "inativo"], []);


  const enriched = useMemo(() => {
    const today = startOfToday();
    const productsByClient = new Map<string, any[]>();
    const paymentsByClient = new Map<string, any[]>();
    const salesByClient = new Map<string, any[]>();

    for (const p of clientProductsSummary as any[]) {
      if (!p.client_id) continue;
      const arr = productsByClient.get(p.client_id) ?? [];
      arr.push(p);
      productsByClient.set(p.client_id, arr);
    }

    for (const p of paymentsSummary as any[]) {
      if (!p.client_id) continue;
      const arr = paymentsByClient.get(p.client_id) ?? [];
      arr.push(p);
      paymentsByClient.set(p.client_id, arr);
    }

    for (const s of salesSummary as any[]) {
      if (!s.client_id) continue;
      const arr = salesByClient.get(s.client_id) ?? [];
      arr.push(s);
      salesByClient.set(s.client_id, arr);
    }

    return clients.map((c: any) => {
      const clientProducts = productsByClient.get(c.id) ?? [];
      const payments = paymentsByClient.get(c.id) ?? [];
      const sales = salesByClient.get(c.id) ?? [];
      const totalContracted = clientProducts.reduce((acc: number, p: any) => acc + Number(p.value || 0), 0) || 0;
      const totalPaid = payments.filter((p: any) => p.status === "pago")
        .reduce((acc: number, p: any) => acc + Number(p.amount_paid || p.amount || 0), 0) || 0;
      const totalPending = Math.max(0, totalContracted - totalPaid);
      const productNames = clientProducts.map((p: any) => p.products?.name).filter(Boolean) || [];
      const overdue = payments.filter((p: any) => {
        if (p.status === "pago" || !p.due_date) return false;
        try {
          return startOfDay(parseISO(String(p.due_date))) < today;
        } catch { return false; }
      }).length || 0;

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
        client_products: clientProducts,
        payments,
        _sales: sales,
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
  }, [clients, clientProductsSummary, paymentsSummary, salesSummary]);


  const filtered = useMemo(() => {
    const qRaw = debouncedSearch.trim().toLowerCase();
    const qDigits = onlyDigits(debouncedSearch);
    const toEnd = dateRange?.to ? endOfDay(dateRange.to) : undefined;
    const fromStart = dateRange?.from ? startOfDay(dateRange.from) : undefined;

    return enriched.filter((c: any) => {
      if (qRaw) {
        const matchText =
          c.full_name?.toLowerCase().includes(qRaw) ||
          c.company?.toLowerCase().includes(qRaw) ||
          c.email?.toLowerCase().includes(qRaw) ||
          c.phone?.toLowerCase().includes(qRaw);
        const matchDoc = qDigits.length > 0 && onlyDigits(c.document).includes(qDigits);
        if (!matchText && !matchDoc) return false;
      }
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (stageIds.length > 0 && !stageIds.includes(c.journey_stage_id)) return false;
      if (productFilter === "_none") {
        if ((c.client_products?.length || 0) > 0) return false;
      } else if (productFilter !== "all") {
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
      if (salesFilter !== "all") {
        // Usa a MESMA fonte da página Vendas (tabela sales), com os mesmos status
        const ss: any[] = c._sales || [];
        const nonCancel = ss.filter((s) => s.status !== "cancelada");
        const hasAtiva = nonCancel.some((s) => s.status === "em_andamento" || s.status === "pendente");
        const hasConcluida = ss.some((s) => s.status === "concluida");
        if (salesFilter === "com_venda_ativa" && !hasAtiva) return false;
        if (salesFilter === "com_venda_concluida" && !hasConcluida) return false;
        if (salesFilter === "sem_venda" && nonCancel.length > 0) return false;
        if (salesFilter === "com_pendencia" && c._totalPending <= 0) return false;
      }

      if (fromStart) {
        const createdAt = new Date(c.created_at);
        if (createdAt < fromStart) return false;
        if (toEnd && createdAt > toEnd) return false;
      }
      return true;
    });
  }, [enriched, debouncedSearch, statusFilter, productFilter, partnerFilter, providerFilter, cityFilter, paymentFilter, riskFilter, salesFilter, dateRange, stageIds]);

  const sorted = useMemo(() => {
    if (view !== "table") return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    const arr = [...filtered];
    arr.sort((a: any, b: any) => {
      let av: any, bv: any;
      switch (sortKey) {
        case "name": av = (a.full_name || "").toLowerCase(); bv = (b.full_name || "").toLowerCase(); break;
        case "revenue": av = a._totalContracted; bv = b._totalContracted; break;
        case "health": av = a._health; bv = b._health; break;
        case "created":
        default: av = new Date(a.created_at).getTime(); bv = new Date(b.created_at).getTime(); break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir, view]);

  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sorted.slice(start, start + itemsPerPage);
  }, [sorted, currentPage]);

  const kpis = useMemo(() => {
    const total = enriched.length;
    const active = enriched.filter((c: any) => c.status === "ativo").length;
    const atRisk = enriched.filter((c: any) => c._risk === "high").length;
    const totalRevenue = enriched.reduce((s: number, c: any) => s + c._totalContracted, 0);
    const totalPending = enriched.reduce((s: number, c: any) => s + c._totalPending, 0);
    const avgHealth = total > 0 ? Math.round(enriched.reduce((s: number, c: any) => s + c._health, 0) / total) : 0;
    return { total, active, atRisk, totalRevenue, totalPending, avgHealth };
  }, [enriched]);

  const handleDelete = async (id: string) => {
    const { checkFkLinks, summarizeBlocks } = await import("@/lib/safe-delete");
    const res = await checkFkLinks(id, [
      { table: "sales", column: "client_id", label: "venda(s)" },
      { table: "client_products", column: "client_id", label: "demanda(s)" },
      { table: "contracts", column: "client_id", label: "contrato(s)" },
      { table: "payments", column: "client_id", label: "pagamento(s)" },
      { table: "documents", column: "client_id", label: "documento(s)" },
      { table: "commissions", column: "client_id", label: "comissão(ões)" },
      { table: "proposals", column: "client_id", label: "proposta(s)" },
    ]);

    if (!res.canDelete) {
      const summary = summarizeBlocks(res.blockedBy);
      const confirmMsg = `⚠️ EXCLUSÃO DEFINITIVA\n\nEste cliente possui: ${summary}.\n\nAo confirmar, TUDO será apagado permanentemente (vendas, demandas, contratos, pagamentos, documentos, comissões, propostas, tarefas e contatos). Esta ação é IRREVERSÍVEL.\n\nDeseja prosseguir e apagar tudo?`;
      if (!(await confirmAction(confirmMsg))) return;
      const { error } = await supabase.rpc("admin_delete_client_cascade" as any, { _client_id: id });
      if (error) toast.error(error.message);
      else { toast.success("Cliente e todos os vínculos excluídos"); qc.invalidateQueries(); }
      return;
    }

    if (!(await confirmAction("Excluir este cliente permanentemente? Esta ação é irreversível."))) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Cliente removido");
      qc.invalidateQueries();
    }
  };


  const handleArchive = async (c: any) => {
    const next = c.status === "inativo" ? "ativo" : "inativo";
    const label = next === "inativo" ? "Arquivar" : "Reativar";
    if (!(await confirmAction(`${label} este cliente?`))) return;
    const { error } = await supabase.from("clients").update({ status: next }).eq("id", c.id);
    if (error) toast.error(error.message);
    else {
      toast.success(next === "inativo" ? "Cliente arquivado" : "Cliente reativado");
      qc.invalidateQueries();
    }
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setOpen(true);
  };

  const resetFilters = () => {
    setStatusFilter("all"); setProductFilter("all"); setPartnerFilter("all");
    setProviderFilter("all"); setCityFilter("all"); setPaymentFilter("all");
    setRiskFilter("all"); setSalesFilter("all"); setDateRange(undefined); setSearch("");
  };

  const activeFiltersCount = [
    statusFilter, productFilter, partnerFilter, providerFilter,
    cityFilter, paymentFilter, riskFilter, salesFilter,
  ].filter((v) => v !== "all").length + (dateRange?.from ? 1 : 0);

  const productById = useMemo(() => Object.fromEntries(products.map((p: any) => [p.id, p.name])), [products]);
  const partnerById = useMemo(() => Object.fromEntries(partners.map((p: any) => [p.id, p.full_name])), [partners]);
  const providerById = useMemo(() => Object.fromEntries(providers.map((p: any) => [p.id, p.name])), [providers]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc"); }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-dvh bg-slate-50/60 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 animate-in fade-in duration-700 admin-shell">
      <PageHero
        eyebrow="CRM"
        category="Base de Clientes"
        title="Gestão de Clientes"
        description="Carteira completa, engajamento e risco de cancelamento."
        icon={<Users className="size-6" />}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={resetFilters} disabled={activeFiltersCount === 0 && !search} className="h-11 px-4 rounded-xl font-bold uppercase text-[10px] border-slate-200 text-slate-700 hover:bg-slate-50">
              Limpar
            </Button>
            {canWrite && (
              <Button onClick={() => { setEditing(null); setOpen(true); }} className="h-11 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all active:scale-95">
                <Plus className="size-4 mr-2 stroke-[3]" />
                Novo cliente
              </Button>
            )}
          </div>
        }
        kpis={[
          { label: "Total", value: kpis.total.toString(), tone: "primary", icon: <Users className="size-4" />, hint: `${kpis.active} ativos` },
          { label: "Em Risco", value: kpis.atRisk.toString(), tone: "danger", icon: <AlertTriangle className="size-4" />, hint: "Saúde < 50" },
          { label: "Saúde", value: `${kpis.avgHealth}%`, tone: "success", icon: <Activity className="size-4" /> },
          { label: "Receita", value: formatBRL(kpis.totalRevenue), tone: "warning", icon: <TrendingUp className="size-4" /> },
        ]}
      />

      <div className="max-w-[1600px] mx-auto px-5 lg:px-8 space-y-6 pb-10 animate-in slide-in-from-bottom-4 duration-1000">

        {/* Toolbar: search + filter toggle + view toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="relative flex-1 min-w-0">
            <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar nome, empresa, CNPJ, e-mail..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-xl bg-white border-slate-200 shadow-sm focus:ring-indigo-500/10 focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 h-11 shrink-0 shadow-sm">
              <button
                onClick={() => setView("grid")}
                className={cn("h-9 px-4 rounded-lg text-xs font-bold transition-all", view === "grid" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900")}
              >Cards</button>
              <button
                onClick={() => setView("table")}
                className={cn("h-9 px-4 rounded-lg text-xs font-bold transition-all", view === "table" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900")}
              >Tabela</button>
            </div>
            <StageFilterBar />
            <FilterPresets
              scope="clients"
              getState={() => ({
                statusFilter, productFilter, partnerFilter, providerFilter,
                cityFilter, paymentFilter, riskFilter, salesFilter,
                dateRange: dateRange ? { from: dateRange.from, to: dateRange.to } : undefined,
                search,
              })}
              applyState={(s) => {
                setStatusFilter(s.statusFilter ?? "all");
                setProductFilter(s.productFilter ?? "all");
                setPartnerFilter(s.partnerFilter ?? "all");
                setProviderFilter(s.providerFilter ?? "all");
                setCityFilter(s.cityFilter ?? "all");
                setPaymentFilter(s.paymentFilter ?? "all");
                setRiskFilter(s.riskFilter ?? "all");
                setSalesFilter(s.salesFilter ?? "all");
                setSearch(s.search ?? "");
                if (s.dateRange?.from) {
                  setDateRange({
                    from: new Date(s.dateRange.from),
                    to: s.dateRange.to ? new Date(s.dateRange.to) : undefined,
                  });
                } else {
                  setDateRange(undefined);
                }
                setShowFilters(true);
              }}
              currentSignature={JSON.stringify({
                statusFilter, productFilter, partnerFilter, providerFilter,
                cityFilter, paymentFilter, riskFilter, salesFilter,
                dateRange: dateRange ? { from: dateRange.from, to: dateRange.to } : undefined,
                search,
              })}
            />
            <Button
              variant="outline"
              onClick={() => setShowFilters((v) => !v)}
              className="h-11 gap-2 flex-1 sm:flex-none rounded-xl border-slate-200 bg-white shadow-sm hover:bg-slate-50 text-slate-700 font-semibold"
            >
              <Filter className="size-4 text-slate-400" />
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center rounded-full bg-indigo-600 text-white size-5 text-[10px] font-bold">
                  {activeFiltersCount}
                </span>
              )}
              {showFilters ? <ChevronUp className="size-4 text-slate-400" /> : <ChevronDown className="size-4 text-slate-400" />}
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="rounded-2xl border border-slate-200/70 bg-white p-5 lg:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shadow-sm animate-in slide-in-from-top-2 duration-300">
            <FilterField label="Status">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField label="Vendas">
              <Select value={salesFilter} onValueChange={setSalesFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="com_venda_ativa">Com venda ativa</SelectItem>
                  <SelectItem value="com_venda_concluida">Com venda concluída</SelectItem>
                  <SelectItem value="com_pendencia">Com pendência financeira</SelectItem>
                  <SelectItem value="sem_venda">Sem venda</SelectItem>
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
                  <SelectItem value="_none">Sem produto</SelectItem>
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

        {/* Active filter chips */}
        {(activeFiltersCount > 0 || search) && (
          <div className="flex flex-wrap items-center gap-2">
            {search && (
              <FilterChip label={`Busca: "${search}"`} onClear={() => setSearch("")} />
            )}
            {statusFilter !== "all" && (
              <FilterChip label={`Status: ${statusLabel(statusFilter)}`} onClear={() => setStatusFilter("all")} />
            )}
            {salesFilter !== "all" && (
              <FilterChip
                label={`Vendas: ${({ com_venda_ativa: "com venda ativa", com_venda_concluida: "concluídas", com_pendencia: "com pendência", sem_venda: "sem venda" } as any)[salesFilter] || salesFilter}`}
                onClear={() => setSalesFilter("all")}
              />
            )}
            {riskFilter !== "all" && (
              <FilterChip label={`Risco: ${riskFilter}`} onClear={() => setRiskFilter("all")} />
            )}
            {productFilter !== "all" && (
              <FilterChip label={productFilter === "_none" ? "Sem produto" : `Produto: ${productById[productFilter] || productFilter}`} onClear={() => setProductFilter("all")} />
            )}
            {partnerFilter !== "all" && (
              <FilterChip label={`Parceiro: ${partnerById[partnerFilter] || partnerFilter}`} onClear={() => setPartnerFilter("all")} />
            )}
            {providerFilter !== "all" && (
              <FilterChip label={`Prestador: ${providerById[providerFilter] || providerFilter}`} onClear={() => setProviderFilter("all")} />
            )}
            {cityFilter !== "all" && (
              <FilterChip label={`Cidade: ${cityFilter}`} onClear={() => setCityFilter("all")} />
            )}
            {paymentFilter !== "all" && (
              <FilterChip label={`Pagamento: ${paymentFilter}`} onClear={() => setPaymentFilter("all")} />
            )}
            {dateRange?.from && (
              <FilterChip
                label={`Cadastro: ${format(dateRange.from, "dd/MM", { locale: ptBR })}${dateRange.to ? ` – ${format(dateRange.to, "dd/MM", { locale: ptBR })}` : ""}`}
                onClear={() => setDateRange(undefined)}
              />
            )}
            <button
              onClick={resetFilters}
              className="text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-indigo-600 transition-colors px-2 py-1"
            >
              Limpar tudo
            </button>
          </div>
        )}

        {/* Lista — grid ou tabela */}
        {isLoading ? (
          view === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-2xl bg-white border border-slate-200/70" />
              ))}
            </div>
          ) : (
            <TableSkeleton rows={6} cols={5} />
          )
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Users}
            title={clients.length === 0 ? "Nenhum cliente cadastrado" : "Nenhum cliente encontrado"}
            description={clients.length === 0 ? "Comece cadastrando seu primeiro cliente." : "Ajuste os filtros ou limpe a busca."}
            actionLabel={clients.length === 0 && canWrite ? "Novo cliente" : "Limpar filtros"}
            onAction={clients.length === 0 && canWrite ? () => { setEditing(null); setOpen(true); } : resetFilters}
          />
        ) : view === "grid" ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {paginated.map((c: any) => (
                <a
                  key={c.id}
                  href={`/clientes/${c.id}`}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                    e.preventDefault();
                    navigate(`/clientes/${c.id}`);
                  }}
                  className="group relative rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-5 hover:border-indigo-300 hover:shadow-md active:scale-[0.99] transition-all cursor-pointer overflow-hidden shadow-sm block no-underline text-inherit"
                >
                  <div
                    className={cn(
                      "absolute top-0 left-0 right-0 h-1",
                      c._risk === "high" && "bg-red-500",
                      c._risk === "med" && "bg-amber-500",
                      c._risk === "low" && "bg-emerald-500"
                    )}
                  />

                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-black shrink-0">
                        {initials(c.full_name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">
                          {c.full_name}
                        </p>
                        <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                          <Building2 className="size-3" />
                          {c.company || "Pessoa física"}
                        </p>
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-8 w-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors sm:opacity-0 sm:group-hover:opacity-100">
                            <MoreHorizontal className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => navigate(`/clientes/${c.id}`)}>
                            <Eye className="size-3.5 mr-2" /> Ver perfil
                          </DropdownMenuItem>
                          {canWrite && (
                            <DropdownMenuItem onClick={() => openEdit(c)}>
                              <Pencil className="size-3.5 mr-2" /> Editar cadastro
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => navigate(`/clientes/${c.id}?tab=financeiro`)}>
                            <CreditCard className="size-3.5 mr-2" /> Financeiro
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/clientes/${c.id}?tab=documentos`)}>
                            <FileText className="size-3.5 mr-2" /> Documentos
                          </DropdownMenuItem>
                          {canWrite && (
                            <DropdownMenuItem onClick={() => navigate(`/agenda?new=1&client=${c.id}`)}>
                              <CalendarClock className="size-3.5 mr-2" /> Nova tarefa
                            </DropdownMenuItem>
                          )}
                          {canWrite && <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleArchive(c)}>
                              {c.status === "inativo" ? (<><ArchiveRestore className="size-3.5 mr-2" /> Reativar</>) : (<><Archive className="size-3.5 mr-2" /> Arquivar</>)}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(c.id)} className="text-red-600 focus:text-red-700">
                              <Trash2 className="size-3.5 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <StatusBadge status={c.status} />
                    <RiskBadge risk={c._risk} overdue={c._overdue} />
                  </div>

                  <div className="mb-3">
                    <InlineStageSelect clientId={c.id} stageId={c.journey_stage_id} />
                  </div>

                  <div className="space-y-2.5 text-xs mb-4">
                    {c.email && (
                      <div className="flex items-center gap-2 text-slate-500 truncate">
                        <Mail className="size-3 shrink-0" /> {c.email}
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <Phone className="size-3" /> {c.phone}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-slate-500">
                      <User className="size-3" /> {c.partners?.full_name || "Direto"}
                    </div>
                  </div>

                  {c._productNames.length > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex flex-wrap gap-1 mb-4 pt-3 border-t border-slate-100 cursor-help">
                          {c._productNames.slice(0, 3).map((p: string, i: number) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold whitespace-nowrap">
                              {p}
                            </span>
                          ))}
                          {c._productNames.length > 3 && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                              +{c._productNames.length - 3}
                            </span>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-300 mb-1">Produtos ({c._productNames.length})</p>
                        <div className="flex flex-col gap-0.5">
                          {c._productNames.map((p: string, i: number) => (
                            <span key={i} className="text-xs">• {p}</span>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}


                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                    <div>
                      <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">Receita</p>
                      <p className="font-mono font-bold text-sm tabular-nums text-slate-900">{formatBRL(c._totalContracted)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">Saúde</p>
                      <p className={cn(
                        "font-mono font-bold text-sm tabular-nums",
                        c._health >= 75 ? "text-emerald-600" : c._health >= 50 ? "text-amber-600" : "text-red-600"
                      )}>{c._health}</p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
            <PaginationControl
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={sorted.length}
              itemsPerPage={itemsPerPage} pageSize={__ps} onPageSizeChange={setPageSize} />
          </>

        ) : (
          <div className="rounded-xl border border-slate-200/70 bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1280px]">
                <thead className="sticky top-0 bg-slate-50/70 backdrop-blur-sm">
                  <tr className="border-b border-slate-200/70">
                    <SortableTh label="Cliente" k="name" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                    <Th>Documento / Contato</Th>
                    <Th>Status</Th>
                    <SortableTh label="Saúde" k="health" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                    <Th>Risco</Th>
                    <Th>Produtos</Th>
                    <Th>Responsável</Th>
                    <SortableTh label="Receita" k="revenue" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} align="right" />
                    <SortableTh label="Cadastro" k="created" sortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} align="right" />
                    <Th align="right">Ações</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((c: any) => (
                    <tr
                      key={c.id}
                      className="group hover:bg-slate-50/70 transition-colors cursor-pointer"
                      onClick={(e) => {
                        if ((e as any).metaKey || (e as any).ctrlKey || (e as any).shiftKey) {
                          window.open(`/clientes/${c.id}`, "_blank");
                          return;
                        }
                        navigate(`/clientes/${c.id}`);
                      }}
                      onAuxClick={(e) => {
                        if (e.button === 1) {
                          e.preventDefault();
                          window.open(`/clientes/${c.id}`, "_blank");
                        }
                      }}
                    >

                      <td className="px-4 py-3.5 max-w-[280px]">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-bold shrink-0">
                            {initials(c.full_name)}
                          </div>
                          <div className="min-w-0">
                            <a
                              href={`/clientes/${c.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-semibold text-slate-900 truncate group-hover:text-indigo-700 transition-colors no-underline hover:underline block"
                            >
                              {c.full_name}
                            </a>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Building2 className="size-3 text-slate-400" />
                              <p className="text-xs text-slate-500 truncate">{c.company || "Pessoa física"}</p>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-xs font-mono text-slate-500">{formatDoc(c.document) || "—"}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Phone className="size-3" /> {c.phone || "—"}</span>
                          {c.email && <Mail className="size-3" />}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1.5">
                          <StatusBadge status={c.status} />
                          <InlineStageSelect clientId={c.id} stageId={c.journey_stage_id} variant="compact" />
                        </div>
                      </td>
                      <td className="px-4 py-3.5"><HealthBar value={c._health} /></td>
                      <td className="px-4 py-3.5"><RiskBadge risk={c._risk} overdue={c._overdue} /></td>
                      <td className="px-4 py-3.5 max-w-[180px]">
                        <div className="flex flex-wrap gap-1">
                          {c._productNames.length > 0 ? (
                            <>
                              {c._productNames.slice(0, 2).map((p: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] text-slate-700 whitespace-nowrap">{p}</span>
                              ))}
                              {c._productNames.length > 2 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] text-slate-500 cursor-help">+{c._productNames.length - 2}</span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <div className="flex flex-col gap-0.5">
                                      {c._productNames.slice(2).map((p: string, i: number) => (
                                        <span key={i} className="text-xs">• {p}</span>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </>
                          ) : <span className="text-xs text-slate-400">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5"><span className="text-xs text-slate-700">{c.partners?.full_name || "Direto"}</span></td>
                      <td className="px-4 py-3.5 text-right">
                        <p className="font-mono font-semibold text-slate-900">{formatBRL(c._totalContracted)}</p>
                        <p className={cn("text-[11px] font-mono mt-0.5", c._totalPending > 0 ? "text-amber-600" : "text-emerald-600")}>
                          {c._totalPending > 0 ? `${formatBRL(c._totalPending)} pend.` : "Quitado"}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <p className="text-xs text-slate-700">{format(new Date(c.created_at), "dd/MM/yyyy")}</p>
                      </td>
                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-8 w-8 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
                              <MoreHorizontal className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => navigate(`/clientes/${c.id}`)}><Eye className="size-3.5 mr-2" /> Ver perfil</DropdownMenuItem>
                            {canWrite && <DropdownMenuItem onClick={() => openEdit(c)}><Pencil className="size-3.5 mr-2" /> Editar cadastro</DropdownMenuItem>}
                            <DropdownMenuItem onClick={() => navigate(`/clientes/${c.id}?tab=financeiro`)}><CreditCard className="size-3.5 mr-2" /> Financeiro</DropdownMenuItem>
                            {canWrite && <DropdownMenuItem onClick={() => navigate(`/agenda?new=1&client=${c.id}`)}><CalendarClock className="size-3.5 mr-2" /> Nova tarefa</DropdownMenuItem>}
                            {canWrite && <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleArchive(c)}>
                                {c.status === "inativo" ? (<><ArchiveRestore className="size-3.5 mr-2" /> Reativar</>) : (<><Archive className="size-3.5 mr-2" /> Arquivar</>)}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(c.id)} className="text-red-600 focus:text-red-700"><Trash2 className="size-3.5 mr-2" /> Excluir</DropdownMenuItem>
                            </>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControl
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={sorted.length}
              itemsPerPage={itemsPerPage} pageSize={__ps} onPageSizeChange={setPageSize} />
          </div>
        )}

        <ClientFormDialog
          open={open}
          onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
          client={editing}
          onCreated={() => { qc.invalidateQueries({ queryKey: ["clients-admin-list"] }); qc.invalidateQueries({ queryKey: ["ref:clients"] }); }}
        />

      </div>
    </div>
    </TooltipProvider>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={cn(
      "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500",
      align === "right" ? "text-right" : "text-left"
    )}>
      {children}
    </th>
  );
}

function SortableTh({
  label, k, sortKey, sortDir, onToggle, align = "left",
}: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: SortDir;
  onToggle: (k: SortKey) => void; align?: "left" | "right";
}) {
  const active = sortKey === k;
  return (
    <th className={cn("px-4 py-3", align === "right" ? "text-right" : "text-left")}>
      <button
        onClick={() => onToggle(k)}
        className={cn(
          "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider transition-colors",
          active ? "text-indigo-700" : "text-slate-500 hover:text-slate-900"
        )}
      >
        {label}
        {active ? (sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
      </button>
    </th>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-white border border-slate-200 shadow-sm text-[11px] font-semibold text-slate-700">
      {label}
      <button
        onClick={onClear}
        className="size-5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
        aria-label="Remover filtro"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  ativo: { label: "Ativo", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  prospecto: { label: "Cliente em prospecção", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  novo_cliente: { label: "Novo cliente", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  em_andamento: { label: "Em andamento", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  pagamento_pendente: { label: "Pagamento pendente", cls: "bg-orange-50 text-orange-700 border-orange-200" },
  pagamento_parcial: { label: "Pagamento parcial", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  pagamento_confirmado: { label: "Pagamento confirmado", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  finalizado: { label: "Cliente finalizado", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  inativo: { label: "Inativo", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  cancelado: { label: "Cancelado", cls: "bg-red-50 text-red-700 border-red-200" },
};

function statusLabel(status: string) {
  return STATUS_META[status]?.label ?? (status ? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—");
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] || { label: statusLabel(status), cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold", m.cls)}>
      <span className="size-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      {m.label}
    </span>
  );
}

function RiskBadge({ risk, overdue }: { risk: "low" | "med" | "high"; overdue: number }) {
  const map = {
    low: { label: "Baixo", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    med: { label: "Médio", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    high: { label: "Alto", cls: "bg-red-50 text-red-700 border-red-200" },
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
        Risco {m.label.toLowerCase()} — calculado pela saúde (pagamentos vencidos, status e relação pago/contratado)
        {overdue > 0 && ` · ${overdue} pagamento(s) vencido(s)`}
      </TooltipContent>
    </Tooltip>
  );
}

function HealthBar({ value }: { value: number }) {
  const tone = value >= 75 ? "bg-emerald-500" : value >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[11px] font-mono font-semibold text-slate-700 w-8 text-right">{value}</span>
    </div>
  );
}
