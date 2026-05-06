import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Mail, Phone, Building2, MapPin, Plus, FileText, ShoppingBag,
  Pencil, Wallet, FolderKanban, Activity as ActivityIcon, TrendingUp, Tag,
  Hash, IdCard, Calendar, Sparkles, ArrowUpRight, CircleDollarSign, Receipt,
  CheckCircle2, Clock3, AlertTriangle, MessageSquarePlus, Users2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDate, formatDateTime, formatDoc, formatPhone, initials, timeAgo, formatPercent } from "@/lib/format";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { SaleFormDialog } from "@/components/sales/SaleFormDialog";
import { DocumentDialog } from "@/components/documents/DocumentDialog";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Repeat, Trash2 } from "lucide-react";

const statusBadge: Record<string, string> = {
  ativo: "bg-success-muted text-success",
  prospecto: "bg-warning-muted text-warning",
  inativo: "bg-muted text-muted-foreground",
};

const saleStatusBadge: Record<string, string> = {
  pago: "bg-success-muted text-success",
  pendente: "bg-warning-muted text-warning",
  em_atraso: "bg-destructive-muted text-destructive",
  cancelado: "bg-muted text-muted-foreground",
};

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [saleOpen, setSaleOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState({ title: "", description: "", event_type: "nota" });

  const { data: client } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*, partners(id,full_name,email,commission_percent)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["client-sales", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales")
        .select("*, products(name, product_categories(name, color))")
        .eq("client_id", id!)
        .order("sale_date", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["client-docs", id],
    queryFn: async () => {
      const { data } = await supabase.from("documents").select("*").eq("client_id", id!).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["client-projects", id],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*, products(name)").eq("client_id", id!).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: timeline = [] } = useQuery({
    queryKey: ["client-timeline", id],
    queryFn: async () => {
      const { data } = await supabase.from("client_timeline").select("*").eq("client_id", id!).order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
    enabled: !!id,
  });

  const saleIds = sales.map((s: any) => s.id);
  const { data: commissions = [] } = useQuery({
    queryKey: ["client-commissions", id, saleIds.join(",")],
    queryFn: async () => {
      if (saleIds.length === 0) return [];
      const { data } = await supabase.from("commissions").select("*, partners(full_name)").in("sale_id", saleIds);
      return data ?? [];
    },
    enabled: !!id && saleIds.length > 0,
  });

  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((s: number, x: any) => s + Number(x.amount || 0), 0);
    const paid = sales.filter((s: any) => s.status === "pago").reduce((sum, x: any) => sum + Number(x.amount || 0), 0);
    const pending = sales.filter((s: any) => s.status === "pendente").reduce((sum, x: any) => sum + Number(x.amount || 0), 0);
    const overdue = sales.filter((s: any) => s.status === "em_atraso").reduce((sum, x: any) => sum + Number(x.amount || 0), 0);
    const totalCommissions = commissions.reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
    const ticket = sales.length ? totalRevenue / sales.length : 0;
    return { totalRevenue, paid, pending, overdue, totalCommissions, ticket, salesCount: sales.length, projectsCount: projects.length, docsCount: docs.length };
  }, [sales, commissions, projects, docs]);

  // Receita mensal (últimos 6 meses)
  const monthlyChart = useMemo(() => {
    const months: { key: string; label: string; total: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), total: 0 });
    }
    sales.forEach((s: any) => {
      const d = new Date(s.sale_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = months.find((mm) => mm.key === key);
      if (m) m.total += Number(s.amount || 0);
    });
    return months;
  }, [sales]);

  const submitNote = async () => {
    if (!note.title.trim()) { toast.error("Título obrigatório"); return; }
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("client_timeline").insert({
      client_id: id!,
      title: note.title.trim(),
      description: note.description.trim() || null,
      event_type: note.event_type,
      user_id: auth.user?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Anotação adicionada");
    setNote({ title: "", description: "", event_type: "nota" });
    setNoteOpen(false);
    qc.invalidateQueries({ queryKey: ["client-timeline", id] });
  };

  if (!client) {
    return <div className="p-12 text-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in space-y-6">
      <button onClick={() => navigate("/clientes")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar para clientes
      </button>

      {/* HERO */}
      <div className="vx-card overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-primary" />
        <div className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="size-16 rounded-2xl bg-gradient-primary text-primary-foreground flex items-center justify-center text-xl font-display font-bold shadow-vx-sm">
                {initials(client.full_name)}
              </div>
              <div className="space-y-2">
                <div>
                  <h1 className="font-display text-2xl font-bold leading-tight">{client.full_name}</h1>
                  {client.company && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Building2 className="size-3.5" /> {client.company}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${statusBadge[client.status] ?? "bg-muted"}`}>
                    <span className="size-1.5 rounded-full bg-current" /> {client.status}
                  </span>
                  {client.partners && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Users2 className="size-3" /> Indicado por {client.partners.full_name}
                    </Badge>
                  )}
                  {(client.tags ?? []).map((t: string) => (
                    <Badge key={t} variant="outline" className="text-[10px]"><Tag className="size-2.5 mr-1" /> {t}</Badge>
                  ))}
                  <span className="text-[11px] text-muted-foreground">
                    Cliente desde {formatDate(client.created_at)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setNoteOpen(true)} className="gap-2"><MessageSquarePlus className="size-4" /> Anotação</Button>
              <Button variant="outline" size="sm" onClick={() => setDocOpen(true)} className="gap-2"><FileText className="size-4" /> Documento</Button>
              <Button size="sm" onClick={() => setSaleOpen(true)} className="gap-2 bg-gradient-primary"><ShoppingBag className="size-4" /> Nova venda</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)} className="gap-2"><Pencil className="size-4" /></Button>
            </div>
          </div>

          {/* Contato grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border">
            <ContactItem icon={Mail} label="E-mail" value={client.email ?? "—"} />
            <ContactItem icon={Phone} label="Telefone" value={formatPhone(client.phone)} />
            <ContactItem icon={IdCard} label="CPF/CNPJ" value={formatDoc(client.document)} mono />
            <ContactItem icon={MapPin} label="Cidade/UF" value={[client.city, client.state].filter(Boolean).join("/") || "—"} />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiCard icon={CircleDollarSign} label="Total faturado" value={formatBRL(stats.totalRevenue)} tone="primary" highlight />
        <KpiCard icon={CheckCircle2} label="Pago" value={formatBRL(stats.paid)} tone="success" />
        <KpiCard icon={Clock3} label="Pendente" value={formatBRL(stats.pending)} tone="warning" />
        <KpiCard icon={AlertTriangle} label="Em atraso" value={formatBRL(stats.overdue)} tone="destructive" />
        <KpiCard icon={Wallet} label="Comissões geradas" value={formatBRL(stats.totalCommissions)} tone="primary" />
        <KpiCard icon={TrendingUp} label="Ticket médio" value={formatBRL(stats.ticket)} tone="muted" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview" className="gap-1.5"><Sparkles className="size-3.5" /> Visão geral</TabsTrigger>
          <TabsTrigger value="sales" className="gap-1.5"><ShoppingBag className="size-3.5" /> Vendas <Badge variant="secondary" className="ml-1 h-4 text-[9px] px-1">{stats.salesCount}</Badge></TabsTrigger>
          <TabsTrigger value="projects" className="gap-1.5"><FolderKanban className="size-3.5" /> Projetos <Badge variant="secondary" className="ml-1 h-4 text-[9px] px-1">{stats.projectsCount}</Badge></TabsTrigger>
          <TabsTrigger value="commissions" className="gap-1.5"><Wallet className="size-3.5" /> Comissões <Badge variant="secondary" className="ml-1 h-4 text-[9px] px-1">{commissions.length}</Badge></TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5"><FileText className="size-3.5" /> Documentos <Badge variant="secondary" className="ml-1 h-4 text-[9px] px-1">{stats.docsCount}</Badge></TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5"><ActivityIcon className="size-3.5" /> Timeline</TabsTrigger>
        </TabsList>

        {/* ============ VISÃO GERAL ============ */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="vx-card p-5 lg:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <p className="font-display text-base font-semibold">Receita por mês</p>
                  <p className="text-[11px] text-muted-foreground">Últimos 6 meses</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{formatBRL(monthlyChart.reduce((s, m) => s + m.total, 0))}</Badge>
              </div>
              <div className="h-56 mt-3">
                <ResponsiveContainer>
                  <AreaChart data={monthlyChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cliRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => formatBRL(v)} />
                    <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#cliRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="vx-card p-5 space-y-4">
              <div>
                <p className="font-display text-base font-semibold">Resumo financeiro</p>
                <p className="text-[11px] text-muted-foreground">Distribuição da carteira</p>
              </div>
              <div className="space-y-3">
                <FinanceBar label="Pago" value={stats.paid} total={stats.totalRevenue} color="hsl(var(--success))" />
                <FinanceBar label="Pendente" value={stats.pending} total={stats.totalRevenue} color="hsl(var(--warning))" />
                <FinanceBar label="Em atraso" value={stats.overdue} total={stats.totalRevenue} color="hsl(var(--destructive))" />
              </div>
              <div className="pt-3 border-t border-border">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Notas internas</p>
                <p className="text-sm mt-1 text-muted-foreground line-clamp-4 whitespace-pre-wrap">{client.notes || "Sem notas para este cliente."}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RecentList
              title="Últimas vendas"
              empty="Sem vendas registradas"
              items={sales.slice(0, 5).map((s: any) => ({
                key: s.id,
                title: s.products?.name ?? "Produto",
                subtitle: formatDate(s.sale_date),
                value: formatBRL(s.amount),
                badge: s.status,
                badgeClass: saleStatusBadge[s.status],
              }))}
            />
            <RecentList
              title="Últimas atividades"
              empty="Sem atividades"
              items={timeline.slice(0, 5).map((t: any) => ({
                key: t.id,
                title: t.title,
                subtitle: timeAgo(t.created_at),
                value: t.event_type,
              }))}
            />
          </div>
        </TabsContent>

        {/* ============ VENDAS ============ */}
        <TabsContent value="sales" className="mt-4">
          <div className="vx-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold">Produtos contratados</p>
              <Button size="sm" onClick={() => setSaleOpen(true)} className="gap-2 bg-gradient-primary"><Plus className="size-4" /> Adicionar venda</Button>
            </div>
            {sales.length === 0 ? (
              <EmptyState icon={ShoppingBag} text="Este cliente ainda não tem vendas registradas." />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-3 text-left font-semibold">Produto</th>
                    <th className="px-6 py-3 text-left font-semibold">Categoria</th>
                    <th className="px-6 py-3 text-right font-semibold">Valor</th>
                    <th className="px-6 py-3 text-right font-semibold">% Comissão</th>
                    <th className="px-6 py-3 text-left font-semibold">Status</th>
                    <th className="px-6 py-3 text-left font-semibold">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sales.map((s: any) => (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <td className="px-6 py-3 font-medium">{s.products?.name ?? "—"}</td>
                      <td className="px-6 py-3">
                        {s.products?.product_categories ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase" style={{ background: `${s.products.product_categories.color}1a`, color: s.products.product_categories.color }}>
                            {s.products.product_categories.name}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-6 py-3 text-right vx-mono font-semibold">{formatBRL(s.amount)}</td>
                      <td className="px-6 py-3 text-right vx-mono text-success">{formatPercent(s.commission_percent)}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold ${saleStatusBadge[s.status] ?? "bg-muted"}`}>
                          {s.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-xs text-muted-foreground">{formatDate(s.sale_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* ============ PROJETOS ============ */}
        <TabsContent value="projects" className="mt-4">
          <div className="vx-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <p className="text-sm font-semibold">Projetos do cliente</p>
            </div>
            {projects.length === 0 ? (
              <EmptyState icon={FolderKanban} text="Nenhum projeto vinculado." />
            ) : (
              <div className="divide-y divide-border">
                {projects.map((p: any) => (
                  <div key={p.id} className="px-6 py-4 hover:bg-muted/30">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{p.name}</p>
                          <Badge variant="secondary" className="text-[10px] uppercase">{p.status}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {p.products?.name ? `${p.products.name} · ` : ""}
                          início {formatDate(p.start_date)}
                          {p.due_date ? ` · prazo ${formatDate(p.due_date)}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="vx-mono font-semibold text-sm">{formatBRL(p.amount)}</p>
                        <p className="text-[11px] text-muted-foreground">{p.progress}% concluído</p>
                      </div>
                    </div>
                    <div className="mt-2 h-1 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-gradient-primary rounded-full" style={{ width: `${Math.min(100, p.progress ?? 0)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ============ COMISSÕES ============ */}
        <TabsContent value="commissions" className="mt-4">
          <div className="vx-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <p className="text-sm font-semibold">Comissões geradas por este cliente</p>
              <p className="text-[11px] text-muted-foreground">Total: <span className="font-semibold text-foreground">{formatBRL(stats.totalCommissions)}</span></p>
            </div>
            {commissions.length === 0 ? (
              <EmptyState icon={Wallet} text="Nenhuma comissão gerada." />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-3 text-left font-semibold">Indicador</th>
                    <th className="px-6 py-3 text-right font-semibold">%</th>
                    <th className="px-6 py-3 text-right font-semibold">Valor</th>
                    <th className="px-6 py-3 text-left font-semibold">Status</th>
                    <th className="px-6 py-3 text-left font-semibold">Pago em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {commissions.map((c: any) => (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="px-6 py-3 font-medium">{c.partners?.full_name ?? "—"}</td>
                      <td className="px-6 py-3 text-right vx-mono">{formatPercent(c.percent)}</td>
                      <td className="px-6 py-3 text-right vx-mono font-semibold">{formatBRL(c.amount)}</td>
                      <td className="px-6 py-3">
                        <Badge variant={c.status === "paga" ? "default" : "secondary"} className="text-[10px] uppercase">{c.status}</Badge>
                      </td>
                      <td className="px-6 py-3 text-xs text-muted-foreground">{c.paid_at ? formatDate(c.paid_at) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* ============ DOCUMENTOS ============ */}
        <TabsContent value="documents" className="mt-4">
          <div className="vx-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold">Documentos do cliente</p>
              <Button size="sm" onClick={() => setDocOpen(true)} className="gap-2 bg-gradient-primary"><Plus className="size-4" /> Solicitar</Button>
            </div>
            {docs.length === 0 ? (
              <EmptyState icon={FileText} text="Nenhum documento solicitado." />
            ) : (
              <div className="divide-y divide-border">
                {docs.map((d: any) => (
                  <div key={d.id} className="px-6 py-4 flex items-center justify-between hover:bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><FileText className="size-4" /></div>
                      <div>
                        <p className="text-sm font-medium">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.description || "Sem descrição"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                        d.status === "aprovado" ? "bg-success-muted text-success" :
                        d.status === "enviado" ? "bg-info-muted text-info" :
                        d.status === "rejeitado" ? "bg-destructive-muted text-destructive" :
                        "bg-warning-muted text-warning"
                      }`}>{d.status}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(d.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ============ TIMELINE ============ */}
        <TabsContent value="timeline" className="mt-4">
          <div className="vx-card p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold">Linha do tempo do relacionamento</p>
              <Button size="sm" onClick={() => setNoteOpen(true)} className="gap-2 bg-gradient-primary"><Plus className="size-4" /> Anotação</Button>
            </div>
            {timeline.length === 0 ? (
              <EmptyState icon={ActivityIcon} text="Nenhum evento registrado." />
            ) : (
              <ol className="relative border-l border-border ml-2 space-y-4">
                {timeline.map((t: any) => (
                  <li key={t.id} className="ml-5">
                    <span className="absolute -left-[7px] mt-1.5 size-3 rounded-full border-2 border-background bg-primary" />
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{t.title}</p>
                      <Badge variant="outline" className="text-[10px] uppercase">{t.event_type}</Badge>
                      <span className="text-[11px] text-muted-foreground">{formatDateTime(t.created_at)}</span>
                    </div>
                    {t.description && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{t.description}</p>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* DIALOGS */}
      <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} client={client} onCreated={() => qc.invalidateQueries({ queryKey: ["client", id] })} />
      <SaleFormDialog open={saleOpen} onOpenChange={setSaleOpen} clientId={id!} onCreated={() => { qc.invalidateQueries({ queryKey: ["client-sales", id] }); toast.success("Venda registrada"); }} />
      <DocumentDialog open={docOpen} onOpenChange={setDocOpen} clientId={id!} onCreated={() => qc.invalidateQueries({ queryKey: ["client-docs", id] })} />

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Nova anotação</DialogTitle>
            <DialogDescription>Registre um evento na linha do tempo deste cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Título *</Label>
                <Input value={note.title} onChange={(e) => setNote({ ...note, title: e.target.value })} placeholder="Ex: Reunião de alinhamento" />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={note.event_type} onValueChange={(v) => setNote({ ...note, event_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nota">Nota</SelectItem>
                    <SelectItem value="reuniao">Reunião</SelectItem>
                    <SelectItem value="ligacao">Ligação</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="contrato">Contrato</SelectItem>
                    <SelectItem value="follow_up">Follow-up</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea rows={4} value={note.description} onChange={(e) => setNote({ ...note, description: e.target.value })} placeholder="Detalhes do evento..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>Cancelar</Button>
            <Button onClick={submitNote} className="bg-gradient-primary gap-2"><MessageSquarePlus className="size-4" /> Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactItem({ icon: Icon, label, value, mono = false }: any) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
      <p className={`text-sm flex items-center gap-1.5 mt-1 ${mono ? "vx-mono" : ""}`}>
        <Icon className="size-3.5 text-muted-foreground shrink-0" /> <span className="truncate">{value}</span>
      </p>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone, highlight = false }: any) {
  const map: any = {
    primary: { color: "text-primary", bg: "bg-primary/10 border-primary/20" },
    success: { color: "text-success", bg: "bg-success-muted border-success/20" },
    warning: { color: "text-warning", bg: "bg-warning-muted border-warning/20" },
    destructive: { color: "text-destructive", bg: "bg-destructive-muted border-destructive/20" },
    muted: { color: "text-foreground", bg: "bg-muted border-border" },
  };
  const t = map[tone];
  return (
    <div className={`vx-card p-4 ${highlight ? "ring-1 ring-primary/30" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
          <p className="font-display text-lg font-bold vx-mono mt-1 truncate">{value}</p>
        </div>
        <div className={`size-9 rounded-md border flex items-center justify-center ${t.bg} ${t.color}`}>
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  );
}

function FinanceBar({ label, value, total, color }: any) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="vx-mono font-semibold">{formatBRL(value)} <span className="text-muted-foreground font-normal">· {pct.toFixed(0)}%</span></span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function RecentList({ title, items, empty }: any) {
  return (
    <div className="vx-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <p className="text-sm font-semibold">{title}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((i: any) => (
            <li key={i.key} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-muted/30">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{i.title}</p>
                <p className="text-[11px] text-muted-foreground">{i.subtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                {i.value && <span className={`text-xs vx-mono font-semibold ${i.badgeClass ? `px-2 py-0.5 rounded-full uppercase ${i.badgeClass}` : ""}`}>{i.value}</span>}
                {i.badge && !i.value?.includes(i.badge) && (
                  <Badge variant="secondary" className="text-[10px] uppercase">{i.badge}</Badge>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, text }: any) {
  return (
    <div className="p-12 text-center">
      <Icon className="size-8 text-muted-foreground/40 mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
