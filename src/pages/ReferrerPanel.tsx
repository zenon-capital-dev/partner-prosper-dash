import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Users, History, UserCog, TrendingUp, Award, Inbox,
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
  { key: "indicacoes", label: "Indicações", icon: Users,           shortLabel: "Indicações" },
  { key: "ganhos",     label: "Ganhos",     icon: TrendingUp },
  { key: "historico",  label: "Histórico",  icon: History,         shortLabel: "Histórico" },
  { key: "perfil",     label: "Perfil",     icon: UserCog },
];

const STATUS_TONE: Record<string, string> = {
  ativo: "bg-emerald-50 text-emerald-700 border-emerald-200",
  prospecto: "bg-slate-100 text-slate-700 border-slate-200",
  inativo: "bg-slate-100 text-slate-500 border-slate-200",
};

export default function ReferrerPanel() {
  const { user, signOut } = useAuth() as any;
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeKey = NAV.find((n) => n.key === tab)?.key ?? "dashboard";
  const onNavigate = (k: string) => navigate(k === "dashboard" ? "/indicador" : `/indicador/${k}`);

  const { data: referrer } = useQuery({
    queryKey: ["referrer-self", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      let { data } = await supabase.from("referrers").select("*").eq("user_id", user!.id).maybeSingle();
      if (!data && user?.email) {
        const { data: be } = await supabase.from("referrers").select("*").ilike("email", user.email).maybeSingle();
        data = be;
      }
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["referrer-clients", referrer?.id],
    enabled: !!referrer?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, email, phone, status, created_at")
        .or(`referrer_id.eq.${referrer!.id},indicator_id.eq.${referrer!.id}`)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const clientIds = useMemo(() => (clients as any[]).map((c) => c.id), [clients]);
  const { data: commissions = [] } = useQuery({
    queryKey: ["referrer-commissions", referrer?.id, user?.id],
    enabled: !!(referrer?.id || user?.id),
    queryFn: async () => {
      const ids = [referrer?.id, user?.id].filter(Boolean) as string[];
      const { data } = await supabase
        .from("commission_splits")
        .select("id, amount, percent, status, paid_at, created_at, sale_id, sales(clients(full_name), products(name))")
        .eq("beneficiary_type", "referrer")
        .in("beneficiary_id", ids)
        .order("created_at", { ascending: false });
      return (data ?? []).map((c: any) => ({
        ...c,
        client_name: c.sales?.clients?.full_name,
        product_name: c.sales?.products?.name,
      }));
    },
  });

  const payments = commissions;

  const kpis = useMemo(() => {
    const total = (clients as any[]).length;
    const ativos = (clients as any[]).filter((c) => c.status === "ativo").length;
    const conv = total > 0 ? Math.round((ativos / total) * 100) : 0;
    const ganhos = (commissions as any[]).filter((p) => p.status === "pago").reduce((s, p) => s + Number(p.amount || 0), 0);
    const pendentes = (commissions as any[]).filter((p) => p.status === "pendente").reduce((s, p) => s + Number(p.amount || 0), 0);
    return { total, ativos, conv, ganhos, pendentes };
  }, [clients, commissions]);

  const firstName = (referrer?.full_name || user?.user_metadata?.full_name || user?.email || "Indicador").split(" ")[0];

  return (
    <PanelShell role="indicador" nav={NAV} activeKey={activeKey} onNavigate={onNavigate} userName={referrer?.full_name}>
      <PanelContainer>
        {activeKey === "dashboard" && (
          <>
            <PanelHero
              role="indicador"
              eyebrow="Painel do indicador"
              title={<>Olá, {firstName} ✨</>}
              subtitle="Acompanhe suas indicações, conversões e ganhos em tempo real."
              stats={[
                { label: "Indicações", value: kpis.total },
                { label: "Ativos", value: kpis.ativos },
                { label: "Conversão", value: `${kpis.conv}%` },
                { label: "Ganhos pagos", value: formatBRL(kpis.ganhos) },
              ]}
            />
            <div className="grid lg:grid-cols-3 gap-5">
              <SectionCard className="lg:col-span-2" title="Últimas indicações" icon={Users}>
                {clients.length === 0 ? <EmptyState icon={Inbox} title="Nenhuma indicação ainda" description="Quando alguém que você indicou for cadastrado, aparece aqui." /> :
                  <ul className="divide-y divide-slate-100 -mx-1">
                    {(clients as any[]).slice(0, 6).map((c) => (
                      <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="size-9 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center text-[11px] font-semibold">{initials(c.full_name)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-slate-900 truncate">{c.full_name}</p>
                          <p className="text-[11px] text-slate-500 truncate">indicado em {formatDate(c.created_at)}</p>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] border capitalize", STATUS_TONE[c.status] || "bg-slate-100")}>{c.status}</Badge>
                      </li>
                    ))}
                  </ul>}
              </SectionCard>
              <SectionCard title="Ganhos" icon={Award}>
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Pendentes</p>
                    <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">{formatBRL(kpis.pendentes)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Pagos</p>
                    <p className="font-mono text-2xl font-semibold text-emerald-600 tabular-nums">{formatBRL(kpis.ganhos)}</p>
                  </div>
                </div>
              </SectionCard>
            </div>
          </>
        )}

        {activeKey === "indicacoes" && (
          <>
            <PanelHero role="indicador" eyebrow="Carteira" title="Minhas indicações" subtitle={`${clients.length} indicação(ões) no total.`} />
            <SectionCard title="">
              {clients.length === 0 ? <EmptyState icon={Users} title="Sem indicações" /> :
                <ul className="divide-y divide-slate-100 -mx-1">
                  {(clients as any[]).map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-3 py-3">
                      <div className="size-10 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center text-[12px] font-semibold">{initials(c.full_name)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium text-slate-900 truncate">{c.full_name}</p>
                        <p className="text-[11.5px] text-slate-500 truncate">{c.email || c.phone || ""}</p>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] border capitalize", STATUS_TONE[c.status] || "bg-slate-100")}>{c.status}</Badge>
                    </li>
                  ))}
                </ul>}
            </SectionCard>
          </>
        )}

        {activeKey === "ganhos" && (
          <>
            <PanelHero role="indicador" eyebrow="Financeiro" title="Seus ganhos" subtitle="Histórico de pagamentos vinculados às suas indicações." stats={[
              { label: "Total pago", value: formatBRL(kpis.ganhos) },
              { label: "A receber", value: formatBRL(kpis.pendentes) },
              { label: "Pagamentos", value: payments.length },
              { label: "Conversão", value: `${kpis.conv}%` },
            ]} />
            <SectionCard title="">
              {payments.length === 0 ? <EmptyState icon={TrendingUp} title="Sem pagamentos ainda" /> :
                <ul className="divide-y divide-slate-100 -mx-1">
                  {(payments as any[]).map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-3">
                      <div className="size-9 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center"><TrendingUp className="size-4" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-slate-900">{formatBRL(p.amount)}</p>
                        <p className="text-[11.5px] text-slate-500">{p.paid_at ? `pago em ${formatDate(p.paid_at)}` : `vence em ${formatDate(p.due_date)}`}</p>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] border capitalize", p.status === "pago" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>{p.status}</Badge>
                    </li>
                  ))}
                </ul>}
            </SectionCard>
          </>
        )}

        {activeKey === "historico" && (
          <>
            <PanelHero role="indicador" eyebrow="Atividade" title="Histórico" subtitle="Linha do tempo das suas indicações." />
            <SectionCard title="">
              {clients.length === 0 ? <EmptyState icon={History} title="Sem atividade" /> :
                <ol className="relative border-l border-slate-200 ml-4 space-y-4 py-2">
                  {(clients as any[]).map((c) => (
                    <li key={c.id} className="pl-5 relative">
                      <span className="absolute -left-[6px] top-1.5 size-3 rounded-full bg-amber-500 ring-4 ring-amber-50" />
                      <p className="text-[13px] font-medium text-slate-900">{c.full_name}</p>
                      <p className="text-[11.5px] text-slate-500">{formatDate(c.created_at)} · status {c.status}</p>
                    </li>
                  ))}
                </ol>}
            </SectionCard>
          </>
        )}

        {activeKey === "perfil" && (
          <>
            <PanelHero role="indicador" eyebrow="Perfil" title="Sua conta" subtitle={user?.email} />
            <SectionCard title="Dados" icon={UserCog}>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
                <div><dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Nome</dt><dd className="text-slate-900">{referrer?.full_name || "—"}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">E-mail</dt><dd className="text-slate-900">{referrer?.email || user?.email}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Telefone</dt><dd className="text-slate-900">{referrer?.phone || "—"}</dd></div>
              </dl>
              <Button variant="outline" className="mt-5 border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => signOut?.()}>Sair</Button>
            </SectionCard>
          </>
        )}
      </PanelContainer>
    </PanelShell>
  );
}
