import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Briefcase, ClipboardCheck, FileText, UserCog, Inbox, Clock, Wallet, MessageSquare,
} from "lucide-react";
import { PanelShell } from "@/components/panels/PanelShell";
import { PanelHero } from "@/components/panels/PanelHero";
import { PanelContainer } from "@/components/panels/PanelContainer";
import { SectionCard, EmptyState } from "@/components/panels/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBRL, formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ReportStatusDialog } from "@/components/provider/ReportStatusDialog";
import { DemandRequestsPanel } from "@/components/demands/DemandRequestsPanel";
import { ClientDocumentsTab } from "@/components/client/ClientDocumentsTab";

const NAV = [
  { key: "dashboard",  label: "Início",     icon: LayoutDashboard },
  { key: "demandas",   label: "Demandas",   icon: Briefcase },
  { key: "reportes",   label: "Reportes",   icon: ClipboardCheck, shortLabel: "Reportes" },
  { key: "documentos", label: "Documentos", icon: FileText, shortLabel: "Docs" },
  { key: "comissoes",  label: "Comissões",  icon: Wallet, shortLabel: "Comissões" },
  { key: "perfil",     label: "Perfil",     icon: UserCog },
];

const STATUS_META: Record<string, { label: string; tone: string }> = {
  aguardando_inicio: { label: "Aguardando", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  em_andamento:      { label: "Em andamento", tone: "bg-teal-50 text-teal-700 border-teal-200" },
  em_execucao:       { label: "Em execução", tone: "bg-teal-50 text-teal-700 border-teal-200" },
  pausado:           { label: "Pausada", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  concluido:         { label: "Concluída", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  concluida:         { label: "Concluída", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelado:         { label: "Cancelada", tone: "bg-rose-50 text-rose-700 border-rose-200" },
};

export default function ProviderPanel() {
  const { user, signOut } = useAuth() as any;
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeKey = NAV.find((n) => n.key === tab)?.key ?? "dashboard";
  const onNavigate = (k: string) => navigate(k === "dashboard" ? "/prestador" : `/prestador/${k}`);
  const [reportTarget, setReportTarget] = useState<{ id: string; productName?: string; clientName?: string } | null>(null);
  const [requestsTarget, setRequestsTarget] = useState<{ id: string; clientName?: string } | null>(null);

  const { data: provider } = useQuery({
    queryKey: ["provider-self", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      let { data } = await supabase.from("service_providers").select("id, name, specialty, email, phone, document_number, user_id").eq("user_id", user!.id).maybeSingle();
      if (!data && user?.email) {
        const { data: be } = await supabase.from("service_providers").select("id, name, specialty, email, phone, document_number, user_id").ilike("email", user.email).maybeSingle();
        data = be;
      }
      return data;
    },
  });

  const providerId = provider?.id;

  const { data: clientProducts = [] } = useQuery({
    queryKey: ["provider-cp", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      // Demandas que ESTE prestador vê:
      //  1) service_provider_id = ele
      //  2) responsible_provider_id = ele
      //  3) demanda em client_product_providers (secundário)
      //  4) cliente vinculado a ele via client_providers E demanda SEM prestador atribuído
      //     (assim demandas novas do cliente caem automaticamente no painel dele)
      const [secLinksRes, clientLinksRes] = await Promise.all([
        supabase.from("client_product_providers").select("client_product_id").eq("service_provider_id", providerId!),
        supabase.from("client_providers").select("client_id").eq("service_provider_id", providerId!),
      ]);
      const secCpIds = (secLinksRes.data ?? []).map((l: any) => l.client_product_id);
      const linkedClientIds = (clientLinksRes.data ?? []).map((l: any) => l.client_id);

      const orParts: string[] = [
        `service_provider_id.eq.${providerId}`,
        `responsible_provider_id.eq.${providerId}`,
      ];
      if (secCpIds.length > 0) orParts.push(`id.in.(${secCpIds.join(",")})`);

      const { data: explicit } = await supabase
        .from("client_products")
        .select(`id, status, value, deadline, created_at, notes, priority, sla_due_date, client_id, service_provider_id,
                 clients(id, full_name, email, phone), products(name, description)`)
        .or(orParts.join(","))
        .order("created_at", { ascending: false });

      let fallback: any[] = [];
      if (linkedClientIds.length > 0) {
        const { data } = await supabase
          .from("client_products")
          .select(`id, status, value, deadline, created_at, notes, priority, sla_due_date, client_id, service_provider_id,
                   clients(id, full_name, email, phone), products(name, description)`)
          .in("client_id", linkedClientIds)
          .is("service_provider_id", null)
          .order("created_at", { ascending: false });
        fallback = data ?? [];
      }

      const map = new Map<string, any>();
      [...(explicit ?? []), ...fallback].forEach((r: any) => map.set(r.id, r));
      return Array.from(map.values());
    },
    staleTime: 2 * 60_000,
  });


  const cpIds = useMemo(() => (clientProducts as any[]).map((c) => c.id), [clientProducts]);

  const { data: reports = [] } = useQuery({
    queryKey: ["provider-reports", cpIds.join(",")],
    enabled: cpIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("client_product_status_reports").select("id, status, notes, next_steps, created_at, client_product_id").in("client_product_id", cpIds).order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["provider-docs", providerId, cpIds.join(",")],
    enabled: !!providerId,
    queryFn: async () => {
      const filters: string[] = [];
      if (providerId) filters.push(`provider_id.eq.${providerId}`);
      if (cpIds.length > 0) filters.push(`client_product_id.in.(${cpIds.join(",")})`);
      if (filters.length === 0) return [];

      const [docsRes, reqRes] = await Promise.all([
        supabase
          .from("documents")
          .select("id, client_id, product_id, name, status, created_at, updated_at, client_product_id, due_date, description, file_path, uploaded_at, rejection_reason, priority, clients(full_name), products(name)")
          .or(filters.join(","))
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("document_requests")
          .select("id, client_id, product_id, request_title, status, file_url, requested_at, updated_at, client_product_id, deadline, description, rejection_reason, submission_date, priority, clients(full_name), products(name)")
          .or(filters.join(","))
          .order("requested_at", { ascending: false })
          .limit(200),
      ]);

      const docs = (docsRes.data ?? []).map((d: any) => ({
        id: d.id, client_id: d.client_id, product_id: d.product_id, name: d.name, status: d.status, created_at: d.created_at,
        updated_at: d.updated_at, client_product_id: d.client_product_id, due_date: d.due_date,
        description: d.description, file_path: d.file_path, file_url: d.file_path, uploaded_at: d.uploaded_at,
        rejection_reason: d.rejection_reason, priority: d.priority, clients: d.clients, client_name: d.clients?.full_name,
        product_name: d.products?.name, source: "documents",
      }));
      const reqs = (reqRes.data ?? []).map((r: any) => ({
        id: r.id, client_id: r.client_id, product_id: r.product_id, name: r.request_title, status: r.status, created_at: r.requested_at,
        updated_at: r.updated_at, client_product_id: r.client_product_id, due_date: r.deadline,
        description: r.description, file_path: null, file_url: r.file_url, uploaded_at: r.submission_date,
        rejection_reason: r.rejection_reason, priority: r.priority, clients: r.clients, client_name: r.clients?.full_name,
        product_name: r.products?.name, source: "document_requests",
      }));
      return [...reqs, ...docs];
    },
    staleTime: 2 * 60_000,
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ["provider-commissions", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_splits")
        .select("id, amount, percent, status, paid_at, created_at, sale_id, sales(clients(full_name), products(name))")
        .eq("beneficiary_type", "service_provider")
        .eq("beneficiary_id", providerId!)
        .order("created_at", { ascending: false });
      return (data ?? []).map((c: any) => ({
        ...c,
        client_name: c.sales?.clients?.full_name,
        product_name: c.sales?.products?.name,
      }));
    },
  });
  const commKpis = useMemo(() => {
    const all = commissions as any[];
    const pago = all.filter((c) => c.status === "pago").reduce((a, c) => a + Number(c.amount || 0), 0);
    const pendente = all.filter((c) => c.status === "pendente").reduce((a, c) => a + Number(c.amount || 0), 0);
    return { pago, pendente, total: pago + pendente, count: all.length };
  }, [commissions]);

  const stats = useMemo(() => {
    const all = clientProducts as any[];
    const active = all.filter((c) => !["concluido","concluida","cancelado","cancelada"].includes(c.status)).length;
    const delayed = all.filter((c) => {
      if (["concluido", "concluida", "cancelado", "cancelada"].includes(c.status)) return false;
      const due = c.deadline || c.sla_due_date || c.end_date;
      return due && new Date(due) < new Date();
    }).length;
    const earnings = all.filter((c) => c.status !== "cancelado").reduce((s, c) => s + Number(c.value || 0), 0);
    return { total: all.length, active, delayed, earnings };
  }, [clientProducts]);

  const firstName = (provider?.name || user?.user_metadata?.full_name || "Prestador").split(" ")[0];

  if (!provider) {
    return (
      <PanelShell role="prestador" nav={NAV} activeKey={activeKey} onNavigate={onNavigate}>
        <PanelContainer>
          <SectionCard title=""><EmptyState icon={Inbox} title="Acesso pendente" description="Sua conta ainda não foi vinculada a um cadastro de prestador. Entre em contato com o admin." /></SectionCard>
        </PanelContainer>
      </PanelShell>
    );
  }

  return (
    <PanelShell role="prestador" nav={NAV} activeKey={activeKey} onNavigate={onNavigate} userName={provider.name} userSubtitle={provider.specialty || provider.email}>
      <PanelContainer>
        {activeKey === "dashboard" && (
          <>
            <PanelHero
              role="prestador"
              eyebrow="Painel do prestador"
              title={<>Olá, {firstName} 👋</>}
              subtitle={`${provider.specialty || "Prestador especialista"} · ${provider.email}`}
              stats={[
                { label: "Demandas ativas", value: stats.active },
                { label: "Atrasadas", value: stats.delayed },
                { label: "A receber", value: formatBRL(stats.earnings) },
                { label: "Total atendidas", value: stats.total },
              ]}
            />

            <SectionCard title="Demandas recentes" icon={Briefcase} action={<Button size="sm" variant="outline" onClick={() => onNavigate("demandas")}>Ver todas</Button>}>
              {clientProducts.length === 0 ? <EmptyState icon={Inbox} title="Nenhuma demanda atribuída" /> :
                <ul className="divide-y divide-slate-100 -mx-1">
                  {(clientProducts as any[]).slice(0, 6).map((cp) => (
                    <li key={cp.id} className="flex items-center gap-3 px-3 py-3">
                      <div className="size-10 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center text-[11px] font-semibold shrink-0">{initials(cp.clients?.full_name || "?")}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium text-slate-900 truncate">{cp.clients?.full_name || "—"}</p>
                        <p className="text-[11.5px] text-slate-500 truncate">{cp.products?.name || ""}</p>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] border", STATUS_META[cp.status]?.tone || "bg-slate-100")}>{STATUS_META[cp.status]?.label || cp.status}</Badge>
                      <Button size="sm" variant="outline" className="hidden sm:inline-flex" onClick={() => setReportTarget({ id: cp.id, productName: cp.products?.name, clientName: cp.clients?.full_name })}>Reportar</Button>
                    </li>
                  ))}
                </ul>}
            </SectionCard>
          </>
        )}

        {activeKey === "demandas" && (
          <>
            <PanelHero role="prestador" eyebrow="Operação" title="Demandas atribuídas" subtitle={`${clientProducts.length} demanda(s) no total.`} />
            {clientProducts.length === 0 ? <SectionCard title=""><EmptyState icon={Briefcase} title="Sem demandas" /></SectionCard> :
              <div className="grid sm:grid-cols-2 gap-3">
                {(clientProducts as any[]).map((cp) => (
                  <div key={cp.id} className="bg-white rounded-xl border border-slate-200/70 p-4 shadow-sm hover:shadow-md hover:border-teal-200 transition">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <Badge variant="outline" className={cn("text-[10px] border", STATUS_META[cp.status]?.tone || "bg-slate-100")}>{STATUS_META[cp.status]?.label || cp.status}</Badge>
                      <p className="font-mono text-[13px] font-semibold text-slate-900 tabular-nums">{formatBRL(cp.value)}</p>
                    </div>
                    <p className="text-[14.5px] font-semibold text-slate-900 leading-tight">{cp.clients?.full_name || "—"}</p>
                    <p className="text-[12px] text-slate-500 mt-0.5 truncate">{cp.products?.name || "—"}</p>
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-[11.5px] text-slate-500 flex-wrap">
                      <span>Início: {formatDate(cp.created_at)}</span>
                      <div className="flex gap-1.5">
                        <Link to={`/demandas/${cp.id}`} className="inline-flex items-center h-8 px-2 rounded border border-slate-200 text-[11px] text-slate-700 hover:bg-slate-50">Abrir</Link>
                        <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => setRequestsTarget({ id: cp.id, clientName: cp.clients?.full_name })}>
                          <MessageSquare className="size-3 mr-1" /> Solicitar
                        </Button>
                        <Button size="sm" className="bg-teal-600 hover:bg-teal-700 h-8 text-[11px]" onClick={() => setReportTarget({ id: cp.id, productName: cp.products?.name, clientName: cp.clients?.full_name })}>Reportar status</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>}
          </>
        )}

        {activeKey === "reportes" && (
          <>
            <PanelHero role="prestador" eyebrow="Atividade" title="Reportes enviados" subtitle={`${reports.length} reporte(s)`} />
            <SectionCard title="">
              {reports.length === 0 ? <EmptyState icon={ClipboardCheck} title="Nenhum reporte enviado" /> :
                <ul className="divide-y divide-slate-100 -mx-1">
                  {(reports as any[]).map((r) => {
                    const cp = (clientProducts as any[]).find((x) => x.id === r.client_product_id);
                    return (
                      <li key={r.id} className="px-3 py-3">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <p className="text-[13px] font-medium text-slate-900 truncate">{cp?.clients?.full_name || "—"} · {cp?.products?.name || ""}</p>
                          <Badge variant="outline" className="text-[10px] border-slate-200 capitalize shrink-0">{r.status}</Badge>
                        </div>
                        {r.notes && <p className="text-[12px] text-slate-600 line-clamp-2">{r.notes}</p>}
                        <p className="text-[11px] text-slate-400 mt-1">{formatDate(r.created_at)}</p>
                      </li>
                    );
                  })}
                </ul>}
            </SectionCard>
          </>
        )}

        {activeKey === "documentos" && (
          <>
            <PanelHero role="prestador" eyebrow="Arquivos" title="Documentos das demandas" subtitle={`${documents.length} documento(s)`} />
            <ClientDocumentsTab
              clientId={providerId!}
              requests={documents as any[]}
              products={(clientProducts as any[]).map((cp) => ({ id: cp.product_id || cp.id, name: cp.products?.name || "Demanda" }))}
              getUploadFolder={(req) => req.client_product_id || providerId}
              invalidateKeys={[["provider-docs", providerId, cpIds.join(",")]]}
            />
          </>
        )}

        {activeKey === "comissoes" && (
          <>
            <PanelHero role="prestador" eyebrow="Financeiro" title="Suas comissões" subtitle="Histórico de comissões vinculadas às suas demandas." stats={[
              { label: "Pagas", value: formatBRL(commKpis.pago) },
              { label: "Pendentes", value: formatBRL(commKpis.pendente) },
              { label: "Total", value: formatBRL(commKpis.total) },
              { label: "Lançamentos", value: commKpis.count },
            ]} />
            <SectionCard title="">
              {commissions.length === 0 ? <EmptyState icon={Wallet} title="Sem comissões" /> :
                <ul className="divide-y divide-slate-100 -mx-1">
                  {(commissions as any[]).map((c) => (
                    <li key={c.id} className="flex items-center gap-3 px-3 py-3">
                      <div className="size-9 rounded-md bg-teal-50 text-teal-700 flex items-center justify-center"><Wallet className="size-4" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-slate-900">{formatBRL(c.amount)} <span className="text-[11px] text-slate-400 font-normal">· {Number(c.percent || 0)}%</span></p>
                        <p className="text-[11.5px] text-slate-500 truncate">{c.client_name || "—"}{c.product_name ? ` · ${c.product_name}` : ""} · {c.paid_at ? `pago em ${formatDate(c.paid_at)}` : `criado em ${formatDate(c.created_at)}`}</p>
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] border capitalize", c.status === "pago" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>{c.status}</Badge>
                    </li>
                  ))}
                </ul>}
            </SectionCard>
          </>
        )}


        {activeKey === "perfil" && (
          <>
            <PanelHero role="prestador" eyebrow="Perfil" title="Sua conta" subtitle={provider.email} />
            <SectionCard title="Dados" icon={UserCog}>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-[13px]">
                <div><dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Nome</dt><dd className="text-slate-900">{provider.name}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Especialidade</dt><dd className="text-slate-900">{provider.specialty || "—"}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">E-mail</dt><dd className="text-slate-900">{provider.email}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Telefone</dt><dd className="text-slate-900">{provider.phone || "—"}</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Documento</dt><dd className="text-slate-900">{provider.document_number || "—"}</dd></div>
              </dl>
              <Button variant="outline" className="mt-5 border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => signOut?.()}>Sair</Button>
            </SectionCard>
          </>
        )}
      </PanelContainer>

      {reportTarget && (
        <ReportStatusDialog
          open={!!reportTarget}
          onOpenChange={(o) => !o && setReportTarget(null)}
          clientProductId={reportTarget.id}
          productName={reportTarget.productName}
          clientName={reportTarget.clientName}
        />
      )}

      <Dialog open={!!requestsTarget} onOpenChange={(o) => !o && setRequestsTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Solicitações · {requestsTarget?.clientName ?? ""}</DialogTitle>
          </DialogHeader>
          {requestsTarget && (
            <DemandRequestsPanel clientProductId={requestsTarget.id} currentRole="prestador" />
          )}
        </DialogContent>
      </Dialog>
    </PanelShell>
  );
}
