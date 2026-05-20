import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus, Search, Pencil, Trash2, Package, TrendingUp, Layers,
  Tag, MoreHorizontal, Power, PowerOff, Filter, Sparkles, ListChecks,
  CircleDollarSign, Percent, RefreshCcw, Users2, ArrowUp, ArrowDown,
  X, Inbox, Handshake,
} from "lucide-react";
import { ProductChecklistDialog } from "@/components/products/ProductChecklistDialog";
import { ProductFormDialog } from "@/components/products/ProductFormDialog";
import { formatBRL, formatPercent } from "@/lib/format";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { confirmAction } from "@/lib/confirm";
import { useAuth } from "@/hooks/useAuth";

type Product = {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  base_price: number | null;
  default_commission_percent: number | null;
  default_employee_commission: number | null;
  default_provider_value: number | null;
  billing_type: string;
  required_documents: { name: string }[] | null;
  standard_steps: { label: string; completed?: boolean }[] | null;
  avg_delivery_time: number | null;
  active: boolean;
  recurring: boolean;
  allow_partner: boolean;
  created_at: string;
  default_sla_days?: number;
  sla_day_type?: "calendar" | "working";
  initial_status?: string;
  client_welcome_message?: string;
  provider_welcome_message?: string;
  auto_tasks_template?: any[];
  recommended_provider_type?: string;
  product_categories?: { id: string; name: string; color: string | null; icon: string | null } | null;
};

type Category = {
  id: string; name: string; slug: string; color: string | null; icon: string | null;
};

type SortKey = "name" | "category" | "price" | "commission" | "partners" | "sales" | "revenue" | "status";
type SortDir = "asc" | "desc";

const norm = (s: any) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export default function Products() {
  const qc = useQueryClient();
  const { isAdmin, isAdminSecondary } = useAuth();
  const canManage = isAdmin || isAdminSecondary;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [billingFilter, setBillingFilter] = useState<"all" | "recurring" | "single">("all");
  const [partnerFilter, setPartnerFilter] = useState<"all" | "yes" | "no">("all");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [productOpen, setProductOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [catForm, setCatForm] = useState<{ id?: string; name: string; color: string }>({ name: "", color: "#6366f1" });
  const [checklistTarget, setChecklistTarget] = useState<Product | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products-list"],
    queryFn: async (): Promise<Product[]> => {
      const { data } = await supabase
        .from("products")
        .select("*, product_categories(id,name,color,icon)")
        .order("created_at", { ascending: false });
      return (data ?? []) as any;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data } = await supabase.from("product_categories").select("*").order("name");
      return (data ?? []) as any;
    },
  });

  const { data: usageStats = {} } = useQuery({
    queryKey: ["product-usage"],
    queryFn: async () => {
      const [{ data: sales }, { data: links }] = await Promise.all([
        supabase.from("sales").select("product_id, amount"),
        supabase.from("partner_products").select("product_id"),
      ]);
      const map: Record<string, { sales: number; revenue: number; partners: number }> = {};
      (sales ?? []).forEach((s: any) => {
        if (!s.product_id) return;
        map[s.product_id] = map[s.product_id] || { sales: 0, revenue: 0, partners: 0 };
        map[s.product_id].sales += 1;
        map[s.product_id].revenue += Number(s.amount || 0);
      });
      (links ?? []).forEach((l: any) => {
        if (!l.product_id) return;
        map[l.product_id] = map[l.product_id] || { sales: 0, revenue: 0, partners: 0 };
        map[l.product_id].partners += 1;
      });
      return map;
    },
  });

  const filtered = useMemo(() => {
    const q = norm(search);
    return products.filter((p) => {
      if (statusFilter === "active" && !p.active) return false;
      if (statusFilter === "inactive" && p.active) return false;
      if (categoryFilter !== "all" && p.category_id !== categoryFilter) return false;
      if (billingFilter === "recurring" && !p.recurring) return false;
      if (billingFilter === "single" && p.recurring) return false;
      if (partnerFilter === "yes" && !p.allow_partner) return false;
      if (partnerFilter === "no" && p.allow_partner) return false;
      if (q) {
        const hay = norm(`${p.name} ${p.description ?? ""} ${p.product_categories?.name ?? ""}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, statusFilter, categoryFilter, billingFilter, partnerFilter, search]);

  const sortedTable = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    const stat = (id: string) => (usageStats as any)[id] || { sales: 0, revenue: 0, partners: 0 };
    arr.sort((a, b) => {
      const v = (p: Product): string | number => {
        switch (sortKey) {
          case "name": return norm(p.name);
          case "category": return norm(p.product_categories?.name);
          case "price": return Number(p.base_price ?? 0);
          case "commission": return Number(p.default_commission_percent ?? 0);
          case "partners": return stat(p.id).partners;
          case "sales": return stat(p.id).sales;
          case "revenue": return stat(p.id).revenue;
          case "status": return p.active ? 1 : 0;
        }
      };
      const va = v(a), vb = v(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir, usageStats]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "name" || k === "category" ? "asc" : "desc"); }
  };

  const kpis = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.active).length;
    const inactive = total - active;
    const recurring = products.filter((p) => p.recurring).length;
    const noCategory = products.filter((p) => !p.category_id).length;
    const avgCommission = total
      ? products.reduce((s, p) => s + Number(p.default_commission_percent ?? 0), 0) / total
      : 0;
    let totalRevenue = 0;
    let totalSales = 0;
    Object.values(usageStats).forEach((v: any) => { totalRevenue += v.revenue; totalSales += v.sales; });
    const ticket = totalSales > 0 ? totalRevenue / totalSales : 0;
    return { total, active, inactive, recurring, avgCommission, totalRevenue, ticket, noCategory };
  }, [products, usageStats]);

  const bestProduct = useMemo(() => {
    const entries = Object.entries(usageStats as any)
      .map(([id, u]: any) => ({ id, ...u, p: products.find((x) => x.id === id) }))
      .filter((x) => x.p && x.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
    return entries[0] || null;
  }, [products, usageStats]);

  const openNew = () => { setEditing(null); setProductOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setProductOpen(true); };

  const toggleActive = async (p: Product) => {
    if (!canManage) return;
    if (p.active) {
      const u = (usageStats as any)[p.id];
      if (u && (u.sales > 0 || u.partners > 0)) {
        if (!(await confirmAction(`Desativar "${p.name}"? Ele sairá do catálogo, mas o histórico (${u.sales} vendas, ${u.partners} parceiros) será preservado.`))) return;
      }
    }
    const { error } = await supabase.from("products").update({ active: !p.active }).eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success(p.active ? "Serviço desativado" : "Serviço ativado");
      qc.invalidateQueries({ queryKey: ["products-list"] });
    }
  };

  const handleDelete = async (p: Product) => {
    if (!canManage) return;
    const [salesQ, cpQ, contractsQ, commissionsQ, leadsQ, paymentsQ, documentsQ] = await Promise.all([
      supabase.from("sales").select("id", { count: "exact", head: true }).eq("product_id", p.id),
      supabase.from("client_products").select("id", { count: "exact", head: true }).eq("product_id", p.id),
      supabase.from("contracts").select("id", { count: "exact", head: true }).eq("product_id", p.id),
      supabase.from("commissions").select("id", { count: "exact", head: true }).eq("product_id", p.id),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("product_id", p.id),
      supabase.from("payments").select("id", { count: "exact", head: true }).eq("product_id", p.id),
      supabase.from("documents").select("id", { count: "exact", head: true }).eq("product_id", p.id),
    ]);
    const counts = {
      vendas: salesQ.count ?? 0,
      demandas: cpQ.count ?? 0,
      contratos: contractsQ.count ?? 0,
      comissões: commissionsQ.count ?? 0,
      leads: leadsQ.count ?? 0,
      faturas: paymentsQ.count ?? 0,
      documentos: documentsQ.count ?? 0,
    };
    const vinculos = Object.entries(counts).filter(([, n]) => n > 0);

    if (vinculos.length > 0) {
      const resumo = vinculos.map(([k, n]) => `${n} ${k}`).join(", ");
      const ok = await confirmAction(
        `"${p.name}" está vinculado a ${resumo} e não pode ser excluído sem perder histórico.\n\nDeseja DESATIVAR este serviço? Ele sairá do catálogo, mas o histórico será preservado.`,
      );
      if (!ok) return;
      const { error } = await supabase.from("products").update({ active: false }).eq("id", p.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Serviço desativado (histórico preservado)");
      qc.invalidateQueries({ queryKey: ["products-list"] });
      return;
    }

    if (!(await confirmAction(`Excluir "${p.name}"? Esta ação não pode ser desfeita.`))) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) {
      toast.error("Não foi possível excluir: existem registros vinculados. Use 'Desativar'.");
      return;
    }
    toast.success("Serviço excluído");
    qc.invalidateQueries({ queryKey: ["products-list"] });
    qc.invalidateQueries({ queryKey: ["product-usage"] });
  };

  const slugify = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const submitCategory = async () => {
    if (!catForm.name?.trim()) { toast.error("Nome obrigatório"); return; }
    const name = catForm.name.trim();
    const slug = slugify(name);
    if (catForm.id) {
      const { error } = await supabase.from("product_categories")
        .update({ name, slug, color: catForm.color })
        .eq("id", catForm.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Categoria atualizada");
    } else {
      const exists = categories.find((c) => norm(c.name) === norm(name) || c.slug === slug);
      if (exists) { toast.error("Já existe uma categoria com esse nome"); return; }
      const { error } = await supabase.from("product_categories").insert({ name, slug, color: catForm.color });
      if (error) { toast.error(error.message); return; }
      toast.success("Categoria criada");
    }
    setCatForm({ name: "", color: "#6366f1" });
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["products-list"] });
  };

  const editCategory = (c: Category) => setCatForm({ id: c.id, name: c.name, color: c.color ?? "#6366f1" });

  const deleteCategory = async (c: Category) => {
    const count = products.filter((p) => p.category_id === c.id).length;
    const msg = count > 0
      ? `Excluir categoria "${c.name}"? ${count} ${count === 1 ? "serviço ficará" : "serviços ficarão"} sem categoria.`
      : `Excluir categoria "${c.name}"?`;
    if (!(await confirmAction(msg))) return;
    const { error } = await supabase.from("product_categories").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Categoria removida");
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["products-list"] });
    }
  };

  const clearFilters = () => {
    setSearch(""); setStatusFilter("all"); setCategoryFilter("all"); setBillingFilter("all"); setPartnerFilter("all");
  };
  const activeChips: { label: string; clear: () => void }[] = [];
  if (search) activeChips.push({ label: `Busca: ${search}`, clear: () => setSearch("") });
  if (statusFilter !== "all") activeChips.push({ label: `Status: ${statusFilter === "active" ? "Ativos" : "Inativos"}`, clear: () => setStatusFilter("all") });
  if (categoryFilter !== "all") {
    const c = categories.find((x) => x.id === categoryFilter);
    activeChips.push({ label: `Categoria: ${c?.name ?? "—"}`, clear: () => setCategoryFilter("all") });
  }
  if (billingFilter !== "all") activeChips.push({ label: `Tipo: ${billingFilter === "recurring" ? "Recorrente" : "Único"}`, clear: () => setBillingFilter("all") });
  if (partnerFilter !== "all") activeChips.push({ label: `Parceiros: ${partnerFilter === "yes" ? "Permite" : "Não permite"}`, clear: () => setPartnerFilter("all") });
  const hasActiveFilters = activeChips.length > 0;

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 font-sans admin-shell">
      <div className="max-w-[1600px] mx-auto px-5 lg:px-8 py-6 space-y-5">
        {/* HEADER */}
        <header className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">
              <Sparkles className="size-3 text-indigo-500" /> Catálogo
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">Serviços</h1>
            <p className="text-[12px] text-slate-500 mt-1">Catálogo operacional: cada serviço vira demanda com checklist, SLA e financeiro.</p>
          </div>
          {canManage && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCategoryOpen(true)} className="h-10 px-4 gap-2 border-slate-200/70 bg-white hover:bg-slate-50">
                <Tag className="size-4" /> Categorias
              </Button>
              <Button size="sm" onClick={openNew} className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                <Plus className="size-4" /> Novo Serviço
              </Button>
            </div>
          )}
        </header>

        {/* KPIs */}
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard label="Total no catálogo" value={String(kpis.total)} icon={<Package className="size-4" />} tone="indigo" />
          <KpiCard label="Ativos" value={String(kpis.active)} icon={<Power className="size-4" />} tone="emerald"
            sub={kpis.inactive > 0 ? `${kpis.inactive} inativos` : undefined} />
          <KpiCard label="Recorrentes" value={String(kpis.recurring)} icon={<RefreshCcw className="size-4" />} tone="sky" />
          <KpiCard label="Ticket médio" value={formatBRL(kpis.ticket)} icon={<CircleDollarSign className="size-4" />} tone="amber"
            sub={`Receita: ${formatBRL(kpis.totalRevenue)}`} />
          <KpiCard label="Comissão média" value={formatPercent(kpis.avgCommission)} icon={<Percent className="size-4" />} tone="violet" />
        </section>

        {/* INSIGHTS */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 bg-white border border-slate-200/70 rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.22em] font-bold text-slate-500">
                  <TrendingUp className="size-3 text-indigo-500" /> Performance · Receita
                </div>
                <h3 className="text-base font-bold mt-1 text-slate-900">Top Serviços por Receita</h3>
              </div>
              <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200/70 text-slate-600">{products.length} serviços</Badge>
            </div>
            {products.length === 0 || !bestProduct ? (
              <div className="py-8 text-center text-sm text-slate-400">
                <Inbox className="size-7 mx-auto mb-2" />
                Sem vendas registradas ainda.
              </div>
            ) : (
              <div className="space-y-3">
                {products
                  .map((p) => ({ p, u: (usageStats as any)[p.id] || { sales: 0, revenue: 0, partners: 0 } }))
                  .filter((x) => x.u.revenue > 0)
                  .sort((a, b) => b.u.revenue - a.u.revenue)
                  .slice(0, 5)
                  .map(({ p, u }, idx) => {
                    const max = Math.max(1, ...products.map((q) => (usageStats as any)[q.id]?.revenue || 0));
                    const pct = (u.revenue / max) * 100;
                    const color = p.product_categories?.color ?? "#6366f1";
                    const ticket = u.sales > 0 ? u.revenue / u.sales : 0;
                    return (
                      <div key={p.id}>
                        <div className="flex items-center justify-between text-[12px] mb-1.5">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="size-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: `${color}1a`, color }}>{idx + 1}</span>
                            <span className="font-semibold text-slate-800 truncate">{p.name}</span>
                          </span>
                          <span className="font-mono font-bold text-slate-900 shrink-0 text-[12px]">
                            {formatBRL(u.revenue)}
                            <span className="font-medium text-slate-400 ml-1.5">· {u.sales} {u.sales === 1 ? "venda" : "vendas"} · ticket {formatBRL(ticket)}</span>
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, pct)}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200/70 rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[9.5px] uppercase tracking-[0.22em] font-bold text-slate-500">
                <Layers className="size-3 text-indigo-500" /> Categorias
              </div>
              <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200/70 text-slate-600">{categories.length}</Badge>
            </div>
            {categories.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-6">Nenhuma categoria criada.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {categories.map((c) => {
                  const count = products.filter((p) => p.category_id === c.id).length;
                  const color = c.color ?? "#6366f1";
                  const active = categoryFilter === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setCategoryFilter(active ? "all" : c.id)}
                      className={cn(
                        "text-left rounded-md border p-2.5 transition-all",
                        active
                          ? "border-indigo-300 bg-indigo-50/60 shadow-sm"
                          : "border-slate-200/70 bg-white hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="size-2 rounded-full shrink-0" style={{ background: color }} />
                        <p className="text-[12px] font-semibold text-slate-800 truncate">{c.name}</p>
                      </div>
                      <p className="text-[10.5px] text-slate-500">{count} {count === 1 ? "serviço" : "serviços"}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* TOOLBAR */}
        <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Buscar serviço, descrição, categoria..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 rounded-md bg-white border-slate-200 text-sm" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[170px] h-10 bg-white border-slate-200 text-xs font-medium"><Filter className="size-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={billingFilter} onValueChange={(v: any) => setBillingFilter(v)}>
            <SelectTrigger className="w-[140px] h-10 bg-white border-slate-200 text-xs font-medium"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              <SelectItem value="recurring">Recorrente</SelectItem>
              <SelectItem value="single">Único</SelectItem>
            </SelectContent>
          </Select>
          <Select value={partnerFilter} onValueChange={(v: any) => setPartnerFilter(v)}>
            <SelectTrigger className="w-[160px] h-10 bg-white border-slate-200 text-xs font-medium"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos parceiros</SelectItem>
              <SelectItem value="yes">Permite parceiro</SelectItem>
              <SelectItem value="no">Sem parceiro</SelectItem>
            </SelectContent>
          </Select>
          <Tabs value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <TabsList className="h-10 bg-slate-100/80">
              <TabsTrigger value="all" className="text-xs data-[state=active]:bg-white">Todos</TabsTrigger>
              <TabsTrigger value="active" className="text-xs data-[state=active]:bg-white">Ativos</TabsTrigger>
              <TabsTrigger value="inactive" className="text-xs data-[state=active]:bg-white">Inativos</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={view} onValueChange={(v: any) => setView(v)}>
            <TabsList className="h-10 bg-slate-100/80">
              <TabsTrigger value="grid" className="text-xs data-[state=active]:bg-white">Grade</TabsTrigger>
              <TabsTrigger value="table" className="text-xs data-[state=active]:bg-white">Tabela</TabsTrigger>
            </TabsList>
          </Tabs>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 text-slate-500 hover:text-slate-900">
              <X className="size-3.5 mr-1" /> Limpar
            </Button>
          )}
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 -mt-2">
            {activeChips.map((c, i) => (
              <button key={i} onClick={c.clear} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-semibold border border-indigo-100 hover:bg-indigo-100">
                {c.label}<X className="size-3" />
              </button>
            ))}
          </div>
        )}

        {/* LIST */}
        {isLoading ? (
          view === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-5 animate-pulse h-[200px]" />
              ))}
            </div>
          ) : (
            <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-6 text-center text-slate-400 text-sm">Carregando...</div>
          )
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-16 text-center">
            <Package className="size-10 text-slate-300 mx-auto mb-3" />
            <p className="text-lg font-semibold text-slate-700">Nenhum serviço encontrado</p>
            <p className="text-sm text-slate-500 mt-1">
              {hasActiveFilters ? "Ajuste os filtros para ver mais resultados." : "Cadastre seu primeiro serviço para começar."}
            </p>
            {canManage && !hasActiveFilters && (
              <Button onClick={openNew} className="mt-4 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"><Plus className="size-4" /> Novo serviço</Button>
            )}
            {hasActiveFilters && (
              <Button variant="link" onClick={clearFilters} className="mt-2 text-indigo-600">Limpar filtros</Button>
            )}
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((p) => {
              const u = (usageStats as any)[p.id] || { sales: 0, revenue: 0, partners: 0 };
              const cat = p.product_categories;
              const color = cat?.color ?? "#6366f1";
              return (
                <div key={p.id} className={cn(
                  "bg-white border rounded-lg shadow-sm p-5 flex flex-col transition-all hover:shadow-md",
                  p.active ? "border-slate-200/70" : "border-slate-200/70 opacity-70"
                )}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="size-10 rounded-md flex items-center justify-center shrink-0" style={{ background: `${color}1a`, color }}>
                      <Package className="size-5" />
                    </div>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8 text-slate-400 hover:text-slate-900 hover:bg-slate-100">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => openEdit(p)}><Pencil className="size-3.5 mr-2" /> Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setChecklistTarget(p)}><ListChecks className="size-3.5 mr-2" /> Checklist Template</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => toggleActive(p)} className={p.active ? "text-amber-700" : "text-emerald-700"}>
                            {p.active ? <><PowerOff className="size-3.5 mr-2" /> Desativar</> : <><Power className="size-3.5 mr-2" /> Ativar</>}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(p)} className="text-rose-600 focus:text-rose-700">
                            <Trash2 className="size-3.5 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border" style={{ color, borderColor: `${color}40`, background: `${color}10` }}>
                        {cat?.name || "Sem categoria"}
                      </span>
                      {p.recurring && (
                        <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                          Recorrente
                        </span>
                      )}
                      {p.allow_partner && (
                        <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Parceiro
                        </span>
                      )}
                      {!p.active && (
                        <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          Inativo
                        </span>
                      )}
                    </div>
                    <h3 className="text-[15px] font-bold text-slate-900 line-clamp-1 tracking-tight">{p.name}</h3>
                    <p className="text-[12px] text-slate-500 line-clamp-2 leading-relaxed min-h-[32px]">
                      {p.description || "Sem descrição."}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100">
                    <div>
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Preço base</p>
                      <p className="text-[13px] font-bold text-slate-900 font-mono mt-0.5">{formatBRL(p.base_price)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Comissão</p>
                      <p className="text-[13px] font-bold text-indigo-700 font-mono mt-0.5">{formatPercent(p.default_commission_percent)}</p>
                    </div>
                    <div>
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">SLA</p>
                      <p className="text-[12px] font-semibold text-slate-700 font-mono mt-0.5">
                        {p.default_sla_days ?? "—"} {p.sla_day_type === "calendar" ? "dias corridos" : "dias úteis"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">Receita</p>
                      <p className="text-[12px] font-semibold text-emerald-700 font-mono mt-0.5">{formatBRL(u.revenue)}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1"><Handshake className="size-3" /> {u.partners} {u.partners === 1 ? "parceiro" : "parceiros"}</span>
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-700"><TrendingUp className="size-3" /> {u.sales} {u.sales === 1 ? "venda" : "vendas"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[960px]">
                <thead>
                  <tr className="border-b border-slate-200/70 bg-slate-50/60">
                    <SortableTh label="Serviço" k="name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                    <SortableTh label="Categoria" k="category" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                    <Th>Tipo</Th>
                    <SortableTh label="Preço" k="price" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                    <SortableTh label="Comissão" k="commission" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                    <SortableTh label="Parceiros" k="partners" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                    <SortableTh label="Vendas" k="sales" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                    <SortableTh label="Receita" k="revenue" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
                    <SortableTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                    <Th align="right">Ações</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedTable.map((p) => {
                    const u = (usageStats as any)[p.id] || { sales: 0, revenue: 0, partners: 0 };
                    const cat = p.product_categories;
                    const color = cat?.color ?? "#6366f1";
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-md flex items-center justify-center shrink-0" style={{ background: `${color}1a`, color }}>
                              <Package className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                              <p className="text-[11px] text-slate-500 truncate max-w-[280px]">{p.description ?? "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {cat ? (
                            <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border" style={{ background: `${color}10`, color, borderColor: `${color}40` }}>{cat.name}</span>
                          ) : <span className="text-slate-400 text-xs">—</span>}
                        </td>
                        <td className="px-5 py-3">
                          <span className={cn(
                            "inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                            p.recurring ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-slate-50 text-slate-600 border-slate-200"
                          )}>
                            {p.recurring ? "Recorrente" : "Único"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-slate-900">{formatBRL(p.base_price)}</td>
                        <td className="px-5 py-3 text-right font-mono text-emerald-700 font-semibold">{formatPercent(p.default_commission_percent)}</td>
                        <td className="px-5 py-3 text-right font-mono text-slate-600">{u.partners}</td>
                        <td className="px-5 py-3 text-right font-mono text-slate-600">{u.sales}</td>
                        <td className="px-5 py-3 text-right font-mono font-semibold text-slate-900">{formatBRL(u.revenue)}</td>
                        <td className="px-5 py-3">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                            p.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200"
                          )}>
                            <span className="size-1.5 rounded-full bg-current" />
                            {p.active ? "ativo" : "inativo"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {canManage ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8 text-slate-400 hover:text-slate-900 hover:bg-slate-100">
                                  <MoreHorizontal className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => openEdit(p)}><Pencil className="size-3.5 mr-2" /> Editar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setChecklistTarget(p)}><ListChecks className="size-3.5 mr-2" /> Checklist Template</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => toggleActive(p)} className={p.active ? "text-amber-700" : "text-emerald-700"}>
                                  {p.active ? <><PowerOff className="size-3.5 mr-2" /> Desativar</> : <><Power className="size-3.5 mr-2" /> Ativar</>}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(p)} className="text-rose-600 focus:text-rose-700">
                                  <Trash2 className="size-3.5 mr-2" /> Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Dialog Serviço */}
      <ProductFormDialog
        open={productOpen}
        onOpenChange={setProductOpen}
        editing={editing}
        categories={categories}
        onSaved={() => {
          setEditing(null);
          qc.invalidateQueries({ queryKey: ["products-list"] });
          qc.invalidateQueries({ queryKey: ["product-usage"] });
        }}
      />

      {/* Dialog Categorias */}
      <Dialog open={categoryOpen} onOpenChange={(v) => { setCategoryOpen(v); if (!v) setCatForm({ name: "", color: "#6366f1" }); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Categorias</DialogTitle>
            <DialogDescription>Organize seu catálogo por tipos de serviço.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-end gap-2 p-3 rounded-md border border-slate-200/70 bg-slate-50/60">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">{catForm.id ? "Editar nome" : "Nome"}</Label>
                <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="Ex: SaaS" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cor</Label>
                <input
                  type="color"
                  value={catForm.color}
                  onChange={(e) => setCatForm({ ...catForm, color: e.target.value })}
                  className="size-9 rounded-md border border-slate-200 cursor-pointer bg-transparent"
                />
              </div>
              <Button onClick={submitCategory} className="gap-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white">
                {catForm.id ? <><Pencil className="size-3.5" /> Salvar</> : <><Plus className="size-4" /> Adicionar</>}
              </Button>
              {catForm.id && (
                <Button variant="ghost" onClick={() => setCatForm({ name: "", color: "#6366f1" })} className="h-9 text-slate-500">
                  Cancelar
                </Button>
              )}
            </div>

            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {categories.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-6">Nenhuma categoria criada</p>
              ) : categories.map((c) => {
                const count = products.filter((p) => p.category_id === c.id).length;
                const color = c.color ?? "#6366f1";
                return (
                  <div key={c.id} className="flex items-center justify-between p-2.5 rounded-md border border-slate-200/70 hover:bg-slate-50/60">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="size-7 rounded-md flex items-center justify-center shrink-0" style={{ background: `${color}1a`, color }}>
                        <Layers className="size-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                        <p className="text-[11px] text-slate-500">{count} serviço{count !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => editCategory(c)} className="size-7 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center">
                        <Pencil className="size-3.5" />
                      </button>
                      <button onClick={() => deleteCategory(c)} className="size-7 rounded-md hover:bg-rose-50 text-slate-500 hover:text-rose-600 flex items-center justify-center">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {checklistTarget && (
        <ProductChecklistDialog
          open={!!checklistTarget}
          onOpenChange={(v) => !v && setChecklistTarget(null)}
          productId={checklistTarget.id}
          productName={checklistTarget.name}
        />
      )}
    </div>
  );
}

function KpiCard({ label, value, icon, tone, sub }: { label: string; value: string; icon: React.ReactNode; tone: "indigo" | "emerald" | "sky" | "amber" | "violet"; sub?: string }) {
  const toneMap = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    sky: "bg-sky-50 text-sky-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-4 flex items-center gap-3">
      <div className={cn("size-10 rounded-md flex items-center justify-center shrink-0", toneMap[tone])}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="font-mono text-[17px] font-bold text-slate-900 leading-tight truncate">{value}</p>
        {sub && <p className="text-[10.5px] text-slate-500 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={cn("px-5 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500", align === "right" ? "text-right" : "text-left")}>
      {children}
    </th>
  );
}

function SortableTh({ label, k, sortKey, sortDir, onClick, align = "left" }: { label: string; k: SortKey; sortKey: SortKey; sortDir: SortDir; onClick: (k: SortKey) => void; align?: "left" | "right" }) {
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
