import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Users, Wallet, CheckCircle2, TrendingUp, Clock, Inbox,
  ArrowUpRight, Mail, Phone, Building2,
} from "lucide-react";
import { formatBRL, formatDate, initials, formatPhone } from "@/lib/format";

export default function PartnerPanel() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["partner-panel", user?.id],
    queryFn: async () => {
      const { data: partner } = await supabase
        .from("partners")
        .select("id, full_name, email, phone, commission_percent, pix_key, partner_type, active")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!partner) return null;

      const [clients, splits] = await Promise.all([
        supabase
          .from("clients")
          .select("id, full_name, company, email, phone, status, created_at, sales(amount, sale_date, status)")
          .eq("partner_id", partner.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("commission_splits")
          .select("*, sales(sale_date, clients(full_name), products(name))")
          .eq("beneficiary_type", "partner")
          .eq("beneficiary_id", partner.id)
          .order("created_at", { ascending: false }),
      ]);

      return {
        partner,
        clients: clients.data ?? [],
        splits: splits.data ?? [],
      };
    },
    enabled: !!user,
  });

  const totals = useMemo(() => {
    if (!data) return { total: 0, paid: 0, pending: 0, thisMonth: 0 };
    const splits = data.splits;
    const total = splits.reduce((s, x: any) => s + Number(x.amount), 0);
    const paid = splits.filter((x: any) => x.status === "pago").reduce((s, x: any) => s + Number(x.amount), 0);
    const pending = splits.filter((x: any) => x.status === "pendente").reduce((s, x: any) => s + Number(x.amount), 0);
    const now = new Date();
    const thisMonth = splits.filter((x: any) => {
      const d = new Date(x.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((s, x: any) => s + Number(x.amount), 0);
    return { total, paid, pending, thisMonth };
  }, [data]);

  if (isLoading) return <div className="p-12 text-center text-sm text-muted-foreground">Carregando…</div>;

  if (!data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="vx-card p-10 max-w-md text-center">
          <Inbox className="size-10 text-muted-foreground/50 mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold">Cadastro pendente</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Sua conta ainda não foi vinculada como parceiro. Entre em contato com o administrador.
          </p>
        </div>
      </div>
    );
  }

  const { partner, clients, splits } = data;

  return (
    <div className="page-shell space-y-7">
      {/* Header */}
      <div className="vx-card p-6 lg:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-xl">
            {initials(partner.full_name)}
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {partner.partner_type === "colaborador" ? "Colaborador" : "Parceiro"}
            </p>
            <h1 className="font-display text-[28px] font-bold tracking-tight leading-tight">{partner.full_name}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>Comissão padrão: <strong className="text-foreground">{Number(partner.commission_percent).toFixed(1)}%</strong></span>
              {partner.email && <span className="flex items-center gap-1"><Mail className="size-3" /> {partner.email}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI icon={Users} label="Indicações" value={String(clients.length)} tone="primary" />
        <KPI icon={TrendingUp} label="Mês atual" value={formatBRL(totals.thisMonth)} tone="info" />
        <KPI icon={Clock} label="A receber" value={formatBRL(totals.pending)} tone="warning" />
        <KPI icon={CheckCircle2} label="Já recebido" value={formatBRL(totals.paid)} tone="success" />
      </div>

      <Tabs defaultValue="clientes" className="space-y-5">
        <TabsList className="h-11 p-1">
          <TabsTrigger value="clientes" className="h-9 gap-2 text-[13px] font-semibold">
            <Users className="size-4" /> Meus Clientes
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{clients.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="comissoes" className="h-9 gap-2 text-[13px] font-semibold">
            <Wallet className="size-4" /> Comissões
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{splits.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* CLIENTES */}
        <TabsContent value="clientes">
          {clients.length === 0 ? (
            <Empty icon={Users} title="Nenhum cliente indicado ainda" desc="Quando você indicar clientes, eles aparecerão aqui com todo o histórico." />
          ) : (
            <div className="vx-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 text-left font-semibold">Cliente</th>
                    <th className="px-5 py-3 text-left font-semibold">Contato</th>
                    <th className="px-5 py-3 text-right font-semibold">Vendas</th>
                    <th className="px-5 py-3 text-right font-semibold">Receita</th>
                    <th className="px-5 py-3 text-left font-semibold">Status</th>
                    <th className="px-5 py-3 text-left font-semibold">Desde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {clients.map((c: any) => {
                    const sales = c.sales ?? [];
                    const revenue = sales.reduce((s: number, x: any) => s + Number(x.amount), 0);
                    return (
                      <tr key={c.id} className="hover:bg-muted/30">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                              {initials(c.full_name)}
                            </div>
                            <div>
                              <p className="font-medium">{c.full_name}</p>
                              {c.company && <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Building2 className="size-2.5" /> {c.company}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-muted-foreground">
                          {c.email && <div className="flex items-center gap-1"><Mail className="size-2.5" /> {c.email}</div>}
                          {c.phone && <div className="flex items-center gap-1 mt-0.5"><Phone className="size-2.5" /> {formatPhone(c.phone)}</div>}
                        </td>
                        <td className="px-5 py-3.5 text-right vx-mono font-semibold">{sales.length}</td>
                        <td className="px-5 py-3.5 text-right vx-mono font-semibold">{formatBRL(revenue)}</td>
                        <td className="px-5 py-3.5"><span className="vx-pill vx-pill-muted">{c.status}</span></td>
                        <td className="px-5 py-3.5 text-xs text-muted-foreground">{formatDate(c.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* COMISSÕES */}
        <TabsContent value="comissoes">
          {splits.length === 0 ? (
            <Empty icon={Wallet} title="Sem comissões" desc="Cada venda atribuída a você gera uma comissão automática." />
          ) : (
            <div className="vx-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 text-left font-semibold">Data</th>
                    <th className="px-5 py-3 text-left font-semibold">Cliente</th>
                    <th className="px-5 py-3 text-left font-semibold">Produto</th>
                    <th className="px-5 py-3 text-right font-semibold">%</th>
                    <th className="px-5 py-3 text-right font-semibold">Valor</th>
                    <th className="px-5 py-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {splits.map((c: any) => (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">{formatDate(c.sales?.sale_date ?? c.created_at)}</td>
                      <td className="px-5 py-3.5 font-medium">{c.sales?.clients?.full_name ?? "—"}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{c.sales?.products?.name ?? "—"}</td>
                      <td className="px-5 py-3.5 text-right vx-mono">{Number(c.percent).toFixed(1)}%</td>
                      <td className="px-5 py-3.5 text-right vx-mono font-semibold text-success">{formatBRL(c.amount)}</td>
                      <td className="px-5 py-3.5">
                        <span className={`vx-pill ${c.status === "pago" ? "vx-pill-success" : c.status === "cancelado" ? "vx-pill-danger" : "vx-pill-warning"}`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KPI({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: "primary" | "info" | "warning" | "success" }) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    info: "bg-info/10 text-info",
    warning: "bg-warning/10 text-warning",
    success: "bg-success/10 text-success",
  };
  return (
    <div className="vx-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className={`size-10 rounded-xl flex items-center justify-center ${toneMap[tone]}`}>
          <Icon className="size-5" strokeWidth={1.8} />
        </span>
        <ArrowUpRight className="size-4 text-muted-foreground/40" />
      </div>
      <p className="vx-kpi-label">{label}</p>
      <p className="vx-kpi-value mt-1.5">{value}</p>
    </div>
  );
}

function Empty({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="vx-card py-16 text-center">
      <Icon className="size-10 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
    </div>
  );
}
