import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Users, Wallet, CheckCircle2, TrendingUp, Clock, Inbox,
  ArrowUpRight, FileText, Download, XCircle, Calendar, Search,
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
        supabase.from("clients").select("id, full_name, company, email, phone, status, created_at, sales(id, amount, sale_date, status, products(name))").eq("partner_id", partner.id).order("created_at", { ascending: false }),
        supabase.from("commissions").select("*, sales(id, amount, sale_date, clients(full_name), products(name))").eq("partner_id", partner.id).order("created_at", { ascending: false }),

        supabase.from("contracts").select("id, name, status, file_path, amount, created_at, signed_at, sent_at, contract_kind, contract_type, expires_at").eq("partner_id", partner.id).order("created_at", { ascending: false }),
      ]);

      return {
        partner,
        clients: clients.data ?? [],
        commissions: commissions.data ?? [],
        contracts: contracts.data ?? [],
      };

    },
    enabled: !!user,
  });

  const totals = useMemo(() => {
    if (!data) return { total: 0, paid: 0, pending: 0, cancelled: 0, thisMonth: 0, clientsActive: 0, clientsNeg: 0, clientsCancelled: 0, nextPayment: null as string | null };
    const commissions = data.commissions;
    const total = commissions.reduce((s, x: any) => s + Number(x.amount), 0);
    const paid = commissions.filter((x: any) => x.workflow_status === "paga").reduce((s, x: any) => s + Number(x.amount), 0);
    const pending = commissions.filter((x: any) => ["aguardando_confirmacao", "pendente", "liberada", "em_pagamento"].includes(x.workflow_status)).reduce((s, x: any) => s + Number(x.amount), 0);
    const cancelled = commissions.filter((x: any) => x.workflow_status === "cancelada").reduce((s, x: any) => s + Number(x.amount), 0);
    const now = new Date();
    const thisMonth = commissions.filter((x: any) => {
      const d = new Date(x.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((s, x: any) => s + Number(x.amount), 0);

    const clientsActive = data.clients.filter((c: any) => c.status === "ativo").length;
    const clientsNeg = data.clients.filter((c: any) => ["em_negociacao", "lead", "prospecto"].includes(c.status)).length;
    const clientsCancelled = data.clients.filter((c: any) => ["cancelado", "inativo"].includes(c.status)).length;

    // Próximo pagamento previsto: comissão pendente mais antiga + 30 dias
    const nextPending = [...commissions].filter((s: any) => ["aguardando_confirmacao", "pendente", "liberada", "em_pagamento"].includes(s.workflow_status)).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
    const nextPayment = nextPending ? new Date(new Date(nextPending.created_at).getTime() + 30 * 86400000).toISOString() : null;

    return { total, paid, pending, cancelled, thisMonth, clientsActive, clientsNeg, clientsCancelled, nextPayment };

  }, [data]);

  const filteredSplits = useMemo(() => {
    if (!data) return [];
    return data.commissions.filter((s: any) => {
      if (statusFilter !== "todos" && s.status !== statusFilter) return false;
      if (clientFilter) {
        const name = (s.sales?.clients?.full_name || "").toLowerCase();
        if (!name.includes(clientFilter.toLowerCase())) return false;
      }
      if (dateFrom && new Date(s.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(s.created_at) > new Date(dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [data, statusFilter, clientFilter, dateFrom, dateTo]);

  const paidHistory = useMemo(() => {
    if (!data) return [];
    return data.commissions
      .filter((s: any) => s.workflow_status === "paga")

      .sort((a: any, b: any) => new Date(b.paid_at || b.updated_at || b.created_at).getTime() - new Date(a.paid_at || a.updated_at || a.created_at).getTime());
  }, [data]);

  async function handleDownloadContract(filePath: string, name: string) {
    const { data: signed, error } = await supabase.storage.from("contracts").createSignedUrl(filePath, 60);
    if (error || !signed) {
      toast.error("Não foi possível gerar o link do contrato");
      return;
    }
    const a = document.createElement("a");
    a.href = signed.signedUrl;
    a.download = name;
    a.click();
  }

  if (isLoading) return <div className="p-12 text-center text-sm font-editorial italic text-muted-foreground">Processando ganhos...</div>;

  if (!data) return (
    <div className="min-h-[70vh] flex items-center justify-center p-8 bg-premium">
      <div className="vx-card p-12 max-w-lg text-center shadow-2xl bg-white/40 backdrop-blur-xl border-white/20">
        <Inbox className="size-12 text-primary/30 mx-auto mb-6" />
        <h2 className="font-editorial text-3xl font-bold tracking-tight mb-3">Seu portal de parceiro está quase pronto</h2>
        <p className="text-muted-foreground leading-relaxed">
          Nossa equipe de parcerias está validando seu cadastro. <br/>Em breve você poderá acompanhar suas indicações e comissões.
        </p>
      </div>
    </div>
  );

  const { partner, clients, commissions, contracts } = data;

  return (
    <div className="bg-premium min-h-screen">
      <div className="page-shell space-y-12 py-12">
        {/* Partner Header */}
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

              <div className="grid grid-cols-2 gap-8 lg:gap-16 lg:pl-16 lg:border-l border-white/10">
                 <PartnerStat label="Indicados" value={String(clients.length)} />
                 <PartnerStat label="Ganhos Totais" value={formatBRL(totals.total)} highlight />
              </div>
           </div>
        </section>

        {/* Dashboard Grid - Comissões */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
           <SimpleKpi label="Comissão gerada" value={formatBRL(totals.total)} tone="info" icon={TrendingUp} />
           <SimpleKpi label="Comissões pendentes" value={formatBRL(totals.pending)} tone="warning" icon={Clock} />
           <SimpleKpi label="Total recebido" value={formatBRL(totals.paid)} tone="success" icon={CheckCircle2} />
           <div className="vx-card p-6 bg-slate-900 text-white rounded-[28px] border-slate-900 shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                 <Wallet className="size-6 text-primary" />
                 <Button variant="ghost" className="h-7 text-[10px] uppercase font-bold text-primary hover:bg-white/5" onClick={() => toast.info("Solicitação enviada ao financeiro")}>Solicitar Saque</Button>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Próximo pagamento previsto</p>
                <p className="font-editorial text-2xl font-bold text-white mt-1">
                  {totals.nextPayment ? formatDate(totals.nextPayment) : "—"}
                </p>
                <p className="text-[10px] text-white/40 mt-1">Saldo: {formatBRL(totals.pending)}</p>
              </div>
           </div>
        </div>

        {/* KPIs de carteira */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MiniKpi label="Indicados" value={clients.length} />
          <MiniKpi label="Ativos" value={totals.clientsActive} tone="emerald" />
          <MiniKpi label="Em negociação" value={totals.clientsNeg} tone="amber" />
          <MiniKpi label="Cancelados" value={totals.clientsCancelled} tone="rose" />
        </div>

        <Tabs defaultValue="clientes" className="space-y-10">
           <TabsList className="bg-transparent h-auto p-0 flex gap-12 border-b border-slate-200 rounded-none pb-px flex-wrap">
              <PremiumTabTrigger value="clientes" label="Carteira Indicada" count={clients.length} />
              <PremiumTabTrigger value="comissoes" label="Comissões" count={commissions.length} />
              <PremiumTabTrigger value="financeiro" label="Financeiro" />
              <PremiumTabTrigger value="contrato" label="Meu Contrato" count={contracts.length} />
           </TabsList>

           <TabsContent value="clientes" className="animate-fade-up">
              {clients.length === 0 ? (
                <div className="vx-card p-20 text-center border-dashed border-2">
                   <Users className="size-12 text-slate-300 mx-auto mb-4" />
                   <p className="font-editorial text-xl font-bold">Nenhuma indicação registrada</p>
                   <p className="text-muted-foreground text-sm mt-2">Suas indicações aparecerão aqui conforme o processamento.</p>
                </div>
              ) : (
                <div className="vx-card bg-white rounded-[32px] overflow-hidden border-slate-100 shadow-xl shadow-slate-200/20">
                   <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                         <thead>
                            <tr className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground bg-slate-50/50">
                               <th className="px-8 py-5 text-left">Cliente / Empresa</th>
                               <th className="px-8 py-5 text-left">Status</th>
                               <th className="px-8 py-5 text-right">LTV</th>
                               <th className="px-8 py-5 text-right">Desde</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50">
                            {clients.map((c: any) => {
                               const revenue = (c.sales ?? []).reduce((s: number, x: any) => s + Number(x.amount), 0);
                               return (
                                 <tr key={c.id} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 py-6">
                                       <div className="flex items-center gap-4">
                                          <div className="size-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-xs group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                             {initials(c.full_name)}
                                          </div>
                                          <div>
                                             <p className="font-bold text-slate-900">{c.full_name}</p>
                                             <p className="text-xs text-muted-foreground">{c.company || "Pessoa Física"}</p>
                                          </div>
                                       </div>
                                    </td>
                                    <td className="px-8 py-6">
                                       <span className="vx-pill vx-pill-muted uppercase tracking-widest text-[9px]">{c.status}</span>
                                    </td>
                                    <td className="px-8 py-6 text-right font-bold tabular-nums text-slate-900">{formatBRL(revenue)}</td>
                                    <td className="px-8 py-6 text-right text-xs text-muted-foreground">{formatDate(c.created_at)}</td>
                                 </tr>
                               );
                            })}
                         </tbody>
                      </table>
                   </div>
                </div>
              )}
           </TabsContent>

           <TabsContent value="comissoes" className="animate-fade-up space-y-6">
              <div className="bg-white/50 backdrop-blur-md p-6 rounded-3xl border border-white/40 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="bg-white border-slate-200 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="pago">Paga / Liberada</SelectItem>
                        <SelectItem value="cancelado">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cliente</Label>
                    <div className="relative mt-1">
                      <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input className="pl-9 bg-white border-slate-200" placeholder="Buscar..." value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">De</Label>
                    <Input type="date" className="bg-white border-slate-200 mt-1" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Até</Label>
                    <Input type="date" className="bg-white border-slate-200 mt-1" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </div>
                </div>
                <div className="flex items-center gap-6 justify-end">
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Pendentes</p>
                    <p className="text-lg font-bold text-amber-600">{formatBRL(totals.pending)}</p>
                  </div>
                  <div className="w-px h-8 bg-slate-200" />
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Recebido</p>
                    <p className="text-lg font-bold text-emerald-600">{formatBRL(totals.paid)}</p>
                  </div>
                </div>
              </div>

              <div className="vx-card bg-white rounded-[32px] overflow-hidden border-slate-100 shadow-xl shadow-slate-200/20">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                     <thead>
                        <tr className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground bg-slate-50/50">
                           <th className="px-8 py-5 text-left">Lançamento / Produto</th>
                           <th className="px-8 py-5 text-left">Cliente</th>
                           <th className="px-8 py-5 text-right">Venda Base</th>
                           <th className="px-8 py-5 text-right">Cálculo</th>
                           <th className="px-8 py-5 text-right">Sua Comissão</th>
                           <th className="px-8 py-5 text-center">Status</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {filteredSplits.length === 0 ? (
                          <tr><td colSpan={6} className="px-8 py-20 text-center">
                            <Inbox className="size-8 text-slate-200 mx-auto mb-3" />
                            <p className="text-muted-foreground font-medium">Nenhum registro encontrado para este filtro.</p>
                          </td></tr>
                        ) : filteredSplits.map((s: any) => (
                          <tr key={s.id} className="group hover:bg-slate-50/50 transition-colors">
                             <td className="px-8 py-6">
                                <p className="font-bold text-slate-900">{s.sales?.products?.name ?? "Serviço Especial"}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{formatDate(s.created_at)}</p>
                             </td>
                             <td className="px-8 py-6">
                                <p className="font-medium text-slate-700">{s.sales?.clients?.full_name ?? "—"}</p>
                             </td>
                             <td className="px-8 py-6 text-right font-medium text-slate-500 tabular-nums">
                                {formatBRL(s.sales?.amount || 0)}
                             </td>
                             <td className="px-8 py-6 text-right font-mono text-[10px] text-slate-400">
                                {Number(s.percent).toFixed(1)}% de {formatBRL(s.sales?.amount || 0)}
                             </td>
                             <td className="px-8 py-6 text-right font-bold tabular-nums text-slate-900">
                                {formatBRL(s.amount)}
                             </td>
                             <td className="px-8 py-6 text-center">
                                <span className={cn(
                                  "vx-pill uppercase tracking-widest text-[9px] min-w-[100px]",
                                  s.workflow_status === 'paga' && "vx-pill-success",
                                  ['aguardando_confirmacao', 'pendente', 'liberada', 'em_pagamento'].includes(s.workflow_status) && "vx-pill-warning",
                                  s.workflow_status === 'cancelada' && "vx-pill-muted text-destructive",
                                  s.workflow_status === 'estornada' && "vx-pill-muted",
                                )}>
                                  {String(s.workflow_status || 'aguardando_confirmacao').replace(/_/g, ' ')}
                                </span>

                             </td>
                          </tr>
                        ))}
                     </tbody>
                  </table>
                </div>
              </div>
           </TabsContent>

           {/* FINANCEIRO */}
           <TabsContent value="financeiro" className="animate-fade-up space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FinanceTile label="Saldo Pendente" value={formatBRL(totals.pending)} icon={Clock} tone="warning" />
                <FinanceTile label="Total Recebido" value={formatBRL(totals.paid)} icon={CheckCircle2} tone="success" />
                <FinanceTile label="Cancelado" value={formatBRL(totals.cancelled)} icon={XCircle} tone="muted" />
              </div>

              {/* Dados de pagamento */}
              <div className="vx-card p-8 bg-white rounded-[32px] border-slate-100">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Wallet className="size-5 text-primary" /> Dados de pagamento
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Row label="Comissão padrão" value={`${Number(partner.commission_percent).toFixed(1)}%`} />
                  <Row label="Recebido este mês" value={formatBRL(totals.thisMonth)} />
                  {partner.pix_key && <Row label="Chave PIX" value={partner.pix_key} />}
                  {partner.bank_name && <Row label="Banco" value={partner.bank_name} />}
                  {partner.bank_agency && <Row label="Agência" value={partner.bank_agency} />}
                  {partner.bank_account && <Row label="Conta" value={partner.bank_account} />}
                  {partner.document && <Row label="CPF/CNPJ" value={partner.document} />}
                </div>
              </div>

              {/* Histórico de pagamentos */}
              <div className="vx-card p-8 bg-white rounded-[32px] border-slate-100">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Calendar className="size-5 text-primary" /> Histórico de pagamentos
                </h3>
                {paidHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Você ainda não recebeu nenhum pagamento.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {paidHistory.map((s: any) => (
                      <div key={s.id} className="py-3 flex items-center justify-between text-sm">
                        <div>
                          <p className="font-bold text-slate-900">{s.sales?.clients?.full_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.sales?.products?.name || "Serviço"} · {s.payment_method || "—"} · {formatDate(s.paid_at || s.updated_at || s.created_at)}
                          </p>
                        </div>
                        <span className="font-bold text-emerald-600 tabular-nums">{formatBRL(s.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
           </TabsContent>

           {/* CONTRATO */}
           <TabsContent value="contrato" className="animate-fade-up">
              {contracts.length === 0 ? (
                <div className="vx-card p-20 text-center border-dashed border-2">
                  <FileText className="size-12 text-slate-300 mx-auto mb-4" />
                  <p className="font-editorial text-xl font-bold">Nenhum contrato disponível</p>
                  <p className="text-muted-foreground text-sm mt-2">Quando seu contrato de parceria estiver pronto ele aparecerá aqui.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {contracts.map((c: any) => (
                    <div key={c.id} className="vx-card p-6 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <FileText className="size-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold truncate">{c.name}</p>
                          <div className="flex gap-2 items-center text-xs text-muted-foreground mt-1">
                            <Badge variant="outline" className="text-[9px]">{c.status}</Badge>
                            <span>·</span>
                            <span>{formatDate(c.created_at)}</span>
                            {c.amount && <><span>·</span><span className="font-bold">{formatBRL(c.amount)}</span></>}
                          </div>
                        </div>
                      </div>
                      {c.file_path && (
                        <Button onClick={() => handleDownloadContract(c.file_path, c.name)}>
                          <Download className="size-4 mr-2" /> Baixar
                        </Button>
                      )}
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

function FinanceTile({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: string }) {
  const tones: any = {
    warning: "bg-amber-500/10 text-amber-600",
    success: "bg-emerald-500/10 text-emerald-600",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <div className="vx-card p-6 bg-white rounded-[28px] border-slate-100">
      <div className={cn("size-10 rounded-2xl flex items-center justify-center mb-3", tones[tone])}>
        <Icon className="size-5" />
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

function MiniKpi({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "amber" | "rose" }) {
  const tones: any = {
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
  };
  return (
    <div className="vx-card p-4 bg-white rounded-2xl border-slate-100">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-bold mt-1 tabular-nums", tone ? tones[tone] : "text-slate-900")}>{value}</p>
    </div>
  );
}

function PartnerStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="space-y-2">
       <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30">{label}</p>
       <p className={cn(
         "font-editorial text-4xl lg:text-6xl font-bold tracking-tight",
         highlight ? "text-primary" : "text-white"
       )}>{value}</p>
    </div>
  );
}

function SimpleKpi({ label, value, tone, icon: Icon }: { label: string; value: string; tone: string; icon: any }) {
  const tones = {
     success: "bg-emerald-500/10 text-emerald-600 border-emerald-100",
     warning: "bg-amber-500/10 text-amber-600 border-amber-100",
     info: "bg-primary/5 text-primary border-primary/10",
     primary: "bg-slate-900 text-white border-slate-900",
  } as any;
  
  return (
     <div className="vx-card p-6 bg-white rounded-[28px] border-slate-100 shadow-lg shadow-slate-200/20 group hover:shadow-xl transition-all">
        <div className="flex items-center justify-between mb-4">
           <div className={cn("size-10 rounded-2xl flex items-center justify-center", tones[tone])}>
              <Icon className="size-5" />
           </div>
           <ArrowUpRight className="size-4 text-slate-200 group-hover:text-primary transition-colors" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        <p className="font-editorial text-2xl font-bold text-slate-900 mt-1">{value}</p>
     </div>
  );
}

function PremiumTabTrigger({ value, label, count }: { value: string; label: string; count?: number }) {
  return (
    <TabsTrigger 
      value={value} 
      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-none rounded-none p-0 pb-4 text-[13px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 transition-all relative group h-auto"
    >
      <div className="flex items-center gap-2">
        {label}
        {count !== undefined && (
          <span className="size-5 rounded-full bg-slate-100 text-[10px] flex items-center justify-center text-slate-500 group-data-[state=active]:bg-primary group-data-[state=active]:text-white transition-colors">
            {count}
          </span>
        )}
      </div>
      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary scale-x-0 data-[state=active]:scale-x-100 transition-transform origin-left" />
    </TabsTrigger>
  );
}
