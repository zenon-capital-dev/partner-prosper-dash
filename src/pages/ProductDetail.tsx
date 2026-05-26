import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Package, Pencil, Copy, Power, PowerOff, Trash2, Plus,
  Users2, Briefcase, FileSignature, Activity, ListChecks, X, BarChart3,
  Building2, Search,
} from "lucide-react";
import { ProductFormDialog } from "@/components/products/ProductFormDialog";
import { DeleteProductDialog } from "@/components/products/DeleteProductDialog";
import { formatBRL, formatPercent } from "@/lib/format";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, isAdminSecondary } = useAuth();
  const canManage = isAdmin || isAdminSecondary;
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").eq("id", id!).maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["product-sales", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("id, amount, sale_date, client_id, status, clients(full_name)")
        .eq("product_id", id!)
        .order("sale_date", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: demands = [] } = useQuery({
    queryKey: ["product-demands", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_products")
        .select("id, status, start_date, value, client_id, clients(full_name)")
        .eq("product_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: providerLinks = [], refetch: refetchProviders } = useQuery({
    queryKey: ["product-providers", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_provider_products")
        .select("id, custom_value, notes, active, service_provider_id, created_at, service_providers(id, name, email, phone, specialty, active)")
        .eq("product_id", id!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: collabLinks = [], refetch: refetchCollabs } = useQuery({
    queryKey: ["product-collabs", id],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("collaborator_products")
        .select("id, notes, active, collaborator_id, created_at")
        .eq("product_id", id!)
        .order("created_at", { ascending: false });
      if (error) { console.error(error); return []; }
      const ids = (rows ?? []).map((r: any) => r.collaborator_id).filter(Boolean);
      if (ids.length === 0) return rows ?? [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return (rows ?? []).map((r: any) => ({ ...r, profiles: map.get(r.collaborator_id) ?? null }));
    },
    enabled: !!id,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["contract-templates"],
    queryFn: async () => {
      const { data } = await supabase.from("contract_templates").select("*").eq("active", true).order("name");
      return data ?? [];
    },
  });

  const kpis = useMemo(() => {
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((a, s: any) => a + Number(s.amount || 0), 0);
    const activeDemands = demands.filter((d: any) => ["em_andamento", "aguardando_inicio", "em_execucao"].includes(d.status)).length;
    const ticket = totalSales > 0 ? totalRevenue / totalSales : 0;
    return { totalSales, totalRevenue, activeDemands, providers: providerLinks.length, collabs: collabLinks.length, ticket };
  }, [sales, demands, providerLinks, collabLinks]);

  const clientList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; sales: number; revenue: number; last: string }>();
    sales.forEach((s: any) => {
      if (!s.client_id) return;
      const cur = map.get(s.client_id) || { id: s.client_id, name: s.clients?.full_name || "Cliente", sales: 0, revenue: 0, last: "" };
      cur.sales += 1;
      cur.revenue += Number(s.amount || 0);
      if (!cur.last || s.sale_date > cur.last) cur.last = s.sale_date;
      map.set(s.client_id, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [sales]);

  const toggleActive = async () => {
    if (!product) return;
    const { error } = await supabase.from("products").update({ active: !product.active }).eq("id", product.id);
    if (error) toast.error(error.message);
    else {
      toast.success(product.active ? "Serviço desativado" : "Serviço ativado");
      qc.invalidateQueries({ queryKey: ["product", id] });
    }
  };

  const duplicate = async () => {
    if (!product) return;
    const { id: _id, created_at, updated_at, ...rest } = product as any;
    const { data, error } = await supabase.from("products").insert({ ...rest, name: `${product.name} (cópia)` }).select("id").maybeSingle();
    if (error) { toast.error(error.message); return; }
    toast.success("Serviço duplicado");
    if (data?.id) navigate(`/produtos/${data.id}`);
  };

  const remove = async () => {
    if (!product) return;
    if (!(await confirmAction(`Excluir definitivamente "${product.name}"?`))) return;
    const { data, error } = await supabase.rpc("admin_delete_product_cascade", { _product_id: product.id });
    if (error) { toast.error(error.message); return; }
    const result = data as { ok: boolean; message?: string } | null;
    if (!result?.ok) {
      const force = await confirmAction(`${result?.message || "Não foi possível excluir."}\n\nFORÇAR EXCLUSÃO TOTAL? Isso apaga vendas, comissões, pagamentos, demandas, tarefas e documentos vinculados. Ação irreversível.`);
      if (!force) return;
      const { data: d2, error: e2 } = await supabase.rpc("admin_delete_product_cascade", { _product_id: product.id, _force: true });
      if (e2) { toast.error(e2.message); return; }
      const r2 = d2 as { ok: boolean; message?: string } | null;
      if (!r2?.ok) { toast.error(r2?.message || "Falha na exclusão forçada"); return; }
      toast.success(r2.message || "Serviço e vínculos excluídos");
      navigate("/produtos"); return;
    }
    toast.success(result.message || "Serviço excluído");
    navigate("/produtos");
  };

  if (isLoading) return <div className="p-12 text-center text-slate-400">Carregando...</div>;
  if (!product) return <div className="p-12 text-center text-rose-600">Serviço não encontrado.</div>;

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans admin-shell">
      <div className="max-w-[1500px] mx-auto px-5 lg:px-8 py-6 space-y-5">
        {/* HEADER */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("/produtos")} className="border-slate-200/70">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <button onClick={() => navigate("/produtos")} className="text-[12px] text-slate-500 hover:text-slate-900">
            Serviços
          </button>
        </div>

        <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="size-12 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Package className="size-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{product.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border",
                  product.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200",
                )}>
                  {product.active ? "Ativo" : "Inativo"}
                </span>
                {product.recurring && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">Recorrente</span>}
                {product.allow_partner && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">Permite parceiro</span>}
                <span className="text-[11px] text-slate-500">{product.billing_type}</span>
              </div>
              {product.description && <p className="text-[13px] text-slate-600 mt-2 max-w-2xl">{product.description}</p>}
            </div>
          </div>
          {canManage && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="border-slate-200/70"><Pencil className="size-3.5 mr-1.5" /> Editar</Button>
              <Button variant="outline" size="sm" onClick={duplicate} className="border-slate-200/70"><Copy className="size-3.5 mr-1.5" /> Duplicar</Button>
              <Button variant="outline" size="sm" onClick={toggleActive} className={cn("border-slate-200/70", product.active ? "text-amber-700" : "text-emerald-700")}>
                {product.active ? <><PowerOff className="size-3.5 mr-1.5" /> Desativar</> : <><Power className="size-3.5 mr-1.5" /> Ativar</>}
              </Button>
              <Button variant="outline" size="sm" onClick={remove} className="border-slate-200/70 text-rose-600 hover:text-rose-700"><Trash2 className="size-3.5" /></Button>
            </div>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <Kpi label="Vendas" value={String(kpis.totalSales)} />
          <Kpi label="Receita" value={formatBRL(kpis.totalRevenue)} />
          <Kpi label="Ticket médio" value={formatBRL(kpis.ticket)} />
          <Kpi label="Demandas ativas" value={String(kpis.activeDemands)} />
          <Kpi label="Prestadores" value={String(kpis.providers)} />
          <Kpi label="Colaboradores" value={String(kpis.collabs)} />
        </div>

        {/* TABS */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-white border border-slate-200/70 h-11 p-1">
            <TabsTrigger value="overview" className="text-xs gap-1.5"><BarChart3 className="size-3.5" /> Visão Geral</TabsTrigger>
            <TabsTrigger value="providers" className="text-xs gap-1.5"><Briefcase className="size-3.5" /> Prestadores</TabsTrigger>
            <TabsTrigger value="collaborators" className="text-xs gap-1.5"><Users2 className="size-3.5" /> Colaboradores</TabsTrigger>
            <TabsTrigger value="clients" className="text-xs gap-1.5"><Building2 className="size-3.5" /> Clientes</TabsTrigger>
            <TabsTrigger value="contract" className="text-xs gap-1.5"><FileSignature className="size-3.5" /> Contrato</TabsTrigger>
            <TabsTrigger value="operation" className="text-xs gap-1.5"><ListChecks className="size-3.5" /> Operação</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab product={product} sales={sales} demands={demands} />
          </TabsContent>
          <TabsContent value="providers">
            <ProvidersTab productId={id!} links={providerLinks} canManage={canManage} refetch={refetchProviders} qc={qc} />
          </TabsContent>
          <TabsContent value="collaborators">
            <CollaboratorsTab productId={id!} links={collabLinks} canManage={canManage} refetch={refetchCollabs} qc={qc} />
          </TabsContent>
          <TabsContent value="clients">
            <ClientsTab clients={clientList} navigate={navigate} />
          </TabsContent>
          <TabsContent value="contract">
            <ContractTab product={product} templates={templates} canManage={canManage} qc={qc} />
          </TabsContent>
          <TabsContent value="operation">
            <OperationTab product={product} />
          </TabsContent>
        </Tabs>
      </div>

      <ProductFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editing={product}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["product", id] }); }}
      />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="font-mono text-[18px] font-bold text-slate-900 leading-tight mt-1">{value}</p>
    </div>
  );
}

function Card({ children, title, action }: { children: React.ReactNode; title?: string; action?: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm">
      {(title || action) && (
        <div className="px-5 py-3 border-b border-slate-200/70 flex items-center justify-between">
          {title && <h3 className="text-[13px] font-bold text-slate-900">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

function OverviewTab({ product, sales, demands }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card title="Resumo financeiro">
        <dl className="space-y-2.5 text-[13px]">
          <Row label="Preço base" value={formatBRL(product.base_price)} />
          <Row label="Tipo de cobrança" value={product.billing_type} />
          {product.billing_type === "parcelado" && (
            <>
              <Row label="Parcelas" value={String(product.installments_count ?? "—")} />
              <Row label="Entrada" value={formatBRL(product.installments_entry ?? 0)} />
              <Row label="Vencimento" value={`Dia ${product.installments_due_day ?? "—"}`} />
            </>
          )}
          <Row label="Comissão parceiro" value={formatPercent(product.default_commission_percent)} />
          <Row label="Comissão colaborador" value={formatPercent(product.default_employee_commission)} />
          <Row label="Pagamento prestador" value={formatBRL(product.default_provider_value)} />
        </dl>
      </Card>
      <Card title="SLA & Operação">
        <dl className="space-y-2.5 text-[13px]">
          <Row label="SLA padrão" value={`${product.default_sla_days ?? "—"} ${product.sla_day_type === "calendar" ? "dias corridos" : "dias úteis"}`} />
          <Row label="Status inicial" value={product.initial_status ?? "—"} />
          <Row label="Documentos exigidos" value={String((product.required_documents ?? []).length)} />
          <Row label="Etapas no checklist" value={String((product.standard_steps ?? []).length)} />
        </dl>
      </Card>
      <Card title="Últimas demandas">
        {demands.length === 0 ? <p className="text-[12px] text-slate-400">Nenhuma demanda ainda.</p> : (
          <ul className="space-y-2">
            {demands.slice(0, 5).map((d: any) => (
              <li key={d.id} className="text-[12px] flex items-center justify-between border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                <span className="font-medium text-slate-800 truncate">{d.clients?.full_name || "Cliente"}</span>
                <span className="text-slate-500">{d.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="lg:col-span-3">
        <Card title="Últimas vendas">
          {sales.length === 0 ? <p className="text-[12px] text-slate-400">Sem vendas registradas.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead><tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200/70">
                  <th className="py-2">Cliente</th><th>Data</th><th>Status</th><th className="text-right">Valor</th>
                </tr></thead>
                <tbody>
                  {sales.slice(0, 10).map((s: any) => (
                    <tr key={s.id} className="border-b border-slate-100">
                      <td className="py-2 font-medium text-slate-800">{s.clients?.full_name || "—"}</td>
                      <td className="text-slate-500">{s.sale_date ? format(new Date(s.sale_date), "dd/MM/yyyy") : "—"}</td>
                      <td className="text-slate-500">{s.status}</td>
                      <td className="text-right font-mono font-semibold text-slate-900">{formatBRL(Number(s.amount || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900 text-right truncate">{value || "—"}</dd>
    </div>
  );
}

function ProvidersTab({ productId, links, canManage, refetch, qc }: any) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [customValue, setCustomValue] = useState("");

  const { data: providers = [] } = useQuery({
    queryKey: ["providers-all"],
    queryFn: async () => {
      const { data } = await supabase.from("service_providers").select("id, name, email, specialty, active").eq("active", true).order("name");
      return data ?? [];
    },
  });

  const available = useMemo(() => {
    const linkedIds = new Set(links.map((l: any) => l.service_provider_id));
    return providers.filter((p: any) => !linkedIds.has(p.id) && p.name?.toLowerCase().includes(query.toLowerCase()));
  }, [providers, links, query]);

  const add = async () => {
    if (!selected) { toast.error("Selecione um prestador"); return; }
    const { error } = await supabase.from("service_provider_products").upsert({
      product_id: productId,
      service_provider_id: selected,
      custom_value: customValue ? Number(customValue) : null,
      active: true,
    }, { onConflict: "service_provider_id,product_id" });
    if (error) { toast.error(error.message); return; }
    toast.success("Prestador vinculado");
    setSelected(""); setCustomValue(""); setQuery(""); setOpen(false);
    refetch();
    qc.invalidateQueries({ queryKey: ["product-providers", productId] });
  };

  const remove = async (linkId: string) => {
    if (!(await confirmAction("Remover este prestador deste serviço?"))) return;
    await supabase.from("service_provider_products").delete().eq("id", linkId);
    toast.success("Vínculo removido");
    refetch();
  };

  return (
    <Card
      title={`Prestadores habilitados (${links.length})`}
      action={canManage && <Button size="sm" onClick={() => setOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white"><Plus className="size-3.5 mr-1" /> Vincular prestador</Button>}
    >
      {links.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400">
          <Briefcase className="size-8 mx-auto mb-2" />
          Nenhum prestador vinculado ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((l: any) => (
            <div key={l.id} className="flex items-center justify-between p-3 rounded-md border border-slate-200/70 hover:bg-slate-50/60">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-slate-900 truncate">{l.service_providers?.name}</p>
                <p className="text-[11.5px] text-slate-500 truncate">{l.service_providers?.specialty || "—"} · {l.service_providers?.email}</p>
              </div>
              <div className="flex items-center gap-4">
                {l.custom_value && <span className="text-[12px] font-mono font-semibold text-slate-900">{formatBRL(l.custom_value)}</span>}
                {canManage && (
                  <Button variant="ghost" size="icon" className="size-8 text-rose-500" onClick={() => remove(l.id)}><X className="size-4" /></Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Vincular prestador</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Buscar prestador</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Digite o nome..." className="pl-9 h-9" />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto border border-slate-200/70 rounded-md">
              {available.length === 0 ? <p className="text-center text-[12px] text-slate-400 py-6">Nenhum prestador disponível</p> :
                available.map((p: any) => (
                  <button key={p.id} onClick={() => setSelected(p.id)} className={cn("w-full text-left p-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50", selected === p.id && "bg-indigo-50")}>
                    <p className="text-[12.5px] font-semibold text-slate-900">{p.name}</p>
                    <p className="text-[11px] text-slate-500">{p.specialty || "—"}</p>
                  </button>
                ))}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor custom para esse prestador (R$, opcional)</Label>
              <Input type="number" step="0.01" value={customValue} onChange={(e) => setCustomValue(e.target.value)} className="h-9" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={add} className="bg-indigo-600 hover:bg-indigo-700 text-white">Vincular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CollaboratorsTab({ productId, links, canManage, refetch, qc }: any) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>("");

  const { data: collaborators = [] } = useQuery({
    queryKey: ["collaborators-all"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "colaborador");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email, active").in("id", ids).eq("active", true).order("full_name");
      return profs ?? [];
    },
  });

  const available = useMemo(() => {
    const linkedIds = new Set(links.map((l: any) => l.collaborator_id));
    return collaborators.filter((c: any) => !linkedIds.has(c.id));
  }, [collaborators, links]);

  const add = async () => {
    if (!selected) { toast.error("Selecione um colaborador"); return; }
    const { error } = await supabase.from("collaborator_products").upsert({ product_id: productId, collaborator_id: selected, active: true }, { onConflict: "collaborator_id,product_id" });
    if (error) { toast.error(error.message); return; }
    toast.success("Colaborador vinculado");
    setSelected(""); setOpen(false);
    refetch();
    qc.invalidateQueries({ queryKey: ["product-collabs", productId] });
  };

  const remove = async (linkId: string) => {
    if (!(await confirmAction("Remover este colaborador deste serviço?"))) return;
    await supabase.from("collaborator_products").delete().eq("id", linkId);
    toast.success("Vínculo removido");
    refetch();
  };

  return (
    <Card
      title={`Colaboradores habilitados (${links.length})`}
      action={canManage && <Button size="sm" onClick={() => setOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white"><Plus className="size-3.5 mr-1" /> Vincular colaborador</Button>}
    >
      {links.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400">
          <Users2 className="size-8 mx-auto mb-2" />
          Nenhum colaborador vinculado ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((l: any) => (
            <div key={l.id} className="flex items-center justify-between p-3 rounded-md border border-slate-200/70 hover:bg-slate-50/60">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-slate-900 truncate">{l.profiles?.full_name || "Colaborador"}</p>
                <p className="text-[11.5px] text-slate-500 truncate">{l.profiles?.email}</p>
              </div>
              {canManage && (
                <Button variant="ghost" size="icon" className="size-8 text-rose-500" onClick={() => remove(l.id)}><X className="size-4" /></Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Vincular colaborador</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger><SelectValue placeholder="Selecione um colaborador" /></SelectTrigger>
              <SelectContent>
                {available.length === 0 ? <div className="p-2 text-[12px] text-slate-400 text-center">Nenhum disponível</div> :
                  available.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name || c.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={add} className="bg-indigo-600 hover:bg-indigo-700 text-white">Vincular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ClientsTab({ clients, navigate }: any) {
  return (
    <Card title={`Clientes que compraram (${clients.length})`}>
      {clients.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400">
          <Building2 className="size-8 mx-auto mb-2" />
          Nenhum cliente comprou esse serviço ainda.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200/70">
              <th className="py-2">Cliente</th><th className="text-right">Vendas</th><th className="text-right">Receita</th><th>Última compra</th>
            </tr></thead>
            <tbody>
              {clients.map((c: any) => (
                <tr key={c.id} onClick={() => navigate(`/clientes/${c.id}`)} className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer">
                  <td className="py-2 font-semibold text-slate-900">{c.name}</td>
                  <td className="text-right font-mono text-slate-600">{c.sales}</td>
                  <td className="text-right font-mono font-semibold text-slate-900">{formatBRL(c.revenue)}</td>
                  <td className="text-slate-500">{c.last ? format(new Date(c.last), "dd/MM/yyyy") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ContractTab({ product, templates, canManage, qc }: any) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");

  const setDefault = async (templateId: string | null) => {
    const { error } = await supabase.from("products").update({ default_contract_template_id: templateId }).eq("id", product.id);
    if (error) { toast.error(error.message); return; }
    toast.success(templateId ? "Modelo vinculado" : "Modelo desvinculado");
    qc.invalidateQueries({ queryKey: ["product", product.id] });
  };

  const createTemplate = async () => {
    if (!newName.trim()) { toast.error("Dê um nome ao modelo"); return; }
    const { data, error } = await supabase.from("contract_templates").insert({ name: newName.trim(), content: newContent }).select("id").maybeSingle();
    if (error) { toast.error(error.message); return; }
    toast.success("Modelo criado");
    if (data?.id) await setDefault(data.id);
    setOpen(false); setNewName(""); setNewContent("");
    qc.invalidateQueries({ queryKey: ["contract-templates"] });
  };

  const current = templates.find((t: any) => t.id === product.default_contract_template_id);

  return (
    <Card
      title="Modelo de contrato padrão"
      action={canManage && <Button size="sm" onClick={() => setOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white"><Plus className="size-3.5 mr-1" /> Novo modelo</Button>}
    >
      <div className="space-y-3">
        <p className="text-[12px] text-slate-500">Esse modelo será sugerido automaticamente quando o serviço for vendido.</p>

        <div className="space-y-1.5">
          <Label className="text-xs">Modelo vinculado</Label>
          <Select value={product.default_contract_template_id ?? "none"} onValueChange={(v) => setDefault(v === "none" ? null : v)} disabled={!canManage}>
            <SelectTrigger><SelectValue placeholder="Nenhum modelo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum modelo</SelectItem>
              {templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {current && (
          <div className="rounded-md border border-slate-200/70 p-4 bg-slate-50/60">
            <p className="text-[13px] font-bold text-slate-900">{current.name}</p>
            {current.description && <p className="text-[12px] text-slate-600 mt-1">{current.description}</p>}
            {current.content && <pre className="mt-3 text-[11.5px] text-slate-700 whitespace-pre-wrap max-h-60 overflow-y-auto">{current.content}</pre>}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Novo modelo de contrato</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Nome do modelo</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Contrato Padrão Tributário" />
            </div>
            <div className="space-y-1.5">
              <Label>Conteúdo</Label>
              <Textarea rows={10} value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Texto do contrato com variáveis {{cliente}}, {{servico}}, {{valor}}..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={createTemplate} className="bg-indigo-600 hover:bg-indigo-700 text-white">Criar e vincular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function OperationTab({ product }: any) {
  const docs = Array.isArray(product.required_documents) ? product.required_documents : [];
  const steps = Array.isArray(product.standard_steps) ? product.standard_steps : [];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card title={`Documentos exigidos (${docs.length})`}>
        {docs.length === 0 ? <p className="text-[12px] text-slate-400">Nenhum documento configurado.</p> : (
          <ul className="space-y-1.5">
            {docs.map((d: any, i: number) => (
              <li key={i} className="text-[13px] flex items-center gap-2 p-2 rounded border border-slate-200/70 bg-white">
                <Activity className="size-3.5 text-slate-400" /> {d.name}
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-slate-400 mt-3">Para editar use "Editar" no topo.</p>
      </Card>
      <Card title={`Etapas do processo (${steps.length})`}>
        {steps.length === 0 ? <p className="text-[12px] text-slate-400">Nenhuma etapa configurada.</p> : (
          <ol className="space-y-1.5">
            {steps.map((s: any, i: number) => (
              <li key={i} className="text-[13px] flex items-center gap-2 p-2 rounded border border-slate-200/70 bg-white">
                <span className="size-5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                {s.label}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
