import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { ReferralDialog } from "@/components/ReferralDialog";

const PARTNER_TABS = ["home", "clientes", "comissoes", "demandas", "contratos", "materiais", "perfil", "suporte"] as const;

export default function PartnerPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const activeTab = tabParam && (PARTNER_TABS as readonly string[]).includes(tabParam) ? tabParam : "home";
  const setActiveTab = (v: string) => navigate(v === "home" ? "/parceiro" : `/parceiro/${v}`);
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [referralOpen, setReferralOpen] = useState(false);
  const panelQueryKey = ["partner-panel", user?.id] as const;

  const { data, isLoading } = useQuery({
    queryKey: panelQueryKey,
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
      if (statusFilter !== "todos" && (s.workflow_status || s.status) !== statusFilter) return false;
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
        <section className="relative overflow-hidden rounded-[32px] bg-slate-900 p-8 lg:p-12 text-white group shadow-2xl border border-slate-800">
           <div className="absolute top-0 right-0 size-96 bg-primary/20 blur-[100px] -mt-48 -mr-48 rounded-full" />
           <div className="absolute bottom-0 left-0 size-64 bg-indigo-500/10 blur-[80px] -mb-32 -ml-32 rounded-full" />
           
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8 relative z-10">
              <div className="space-y-5">
                 <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10">
                   <div className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse" />
                   <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/90">Rede de Parceiros Prosper</span>
                 </div>
                  <h1 className="font-editorial text-[40px] lg:text-[56px] font-bold tracking-tight leading-[1.05] text-white">
                    Seus ganhos e <br/><span className="italic text-emerald-300 font-medium">indicações.</span>
                  </h1>
                 <div className="flex items-center gap-4 text-white/80 font-bold text-lg">
                   <span>{partner.full_name}</span>
                   <span className="size-1 bg-white/30 rounded-full" />
                   <span className="text-emerald-300">{Number(partner.commission_percent).toFixed(1)}% comissão ativa</span>
                 </div>
              </div>
               <div className="flex flex-col sm:flex-row gap-3">
                 <Button onClick={() => setReferralOpen(true)} className="w-full sm:w-auto rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold h-14 px-8 shadow-xl shadow-primary/20 text-base transition-all hover:scale-[1.02] active:scale-[0.98]">
                   <Share2 className="size-5 mr-2" /> Indicar Novo Cliente
                 </Button>
               </div>
            </div>
        </section>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-10">
           <TabsList className="bg-white/80 backdrop-blur-sm p-1.5 rounded-2xl border border-slate-200 shadow-sm h-14 inline-flex flex-wrap overflow-x-auto whitespace-nowrap">
              <TabsTrigger value="home" className="rounded-xl px-6 data-[state=active]:bg-slate-900 data-[state=active]:text-white shadow-sm font-bold transition-all">Dashboard</TabsTrigger>
              <TabsTrigger value="clientes" className="rounded-xl px-6 data-[state=active]:bg-slate-900 data-[state=active]:text-white shadow-sm font-bold transition-all">Indicados ({clients.length})</TabsTrigger>
              <TabsTrigger value="comissoes" className="rounded-xl px-6 data-[state=active]:bg-slate-900 data-[state=active]:text-white shadow-sm font-bold transition-all">Comissões ({commissions.length})</TabsTrigger>
              <TabsTrigger value="demandas" className="rounded-xl px-6 data-[state=active]:bg-slate-900 data-[state=active]:text-white shadow-sm font-bold transition-all">Demandas ({demands.length})</TabsTrigger>
              <TabsTrigger value="contratos" className="rounded-xl px-6 data-[state=active]:bg-slate-900 data-[state=active]:text-white shadow-sm font-bold transition-all">Documentos ({contracts.length})</TabsTrigger>
              <TabsTrigger value="materiais" className="rounded-xl px-6 data-[state=active]:bg-slate-900 data-[state=active]:text-white shadow-sm font-bold transition-all">Materiais</TabsTrigger>
              <TabsTrigger value="perfil" className="rounded-xl px-6 data-[state=active]:bg-slate-900 data-[state=active]:text-white shadow-sm font-bold transition-all">Dados Bancários</TabsTrigger>
              <TabsTrigger value="suporte" className="rounded-xl px-6 data-[state=active]:bg-slate-900 data-[state=active]:text-white shadow-sm font-bold transition-all">Suporte</TabsTrigger>
           </TabsList>

           <TabsContent value="home" className="animate-fade-up space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <KpiCard label="Saldo Disponível" value={formatBRL(totals.pending)} icon={Wallet} tone="info" description="Liberado após pagamento do cliente" />
                 <KpiCard label="Total Recebido" value={formatBRL(totals.paid)} icon={CheckCircle2} tone="success" description="Já creditado" />
                 <KpiCard label="Conversão" value={`${totals.conversionRate.toFixed(1)}%`} icon={TrendingUp} tone="warning" description="Eficiência de indicação" />
                 <KpiCard label="Pagamento" value={totals.nextPayment ? formatDate(totals.nextPayment) : "—"} icon={Calendar} description="Próxima data prevista" />
              </div>

              <div className="vx-card p-8 bg-slate-900 text-white rounded-[32px] relative overflow-hidden shadow-2xl border border-slate-800">
                <div className="absolute top-0 right-0 size-64 bg-primary/20 blur-[100px] -mr-32 -mt-32 rounded-full" />
                <div className="relative z-10 space-y-4">
                  <div className="space-y-2">
                    <h3 className="font-editorial text-[28px] font-bold text-white tracking-tight leading-tight">Como funciona a sua comissão</h3>
                    <p className="text-white/70 text-sm max-w-xl font-medium">
                      Toda comissão fica como <strong className="text-white">aguardando confirmação</strong> até que o cliente quite o pagamento. Assim que registrarmos a entrada, ela é automaticamente <strong className="text-emerald-400">liberada</strong> para repasse.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-4 border-t border-white/10">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 mb-1">Seu link de indicação</p>
                      <code className="text-xs text-white/80 font-mono break-all">{`${window.location.origin}/?ref=${partner.id.slice(0, 8).toUpperCase()}`}</code>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
                        onClick={() => {
                          const link = `${window.location.origin}/?ref=${partner.id.slice(0, 8).toUpperCase()}`;
                          navigator.clipboard.writeText(link);
                          toast.success("Link copiado");
                        }}
                      >
                        <Copy className="size-3 mr-1.5" /> Copiar
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-500 hover:bg-emerald-600 text-white"
                        onClick={() => {
                          const link = `${window.location.origin}/?ref=${partner.id.slice(0, 8).toUpperCase()}`;
                          const msg = encodeURIComponent(`Olá! Quero te indicar nossos serviços. Confira: ${link}`);
                          window.open(`https://wa.me/?text=${msg}`, "_blank");
                        }}
                      >
                        <Share2 className="size-3 mr-1.5" /> WhatsApp
                      </Button>
                    </div>
                  </div>
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
                      <div key={c.id} className="vx-card bg-white border border-slate-200/60 rounded-[24px] p-6 space-y-3 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">{initials(c.full_name)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 truncate">{c.full_name}</p>
                            <p className="text-xs text-slate-500 truncate">{c.company || c.email || "—"}</p>
                          </div>
                          <Badge variant="outline" className="text-[9px] font-bold text-slate-600 border-slate-200">{c.status}</Badge>
                        </div>
                        <div className="text-xs text-slate-500 font-medium">Produtos contratados: <strong className="text-slate-900">{cd.length}</strong></div>
                        {cd.slice(0, 3).map((d: any) => (
                          <div key={d.id} className="text-xs flex justify-between gap-2 border-t border-slate-100/80 pt-2">
                            <span className="truncate text-slate-700 font-medium">{d.products?.name || d.custom_product_name || "Produto"}</span>
                            <Badge variant="outline" className="text-[9px] font-bold text-slate-500 border-slate-100">{d.status}</Badge>
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
                      <tr className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-600 bg-slate-50/80 border-b border-slate-100">
                         <th className="px-8 py-4 text-left">Produto / Serviço</th>
                         <th className="px-8 py-4 text-left">Cliente Final</th>
                         <th className="px-8 py-4 text-right">Valor Comissão</th>
                         <th className="px-8 py-4 text-center">Status Repasse</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                      {filteredSplits.map((s: any) => (
                        <tr key={s.id} className="hover:bg-slate-50/30 transition-colors group">
                           <td className="px-8 py-5 font-semibold text-slate-900">{s.sales?.products?.name ?? "Venda Direta"}</td>
                           <td className="px-8 py-5 text-slate-700 font-medium">{s.sales?.clients?.full_name ?? "—"}</td>
                           <td className="px-8 py-5 text-right font-bold tabular-nums text-slate-900">{formatBRL(s.amount)}</td>
                           <td className="px-8 py-5 text-center"><CommissionStatusBadge status={s.workflow_status || 'pendente'} /></td>
                        </tr>
                      ))}
                      {filteredSplits.length === 0 && (
                        <tr><td colSpan={4} className="px-8 py-16 text-center text-sm text-slate-500 italic">Nenhuma comissão registrada até o momento.</td></tr>
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
                      <tr className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-600 bg-slate-50/80 border-b border-slate-100">
                        <th className="px-6 py-4 text-left">Cliente</th>
                        <th className="px-6 py-4 text-left">Produto / Demanda</th>
                        <th className="px-6 py-4 text-center">Etapa Atual</th>
                        <th className="px-6 py-4 text-center">SLA Interno</th>
                        <th className="px-6 py-4 text-left">Data Entrega</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {demands.map((d: any) => (
                        <tr key={d.id} className="hover:bg-slate-50/30 transition-colors">
                           <td className="px-6 py-5 font-semibold text-slate-900">{d.clients?.full_name ?? "—"}</td>
                           <td className="px-6 py-5 text-slate-700 font-medium">{d.products?.name || d.custom_product_name || "—"}</td>
                           <td className="px-6 py-5 text-center"><Badge variant="outline" className="text-[10px] font-bold text-slate-700 border-slate-200 bg-white">{d.status}</Badge></td>
                           <td className="px-6 py-5 text-center"><Badge variant="outline" className={cn("text-[10px] font-bold", d.sla_status === 'no_prazo' ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : d.sla_status === 'atrasado' ? 'text-rose-700 border-rose-200 bg-rose-50' : 'text-amber-700 border-amber-200 bg-amber-50')}>{d.sla_status || '—'}</Badge></td>
                           <td className="px-6 py-5 text-xs text-slate-600 font-medium">{d.deadline ? formatDate(d.deadline) : (d.sla_due_date ? formatDate(d.sla_due_date) : "—")}</td>
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
                    <div key={c.id} className="vx-card bg-white border border-slate-200/60 rounded-[24px] p-6 space-y-3 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-900">{c.name}</p>
                          <p className="text-xs text-slate-500 font-medium">{c.contract_type || c.contract_kind} · {formatDate(c.created_at)}</p>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-bold uppercase text-slate-600 border-slate-200">{c.status}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-500 text-xs font-medium">Valor</span>
                        <span className="font-bold tabular-nums text-slate-900">{c.amount ? formatBRL(c.amount) : "—"}</span>
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

            <TabsContent value="materiais" className="animate-fade-up space-y-4">
              <div className="vx-card bg-white rounded-[32px] p-16 text-center text-slate-600">
                <h3 className="font-editorial text-2xl font-bold text-slate-900 mb-2">Central de Materiais</h3>
                <p>Nesta área, você encontrará materiais de apoio, apresentações e templates para suas vendas.</p>
                <div className="mt-8 text-sm text-slate-400 italic">Em desenvolvimento.</div>
              </div>
            </TabsContent>

            <TabsContent value="perfil" className="animate-fade-up space-y-4">
              <div className="vx-card bg-white rounded-[32px] overflow-hidden border border-slate-100">
                <div className="p-8 border-b border-slate-100">
                   <h3 className="font-editorial text-2xl font-bold text-slate-900">Seus dados de recebimento</h3>
                   <p className="text-slate-500 text-sm mt-1">Mantenha seus dados atualizados para garantir os repasses das comissões.</p>
                </div>
                <div className="p-8 grid md:grid-cols-2 gap-8">
                   <div className="space-y-6">
                      <div className="space-y-1">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nome do Titular</p>
                         <p className="font-bold text-slate-900 text-lg">{partner.full_name}</p>
                      </div>
                      <div className="space-y-1">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">E-mail</p>
                         <p className="font-bold text-slate-900">{partner.email}</p>
                      </div>
                      <div className="space-y-1">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Documento</p>
                         <p className="font-bold text-slate-900">{partner.document || "—"}</p>
                      </div>
                   </div>
                   <div className="space-y-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                      <div className="space-y-1">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Chave PIX</p>
                         <p className="font-bold text-slate-900 text-lg">{partner.pix_key || "—"}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                           <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Banco</p>
                           <p className="font-bold text-slate-900 text-sm">{partner.bank_name || "—"}</p>
                        </div>
                        <div className="space-y-1">
                           <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Agência</p>
                           <p className="font-bold text-slate-900 text-sm">{partner.bank_agency || "—"}</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                         <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Conta</p>
                         <p className="font-bold text-slate-900 text-sm">{partner.bank_account || "—"}</p>
                      </div>
                   </div>
                </div>
                <div className="bg-slate-50 p-6 border-t border-slate-100 flex justify-end">
                   <Button variant="outline" className="rounded-xl" onClick={() => window.open(`https://wa.me/?text=Olá, gostaria de atualizar meus dados bancários no Portal do Parceiro.`, "_blank")}>
                      Solicitar Alteração
                   </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="suporte" className="animate-fade-up space-y-4">
              <div className="vx-card bg-white rounded-[32px] p-16 text-center text-slate-600">
                <h3 className="font-editorial text-2xl font-bold text-slate-900 mb-2">Suporte ao Parceiro</h3>
                <p>Precisa de ajuda com uma indicação ou comissão? Fale diretamente com nossa equipe.</p>
                <Button className="mt-8 rounded-xl bg-slate-900 text-white h-12 px-8 shadow-lg hover:bg-slate-800" onClick={() => window.open(`https://wa.me/?text=Olá, preciso de suporte no Portal do Parceiro.`, "_blank")}>
                   Falar com equipe
                </Button>
              </div>
            </TabsContent>
        </Tabs>
        <ReferralDialog open={referralOpen} onOpenChange={setReferralOpen} mode="partner" ownerId={partner.id} queryKey={panelQueryKey} />
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
  const tones: any = { 
    info: "text-blue-600 bg-blue-50 border-blue-100", 
    success: "text-emerald-600 bg-emerald-50 border-emerald-100", 
    warning: "text-amber-600 bg-amber-50 border-amber-100" 
  };
  return (
    <div className="vx-card p-6 bg-white border border-slate-200/80 rounded-[28px] shadow-sm hover:shadow-xl transition-all group hover:-translate-y-1 duration-300">
       <div className={cn("size-12 rounded-2xl flex items-center justify-center mb-4 border transition-transform group-hover:scale-110", tones[tone] || "text-slate-600 bg-slate-50 border-slate-100")}>
          <Icon className="size-6" />
       </div>
       <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1">{label}</p>
       <p className="text-3xl font-bold text-slate-900 tabular-nums">{value}</p>
       <p className="text-xs text-slate-600 font-medium mt-2 leading-relaxed">{description}</p>
    </div>
  );
}
