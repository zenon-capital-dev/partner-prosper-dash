import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Briefcase, FileText, Wallet, UserCog, Inbox, CheckCircle2,
  AlertCircle, Calendar, HelpCircle,
} from "lucide-react";
import { PanelShell } from "@/components/panels/PanelShell";
import { PanelHero } from "@/components/panels/PanelHero";
import { PanelContainer } from "@/components/panels/PanelContainer";
import { SectionCard, EmptyState } from "@/components/panels/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV = [
  { key: "dashboard",  label: "Início",     icon: LayoutDashboard },
  { key: "servicos",   label: "Serviços",   icon: Briefcase },
  { key: "documentos", label: "Documentos", icon: FileText, shortLabel: "Docs" },
  { key: "pagamentos", label: "Pagamentos", icon: Wallet, shortLabel: "Pagar" },
  { key: "perfil",     label: "Perfil",     icon: UserCog },
  { key: "suporte",    label: "Suporte",    icon: HelpCircle },
];

const STATUS_META: Record<string, { label: string; tone: string }> = {
  aguardando_inicio: { label: "Aguardando início", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  em_andamento:      { label: "Em andamento", tone: "bg-sky-50 text-sky-700 border-sky-200" },
  em_execucao:       { label: "Em execução", tone: "bg-sky-50 text-sky-700 border-sky-200" },
  pausado:           { label: "Pausada", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  concluida:         { label: "Concluída", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  concluido:         { label: "Concluída", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelada:         { label: "Cancelada", tone: "bg-rose-50 text-rose-700 border-rose-200" },
};

const DOC_TONE: Record<string, string> = {
  solicitado: "bg-amber-50 text-amber-700 border-amber-200",
  enviado: "bg-sky-50 text-sky-700 border-sky-200",
  em_analise: "bg-indigo-50 text-indigo-700 border-indigo-200",
  aprovado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  reprovado: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function ClientPanel() {
  const { user, signOut } = useAuth() as any;
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeKey = NAV.find((n) => n.key === tab)?.key ?? "dashboard";
  const onNavigate = (k: string) => navigate(k === "dashboard" ? "/portal-cliente" : `/portal-cliente/${k}`);

  const { data: client } = useQuery({
    queryKey: ["client-self", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const clientId = client?.id;

  const { data: demandas = [] } = useQuery({
    queryKey: ["client-demandas", clientId],
    enabled: !!clientId,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchInterval: 45_000,
    queryFn: async () => {
      const { data } = await supabase.from("client_products")
        .select("id, status, value, deadline, sla_due_date, created_at, custom_product_name, products(name, description)")
        .eq("client_id", clientId!).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["client-docs", clientId],
    enabled: !!clientId,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchInterval: 30_000,
    queryFn: async () => {
      // Read from both legacy (client_document_requests) and the main documents table
      // used by the admin "Solicitar Documento" flow.
      const [{ data: cdr }, { data: docsTable }] = await Promise.all([
        supabase.from("client_document_requests")
          .select("id, title, description, status, due_date, file_url, created_at, updated_at, reviewed_at")
          .eq("client_id", clientId!),
        supabase.from("documents")
          .select("id, name, description, status, due_date, file_path, created_at, updated_at, reviewed_at")
          .eq("client_id", clientId!),
      ]);
      const normalized = [
        ...((cdr ?? []) as any[]).map((d) => ({ ...d, _source: "cdr" })),
        ...((docsTable ?? []) as any[]).map((d: any) => ({
          id: d.id,
          title: d.name,
          description: d.description,
          status: d.status,
          due_date: d.due_date,
          file_url: d.file_path,
          created_at: d.created_at,
          updated_at: d.updated_at,
          reviewed_at: d.reviewed_at,
          _source: "documents",
        })),
      ];
      normalized.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      return normalized;
    },
  });


  const { data: payments = [] } = useQuery({
    queryKey: ["client-payments", clientId],
    enabled: !!clientId,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("payments")
        .select("id, amount, status, due_date, paid_at, description, created_at")
        .eq("client_id", clientId!).order("due_date", { ascending: false });
      return data ?? [];
    },
  });


  const kpis = useMemo(() => {
    const active = (demandas as any[]).filter((d) => !["concluida","concluido","cancelada"].includes(d.status)).length;
    const docsPend = (docs as any[]).filter((d) => d.status === "solicitado" || d.status === "reprovado").length;
    const totalPaid = (payments as any[]).filter((p) => p.status === "pago").reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalDue = (payments as any[]).filter((p) => p.status !== "pago" && p.status !== "cancelado").reduce((s, p) => s + Number(p.amount || 0), 0);
    return { active, docsPend, totalPaid, totalDue };
  }, [demandas, docs, payments]);

  const firstName = (client?.full_name || user?.user_metadata?.full_name || user?.email || "Cliente").split(" ")[0];

  if (!client) {
    return (
      <PanelShell role="cliente" nav={NAV} activeKey={activeKey} onNavigate={onNavigate}>
        <PanelContainer>
          <SectionCard title=""><EmptyState icon={Inbox} title="Conta em ativação" description="Sua conta ainda não foi vinculada a um cadastro de cliente. Entre em contato com nosso time." /></SectionCard>
        </PanelContainer>
      </PanelShell>
    );
  }

  return (
    <PanelShell role="cliente" nav={NAV} activeKey={activeKey} onNavigate={onNavigate} userName={client.full_name} userSubtitle={client.email} notifCount={kpis.docsPend}>
      <PanelContainer>
        {activeKey === "dashboard" && (
          <>
            <PanelHero
              role="cliente"
              eyebrow="Portal do cliente"
              title={<>Olá, {firstName} 👋</>}
              subtitle="Acompanhe seus serviços e documentos em um só lugar."
              stats={[
                { label: "Serviços ativos", value: kpis.active },
                { label: "Docs pendentes", value: kpis.docsPend, sub: kpis.docsPend ? "ação necessária" : "tudo enviado" },
                { label: "Faturas", value: payments.length },
                { label: "Pendentes", value: (payments as any[]).filter((p) => p.status !== "pago").length },
              ]}
            />


            <div className="grid lg:grid-cols-3 gap-5">
              <SectionCard className="lg:col-span-2" title="Seus serviços" icon={Briefcase} action={<Button size="sm" variant="outline" onClick={() => onNavigate("servicos")}>Ver todos</Button>}>
                {demandas.length === 0 ? <EmptyState icon={Inbox} title="Nenhum serviço contratado" /> :
                  <ul className="divide-y divide-slate-100 -mx-1">
                    {(demandas as any[]).slice(0, 5).map((d) => (
                      <li key={d.id} className="px-3 py-3">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <p className="text-[13.5px] font-medium text-slate-900 truncate">{d.products?.name || d.custom_product_name || "—"}</p>
                          <Badge variant="outline" className={cn("text-[10px] border", STATUS_META[d.status]?.tone || "bg-slate-100")}>{STATUS_META[d.status]?.label || d.status}</Badge>
                        </div>
                        <p className="text-[11.5px] text-slate-500">Iniciado em {formatDate(d.created_at)}{d.sla_due_date ? ` · prazo ${formatDate(d.sla_due_date)}` : ""}</p>
                      </li>
                    ))}
                  </ul>}
              </SectionCard>

              <SectionCard title="Documentos pendentes" icon={FileText}>
                {(docs as any[]).filter((d) => d.status === "solicitado" || d.status === "reprovado").length === 0 ?
                  <EmptyState icon={CheckCircle2} title="Tudo em dia" /> :
                  <ul className="divide-y divide-slate-100 -mx-1">
                    {(docs as any[]).filter((d) => d.status === "solicitado" || d.status === "reprovado").slice(0, 5).map((d) => (
                      <li key={d.id} className="px-3 py-2.5">
                        <p className="text-[13px] font-medium text-slate-900 truncate">{d.title}</p>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className="text-[11px] text-slate-500">{d.due_date ? `vence ${formatDate(d.due_date)}` : "sem prazo"}</p>
                          <Badge variant="outline" className={cn("text-[10px] border capitalize", DOC_TONE[d.status])}>{d.status}</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>}
              </SectionCard>
            </div>
          </>
        )}

        {activeKey === "servicos" && (
          <>
            <PanelHero role="cliente" eyebrow="Atendimentos" title="Meus serviços" subtitle={`${demandas.length} serviço(s) no total.`} />
            {demandas.length === 0 ? <SectionCard title=""><EmptyState icon={Briefcase} title="Sem serviços contratados" /></SectionCard> :
              <div className="grid sm:grid-cols-2 gap-3">
                {(demandas as any[]).map((d) => (
                  <div key={d.id} className="bg-white rounded-xl border border-slate-200/70 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge variant="outline" className={cn("text-[10px] border", STATUS_META[d.status]?.tone || "bg-slate-100")}>{STATUS_META[d.status]?.label || d.status}</Badge>
                    </div>

                    <p className="text-[14.5px] font-semibold text-slate-900 leading-tight">{d.products?.name || d.custom_product_name || "—"}</p>
                    {d.products?.description && <p className="text-[12px] text-slate-500 mt-1 line-clamp-2">{d.products.description}</p>}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11.5px] text-slate-500">
                      <span><Calendar className="size-3 inline mr-1" />Início: {formatDate(d.created_at)}</span>
                      {d.sla_due_date && <span className={cn(new Date(d.sla_due_date) < new Date() ? "text-rose-600" : "text-slate-600")}>Prazo: {formatDate(d.sla_due_date)}</span>}
                    </div>
                  </div>
                ))}
              </div>}
          </>
        )}

        {activeKey === "documentos" && (
          <>
            <PanelHero role="cliente" eyebrow="Documentos" title="Meus documentos" subtitle={`${docs.length} documento(s) · ${kpis.docsPend} pendente(s)`} />
            <SectionCard title="">
              {docs.length === 0 ? <EmptyState icon={FileText} title="Sem documentos solicitados" /> :
                <ul className="divide-y divide-slate-100 -mx-1">
                  {(docs as any[]).map((d) => (
                    <li key={d.id} className="px-3 py-3">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <p className="text-[13.5px] font-medium text-slate-900 truncate">{d.title}</p>
                        <Badge variant="outline" className={cn("text-[10px] border capitalize", DOC_TONE[d.status] || "bg-slate-100")}>{d.status}</Badge>
                      </div>
                      {d.description && <p className="text-[12px] text-slate-500 line-clamp-2">{d.description}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-[11px] text-slate-400">{d.due_date ? `Vence em ${formatDate(d.due_date)}` : "Sem prazo"}</p>
                        {(d.status === "solicitado" || d.status === "reprovado") && (
                          <Button size="sm" className="bg-sky-600 hover:bg-sky-700 h-8 text-[11px]" onClick={() => onNavigate("documentos")}>
                            {d.status === "reprovado" ? "Reenviar" : "Enviar"}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>}
            </SectionCard>
          </>
        )}

        {activeKey === "pagamentos" && (
          <>
            <PanelHero role="cliente" eyebrow="Financeiro" title="Pagamentos" subtitle={`${payments.length} faturas`} stats={[
              { label: "Pago", value: formatBRL(kpis.totalPaid) },
              { label: "Em aberto", value: formatBRL(kpis.totalDue) },
              { label: "Faturas", value: payments.length },
              { label: "Pendentes", value: (payments as any[]).filter((p) => p.status !== "pago").length },
            ]} />
            <SectionCard title="">
              {payments.length === 0 ? <EmptyState icon={Wallet} title="Sem faturas" /> :
                <ul className="divide-y divide-slate-100 -mx-1">
                  {(payments as any[]).map((p) => {
                    const overdue = p.status !== "pago" && p.due_date && new Date(p.due_date) < new Date();
                    return (
                      <li key={p.id} className="flex items-center gap-3 px-3 py-3">
                        <div className={cn("size-10 rounded-md flex items-center justify-center shrink-0", p.status === "pago" ? "bg-emerald-50 text-emerald-700" : overdue ? "bg-rose-50 text-rose-700" : "bg-sky-50 text-sky-700")}>
                          {p.status === "pago" ? <CheckCircle2 className="size-5" /> : <AlertCircle className="size-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[14px] font-semibold text-slate-900 tabular-nums">{formatBRL(p.amount)}</p>
                          <p className="text-[11.5px] text-slate-500 truncate">{p.description || "Fatura"} · {p.paid_at ? `pago ${formatDate(p.paid_at)}` : `vence ${formatDate(p.due_date)}`}</p>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] border capitalize shrink-0", p.status === "pago" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : overdue ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200")}>{overdue ? "vencido" : p.status}</Badge>
                      </li>
                    );
                  })}
                </ul>}
            </SectionCard>
          </>
        )}

        {activeKey === "suporte" && (
          <>
            <PanelHero role="cliente" eyebrow="Atendimento" title="Suporte" subtitle="Estamos aqui para ajudar." />
            <SectionCard title="Fale conosco" icon={HelpCircle}>
              <p className="text-[13px] text-slate-600">Em caso de dúvidas sobre seu serviço, documentos ou pagamentos, entre em contato com nossa equipe.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => window.open("mailto:contato@empresa.com", "_blank")} className="bg-sky-600 hover:bg-sky-700">Enviar e-mail</Button>
                <Button variant="outline" onClick={() => navigate("/cliente/suporte")}>Central de ajuda</Button>
              </div>
            </SectionCard>
          </>
        )}

        {activeKey === "perfil" && (
          <>
            <PanelHero role="cliente" eyebrow="Perfil" title="Sua conta" subtitle={client.email} />
            <SectionCard title="Dados cadastrais" icon={UserCog}>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
                <div><dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Nome</dt><dd className="text-slate-900">{client.full_name}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">E-mail</dt><dd className="text-slate-900">{client.email}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Telefone</dt><dd className="text-slate-900">{client.phone || "—"}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Documento</dt><dd className="text-slate-900">{client.document || "—"}</dd></div>
              </dl>
              <Button variant="outline" className="mt-5 border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => signOut?.()}>Sair</Button>
            </SectionCard>
          </>
        )}
      </PanelContainer>
    </PanelShell>
  );
}
