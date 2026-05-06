import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus, Search, Pencil, Trash2, Package, TrendingUp, Layers, RefreshCcw,
  Tag, Users2, MoreHorizontal, Power, PowerOff, Filter, Sparkles, Boxes,
} from "lucide-react";
import { formatBRL, formatPercent } from "@/lib/format";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";

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
  required_documents: string[] | null;
  standard_steps: { label: string; completed: boolean }[] | null;
  avg_delivery_time: number | null;
  active: boolean;
  recurring: boolean;
  allow_partner: boolean;
  created_at: string;
  product_categories?: { id: string; name: string; color: string | null; icon: string | null } | null;
};

type Category = {
  id: string; name: string; slug: string; color: string | null; icon: string | null;
};

const emptyForm = {
  name: "",
  description: "",
  category_id: "",
  base_price: 0,
  default_commission_percent: 10,
  default_employee_commission: 0,
  default_provider_value: 0,
  billing_type: "unico",
  required_documents: "",
  standard_steps: "",
  avg_delivery_time: "",
  active: true,
  recurring: false,
  allow_partner: true,
};

export default function Products() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [view, setView] = useState<"grid" | "table">("grid");

  const [productOpen, setProductOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<any>(emptyForm);

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [catForm, setCatForm] = useState<any>({ name: "", color: "#6366f1" });

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
      const { data: sales } = await supabase.from("sales").select("product_id, amount");
      const { data: links } = await supabase.from("partner_products").select("product_id");
      const map: Record<string, { sales: number; revenue: number; partners: number }> = {};
      (sales ?? []).forEach((s: any) => {
        if (!s.product_id) return;
        map[s.product_id] = map[s.product_id] || { sales: 0, revenue: 0, partners: 0 };
        map[s.product_id].sales += 1;
        map[s.product_id].revenue += Number(s.amount || 0);
      });
      (links ?? []).forEach((l: any) => {
        map[l.product_id] = map[l.product_id] || { sales: 0, revenue: 0, partners: 0 };
        map[l.product_id].partners += 1;
      });
      return map;
    },
  });

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (statusFilter === "active" && !p.active) return false;
      if (statusFilter === "inactive" && p.active) return false;
      if (categoryFilter !== "all" && p.category_id !== categoryFilter) return false;
      if (search && !`${p.name} ${p.description ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [products, statusFilter, categoryFilter, search]);

  const kpis = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.active).length;
    const recurring = products.filter((p) => p.recurring).length;
    const avgCommission = total
      ? products.reduce((s, p) => s + Number(p.default_commission_percent ?? 0), 0) / total
      : 0;
    const totalRevenue = Object.values(usageStats).reduce((s: number, v: any) => s + v.revenue, 0);
    return { total, active, recurring, avgCommission, totalRevenue };
  }, [products, usageStats]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, category_id: categories[0]?.id ?? "" });
    setProductOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      category_id: p.category_id ?? "",
      base_price: p.base_price ?? 0,
      default_commission_percent: p.default_commission_percent ?? 10,
      default_employee_commission: p.default_employee_commission ?? 0,
      default_provider_value: p.default_provider_value ?? 0,
      billing_type: p.billing_type || "unico",
      required_documents: Array.isArray(p.required_documents) ? p.required_documents.join(", ") : "",
      standard_steps: Array.isArray(p.standard_steps) ? p.standard_steps.map((s: any) => s.label).join(", ") : "",
      avg_delivery_time: p.avg_delivery_time ?? "",
      active: p.active,
      recurring: p.recurring,
      allow_partner: p.allow_partner,
    });
    setProductOpen(true);
  };

  const submit = async () => {
    if (!form.name?.trim()) { toast.error("Nome obrigatório"); return; }
    if (!form.category_id) { toast.error("Selecione uma categoria"); return; }

    const payload = {
      name: form.name.trim(),
      description: form.description?.trim() || null,
      category_id: form.category_id,
      base_price: Number(form.base_price ?? 0),
      default_commission_percent: Number(form.default_commission_percent ?? 0),
      default_employee_commission: Number(form.default_employee_commission ?? 0),
      default_provider_value: Number(form.default_provider_value ?? 0),
      billing_type: form.billing_type,
      required_documents: form.required_documents ? form.required_documents.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
      standard_steps: form.standard_steps ? form.standard_steps.split(",").map((s: string) => ({ label: s.trim(), completed: false })).filter((s: any) => s.label) : [],
      avg_delivery_time: form.avg_delivery_time ? Number(form.avg_delivery_time) : null,
      active: !!form.active,
      recurring: !!form.recurring,
      allow_partner: !!form.allow_partner,
    };

    const { error } = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);

    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Produto atualizado" : "Produto cadastrado");
    setProductOpen(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["products-list"] });
  };

  const toggleActive = async (p: Product) => {
    const { error } = await supabase.from("products").update({ active: !p.active }).eq("id", p.id);
    if (error) toast.error(error.message);
    else { toast.success(p.active ? "Produto desativado" : "Produto ativado"); qc.invalidateQueries({ queryKey: ["products-list"] }); }
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`Excluir "${p.name}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else { toast.success("Produto excluído"); qc.invalidateQueries({ queryKey: ["products-list"] }); }
  };

  const submitCategory = async () => {
    if (!catForm.name?.trim()) { toast.error("Nome obrigatório"); return; }
    const slug = catForm.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const { error } = await supabase.from("product_categories").insert({
      name: catForm.name.trim(),
      slug,
      color: catForm.color,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Categoria criada");
    setCatForm({ name: "", color: "#6366f1" });
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("Excluir categoria? Produtos vinculados ficarão sem categoria.")) return;
    const { error } = await supabase.from("product_categories").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Categoria removida"); qc.invalidateQueries({ queryKey: ["categories"] }); qc.invalidateQueries({ queryKey: ["products-list"] }); }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in space-y-6">
      <PageHeader
        title="Catálogo de produtos"
        description="Gerencie produtos, categorias, preços, comissões e disponibilidade para parceiros."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setCategoryOpen(true)} className="gap-2">
              <Tag className="size-4" /> Categorias
            </Button>
            <Button onClick={openNew} className="gap-2 bg-gradient-primary hover:opacity-90 shadow-vx-sm">
              <Plus className="size-4" /> Novo produto
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <KpiCard icon={Boxes} label="Total" value={kpis.total} tone="primary" />
        <KpiCard icon={Power} label="Ativos" value={kpis.active} tone="success" />
        <KpiCard icon={RefreshCcw} label="Recorrentes" value={kpis.recurring} tone="warning" />
        <KpiCard icon={TrendingUp} label="Comissão média" value={formatPercent(kpis.avgCommission)} tone="primary" />
        <KpiCard icon={Sparkles} label="Receita gerada" value={formatBRL(kpis.totalRevenue)} tone="success" className="col-span-2 md:col-span-1" />
      </div>

      {/* Toolbar */}
      <div className="vx-card p-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar produto, descrição..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px] h-10"><Filter className="size-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Tabs value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <TabsList className="h-10">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="active">Ativos</TabsTrigger>
              <TabsTrigger value="inactive">Inativos</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={view} onValueChange={(v: any) => setView(v)}>
            <TabsList className="h-10">
              <TabsTrigger value="grid">Grade</TabsTrigger>
              <TabsTrigger value="table">Tabela</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="vx-card p-12 text-center text-muted-foreground text-sm">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="vx-card p-16 text-center">
          <Package className="size-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-display text-lg font-semibold">Nenhum produto encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">Ajuste os filtros ou cadastre seu primeiro produto.</p>
          <Button onClick={openNew} className="mt-4 gap-2 bg-gradient-primary"><Plus className="size-4" /> Novo produto</Button>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => {
            const u = (usageStats as any)[p.id] || { sales: 0, revenue: 0, partners: 0 };
            const cat = p.product_categories;
            const color = cat?.color ?? "hsl(var(--primary))";
            return (
              <div key={p.id} className="vx-card overflow-hidden group relative">
                <div className="h-1 w-full" style={{ background: color }} />
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {cat && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider"
                          style={{ background: `${color}1a`, color }}
                        >
                          {cat.name}
                        </span>
                      )}
                      <h3 className="font-display font-semibold text-base mt-2 truncate">{p.name}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1 min-h-[2rem]">
                        {p.description ?? "Sem descrição"}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="size-8 rounded-md hover:bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="size-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => openEdit(p)}><Pencil className="size-3.5 mr-2" /> Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(p)}>
                          {p.active ? <><PowerOff className="size-3.5 mr-2" /> Desativar</> : <><Power className="size-3.5 mr-2" /> Ativar</>}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDelete(p)} className="text-destructive">
                          <Trash2 className="size-3.5 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Preço</p>
                      <p className="font-display font-bold vx-mono text-sm mt-1">{formatBRL(p.base_price)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Comissão</p>
                      <p className="font-display font-bold vx-mono text-sm mt-1 text-success">{formatPercent(p.default_commission_percent)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-3 border-t border-border">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Users2 className="size-3" /> {u.partners}</span>
                      <span className="inline-flex items-center gap-1"><TrendingUp className="size-3" /> {u.sales}</span>
                      {p.recurring && <Badge variant="secondary" className="h-4 text-[9px] px-1.5">RECORRENTE</Badge>}
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase ${p.active ? "text-success" : "text-muted-foreground"}`}>
                      <span className={`size-1.5 rounded-full ${p.active ? "bg-success" : "bg-muted-foreground"}`} />
                      {p.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="vx-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 text-left font-semibold">Produto</th>
                  <th className="px-5 py-3 text-left font-semibold">Categoria</th>
                  <th className="px-5 py-3 text-right font-semibold">Preço</th>
                  <th className="px-5 py-3 text-right font-semibold">% Comissão</th>
                  <th className="px-5 py-3 text-right font-semibold">Parceiros</th>
                  <th className="px-5 py-3 text-right font-semibold">Vendas</th>
                  <th className="px-5 py-3 text-right font-semibold">Receita</th>
                  <th className="px-5 py-3 text-left font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => {
                  const u = (usageStats as any)[p.id] || { sales: 0, revenue: 0, partners: 0 };
                  const cat = p.product_categories;
                  const color = cat?.color ?? "hsl(var(--primary))";
                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="size-8 rounded-md flex items-center justify-center" style={{ background: `${color}1a`, color }}>
                            <Package className="size-4" />
                          </div>
                          <div>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-[280px]">{p.description ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {cat ? (
                          <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase" style={{ background: `${color}1a`, color }}>{cat.name}</span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right vx-mono">{formatBRL(p.base_price)}</td>
                      <td className="px-5 py-3 text-right vx-mono text-success font-semibold">{formatPercent(p.default_commission_percent)}</td>
                      <td className="px-5 py-3 text-right vx-mono text-muted-foreground">{u.partners}</td>
                      <td className="px-5 py-3 text-right vx-mono text-muted-foreground">{u.sales}</td>
                      <td className="px-5 py-3 text-right vx-mono font-semibold">{formatBRL(u.revenue)}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${p.active ? "bg-success-muted text-success" : "bg-muted text-muted-foreground"}`}>
                          <span className="size-1.5 rounded-full bg-current" />
                          {p.active ? "ativo" : "inativo"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="size-8 rounded-md hover:bg-muted flex items-center justify-center"><MoreHorizontal className="size-4 text-muted-foreground" /></button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => openEdit(p)}><Pencil className="size-3.5 mr-2" /> Editar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleActive(p)}>
                              {p.active ? <><PowerOff className="size-3.5 mr-2" /> Desativar</> : <><Power className="size-3.5 mr-2" /> Ativar</>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(p)} className="text-destructive"><Trash2 className="size-3.5 mr-2" /> Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dialog Produto */}
      <Dialog open={productOpen} onOpenChange={setProductOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
            <DialogDescription>Configure preço, comissão e disponibilidade para parceiros.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome do produto *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Plano Enterprise" />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria *</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="inline-flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ background: c.color ?? "#6366f1" }} />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Preço base (R$)</Label>
              <Input type="number" step="0.01" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Descrição</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalhes, escopo, entregáveis..." />
            </div>
            <div className="space-y-1.5">
              <Label>% Comissão padrão</Label>
              <Input type="number" step="0.01" value={form.default_commission_percent} onChange={(e) => setForm({ ...form, default_commission_percent: e.target.value })} />
            </div>
            <div className="space-y-3">
              <Label>Configurações</Label>
              <div className="space-y-2 p-3 rounded-md border border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Ativo</p>
                    <p className="text-[11px] text-muted-foreground">Disponível para venda</p>
                  </div>
                  <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Recorrente</p>
                    <p className="text-[11px] text-muted-foreground">Cobrança mensal</p>
                  </div>
                  <Switch checked={form.recurring} onCheckedChange={(v) => setForm({ ...form, recurring: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Permitir parceiros</p>
                    <p className="text-[11px] text-muted-foreground">Vendável por indicadores</p>
                  </div>
                  <Switch checked={form.allow_partner} onCheckedChange={(v) => setForm({ ...form, allow_partner: v })} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductOpen(false)}>Cancelar</Button>
            <Button onClick={submit} className="bg-gradient-primary hover:opacity-90 gap-2">
              <Sparkles className="size-4" /> {editing ? "Salvar alterações" : "Cadastrar produto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Categorias */}
      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Categorias</DialogTitle>
            <DialogDescription>Organize seu catálogo por tipos de produto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-end gap-2 p-3 rounded-md border border-border bg-muted/30">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} placeholder="Ex: SaaS" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cor</Label>
                <input
                  type="color"
                  value={catForm.color}
                  onChange={(e) => setCatForm({ ...catForm, color: e.target.value })}
                  className="size-9 rounded-md border border-border cursor-pointer bg-transparent"
                />
              </div>
              <Button onClick={submitCategory} className="gap-1 h-9"><Plus className="size-4" /> Adicionar</Button>
            </div>

            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {categories.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">Nenhuma categoria criada</p>
              ) : categories.map((c) => {
                const count = products.filter((p) => p.category_id === c.id).length;
                return (
                  <div key={c.id} className="flex items-center justify-between p-2.5 rounded-md border border-border hover:bg-muted/30">
                    <div className="flex items-center gap-3">
                      <span className="size-7 rounded-md flex items-center justify-center" style={{ background: `${c.color}1a`, color: c.color ?? "#6366f1" }}>
                        <Layers className="size-3.5" />
                      </span>
                      <div>
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground">{count} produto{count !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <button onClick={() => deleteCategory(c.id)} className="size-7 rounded-md hover:bg-destructive-muted text-muted-foreground hover:text-destructive flex items-center justify-center">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone, className = "" }: any) {
  const toneMap: any = {
    primary: "text-primary bg-primary/10 border-primary/20",
    success: "text-success bg-success-muted border-success/20",
    warning: "text-warning bg-warning-muted border-warning/20",
  };
  return (
    <div className={`vx-card p-4 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
          <p className="font-display text-2xl font-bold vx-mono mt-1">{value}</p>
        </div>
        <div className={`size-9 rounded-md border flex items-center justify-center ${toneMap[tone]}`}>
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  );
}
