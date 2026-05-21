import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Users, Wallet, FileText, UserCog, TrendingUp, CheckCircle2, Inbox, Clock,
} from "lucide-react";
import { PanelShell } from "@/components/panels/PanelShell";
import { PanelHero } from "@/components/panels/PanelHero";
import { PanelContainer } from "@/components/panels/PanelContainer";
import { SectionCard, EmptyState } from "@/components/panels/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL, formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV = [
  { key: "dashboard",  label: "Início",     icon: LayoutDashboard },
  { key: "clientes",   label: "Clientes",   icon: Users },
  { key: "comissoes",  label: "Comissões",  icon: Wallet, shortLabel: "Comissões" },
  { key: "extrato",    label: "Extrato",    icon: FileText },
  { key: "perfil",     label: "Perfil",     icon: UserCog },
];

const CLIENT_TONE: Record<string, string> = {
  ativo: "bg-emerald-50 text-emerald-700 border-emerald-200",
  prospecto: "bg-slate-100 text-slate-700 border-slate-200",
  inativo: "bg-slate-100 text-slate-500 border-slate-200",
};

export default function PartnerPanel() {
  const { user, signOut } = useAuth() as any;
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeKey = NAV.find((n) => n.key === tab)?.key ?? "dashboard";
  const onNavigate = (k: string) => navigate(k === "dashboard" ? "/parceiro" : `/parceiro/${k}`);

  const { data: partner } = useQuery({
    queryKey: ["partner-self", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      let { data } = await supabase.from("partners").select("*").eq("user_id", user!.id).maybeSingle();
      if (!data && user?.email) {
        const { data: be } = await supabase.from("partners").select("*").ilike("email", user.email).maybeSingle();
        data = be;
      }
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["partner-clients", partner?.id],
    enabled: !!partner?.id,
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name, email, phone, status, created_at").eq("partner_id", partner!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ["partner-commissions", partner?.id],
    enabled: !!partner?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("commissions")
        .select("id, amount, percent, status, workflow_status, paid_at, created_at, sale_id, clients(full_name), products(name)")
        .eq("partner_id", partner!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const kpis = useMemo(() => {
    const all = commissions as any[];
    const paid = all.filter((c) => c.status === "pago" || c.status === "paga" || c.workflow_status === "paga" || c.workflow_status === "liberada");
    const pending = all.filter((c) => !paid.includes(c) && c.status !== "cancelada");
    const totalPaid = paid.reduce((s, c) => s + Number(c.amount || 0), 0);
    const totalPending = pending.reduce((s, c) => s + Number(c.amount || 0), 0);

    const thisMonth = new Date(); const m = thisMonth.getMonth(); const y = thisMonth.getFullYear();
    const monthPaid = paid.filter((c) => { const d = c.paid_at ? new Date(c.paid_at) : new Date(c.created_at); return d.getMonth() === m && d.getFullYear() === y; })
      .reduce((s, c) => s + Number(c.amount || 0), 0);

    return {
      totalPaid, totalPending, monthPaid,
      clients: (clients as any[]).length,
      activeClients: (clients as any[]).filter((c) => c.status === "ativo").length,
    };
  }, [commissions, clients]);

  const firstName = (partner?.full_name || user?.user_metadata?.full_name || user?.email || "Parceiro").split(" ")[0];

  return (
    <PanelShell role="parceiro" nav={NAV} activeKey={activeKey} onNavigate={onNavigate} userName={partner?.full_name}>
      <PanelContainer>
        {activeKey === "dashboard" && (
          <>
            <PanelHero
              role="parceiro"
              eyebrow="Painel do parceiro"
              title={<>Olá, {firstName} 👋</>}
              subtitle="Veja seus clientes, comissões e desempenho em tempo real."
              stats={[
                { label: "Comissão neste mês", value: formatBRL(kpis.monthPaid) },
                { label: "Comissões pagas", value: formatBRL(kpis.totalPaid) },
                { label: "A receber", value: formatBRL(kpis.totalPending) },
                { label: "Clientes ativos", value: kpis.activeClients },
              ]}
            />
            <div className="grid lg:grid-cols-3 gap-5">
              <SectionCard className="lg:col-span-2" title="Últimos clientes" icon={Users}>
                {clients.length === 0 ? <EmptyState icon={Inbox} title="Nenhum cliente ainda" /> :
                  <ul className="divide-y divide-slate-100 -mx-1">
                    {(clients as any[]).slice(0, 6).map((c) => (
                      <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="size-9 rounded-full bg-violet-50 text-violet-700 flex items-center justify-center text-[11px] font-semibold">{initials(c.full_name)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-slate-900 truncate">{c.full_name}</p>
                          <p className="text-[11px] text-slate-500 truncate">desde {formatDate(c.created_at)}</p>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] border capitalize", CLIENT_TONE[c.status] || "bg-slate-100")}>{c.status}</Badge>
                      </li>
                    ))}
                  </ul>}
              </SectionCard>

              <SectionCard title="Comissões recentes" icon={Wallet}>
                {commissions.length === 0 ? <EmptyState icon={Clock} title="Sem comissões" /> :
                  <ul className="divide-y divide-slate-100 -mx-1">
                    {(commissions as any[]).slice(0, 5).map((c) => (
                      <li key={c.id} className="px-3 py-2.5">
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-[13px] font-semibold text-slate-900 tabular-nums">{formatBRL(c.amount)}</p>
                          <Badge variant="outline" className={cn("text-[10px] border capitalize", (c.status === "pago" || c.status === "paga") ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>{c.status}</Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">{c.clients?.full_name || "—"} · {c.products?.name || ""}</p>
                      </li>
                    ))}
                  </ul>}
              </SectionCard>
            </div>
          </>
        )}

        {activeKey === "clientes" && (
          <>
            <PanelHero role="parceiro" eyebrow="Carteira" title="Meus clientes" subtitle={`${clients.length} cliente(s) ativos sob sua parceria.`} />
            <SectionCard title="">
              {clients.length === 0 ? <EmptyState icon={Users} title="Sem clientes" /> :
                <ul className="divide-y divide-slate-100 -mx-1">
                  {(clients as any[]).map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-3 py-3">
                      <div className="size-10 rounded-full bg-violet-50 text-violet-700 flex items-center justify-center text-[12px] font-semibold">{initials(c.full_name)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium text-slate-900 truncate">{c.full_name}</p>
                        <p className="text-[11.5px] text-slate-500 truncate">{c.email || c.phone || ""}</p>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] border capitalize", CLIENT_TONE[c.status] || "bg-slate-100")}>{c.status}</Badge>
                    </li>
                  ))}
                </ul>}
            </SectionCard>
          </>
        )}

        {activeKey === "comissoes" && (
          <>
            <PanelHero role="parceiro" eyebrow="Financeiro" title="Comissões" subtitle="Histórico completo das suas comissões." stats={[
              { label: "Pagas", value: formatBRL(kpis.totalPaid) },
              { label: "Pendentes", value: formatBRL(kpis.totalPending) },
              { label: "Total", value: commissions.length },
              { label: "Mês atual", value: formatBRL(kpis.monthPaid) },
            ]} />
            <SectionCard title="">
              {commissions.length === 0 ? <EmptyState icon={Wallet} title="Sem comissões" /> :
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-100">
                        <th className="px-3 py-2.5">Cliente</th><th className="px-3 py-2.5">Produto</th><th className="px-3 py-2.5 text-right">Valor</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(commissions as any[]).map((c) => (
                        <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                          <td className="px-3 py-2.5 text-slate-900 font-medium">{c.clients?.full_name || "—"}</td>
                          <td className="px-3 py-2.5 text-slate-600">{c.products?.name || "—"}</td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold">{formatBRL(c.amount)}</td>
                          <td className="px-3 py-2.5"><Badge variant="outline" className={cn("text-[10px] border capitalize", (c.status === "pago" || c.status === "paga") ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>{c.status}</Badge></td>
                          <td className="px-3 py-2.5 text-slate-500">{formatDate(c.paid_at || c.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>}
            </SectionCard>
          </>
        )}

        {activeKey === "extrato" && (
          <>
            <PanelHero role="parceiro" eyebrow="Atividade" title="Extrato" subtitle="Linha do tempo das suas comissões." />
            <SectionCard title="">
              {commissions.length === 0 ? <EmptyState icon={FileText} title="Sem movimentações" /> :
                <ol className="relative border-l border-slate-200 ml-4 space-y-4 py-2">
                  {(commissions as any[]).map((c) => {
                    const paid = c.status === "pago" || c.status === "paga";
                    return (
                      <li key={c.id} className="pl-5 relative">
                        <span className={cn("absolute -left-[6px] top-1.5 size-3 rounded-full ring-4", paid ? "bg-emerald-500 ring-emerald-50" : "bg-amber-500 ring-amber-50")} />
                        <div className="flex flex-wrap items-baseline gap-x-3">
                          <p className="text-[13px] font-medium text-slate-900">{formatBRL(c.amount)} · {c.clients?.full_name || "—"}</p>
                          <p className="text-[11.5px] text-slate-500">{formatDate(c.paid_at || c.created_at)}</p>
                        </div>
                        <p className="text-[11.5px] text-slate-500 capitalize">{paid ? "Comissão paga" : "Aguardando pagamento"} · {c.products?.name || ""}</p>
                      </li>
                    );
                  })}
                </ol>}
            </SectionCard>
          </>
        )}

        {activeKey === "perfil" && (
          <>
            <PanelHero role="parceiro" eyebrow="Perfil" title="Sua conta" subtitle={user?.email} />
            <SectionCard title="Dados" icon={UserCog}>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
                <div><dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Nome</dt><dd className="text-slate-900">{partner?.full_name || "—"}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">E-mail</dt><dd className="text-slate-900">{partner?.email || user?.email}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Telefone</dt><dd className="text-slate-900">{partner?.phone || "—"}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Documento</dt><dd className="text-slate-900">{partner?.document_number || "—"}</dd></div>
              </dl>
              <Button variant="outline" className="mt-5 border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => signOut?.()}>Sair</Button>
            </SectionCard>
          </>
        )}
      </PanelContainer>
    </PanelShell>
  );
}
