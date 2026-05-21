import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard, Users, Wallet, FileText, ClipboardList, UserCog,
  Search, Calendar, CheckCircle2, Inbox, Loader2, Phone, Mail, Building2,
  ArrowUpRight, CalendarDays, ChevronRight, LogOut, Share2, Copy, Download,
  TrendingUp, BadgeDollarSign, LifeBuoy, ExternalLink, Sparkles,
} from "lucide-react";
import { formatBRL, formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ReferralDialog } from "@/components/ReferralDialog";

const NAV = [
  { v: "dashboard",  icon: LayoutDashboard,  label: "Visão geral" },
  { v: "clientes",   icon: Users,            label: "Indicados" },
  { v: "comissoes",  icon: Wallet,           label: "Comissões" },
  { v: "demandas",   icon: ClipboardList,    label: "Demandas" },
  { v: "contratos",  icon: FileText,         label: "Documentos" },
  { v: "materiais",  icon: Sparkles,         label: "Materiais" },
  { v: "perfil",     icon: UserCog,          label: "Dados bancários" },
  { v: "suporte",    icon: LifeBuoy,         label: "Suporte" },
] as const;
type Tab = typeof NAV[number]["v"];

const COMMISSION_META: Record<string, { label: string; tone: string }> = {
  pendente:                { label: "Pendente",         tone: "bg-amber-50 text-amber-700 border-amber-200" },
  aguardando_confirmacao:  { label: "Em análise",       tone: "bg-blue-50 text-blue-700 border-blue-200" },
  liberada:                { label: "Liberada",         tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  em_pagamento:            { label: "Em pagamento",     tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  paga:                    { label: "Paga",             tone: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  cancelada:               { label: "Cancelada",        tone: "bg-rose-50 text-rose-700 border-rose-200" },
};
const DEMAND_META: Record<string, { label: string; tone: string }> = {
  aguardando_inicio: { label: "Aguardando início", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  em_execucao:       { label: "Em execução",       tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  pausado:           { label: "Pausada",           tone: "bg-amber-50 text-amber-700 border-amber-200" },
  concluida:         { label: "Concluída",         tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelada:         { label: "Cancelada",         tone: "bg-rose-50 text-rose-700 border-rose-200" },
};

export default function PartnerPanel() {
  const { user, signOut } = useAuth() as any;
  const navigate = useNavigate();
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const activeTab: Tab = (NAV.find((n) => n.v === tabParam)?.v ?? "dashboard") as Tab;
  const goTab = (v: Tab) => navigate(v === "dashboard" ? "/parceiro" : `/parceiro/${v}`);
  const [search, setSearch] = useState("");
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const [referralOpen, setReferralOpen] = useState(false);
  const [commissionFilter, setCommissionFilter] = useState("todos");

  // ============ Partner record + linked data ============
  const { data, isLoading } = useQuery({
    queryKey: ["partner-panel", user?.id, user?.email],
    enabled: !!user,
    queryFn: async () => {
      let { data: partner } = await supabase
        .from("partners")
        .select("id, full_name, email, phone, commission_percent, pix_key, partner_type, active, bank_name, bank_agency, bank_account, document, whatsapp")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!partner && user?.email) {
        const { data: byEmail } = await supabase
          .from("partners")
          .select("id, full_name, email, phone, commission_percent, pix_key, partner_type, active, bank_name, bank_agency, bank_account, document, whatsapp")
          .ilike("email", user.email)
          .maybeSingle();
        partner = byEmail;
      }
      if (!partner) return null;

      const [clientsRes, commissionsRes, contractsRes] = await Promise.all([
        supabase.from("clients")
          .select("id, full_name, company, email, phone, status, created_at, address_city, address_state")
          .eq("partner_id", partner.id)
          .order("created_at", { ascending: false }),
        supabase.from("commissions")
          .select("id, amount, percent, status, workflow_status, created_at, paid_at, expected_date, sales(id, amount, sale_date, clients(id, full_name), products(name))")
          .eq("partner_id", partner.id)
          .order("created_at", { ascending: false }),
        supabase.from("contracts")
          .select("id, name, status, file_path, amount, created_at, signed_at, sent_at, expires_at, contract_kind, contract_type")
          .eq("partner_id", partner.id)
          .order("created_at", { ascending: false }),
      ]);

      const clients = clientsRes.data ?? [];
      const clientIds = clients.map((c: any) => c.id);
      let demands: any[] = [];
      if (clientIds.length) {
        const { data: d } = await supabase
          .from("client_products")
          .select("id, status, sla_status, sla_due_date, value, start_date, deadline, created_at, custom_product_name, clients(id, full_name), products(name)")
          .in("client_id", clientIds)
          .order("created_at", { ascending: false });
        demands = d ?? [];
      }
      return {
        partner,
        clients,
        commissions: commissionsRes.data ?? [],
        contracts: contractsRes.data ?? [],
        demands,
      };
    },
  });

  const totals = useMemo(() => {
    const cs = (data?.commissions ?? []) as any[];
    const total = cs.reduce((s, x) => s + Number(x.amount || 0), 0);
    const paid = cs.filter((x) => x.workflow_status === "paga" || x.status === "pago" || x.status === "paga").reduce((s, x) => s + Number(x.amount || 0), 0);
    const pending = cs.filter((x) => ["aguardando_confirmacao", "pendente", "liberada", "em_pagamento"].includes(x.workflow_status)).reduce((s, x) => s + Number(x.amount || 0), 0);
    const active = (data?.clients ?? []).filter((c: any) => c.status === "ativo").length;
    const totalClients = (data?.clients ?? []).length;
    const conversion = totalClients > 0 ? (active / totalClients) * 100 : 0;
    const next = [...cs].filter((s) => ["aguardando_confirmacao", "pendente", "liberada", "em_pagamento"].includes(s.workflow_status))
      .sort((a, b) => new Date(a.expected_date || a.created_at).getTime() - new Date(b.expected_date || b.created_at).getTime())[0];
    return { total, paid, pending, active, totalClients, conversion, nextPayment: next?.expected_date || (next ? new Date(new Date(next.created_at).getTime() + 30*86400000).toISOString() : null) };
  }, [data]);

  const filteredClients = useMemo(() => {
    const list = (data?.clients ?? []) as any[];
    const s = search.toLowerCase();
    if (!s) return list;
    return list.filter((c) =>
      (c.full_name || "").toLowerCase().includes(s) ||
      (c.email || "").toLowerCase().includes(s) ||
      (c.company || "").toLowerCase().includes(s)
    );
  }, [data, search]);

  const filteredCommissions = useMemo(() => {
    const list = (data?.commissions ?? []) as any[];
    return list.filter((c) => {
      if (commissionFilter !== "todos" && (c.workflow_status || c.status) !== commissionFilter) return false;
      if (search) {
        const name = (c.sales?.clients?.full_name || c.sales?.products?.name || "").toLowerCase();
        if (!name.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [data, search, commissionFilter]);

  const filteredDemands = useMemo(() => {
    const list = (data?.demands ?? []) as any[];
    const s = search.toLowerCase();
    if (!s) return list;
    return list.filter((d) =>
      (d.clients?.full_name || "").toLowerCase().includes(s) ||
      (d.products?.name || d.custom_product_name || "").toLowerCase().includes(s)
    );
  }, [data, search]);

  async function downloadContract(path: string | null, name: string) {
    if (!path) return toast.error("Arquivo indisponível");
    const { data, error } = await supabase.storage.from("contracts").createSignedUrl(path, 60);
    if (error || !data) return toast.error("Não foi possível baixar");
    window.open(data.signedUrl, "_blank");
  }

  function copyReferralLink() {
    const url = `${window.location.origin}/indicar/${data?.partner?.id || ""}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/60">
        <Loader2 className="size-6 text-indigo-500 animate-spin" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/60 p-6">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Inbox className="size-10 text-slate-300 mx-auto mb-3" />
            <h2 className="text-base font-semibold text-slate-900">Acesso pendente</h2>
            <p className="text-sm text-slate-500 mt-1">Seu cadastro de parceiro ainda não está vinculado a este e-mail.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { partner, clients, commissions, contracts, demands } = data;
  const firstName = (partner.full_name || "").split(" ")[0];

  return (
    <div className="min-h-screen flex bg-slate-50/60">
      {/* ============ SIDEBAR ============ */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-200/70 bg-white sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-slate-100">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">Portal</p>
          <h1 className="text-[15px] font-semibold text-slate-900 mt-0.5">Parceiro</h1>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {NAV.map((n) => {
            const active = activeTab === n.v;
            return (
              <button
                key={n.v}
                onClick={() => goTab(n.v)}
                className={cn(
                  "relative w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition",
                  active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-indigo-600" />}
                <n.icon className="size-4 shrink-0" />
                <span className="truncate">{n.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="px-3 py-3 border-t border-slate-100">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <Avatar className="size-8"><AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">{initials(partner.full_name || user?.email || "P")}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 truncate">{partner.full_name}</p>
              <p className="text-[11px] text-slate-500 truncate">{Number(partner.commission_percent || 0).toFixed(1)}% comissão</p>
            </div>
            <button onClick={() => signOut?.()} className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700" title="Sair">
              <LogOut className="size-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ============ MAIN ============ */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* HEADER */}
        <header className="sticky top-0 z-10 bg-white/85 backdrop-blur border-b border-slate-200/70">
          <div className="px-4 sm:px-6 lg:px-8 py-3.5 flex items-center gap-3">
            <div className="lg:hidden">
              <Select value={activeTab} onValueChange={(v) => goTab(v as Tab)}>
                <SelectTrigger className="w-[170px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NAV.map((n) => <SelectItem key={n.v} value={n.v}>{n.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input placeholder="Buscar cliente, demanda, comissão…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 bg-slate-50 border-slate-200/70 focus-visible:bg-white" />
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
              <CalendarDays className="size-4" />
              <span className="font-medium text-slate-700">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</span>
            </div>
            <Button onClick={() => setReferralOpen(true)} size="sm" className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white">
              <Share2 className="size-3.5 mr-1.5" /> Indicar
            </Button>
          </div>
        </header>

        <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] w-full mx-auto">
          {/* ===== DASHBOARD ===== */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-[22px] font-semibold text-slate-900 tracking-tight">Olá, {firstName} 👋</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Visão geral dos seus ganhos e indicações.</p>
                </div>
                <button onClick={copyReferralLink} className="flex items-center gap-2 text-xs text-slate-600 hover:text-indigo-700 bg-white border border-slate-200/70 rounded-md px-3 py-2 shadow-sm transition">
                  <Copy className="size-3.5" /> Copiar link de indicação
                </button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi label="Saldo a receber" value={formatBRL(totals.pending)} icon={Wallet} tone="amber" hint="A confirmar / liberar" />
                <Kpi label="Total recebido" value={formatBRL(totals.paid)} icon={CheckCircle2} tone="emerald" hint="Comissões pagas" />
                <Kpi label="Indicados ativos" value={`${totals.active}/${totals.totalClients}`} icon={Users} tone="indigo" hint={`${totals.conversion.toFixed(0)}% conversão`} />
                <Kpi label="Próximo pagamento" value={totals.nextPayment ? formatDate(totals.nextPayment) : "—"} icon={Calendar} tone="rose" hint={totals.nextPayment ? "Previsão" : "Sem pendência"} />
              </div>

              <div className="grid lg:grid-cols-3 gap-5">
                <Panel title="Comissões recentes" subtitle={`${commissions.length} no total`} className="lg:col-span-2">
                  {commissions.length === 0 ? <EmptyHint message="Nenhuma comissão registrada" icon={Wallet} /> : (
                    <div className="divide-y divide-slate-100">
                      {commissions.slice(0, 6).map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{c.sales?.products?.name || "Venda direta"}</p>
                            <p className="text-[11px] text-slate-500 truncate">{c.sales?.clients?.full_name || "—"} · {formatDate(c.created_at)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-slate-900 font-mono tabular-nums">{formatBRL(c.amount)}</p>
                            <CommissionBadge status={c.workflow_status || c.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel title="Seus indicados" subtitle={`${clients.length} cadastrado(s)`}>
                  {clients.length === 0 ? <EmptyHint message="Indique seu primeiro cliente" icon={Users} /> : (
                    <div className="space-y-1">
                      {clients.slice(0, 6).map((c: any) => (
                        <button key={c.id} onClick={() => setOpenClientId(c.id)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-slate-50 text-left">
                          <Avatar className="size-7"><AvatarFallback className="bg-indigo-50 text-indigo-700 text-[10px] font-semibold">{initials(c.full_name)}</AvatarFallback></Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900 truncate">{c.full_name}</p>
                            <p className="text-[11px] text-slate-500 truncate">{c.company || c.email || "—"}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px] capitalize border-slate-200 text-slate-600">{c.status}</Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>

              <div className="grid lg:grid-cols-2 gap-5">
                <Panel title="Demandas em andamento" subtitle={`${demands.length} no total`}>
                  {demands.length === 0 ? <EmptyHint message="Nada em andamento" icon={ClipboardList} /> : (
                    <div className="divide-y divide-slate-100">
                      {demands.slice(0, 5).map((d: any) => (
                        <button key={d.id} onClick={() => setOpenClientId(d.clients?.id || null)} className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-slate-50 text-left">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{d.clients?.full_name || "—"}</p>
                            <p className="text-[11px] text-slate-500 truncate">{d.products?.name || d.custom_product_name || "—"}</p>
                          </div>
                          <Badge variant="outline" className={cn("text-[10px] border", DEMAND_META[d.status]?.tone)}>{DEMAND_META[d.status]?.label || d.status}</Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </Panel>
                <Panel title="Contratos" subtitle={`${contracts.length} no total`}>
                  {contracts.length === 0 ? <EmptyHint message="Nenhum contrato" icon={FileText} /> : (
                    <div className="divide-y divide-slate-100">
                      {contracts.slice(0, 5).map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="size-7 rounded bg-slate-100 flex items-center justify-center shrink-0"><FileText className="size-3.5 text-slate-500" /></div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                              <p className="text-[11px] text-slate-500">{formatDate(c.created_at)}</p>
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" className="h-7 text-[11px]" disabled={!c.file_path} onClick={() => downloadContract(c.file_path, c.name)}>
                            <Download className="size-3 mr-1" /> Baixar
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>
            </div>
          )}

          {/* ===== INDICADOS ===== */}
          {activeTab === "clientes" && (
            <div className="space-y-4">
              <SectionHeader title="Meus indicados" count={filteredClients.length} icon={Users}>
                <Button onClick={() => setReferralOpen(true)} size="sm" className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Share2 className="size-3.5 mr-1.5" /> Nova indicação
                </Button>
              </SectionHeader>
              {filteredClients.length === 0 ? (
                <EmptyState message="Nenhum cliente indicado por enquanto" icon={Users} />
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredClients.map((c: any) => {
                    const cd = demands.filter((d: any) => d.clients?.id === c.id);
                    return (
                      <button key={c.id} onClick={() => setOpenClientId(c.id)} className="group text-left bg-white border border-slate-200/70 rounded-lg p-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition">
                        <div className="flex items-start gap-3">
                          <Avatar className="size-11"><AvatarFallback className="bg-indigo-50 text-indigo-700 text-sm font-semibold">{initials(c.full_name)}</AvatarFallback></Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900 truncate">{c.full_name}</p>
                            <p className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5"><Building2 className="size-3" />{c.company || "—"}</p>
                            <p className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5"><Mail className="size-3" />{c.email || "—"}</p>
                          </div>
                          <ChevronRight className="size-4 text-slate-300 group-hover:text-indigo-600 transition shrink-0" />
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                          <Badge variant="outline" className="text-[10px] capitalize border-slate-200 text-slate-600">{c.status}</Badge>
                          <span className="text-[11px] font-mono font-semibold text-slate-700">{cd.length} produto{cd.length !== 1 ? "s" : ""}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===== COMISSÕES ===== */}
          {activeTab === "comissoes" && (
            <div className="space-y-4">
              <SectionHeader title="Comissões" count={filteredCommissions.length} icon={Wallet}>
                <Select value={commissionFilter} onValueChange={setCommissionFilter}>
                  <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="aguardando_confirmacao">Em análise</SelectItem>
                    <SelectItem value="liberada">Liberada</SelectItem>
                    <SelectItem value="em_pagamento">Em pagamento</SelectItem>
                    <SelectItem value="paga">Paga</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </SectionHeader>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi label="Total" value={formatBRL(totals.total)} icon={BadgeDollarSign} tone="slate" />
                <Kpi label="A receber" value={formatBRL(totals.pending)} icon={TrendingUp} tone="amber" />
                <Kpi label="Recebido" value={formatBRL(totals.paid)} icon={CheckCircle2} tone="emerald" />
                <Kpi label="Próximo" value={totals.nextPayment ? formatDate(totals.nextPayment) : "—"} icon={Calendar} tone="indigo" />
              </div>

              {filteredCommissions.length === 0 ? (
                <EmptyState message="Nenhuma comissão encontrada" icon={Wallet} />
              ) : (
                <Card className="border-slate-200/70 shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50/60 border-b border-slate-100">
                        <tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          <th className="px-5 py-3 text-left">Produto</th>
                          <th className="px-5 py-3 text-left">Cliente</th>
                          <th className="px-5 py-3 text-right">Valor</th>
                          <th className="px-5 py-3 text-left">Previsão</th>
                          <th className="px-5 py-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredCommissions.map((c: any) => (
                          <tr key={c.id} className="hover:bg-slate-50/50 transition">
                            <td className="px-5 py-3.5 font-medium text-slate-900">{c.sales?.products?.name || "Venda direta"}</td>
                            <td className="px-5 py-3.5 text-slate-700">{c.sales?.clients?.full_name || "—"}</td>
                            <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-900 tabular-nums">{formatBRL(c.amount)}</td>
                            <td className="px-5 py-3.5 text-[12px] text-slate-500">{c.expected_date ? formatDate(c.expected_date) : (c.paid_at ? `Pago ${formatDate(c.paid_at)}` : "—")}</td>
                            <td className="px-5 py-3.5 text-center"><CommissionBadge status={c.workflow_status || c.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ===== DEMANDAS ===== */}
          {activeTab === "demandas" && (
            <div className="space-y-4">
              <SectionHeader title="Demandas dos seus indicados" count={filteredDemands.length} icon={ClipboardList} />
              {filteredDemands.length === 0 ? (
                <EmptyState message="Nenhuma demanda em andamento" icon={ClipboardList} />
              ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredDemands.map((d: any) => (
                    <button key={d.id} onClick={() => setOpenClientId(d.clients?.id || null)} className="group text-left bg-white border border-slate-200/70 rounded-lg p-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="size-9 shrink-0"><AvatarFallback className="bg-indigo-50 text-indigo-700 text-xs font-semibold">{initials(d.clients?.full_name || "?")}</AvatarFallback></Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{d.clients?.full_name || "—"}</p>
                            <p className="text-[11px] text-slate-500 truncate">{d.products?.name || d.custom_product_name || "—"}</p>
                          </div>
                        </div>
                        <ArrowUpRight className="size-4 text-slate-300 group-hover:text-indigo-600 transition shrink-0" />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-3">
                        <Badge variant="outline" className={cn("text-[10px] border", DEMAND_META[d.status]?.tone)}>{DEMAND_META[d.status]?.label || d.status}</Badge>
                        {d.sla_status === "atrasado" && <Badge variant="outline" className="text-[10px] border bg-rose-50 text-rose-700 border-rose-200">SLA atrasado</Badge>}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-100">
                        <span className="flex items-center gap-1"><Calendar className="size-3" />{d.deadline ? formatDate(d.deadline) : "Sem prazo"}</span>
                        {d.value && <span className="font-mono font-semibold text-slate-700">{formatBRL(d.value)}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== CONTRATOS ===== */}
          {activeTab === "contratos" && (
            <div className="space-y-4">
              <SectionHeader title="Documentos e contratos" count={contracts.length} icon={FileText} />
              {contracts.length === 0 ? (
                <EmptyState message="Nenhum contrato vinculado" icon={FileText} />
              ) : (
                <div className="grid md:grid-cols-2 gap-3">
                  {contracts.map((c: any) => (
                    <div key={c.id} className="bg-white border border-slate-200/70 rounded-lg p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="size-9 rounded bg-indigo-50 flex items-center justify-center shrink-0"><FileText className="size-4 text-indigo-600" /></div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{c.name}</p>
                            <p className="text-[11px] text-slate-500">{c.contract_type || c.contract_kind || "Contrato"} · {formatDate(c.created_at)}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize border-slate-200 text-slate-600 shrink-0">{c.status}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-[12px] text-slate-600 mb-3 pt-3 border-t border-slate-100">
                        <span>Valor</span>
                        <span className="font-mono font-semibold text-slate-900">{c.amount ? formatBRL(c.amount) : "—"}</span>
                      </div>
                      {c.expires_at && <p className="text-[11px] text-slate-500 mb-3">Expira em {formatDate(c.expires_at)}</p>}
                      <Button size="sm" variant="outline" className="w-full" disabled={!c.file_path} onClick={() => downloadContract(c.file_path, c.name)}>
                        <Download className="size-3.5 mr-1.5" /> Baixar contrato
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== MATERIAIS ===== */}
          {activeTab === "materiais" && (
            <div className="space-y-4">
              <SectionHeader title="Central de materiais" icon={Sparkles} />
              <Card className="border-slate-200/70 shadow-sm">
                <CardContent className="p-10 text-center">
                  <Sparkles className="size-10 text-indigo-300 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-slate-900">Em breve</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">Aqui você terá apresentações, peças de marketing e scripts prontos para acelerar suas indicações.</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ===== PERFIL / DADOS BANCÁRIOS ===== */}
          {activeTab === "perfil" && (
            <div className="max-w-3xl space-y-4">
              <SectionHeader title="Dados de recebimento" icon={UserCog} />
              <Card className="border-slate-200/70 shadow-sm">
                <CardContent className="p-6 space-y-5">
                  <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
                    <Avatar className="size-14"><AvatarFallback className="bg-indigo-50 text-indigo-700 font-semibold">{initials(partner.full_name)}</AvatarFallback></Avatar>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-slate-900 truncate">{partner.full_name}</p>
                      <p className="text-sm text-slate-500 truncate">{partner.email}</p>
                    </div>
                    <Badge variant="outline" className="ml-auto text-[10px] border-emerald-200 bg-emerald-50 text-emerald-700">{Number(partner.commission_percent || 0).toFixed(1)}% comissão</Badge>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Info label="Telefone" value={partner.phone} />
                    <Info label="WhatsApp" value={partner.whatsapp} />
                    <Info label="Documento" value={partner.document} />
                    <Info label="Tipo" value={partner.partner_type} />
                  </div>
                  <div className="bg-slate-50 rounded-lg p-5 border border-slate-100 space-y-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pagamento</p>
                    <Info label="Chave PIX" value={partner.pix_key} mono />
                    <div className="grid sm:grid-cols-3 gap-4">
                      <Info label="Banco" value={partner.bank_name} />
                      <Info label="Agência" value={partner.bank_agency} mono />
                      <Info label="Conta" value={partner.bank_account} mono />
                    </div>
                  </div>
                  <div className="flex justify-end pt-2 border-t border-slate-100">
                    <Button variant="outline" size="sm" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent("Olá, gostaria de atualizar meus dados bancários no Portal do Parceiro.")}`, "_blank")}>
                      <ExternalLink className="size-3.5 mr-1.5" /> Solicitar alteração
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ===== SUPORTE ===== */}
          {activeTab === "suporte" && (
            <div className="max-w-2xl space-y-4">
              <SectionHeader title="Suporte ao parceiro" icon={LifeBuoy} />
              <Card className="border-slate-200/70 shadow-sm">
                <CardContent className="p-8 text-center">
                  <LifeBuoy className="size-10 text-indigo-300 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-slate-900">Fale com a equipe</h3>
                  <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">Tire dúvidas sobre indicações, comissões e pagamentos diretamente com nosso time.</p>
                  <Button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent("Olá, preciso de suporte no Portal do Parceiro.")}`, "_blank")} className="mt-5 bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Phone className="size-3.5 mr-1.5" /> Abrir conversa
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      <PartnerClientDrawer clientId={openClientId} onClose={() => setOpenClientId(null)} partnerId={partner.id} />
      <ReferralDialog open={referralOpen} onOpenChange={setReferralOpen} mode="partner" ownerId={partner.id} queryKey={["partner-panel", user?.id, user?.email]} />
    </div>
  );
}

/* ================= Subcomponents ================= */
function Kpi({ label, value, icon: Icon, tone, hint }: { label: string; value: string | number; icon: any; tone: "indigo"|"rose"|"amber"|"emerald"|"slate"; hint?: string }) {
  const toneClass = {
    indigo: "bg-indigo-50 text-indigo-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-700",
  }[tone];
  return (
    <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="text-[22px] font-bold text-slate-900 mt-1.5 font-mono leading-none tabular-nums truncate">{value}</p>
          {hint && <p className="text-[10px] text-slate-500 mt-1.5">{hint}</p>}
        </div>
        <div className={cn("size-9 rounded-md flex items-center justify-center shrink-0", toneClass)}><Icon className="size-4" /></div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white border border-slate-200/70 rounded-lg shadow-sm", className)}>
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}

function SectionHeader({ title, count, icon: Icon, children }: { title: string; count?: number; icon: any; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="size-9 rounded-md bg-indigo-50 text-indigo-700 flex items-center justify-center"><Icon className="size-4" /></div>
        <div>
          <h2 className="text-[17px] font-semibold text-slate-900 tracking-tight">{title}</h2>
          {typeof count === "number" && <p className="text-[11px] text-slate-500 font-mono">{count} item{count !== 1 ? "s" : ""}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function CommissionBadge({ status }: { status: string }) {
  const meta = COMMISSION_META[status] || { label: status || "—", tone: "bg-slate-100 text-slate-700 border-slate-200" };
  return <Badge variant="outline" className={cn("text-[10px] border font-semibold", meta.tone)}>{meta.label}</Badge>;
}

function EmptyHint({ message, icon: Icon = Inbox }: { message: string; icon?: any }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Icon className="size-7 text-slate-300 mb-2" />
      <p className="text-xs text-slate-500">{message}</p>
    </div>
  );
}
function EmptyState({ message, icon: Icon = Inbox }: { message: string; icon?: any }) {
  return (
    <div className="bg-white border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center py-16 text-center">
      <Icon className="size-10 text-slate-300 mb-3" />
      <p className="text-sm font-medium text-slate-600">{message}</p>
    </div>
  );
}
function Info({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn("text-sm text-slate-900 mt-0.5 truncate", mono && "font-mono")}>{value || "—"}</p>
    </div>
  );
}

/* ================= Client detail drawer ================= */
function PartnerClientDrawer({ clientId, onClose, partnerId }: { clientId: string | null; onClose: () => void; partnerId: string }) {
  const open = !!clientId;
  const { data: client } = useQuery({
    queryKey: ["partner-client-detail", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").eq("id", clientId!).maybeSingle();
      return data;
    },
  });
  const { data: company } = useQuery({
    queryKey: ["partner-client-company", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("*").eq("client_id", clientId!).maybeSingle();
      return data;
    },
  });
  const { data: clientDemands = [] } = useQuery({
    queryKey: ["partner-client-demands", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_products")
        .select("id, status, sla_status, deadline, value, custom_product_name, created_at, products(name)")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const { data: clientCommissions = [] } = useQuery({
    queryKey: ["partner-client-commissions", clientId, partnerId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("commissions")
        .select("id, amount, status, workflow_status, created_at, paid_at, sales!inner(client_id, products(name))")
        .eq("partner_id", partnerId)
        .eq("sales.client_id", clientId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 overflow-y-auto bg-slate-50/40">
        {!client ? (
          <div className="flex items-center justify-center h-full"><Loader2 className="size-5 animate-spin text-slate-400" /></div>
        ) : (
          <div>
            <SheetHeader className="bg-white border-b border-slate-200/70 px-6 py-5">
              <div className="flex items-start gap-4">
                <Avatar className="size-14"><AvatarFallback className="bg-indigo-50 text-indigo-700 font-semibold text-base">{initials(client.full_name)}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-[17px] text-slate-900 truncate text-left">{client.full_name}</SheetTitle>
                  <p className="text-xs text-slate-500 mt-0.5 text-left">{client.email || "—"}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <Badge variant="outline" className="text-[10px] capitalize border-slate-200 text-slate-700">{client.status || "—"}</Badge>
                    {client.document && <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-600 font-mono">{client.document}</Badge>}
                  </div>
                </div>
              </div>
            </SheetHeader>

            <div className="p-5 space-y-5">
              <Card className="border-slate-200/70 shadow-sm">
                <CardContent className="p-4 grid grid-cols-2 gap-3 text-sm">
                  <Info label="Telefone" value={client.phone} />
                  <Info label="Empresa" value={(company as any)?.name || (company as any)?.trade_name || client.company} />
                  <Info label="CNPJ" value={(company as any)?.document} mono />
                  <Info label="Cidade" value={[client.address_city, client.address_state].filter(Boolean).join(" / ") || "—"} />
                </CardContent>
              </Card>

              <Tabs defaultValue="demandas">
                <TabsList className="bg-white border border-slate-200/70 p-1 h-auto rounded-lg w-full grid grid-cols-2">
                  <TabsTrigger value="demandas" className="text-xs data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:font-semibold">Demandas ({clientDemands.length})</TabsTrigger>
                  <TabsTrigger value="comissoes" className="text-xs data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:font-semibold">Comissões ({clientCommissions.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="demandas" className="mt-3 space-y-2">
                  {clientDemands.length === 0 ? <EmptyHint message="Sem demandas registradas" icon={ClipboardList} />
                    : (clientDemands as any[]).map((d) => (
                      <div key={d.id} className="bg-white border border-slate-200/70 rounded-lg p-3.5 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">{d.products?.name || d.custom_product_name || "—"}</p>
                          <Badge variant="outline" className={cn("text-[10px] border", DEMAND_META[d.status]?.tone)}>{DEMAND_META[d.status]?.label || d.status}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-2">
                          {d.deadline && <span className="flex items-center gap-1"><Calendar className="size-3" />{formatDate(d.deadline)}</span>}
                          {d.sla_status === "atrasado" && <span className="text-rose-600 font-semibold">SLA atrasado</span>}
                          {d.value && <span className="font-mono text-slate-700 ml-auto">{formatBRL(d.value)}</span>}
                        </div>
                      </div>
                    ))}
                </TabsContent>

                <TabsContent value="comissoes" className="mt-3 space-y-2">
                  {clientCommissions.length === 0 ? <EmptyHint message="Sem comissões deste cliente" icon={Wallet} />
                    : (clientCommissions as any[]).map((c) => (
                      <div key={c.id} className="bg-white border border-slate-200/70 rounded-lg px-3.5 py-2.5 shadow-sm flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{c.sales?.products?.name || "Comissão"}</p>
                          <p className="text-[11px] text-slate-500">{formatDate(c.created_at)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-slate-900 font-mono tabular-nums">{formatBRL(c.amount)}</p>
                          <CommissionBadge status={c.workflow_status || c.status} />
                        </div>
                      </div>
                    ))}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
