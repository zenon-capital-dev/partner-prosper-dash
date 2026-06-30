import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  FolderKanban, Plus, MoreHorizontal, Pencil, Trash2, ExternalLink, Search,
} from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";
import { PageHero } from "@/components/PageHero";
import { formatBRL, formatDate } from "@/lib/format";

const STATUSES = [
  { value: "previsto", label: "Previsto", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "ativo", label: "Ativo", tone: "bg-sky-50 text-sky-700 border-sky-200" },
  { value: "em_andamento", label: "Em andamento", tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { value: "concluido", label: "Concluído", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "cancelado", label: "Cancelado", tone: "bg-rose-50 text-rose-700 border-rose-200" },
];
const statusMeta = (s: string) => STATUSES.find((x) => x.value === s) ?? STATUSES[0];

type ProjectForm = {
  id?: string;
  name: string;
  client_id: string;
  product_id: string;
  partner_id: string;
  status: string;
  amount: string;
  progress: string;
  start_date: string;
  due_date: string;
  priority: string;
  budget: string;
  notes: string;
};

const emptyForm: ProjectForm = {
  name: "", client_id: "", product_id: "", partner_id: "",
  status: "previsto", amount: "0", progress: "0",
  start_date: new Date().toISOString().slice(0, 10),
  due_date: "", priority: "normal", budget: "", notes: "",
};

export default function Projects() {
  const { user, isAdmin, isAdminSecondary } = useAuth();
  const canManage = isAdmin || isAdminSecondary;
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProjectForm>(emptyForm);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("projects")
        .select("*, clients(id, full_name, company), products(id, name), partners(id, full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["ref:clients-min"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name, company").order("full_name");
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["ref:products-active"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name").eq("active", true).order("name");
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["ref:partners-active"],
    queryFn: async () => {
      const { data } = await supabase.from("partners").select("id, full_name").eq("active", true).order("full_name");
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (projects as any[]).filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.name?.toLowerCase().includes(q) ||
        p.clients?.full_name?.toLowerCase().includes(q) ||
        p.clients?.company?.toLowerCase().includes(q) ||
        p.products?.name?.toLowerCase().includes(q) ||
        p.partners?.full_name?.toLowerCase().includes(q)
      );
    });
  }, [projects, search, statusFilter]);

  const kpis = useMemo(() => {
    const list = projects as any[];
    return {
      total: list.length,
      active: list.filter((p) => p.status === "ativo" || p.status === "em_andamento").length,
      done: list.filter((p) => p.status === "concluido").length,
      revenue: list.reduce((s, p) => s + Number(p.amount || 0), 0),
    };
  }, [projects]);

  const openNew = () => { setForm(emptyForm); setOpen(true); };
  const openEdit = (p: any) => {
    setForm({
      id: p.id,
      name: p.name ?? "",
      client_id: p.client_id ?? "",
      product_id: p.product_id ?? "",
      partner_id: p.partner_id ?? "",
      status: p.status ?? "previsto",
      amount: String(p.amount ?? 0),
      progress: String(p.progress ?? 0),
      start_date: p.start_date ?? new Date().toISOString().slice(0, 10),
      due_date: p.due_date ?? "",
      priority: p.priority ?? "normal",
      budget: p.budget != null ? String(p.budget) : "",
      notes: p.notes ?? "",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async (f: ProjectForm) => {
      if (!f.name.trim()) throw new Error("Nome é obrigatório");
      if (!f.client_id) throw new Error("Cliente é obrigatório");
      const payload: any = {
        name: f.name.trim(),
        client_id: f.client_id,
        product_id: f.product_id || null,
        partner_id: f.partner_id || null,
        status: f.status,
        amount: Number(f.amount || 0),
        progress: Math.max(0, Math.min(100, Number(f.progress || 0))),
        start_date: f.start_date,
        due_date: f.due_date || null,
        priority: f.priority || null,
        budget: f.budget ? Number(f.budget) : null,
        notes: f.notes || null,
      };
      if (f.id) {
        const { error } = await (supabase as any).from("projects").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id ?? null;
        const { error } = await (supabase as any).from("projects").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects-list"] });
      setOpen(false);
      toast.success("Projeto salvo");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects-list"] });
      toast.success("Projeto removido");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  const updateStatus = (p: any, status: string) =>
    (supabase as any).from("projects").update({ status }).eq("id", p.id).then(({ error }: any) => {
      if (error) toast.error(error.message);
      else { qc.invalidateQueries({ queryKey: ["projects-list"] }); toast.success("Status atualizado"); }
    });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHero
        icon={<FolderKanban className="size-5" />}
        title="Projetos"
        description="Acompanhe projetos previstos, em andamento e concluídos."
        actions={
          canManage ? (
            <Button onClick={openNew}><Plus className="size-4 mr-2" />Novo projeto</Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total</div><div className="text-2xl font-bold mt-1">{kpis.total}</div></Card>
        <Card className="p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ativos</div><div className="text-2xl font-bold mt-1 text-indigo-700">{kpis.active}</div></Card>
        <Card className="p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Concluídos</div><div className="text-2xl font-bold mt-1 text-emerald-700">{kpis.done}</div></Card>
        <Card className="p-4"><div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Valor total</div><div className="text-2xl font-bold mt-1 font-mono">{formatBRL(kpis.revenue)}</div></Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, cliente, produto..." className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {isLoading ? (
        <Card className="p-8 text-sm text-slate-500">Carregando...</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-500">
          {projects.length === 0 ? "Nenhum projeto cadastrado." : "Nenhum projeto bate com os filtros."}
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((p: any) => {
            const meta = statusMeta(p.status);
            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900 truncate">{p.name}</h3>
                      <Badge variant="outline" className={meta.tone}>{meta.label}</Badge>
                      {p.priority && p.priority !== "normal" ? (
                        <Badge variant="outline" className="text-[10px]">{p.priority}</Badge>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                      {p.clients ? (
                        <Link to={`/clientes/${p.clients.id}`} className="hover:underline inline-flex items-center gap-1">
                          {p.clients.full_name}{p.clients.company ? ` · ${p.clients.company}` : ""}
                          <ExternalLink className="size-3" />
                        </Link>
                      ) : null}
                      {p.products?.name ? <span>· {p.products.name}</span> : null}
                      {p.partners?.full_name ? <span>· Parceiro: {p.partners.full_name}</span> : null}
                    </div>
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div><span className="text-slate-500">Início:</span> {p.start_date ? formatDate(p.start_date) : "—"}</div>
                      <div><span className="text-slate-500">Prazo:</span> {p.due_date ? formatDate(p.due_date) : "—"}</div>
                      <div><span className="text-slate-500">Valor:</span> <span className="font-mono">{formatBRL(p.amount || 0)}</span></div>
                      <div><span className="text-slate-500">Orçamento:</span> <span className="font-mono">{p.budget != null ? formatBRL(p.budget) : "—"}</span></div>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span>Progresso</span><span>{p.progress ?? 0}%</span>
                      </div>
                      <Progress value={p.progress ?? 0} className="h-1.5" />
                    </div>
                    {p.notes ? <p className="mt-2 text-xs text-slate-600 line-clamp-2">{p.notes}</p> : null}
                  </div>

                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="size-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => openEdit(p)}>
                          <Pencil className="size-4 mr-2" />Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {STATUSES.map((s) => (
                          <DropdownMenuItem key={s.value} disabled={p.status === s.value} onClick={() => updateStatus(p, s.value)}>
                            → {s.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-rose-700"
                          onClick={async () => {
                            const ok = await confirmAction({ title: "Excluir projeto?", description: `Remover "${p.name}" definitivamente?`, destructive: true });
                            if (ok) remove.mutate(p.id);
                          }}
                        >
                          <Trash2 className="size-4 mr-2" />Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{form.id ? "Editar projeto" : "Novo projeto"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label>Nome do projeto *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {(clients as any[]).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}{c.company ? ` · ${c.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Produto</Label>
              <Select value={form.product_id || "none"} onValueChange={(v) => setForm({ ...form, product_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {(products as any[]).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Parceiro</Label>
              <Select value={form.partner_id || "none"} onValueChange={(v) => setForm({ ...form, partner_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {(partners as any[]).map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data de início</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Prazo</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Orçamento (R$)</Label>
              <Input type="number" min="0" step="0.01" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Progresso (%)</Label>
              <Input type="number" min="0" max="100" value={form.progress} onChange={(e) => setForm({ ...form, progress: e.target.value })} />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>Notas</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
