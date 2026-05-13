import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Users, Wallet, CheckCircle2, TrendingUp, Clock, Inbox,
  ArrowUpRight, FileText, Download, XCircle, Calendar, Search,
  Copy, ExternalLink, Share2, Award, Zap
} from "lucide-react";
import { formatBRL, formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function PartnerPanel() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["partner-panel", user?.id],
    queryFn: async () => {
      const { data: partner } = await supabase
        .from("partners")
        .select("id, full_name, email, phone, commission_percent, pix_key, partner_type, active, bank_name, bank_agency, bank_account, document, whatsapp")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!partner) return null;

      const [clients, commissions, contracts] = await Promise.all([
        supabase.from("clients").select("id, full_name, company, email, phone, status, created_at").eq("partner_id", partner.id).order("created_at", { ascending: false }),
        supabase.from("commissions").select("id, amount, percent, status, workflow_status, created_at, paid_at, expected_date, sales(id, amount, sale_date, clients(full_name), products(name))").eq("partner_id", partner.id).order("created_at", { ascending: false }),
        supabase.from("contracts").select("id, name, status, file_path, amount, created_at, signed_at, sent_at, expires_at, contract_kind, contract_type").eq("partner_id", partner.id).order("created_at", { ascending: false }),
      ]);

      const clientIds = (clients.data ?? []).map((c: any) => c.id);
      let demands: any[] = [];
      if (clientIds.length) {
        const { data: d } = await supabase
          .from("client_products")
          .select("id, status, sla_status, sla_due_date, value, start_date, deadline, created_at, custom_product_name, clients(full_name), products(name)")
          .in("client_id", clientIds)
          .order("created_at", { ascending: false });
        demands = d ?? [];
      }
      return { partner, clients: clients.data ?? [], commissions: commissions.data ?? [], contracts: contracts.data ?? [], demands };
    },
    enabled: !!user,
  });

  const totals = useMemo(() => {
    if (!data) return { total: 0, paid: 0, pending: 0, cancelled: 0, thisMonth: 0, clientsActive: 0, clientsNeg: 0, clientsCancelled: 0, nextPayment: null as string | null, conversionRate: 0 };
    const commissions = data.commissions;
    const total = commissions.reduce((s, x: any) => s + Number(x.amount), 0);
    const paid = commissions.filter((x: any) => x.workflow_status === "paga").reduce((s, x: any) => s + Number(x.amount), 0);
    const pending = commissions.filter((x: any) => ["aguardando_confirmacao", "pendente", "liberada", "em_pagamento"].includes(x.workflow_status)).reduce((s, x: any) => s + Number(x.amount), 0);
    const clientsActive = data.clients.filter((c: any) => c.status === "ativo").length;
    const nextPending = [...commissions].filter((s: any) => ["aguardando_confirmacao", "pendente", "liberada", "em_pagamento"].includes(s.workflow_status)).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
    const nextPayment = nextPending ? new Date(new Date(nextPending.created_at).getTime() + 30 * 86400000).toISOString() : null;
    const conversionRate = data.clients.length > 0 ? (clientsActive / data.clients.length) * 100 : 0;
    return { total, paid, pending, clientsActive, nextPayment, conversionRate };
  }, [data]);

  const filteredSplits = useMemo(() => {
    if (!data) return [];
    return data.commissions.filter((s: any) => {
      if (statusFilter !== "todos" && s.status !== statusFilter) return false;
      if (clientFilter) {
        const name = (s.sales?.clients?.full_name || "").toLowerCase();
        if (!name.includes(clientFilter.toLowerCase())) return false;
      }
      return true;
    });
  }, [data, statusFilter, clientFilter]);

  if (isLoading) return <div className="p-12 text-center text-sm font-editorial italic text-muted-foreground">Processando ganhos...</div>;
  if (!data) return <div className="p-20 text-center">Acesso pendente.</div>;

  const { partner, clients, commissions, contracts, demands } = data;

  const downloadContract = async (path: string | null, name: string) => {
    if (!path) return toast.error("Arquivo indisponível");
    const { data, error } = await supabase.storage.from("contracts").createSignedUrl(path, 60);
    if (error || !data) return toast.error("Não foi possível baixar");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="bg-premium min-h-screen">
      <div className="page-shell space-y-12 py-12">
        <section className="relative overflow-hidden rounded-[40px] bg-slate-900 p-10 lg:p-16 text-white group shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)]">
           <div className="absolute bottom-0 right-0 size-96 bg-primary/10 blur-[100px] -mb-48 -mr-48 rounded-full" />
           <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 relative">
              <div className="space-y-6">
                 <div className="flex items-center gap-3">
                   <div className="size-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]" />
                   <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/40">Active Partner Network</span>
                 </div>
                 <h1 className="font-editorial text-4xl lg:text-7xl font-bold tracking-tight leading-[0.95]">
                   Eleve seu <br/><span className="italic text-primary">impacto</span>.
                 </h1>
                 <div className="flex items-center gap-4 text-white/60 font-editorial italic text-lg lg:text-xl">
                   <span>{partner.full_name}</span>
                   <span className="size-1 bg-white/20 rounded-full" />
                   <span>{Number(partner.commission_percent).toFixed(1)}% comissão</span>
                 </div>
              </div>
           </div>
        </section>

        <Tabs defaultValue="home" className="space-y-10">
           <TabsList className="bg-slate-100/50 dark:bg-white/5 p-1 rounded-2xl border border-slate-200/50 dark:border-white/5 h-12 inline-flex flex-wrap">
              <TabsTrigger value="home" className="rounded-xl px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 shadow-none font-bold">Visão Geral</TabsTrigger>
              <TabsTrigger value="clientes" className="rounded-xl px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 shadow-none font-bold">Indicados ({clients.length})</TabsTrigger>
              <TabsTrigger value="comissoes" className="rounded-xl px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 shadow-none font-bold">Comissões ({commissions.length})</TabsTrigger>
              <TabsTrigger value="demandas" className="rounded-xl px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 shadow-none font-bold">Demandas ({demands.length})</TabsTrigger>
              <TabsTrigger value="contratos" className="rounded-xl px-6 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 shadow-none font-bold">Contratos ({contracts.length})</TabsTrigger>
           </TabsList>

           <TabsContent value="home" className="animate-fade-up space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <KpiCard label="Saldo Disponível" value={formatBRL(totals.pending)} icon={Wallet} tone="info" description="Liberado após pagamento do cliente" />
                 <KpiCard label="Total Recebido" value={formatBRL(totals.paid)} icon={CheckCircle2} tone="success" description="Já creditado" />
                 <KpiCard label="Conversão" value={`${totals.conversionRate.toFixed(1)}%`} icon={TrendingUp} tone="warning" description="Eficiência de indicação" />
                 <KpiCard label="Pagamento" value={totals.nextPayment ? formatDate(totals.nextPayment) : "—"} icon={Calendar} description="Próxima data prevista" />
              </div>

              <div className="vx-card p-8 bg-slate-900 text-white rounded-[32px] relative overflow-hidden">
                <div className="absolute top-0 right-0 size-64 bg-primary/20 blur-[100px] -mr-32 -mt-32 rounded-full" />
                <div className="relative z-10 space-y-2">
                  <h3 className="font-editorial text-2xl font-bold">Como funciona a sua comissão</h3>
                  <p className="text-white/60 text-sm max-w-xl">
                    Toda comissão fica como <strong>aguardando confirmação</strong> até que o cliente quite o pagamento. Assim que registrarmos a entrada, ela é automaticamente <strong>liberada</strong> para repasse.
                  </p>
                  <p className="text-white/40 text-xs pt-2">Código de indicação: <span className="font-mono text-white/80">{partner.id.slice(0, 8).toUpperCase()}</span></p>
                </div>
              </div>
           </TabsContent>

           <TabsContent value="clientes" className="animate-fade-up space-y-4">
              {clients.length === 0 ? (
                <div className="vx-card bg-white rounded-[32px] p-16 text-center text-muted-foreground">Você ainda não possui clientes indicados.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {clients.map((c: any) => {
                    const cd = demands.filter((d: any) => d.clients?.full_name === c.full_name);
                    return (
                      <div key={c.id} className="vx-card bg-white border border-slate-100 rounded-[24px] p-6 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">{initials(c.full_name)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold truncate">{c.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{c.company || c.email || "—"}</p>
                          </div>
                          <Badge variant="outline" className="text-[9px]">{c.status}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">Produtos contratados: <strong className="text-foreground">{cd.length}</strong></div>
                        {cd.slice(0, 3).map((d: any) => (
                          <div key={d.id} className="text-xs flex justify-between gap-2 border-t border-slate-100 pt-2">
                            <span className="truncate">{d.products?.name || d.custom_product_name || "Produto"}</span>
                            <Badge variant="outline" className="text-[9px]">{d.status}</Badge>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
           </TabsContent>

           <TabsContent value="comissoes" className="animate-fade-up space-y-6">
              <div className="vx-card bg-white rounded-[32px] overflow-hidden border-slate-100">
                <table className="w-full text-sm">
                   <thead>
                      <tr className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground bg-slate-50/50">
                         <th className="px-8 py-5 text-left">Produto</th>
                         <th className="px-8 py-5 text-left">Cliente</th>
                         <th className="px-8 py-5 text-right">Comissão</th>
                         <th className="px-8 py-5 text-center">Status</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                      {filteredSplits.map((s: any) => (
                        <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                           <td className="px-8 py-6 font-bold">{s.sales?.products?.name ?? "—"}</td>
                           <td className="px-8 py-6">{s.sales?.clients?.full_name ?? "—"}</td>
                           <td className="px-8 py-6 text-right font-bold tabular-nums">{formatBRL(s.amount)}</td>
                           <td className="px-8 py-6 text-center"><CommissionStatusBadge status={s.workflow_status || 'pendente'} /></td>
                        </tr>
                      ))}
                      {filteredSplits.length === 0 && (
                        <tr><td colSpan={4} className="px-8 py-12 text-center text-sm text-muted-foreground">Sem comissões registradas.</td></tr>
                      )}
                   </tbody>
                </table>
              </div>
           </TabsContent>

           <TabsContent value="demandas" className="animate-fade-up space-y-4">
              {demands.length === 0 ? (
                <div className="vx-card bg-white rounded-[32px] p-16 text-center text-muted-foreground">Nenhuma demanda em andamento dos seus indicados.</div>
              ) : (
                <div className="vx-card bg-white rounded-[32px] overflow-hidden border-slate-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground bg-slate-50/50">
                        <th className="px-6 py-5 text-left">Cliente</th>
                        <th className="px-6 py-5 text-left">Produto</th>
                        <th className="px-6 py-5 text-center">Status</th>
                        <th className="px-6 py-5 text-center">SLA</th>
                        <th className="px-6 py-5 text-left">Prazo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {demands.map((d: any) => (
                        <tr key={d.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-5 font-bold">{d.clients?.full_name ?? "—"}</td>
                          <td className="px-6 py-5">{d.products?.name || d.custom_product_name || "—"}</td>
                          <td className="px-6 py-5 text-center"><Badge variant="outline" className="text-[9px]">{d.status}</Badge></td>
                          <td className="px-6 py-5 text-center"><Badge variant="outline" className={cn("text-[9px]", d.sla_status === 'no_prazo' ? 'text-emerald-600 border-emerald-200' : d.sla_status === 'atrasado' ? 'text-rose-600 border-rose-200' : 'text-amber-600 border-amber-200')}>{d.sla_status || '—'}</Badge></td>
                          <td className="px-6 py-5 text-xs text-muted-foreground">{d.deadline ? formatDate(d.deadline) : (d.sla_due_date ? formatDate(d.sla_due_date) : "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
           </TabsContent>

           <TabsContent value="contratos" className="animate-fade-up space-y-4">
              {contracts.length === 0 ? (
                <div className="vx-card bg-white rounded-[32px] p-16 text-center text-muted-foreground">Nenhum contrato vinculado ao seu cadastro.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contracts.map((c: any) => (
                    <div key={c.id} className="vx-card bg-white border border-slate-100 rounded-[24px] p-6 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.contract_type || c.contract_kind} · {formatDate(c.created_at)}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px] uppercase">{c.status}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground text-xs">Valor</span>
                        <span className="font-bold tabular-nums">{c.amount ? formatBRL(c.amount) : "—"}</span>
                      </div>
                      {c.expires_at && <div className="text-xs text-muted-foreground">Expira: {formatDate(c.expires_at)}</div>}
                      <Button size="sm" variant="outline" className="w-full" disabled={!c.file_path} onClick={() => downloadContract(c.file_path, c.name)}>
                        <Download className="size-3 mr-2" /> Baixar contrato
                      </Button>
                    </div>
                  ))}
                </div>
              )}
           </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function CommissionStatusBadge({ status }: { status: string }) {
  const map: any = {
    pendente: { label: "PENDENTE", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    aguardando_confirmacao: { label: "EM ANÁLISE", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    liberada: { label: "LIBERADA", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    em_pagamento: { label: "EM PAGAMENTO", className: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" },
    paga: { label: "PAGA", className: "bg-emerald-500 text-white border-transparent" },
    cancelada: { label: "CANCELADA", className: "bg-rose-500/10 text-rose-600 border-rose-500/20" },
  };
  const cfg = map[status] || { label: status?.toUpperCase() || "—", className: "bg-slate-100 text-slate-600 border-slate-200" };
  return <Badge variant="outline" className={cn("text-[9px] font-bold tracking-widest border px-2 py-0.5 min-w-[100px] justify-center", cfg.className)}>{cfg.label}</Badge>;
}

function KpiCard({ label, value, icon: Icon, tone, description }: any) {
  const tones: any = { info: "text-blue-500 bg-blue-500/5", success: "text-emerald-500 bg-emerald-500/5", warning: "text-amber-500 bg-amber-500/5" };
  return (
    <div className="vx-card p-6 bg-white border border-slate-100 rounded-[32px] shadow-sm">
       <div className={cn("size-10 rounded-xl flex items-center justify-center mb-4", tones[tone])}>
          <Icon className="size-5" />
       </div>
       <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
       <p className="text-2xl font-bold font-editorial text-slate-900 mt-1">{value}</p>
       <p className="text-[10px] text-muted-foreground mt-1">{description}</p>
    </div>
  );
}
