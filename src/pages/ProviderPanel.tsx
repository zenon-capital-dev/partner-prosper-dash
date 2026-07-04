import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Briefcase, ClipboardCheck, FileText, UserCog, Inbox, Clock, Wallet, MessageSquare,
  TrendingUp, AlertTriangle, CheckCircle2, CalendarClock, Sparkles, ArrowUpRight, Activity, Bell,
  Package, Zap, Target,
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
import { ClientDocumentFolders } from "@/components/documents/ClientDocumentFolders";

const NAV = [
  { key: "dashboard",  label: "Início",     icon: LayoutDashboard },
  { key: "demandas",   label: "Demandas",   icon: Briefcase },
  { key: "reportes",   label: "Reportes",   icon: ClipboardCheck, shortLabel: "Reportes" },
  { key: "documentos", label: "Documentos", icon: FileText, shortLabel: "Docs" },
  { key: "comissoes",  label: "Comissões",  icon: Wallet, shortLabel: "Comissões" },
  { key: "perfil",     label: "Perfil",     icon: UserCog },
];

const STATUS_META: Record<string, { label: string; tone: string }> = {
  aguardando_inicio:      { label: "Aguardando início", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  aguardando_cliente:     { label: "Aguardando cliente", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  aguardando_documentos:  { label: "Aguardando documentos", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  aguardando_aprovacao:   { label: "Aguardando aprovação", tone: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  aguardando_pagamento:   { label: "Aguardando pagamento", tone: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200" },
  em_andamento:           { label: "Em andamento", tone: "bg-teal-50 text-teal-700 border-teal-200" },
  em_execucao:            { label: "Em execução", tone: "bg-teal-50 text-teal-700 border-teal-200" },
  em_analise:             { label: "Em análise", tone: "bg-blue-50 text-blue-700 border-blue-200" },
  atrasado:               { label: "Atrasada", tone: "bg-rose-50 text-rose-700 border-rose-200" },
  atrasada:               { label: "Atrasada", tone: "bg-rose-50 text-rose-700 border-rose-200" },
  bloqueado:              { label: "Bloqueada", tone: "bg-rose-50 text-rose-700 border-rose-200" },
  pausado:                { label: "Pausada", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  pausada:                { label: "Pausada", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  concluido:              { label: "Concluída", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  concluida:              { label: "Concluída", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  entregue:               { label: "Entregue", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelado:              { label: "Cancelada", tone: "bg-slate-100 text-slate-500 border-slate-200 line-through" },
  cancelada:              { label: "Cancelada", tone: "bg-slate-100 text-slate-500 border-slate-200 line-through" },
};

// Formatter para status desconhecidos: substitui _ por espaço e capitaliza
const prettyStatus = (s?: string) => (s || "—").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function KpiTile({ icon: Icon, label, value, hint, accent, progress }: {
  icon: any; label: string; value: React.ReactNode; hint?: string; accent?: string; progress?: number;
}) {
  return (
    <div className="group relative rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm hover:shadow-md hover:border-slate-300/70 transition-all overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.12em] font-medium text-slate-500">{label}</div>
          <div className="mt-1.5 text-2xl font-semibold text-slate-900 tracking-tight tabular-nums">{value}</div>
          {hint && <div className="text-[11px] text-slate-500 mt-0.5 truncate">{hint}</div>}
        </div>
        <div className={cn("size-9 rounded-lg border flex items-center justify-center shrink-0", accent || "text-slate-500 bg-slate-50 border-slate-200")}>
          <Icon className="size-4" />
        </div>
      </div>
      {typeof progress === "number" && (
        <div className="mt-3 h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}


export default function ProviderPanel() {
  const { user, signOut } = useAuth() as any;
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeKey = NAV.find((n) => n.key === tab)?.key ?? "dashboard";
  const onNavigate = (k: string) => navigate(k === "dashboard" ? "/prestador" : `/prestador/${k}`);
  const qc = useQueryClient();
  const [reportTarget, setReportTarget] = useState<{ id: string; productName?: string; clientName?: string } | null>(null);
  const [requestsTarget, setRequestsTarget] = useState<{ id: string; clientName?: string } | null>(null);
  const [reportView, setReportView] = useState<any | null>(null);

  const { data: provider } = useQuery({
    queryKey: ["provider-self", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const cols = "id, name, specialty, email, phone, document_number, user_id, whatsapp, bio, address_zip, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, pix_key, bank_name, bank_account_type, bank_agency, bank_account";
      let { data } = await supabase.from("service_providers").select(cols).eq("user_id", user!.id).maybeSingle();
      if (!data && user?.email) {
        const { data: be } = await supabase.from("service_providers").select(cols).ilike("email", user.email).maybeSingle();
        data = be;
      }
      return data;
    },
  });

  const providerId = provider?.id;

  // ----- Profile edit -----
  const emptyProfile = {
    name: "", specialty: "", phone: "", document_number: "", whatsapp: "", bio: "",
    address_zip: "", address_street: "", address_number: "", address_complement: "",
    address_neighborhood: "", address_city: "", address_state: "",
    pix_key: "", bank_name: "", bank_account_type: "corrente", bank_agency: "", bank_account: "",
  };
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState(emptyProfile);
  const hydrateProfile = (p: any) => ({
    name: p?.name || "",
    specialty: p?.specialty || "",
    phone: p?.phone || "",
    document_number: p?.document_number || "",
    whatsapp: p?.whatsapp || "",
    bio: p?.bio || "",
    address_zip: p?.address_zip || "",
    address_street: p?.address_street || "",
    address_number: p?.address_number || "",
    address_complement: p?.address_complement || "",
    address_neighborhood: p?.address_neighborhood || "",
    address_city: p?.address_city || "",
    address_state: p?.address_state || "",
    pix_key: p?.pix_key || "",
    bank_name: p?.bank_name || "",
    bank_account_type: p?.bank_account_type || "corrente",
    bank_agency: p?.bank_agency || "",
    bank_account: p?.bank_account || "",
  });
  useEffect(() => { if (provider) setProfileForm(hydrateProfile(provider)); }, [provider]);
  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!providerId) throw new Error("Prestador não encontrado");
      const { error } = await supabase.from("service_providers").update(profileForm as any).eq("id", providerId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados atualizados");
      qc.invalidateQueries({ queryKey: ["provider-self", user?.id] });
      setEditingProfile(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

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
        .select(`id, status, value, deadline, created_at, notes, priority, sla_due_date, client_id, service_provider_id, sale_id,
                 clients(id, full_name, email, phone), products(name, description),
                 sales(id, amount, revenue_type, recurrence_months, recurrence_start, paid_at, status)`)
        .or(orParts.join(","))
        .order("created_at", { ascending: false });

      let fallback: any[] = [];
      if (linkedClientIds.length > 0) {
        const { data } = await supabase
          .from("client_products")
          .select(`id, status, value, deadline, created_at, notes, priority, sla_due_date, client_id, service_provider_id, sale_id,
                   clients(id, full_name, email, phone), products(name, description),
                   sales(id, amount, revenue_type, recurrence_months, recurrence_start, paid_at, status)`)
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
      const { data } = await supabase.from("client_product_status_reports").select("id, status, notes, next_steps, pending, attachments, created_at, client_product_id").in("client_product_id", cpIds).order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  // Último reporte por demanda + cálculo de urgência (para destaque visual nos cards)
  const lastReportByCp = useMemo(() => {
    const m = new Map<string, string>();
    (reports as any[]).forEach((r) => {
      if (!m.has(r.client_product_id)) m.set(r.client_product_id, r.created_at);
    });
    return m;
  }, [reports]);

  const getDemandUrgency = (cp: any): { level: "overdue" | "stale" | "soon" | "ok" | "done"; label?: string; border: string; ring?: string; ribbon: string; ribbonLabel: string } => {
    const done = ["concluido", "concluida", "cancelado", "cancelada"].includes(cp.status);
    if (done) return {
      level: "done",
      border: "border-l-[6px] border-l-emerald-500 border-slate-200/70",
      ring: "bg-emerald-50/30",
      ribbon: "bg-emerald-500",
      ribbonLabel: cp.status?.startsWith("cancel") ? "Cancelada" : "Concluída",
    };
    const due = cp.deadline || cp.sla_due_date;
    if (due) {
      const daysLate = Math.floor((Date.now() - new Date(due).getTime()) / 86400000);
      if (daysLate > 0) return { level: "overdue", label: `${daysLate}d de atraso`, border: "border-l-[6px] border-l-rose-500 border-rose-200", ring: "bg-rose-50/60", ribbon: "bg-rose-500", ribbonLabel: `Atrasada · ${daysLate}d` };
      const daysUntil = Math.abs(daysLate);
      if (daysUntil <= 3) return { level: "soon", label: `Vence em ${daysUntil}d`, border: "border-l-[6px] border-l-amber-500 border-amber-200", ring: "bg-amber-50/40", ribbon: "bg-amber-500", ribbonLabel: `Vence em ${daysUntil}d` };
    }
    const last = lastReportByCp.get(cp.id);
    const daysSince = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;
    if (daysSince === null) {
      const ageDays = Math.floor((Date.now() - new Date(cp.created_at).getTime()) / 86400000);
      if (ageDays >= 3) return { level: "overdue", label: "Sem reporte", border: "border-l-[6px] border-l-rose-500 border-rose-200", ring: "bg-rose-50/60", ribbon: "bg-rose-500", ribbonLabel: "Sem reporte" };
      if (ageDays >= 1) return { level: "stale", label: "Aguardando 1º reporte", border: "border-l-[6px] border-l-amber-500 border-amber-200", ring: "bg-amber-50/40", ribbon: "bg-amber-500", ribbonLabel: "Aguardando 1º reporte" };
    } else if (daysSince >= 7) {
      return { level: "overdue", label: `Sem reporte há ${daysSince}d`, border: "border-l-[6px] border-l-rose-500 border-rose-200", ring: "bg-rose-50/60", ribbon: "bg-rose-500", ribbonLabel: `Sem reporte ${daysSince}d` };
    } else if (daysSince >= 3) {
      return { level: "stale", label: `Sem reporte há ${daysSince}d`, border: "border-l-[6px] border-l-amber-500 border-amber-200", ring: "bg-amber-50/40", ribbon: "bg-amber-500", ribbonLabel: `Sem reporte ${daysSince}d` };
    } else if (daysSince >= 2) {
      return { level: "soon", label: `Reportar em breve (${daysSince}d)`, border: "border-l-[6px] border-l-sky-500 border-sky-200", ring: "bg-sky-50/40", ribbon: "bg-sky-500", ribbonLabel: "Reportar em breve" };
    }
    return {
      level: "ok",
      border: "border-l-[6px] border-l-emerald-500 border-slate-200/70",
      ring: "",
      ribbon: "bg-emerald-500",
      ribbonLabel: "Em dia",
    };
  };



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

  // Pastas de documentos do cliente às quais este prestador foi autorizado (pela Zenon)
  const { data: authorizedFolderClients = [] } = useQuery({
    queryKey: ["provider-authorized-folder-clients", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("client_document_folders")
        .select("id, client_id, name, clients(full_name)")
        .order("name");
      const map = new Map<string, { client_id: string; client_name: string; folders: any[] }>();
      for (const f of (data ?? []) as any[]) {
        const key = f.client_id;
        if (!map.has(key)) map.set(key, { client_id: key, client_name: f.clients?.full_name || "Cliente", folders: [] });
        map.get(key)!.folders.push(f);
      }
      return Array.from(map.values());
    },
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

  const { data: pendingRequests = [] } = useQuery({
    queryKey: ["provider-pending-requests", user?.id, cpIds.join(",")],
    enabled: !!user?.id && cpIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("demand_requests")
        .select("id, title, kind, status, created_at, client_product_id, requested_role")
        .in("client_product_id", cpIds)
        .eq("target_role", "prestador")
        .in("status", ["aberta", "respondida"])
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const { data: recentNotifications = [] } = useQuery({
    queryKey: ["provider-notifs", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, message, created_at, read_at, kind, link")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ["provider-deliveries", cpIds.join(",")],
    enabled: cpIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("demand_deliveries")
        .select("id, title, description, status, created_at, client_product_id, files")
        .in("client_product_id", cpIds)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const all = clientProducts as any[];
    const active = all.filter((c) => !["concluido","concluida","cancelado","cancelada"].includes(c.status)).length;
    const done = all.filter((c) => ["concluido","concluida"].includes(c.status)).length;
    const delayed = all.filter((c) => {
      if (["concluido", "concluida", "cancelado", "cancelada"].includes(c.status)) return false;
      const due = c.deadline || c.sla_due_date || c.end_date;
      return due && new Date(due) < new Date();
    }).length;
    const nonCancelled = all.filter((c) => !["cancelado","cancelada"].includes(c.status));
    const isPaid = (c: any) => !!c.sales?.paid_at || ["concluido","concluida"].includes(c.status);
    const aReceber = nonCancelled.filter((c) => !isPaid(c)).reduce((s, c) => s + Number(c.value || 0), 0);
    const recebido = nonCancelled.filter(isPaid).reduce((s, c) => s + Number(c.value || 0), 0);
    const recorrenteMes = nonCancelled.reduce((s, c) => {
      const sale = c.sales;
      if (sale?.revenue_type === "recorrente" && sale?.recurrence_months && Number(sale.recurrence_months) > 0) {
        return s + Number(c.value || 0) / Number(sale.recurrence_months);
      }
      return s;
    }, 0);
    return { total: all.length, active, delayed, done, earnings: aReceber + recebido, aReceber, recebido, recorrenteMes };
  }, [clientProducts]);

  const upcoming = useMemo(() => {
    const now = new Date();
    const in14 = new Date(now.getTime() + 14 * 86400000);
    return (clientProducts as any[])
      .filter((c) => {
        if (["concluido","concluida","cancelado","cancelada"].includes(c.status)) return false;
        const due = c.deadline || c.sla_due_date;
        if (!due) return false;
        const d = new Date(due);
        return d >= now && d <= in14;
      })
      .sort((a, b) => new Date(a.deadline || a.sla_due_date).getTime() - new Date(b.deadline || b.sla_due_date).getTime())
      .slice(0, 5);
  }, [clientProducts]);

  const delayedList = useMemo(() => (clientProducts as any[])
    .filter((c) => {
      if (["concluido","concluida","cancelado","cancelada"].includes(c.status)) return false;
      const due = c.deadline || c.sla_due_date;
      return due && new Date(due) < new Date();
    })
    .sort((a, b) => new Date(a.deadline || a.sla_due_date).getTime() - new Date(b.deadline || b.sla_due_date).getTime())
    .slice(0, 5), [clientProducts]);

  const reportsThisMonth = useMemo(() => {
    const now = new Date();
    return (reports as any[]).filter((r) => {
      const d = new Date(r.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [reports]);

  const commPct = commKpis.total > 0 ? Math.round((commKpis.pago / commKpis.total) * 100) : 0;

  const revenueByMonth = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      buckets.push({ key, label, value: 0 });
    }
    (commissions as any[]).forEach((c) => {
      if (c.status !== "pago" || !c.paid_at) return;
      const d = new Date(c.paid_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const b = buckets.find((x) => x.key === key);
      if (b) b.value += Number(c.amount || 0);
    });
    const max = Math.max(1, ...buckets.map((b) => b.value));
    const total = buckets.reduce((s, b) => s + b.value, 0);
    const prev = buckets[buckets.length - 2]?.value || 0;
    const curr = buckets[buckets.length - 1]?.value || 0;
    const trend = prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);
    return { buckets, max, total, trend, curr };
  }, [commissions]);

  const activityFeed = useMemo(() => {
    const items: any[] = [];
    (reports as any[]).slice(0, 8).forEach((r) => {
      const cp = (clientProducts as any[]).find((c) => c.id === r.client_product_id);
      items.push({ id: `r-${r.id}`, kind: "report", when: r.created_at, title: `Reporte · ${cp?.clients?.full_name || "—"}`, subtitle: cp?.products?.name || "", tone: "teal" });
    });
    (deliveries as any[]).slice(0, 6).forEach((d) => {
      const cp = (clientProducts as any[]).find((c) => c.id === d.client_product_id);
      items.push({ id: `d-${d.id}`, kind: "delivery", when: d.created_at, title: `Entrega · ${d.title}`, subtitle: cp?.clients?.full_name || "", tone: "indigo" });
    });
    return items.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime()).slice(0, 7);
  }, [reports, deliveries, clientProducts]);



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
          <div className="space-y-5">
            {/* Hero premium */}
            <div className="relative overflow-hidden rounded-2xl border border-teal-100/60 bg-gradient-to-br from-teal-600 via-emerald-600 to-cyan-600 text-white shadow-[0_10px_40px_-15px_rgba(20,184,166,0.5)]">
              <div className="absolute inset-0 opacity-[0.15] bg-[radial-gradient(circle_at_20%_20%,white_0%,transparent_40%),radial-gradient(circle_at_80%_60%,white_0%,transparent_35%)]" />
              <div className="absolute -right-10 -top-10 size-56 rounded-full bg-white/10 blur-3xl" />
              <div className="relative p-6 sm:p-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] font-medium text-white/80 bg-white/10 border border-white/15 rounded-full px-2.5 py-1">
                    <Sparkles className="w-3 h-3" /> Painel do prestador
                  </div>
                  <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight">
                    Olá, {firstName}
                  </h1>
                  <p className="mt-1 text-sm text-white/80">
                    {provider.specialty || "Prestador especialista"} · {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 lg:min-w-[540px]">
                  {[
                    { label: "Ativas",     value: stats.active,    icon: Activity },
                    { label: "Atrasadas",  value: stats.delayed,   icon: AlertTriangle, tone: stats.delayed > 0 ? "text-rose-100" : "" },
                    { label: "Recorrente/mês", value: formatBRL(stats.recorrenteMes), icon: TrendingUp, small: true },
                    { label: "A receber",  value: formatBRL(stats.aReceber), icon: Wallet, small: true },
                  ].map((k: any) => (
                    <div key={k.label} className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 p-3">
                      <div className="flex items-center justify-between text-white/70">
                        <k.icon className="w-3.5 h-3.5" />
                        <span className="text-[10px] uppercase tracking-wider">{k.label}</span>
                      </div>
                      <div className={cn("mt-1 font-semibold tracking-tight tabular-nums", k.small ? "text-lg" : "text-2xl", k.tone)}>
                        {k.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiTile
                icon={ClipboardCheck}
                label="Reportes no mês"
                value={reportsThisMonth}
                hint={`${reports.length} total`}
                accent="text-teal-600 bg-teal-50 border-teal-100"
              />
              <KpiTile
                icon={CalendarClock}
                label="Prazos em 14 dias"
                value={upcoming.length}
                hint={upcoming[0] ? `próx: ${formatDate(upcoming[0].deadline || upcoming[0].sla_due_date)}` : "sem prazos"}
                accent="text-indigo-600 bg-indigo-50 border-indigo-100"
              />
              <KpiTile
                icon={MessageSquare}
                label="Solicitações abertas"
                value={pendingRequests.length}
                hint={pendingRequests.length > 0 ? "requer sua resposta" : "tudo em dia"}
                accent="text-amber-600 bg-amber-50 border-amber-100"
              />
              <KpiTile
                icon={Wallet}
                label="Recebido"
                value={formatBRL(stats.recebido)}
                hint={`${stats.aReceber > 0 ? formatBRL(stats.aReceber) + " a receber" : "tudo recebido"}`}
                accent="text-emerald-600 bg-emerald-50 border-emerald-100"
                progress={stats.earnings > 0 ? Math.round((stats.recebido / stats.earnings) * 100) : 0}
              />
            </div>

            {/* Two-column grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Próximos prazos */}
              <SectionCard
                title="Próximos prazos"
                icon={CalendarClock}
                action={<Button size="sm" variant="ghost" className="text-teal-700 hover:text-teal-800" onClick={() => onNavigate("demandas")}>Ver todas <ArrowUpRight className="w-3 h-3 ml-1" /></Button>}
              >
                {upcoming.length === 0 ? (
                  <EmptyState icon={CalendarClock} title="Sem prazos próximos" description="Nenhuma demanda vence nos próximos 14 dias." />
                ) : (
                  <ul className="divide-y divide-slate-100 -mx-1">
                    {upcoming.map((cp: any) => {
                      const due = cp.deadline || cp.sla_due_date;
                      const days = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
                      return (
                        <li key={cp.id} className="flex items-center gap-3 px-3 py-2.5">
                          <div className="size-9 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center text-[10px] font-semibold shrink-0">{initials(cp.clients?.full_name || "?")}</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-slate-900 truncate">{cp.clients?.full_name || "—"}</p>
                            <p className="text-[11px] text-slate-500 truncate">{cp.products?.name}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] font-medium text-slate-700 tabular-nums">{formatDate(due)}</div>
                            <div className={cn("text-[10px] tabular-nums", days <= 3 ? "text-rose-600 font-medium" : days <= 7 ? "text-amber-600" : "text-slate-500")}>
                              {days === 0 ? "hoje" : `em ${days}d`}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SectionCard>

              {/* Alertas de atraso */}
              <SectionCard title="Atenção — atrasadas" icon={AlertTriangle}>
                {delayedList.length === 0 ? (
                  <EmptyState icon={CheckCircle2} title="Nada atrasado" description="Todas as demandas estão dentro do prazo." />
                ) : (
                  <ul className="space-y-2">
                    {delayedList.map((cp: any) => {
                      const due = cp.deadline || cp.sla_due_date;
                      const daysLate = Math.floor((Date.now() - new Date(due).getTime()) / 86400000);
                      return (
                        <li key={cp.id} className="rounded-lg border border-rose-100 bg-rose-50/40 p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-slate-900 truncate">{cp.clients?.full_name}</p>
                              <p className="text-[11px] text-slate-500 truncate">{cp.products?.name}</p>
                            </div>
                            <Badge variant="outline" className="bg-white text-rose-700 border-rose-200 text-[10px]">
                              {daysLate}d de atraso
                            </Badge>
                          </div>
                          <Button
                            size="sm" variant="ghost"
                            className="mt-1 h-7 px-2 text-[11px] text-rose-700 hover:bg-rose-100/50"
                            onClick={() => setReportTarget({ id: cp.id, productName: cp.products?.name, clientName: cp.clients?.full_name })}
                          >
                            Reportar status
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SectionCard>

              {/* Reportes recentes */}
              <SectionCard
                title="Últimos reportes"
                icon={ClipboardCheck}
                action={<Button size="sm" variant="ghost" className="text-teal-700 hover:text-teal-800" onClick={() => onNavigate("reportes")}>Ver todos <ArrowUpRight className="w-3 h-3 ml-1" /></Button>}
              >
                {reports.length === 0 ? (
                  <EmptyState icon={ClipboardCheck} title="Sem reportes" description="Envie seu primeiro reporte pela aba Demandas." />
                ) : (
                  <ul className="space-y-2">
                    {(reports as any[]).slice(0, 5).map((r) => {
                      const cp = (clientProducts as any[]).find((c) => c.id === r.client_product_id);
                      const tone = r.status === "concluido" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : r.status === "atrasado" ? "bg-rose-50 text-rose-700 border-rose-200"
                        : r.status === "em_analise" ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-blue-50 text-blue-700 border-blue-200";
                      return (
                        <li key={r.id} className="rounded-lg border border-slate-100 hover:border-teal-200 hover:bg-teal-50/30 transition-colors p-2.5 cursor-pointer" onClick={() => setReportView({ ...r, _cp: cp })}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[12px] font-medium text-slate-900 truncate flex-1">
                              {cp?.clients?.full_name || "—"} · {cp?.products?.name || ""}
                            </p>
                            <Badge variant="outline" className={cn("text-[10px]", tone)}>{r.status}</Badge>
                          </div>
                          <p className="text-[10.5px] text-slate-500 mt-0.5 tabular-nums">{formatDate(r.created_at)}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SectionCard>
            </div>

            {/* Receita + Entregas */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Receita 6 meses */}
              <SectionCard
                title="Receita — últimos 6 meses"
                icon={TrendingUp}
                className="lg:col-span-3"
                action={
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-slate-500">este mês</span>
                    <span className="tabular-nums font-semibold text-slate-900">{formatBRL(revenueByMonth.curr)}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] tabular-nums",
                        revenueByMonth.trend > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : revenueByMonth.trend < 0 ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      )}
                    >
                      {revenueByMonth.trend > 0 ? "▲" : revenueByMonth.trend < 0 ? "▼" : "="} {Math.abs(revenueByMonth.trend)}%
                    </Badge>
                  </div>
                }
              >
                <div className="flex items-end justify-between gap-2 h-32 pt-2 pb-1">
                  {revenueByMonth.buckets.map((b, i) => {
                    const h = (b.value / revenueByMonth.max) * 100;
                    const isLast = i === revenueByMonth.buckets.length - 1;
                    return (
                      <div key={b.key} className="flex-1 flex flex-col items-center gap-1.5 group">
                        <div className="text-[10px] tabular-nums text-slate-400 opacity-0 group-hover:opacity-100 transition">
                          {b.value > 0 ? formatBRL(b.value) : ""}
                        </div>
                        <div className="w-full max-w-[38px] h-full flex items-end">
                          <div
                            className={cn(
                              "w-full rounded-t-md transition-all",
                              isLast
                                ? "bg-gradient-to-t from-emerald-500 to-teal-400"
                                : "bg-gradient-to-t from-slate-200 to-slate-300 group-hover:from-teal-200 group-hover:to-teal-100"
                            )}
                            style={{ height: `${Math.max(h, 4)}%` }}
                          />
                        </div>
                        <div className={cn("text-[10px] uppercase tracking-wider", isLast ? "text-teal-700 font-semibold" : "text-slate-400")}>
                          {b.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-emerald-700">Pago</div>
                    <div className="text-[13px] font-semibold text-emerald-900 tabular-nums mt-0.5">{formatBRL(commKpis.pago)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-amber-700">A receber</div>
                    <div className="text-[13px] font-semibold text-amber-900 tabular-nums mt-0.5">{formatBRL(commKpis.pendente)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-600">Total 6m</div>
                    <div className="text-[13px] font-semibold text-slate-900 tabular-nums mt-0.5">{formatBRL(revenueByMonth.total)}</div>
                  </div>
                </div>
              </SectionCard>

              {/* Entregas recentes */}
              <SectionCard
                title="Entregas recentes"
                icon={Package}
                className="lg:col-span-2"
              >
                {deliveries.length === 0 ? (
                  <EmptyState icon={Package} title="Sem entregas" description="Suas entregas aparecerão aqui." />
                ) : (
                  <ul className="space-y-1.5">
                    {(deliveries as any[]).map((d) => {
                      const cp = (clientProducts as any[]).find((c) => c.id === d.client_product_id);
                      const files = Array.isArray(d.files) ? d.files.length : 0;
                      const tone = d.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : d.status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-200"
                        : d.status === "delivered" ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-slate-50 text-slate-700 border-slate-200";
                      return (
                        <li key={d.id} className="rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors p-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[12.5px] font-medium text-slate-900 truncate flex-1">{d.title}</p>
                            <Badge variant="outline" className={cn("text-[10px] shrink-0 capitalize", tone)}>{String(d.status || "pending").replace("_", " ")}</Badge>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[10.5px] text-slate-500">
                            <span className="truncate">{cp?.clients?.full_name || "—"}</span>
                            <span>·</span>
                            <span className="tabular-nums shrink-0">{formatDate(d.created_at)}</span>
                            {files > 0 && (<><span>·</span><span className="shrink-0">{files} arquivo(s)</span></>)}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SectionCard>
            </div>

            {/* Atividade + Notificações */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <SectionCard title="Atividade recente" icon={Activity} className="lg:col-span-3">
                {activityFeed.length === 0 ? (
                  <EmptyState icon={Activity} title="Sem atividade" description="Reportes e entregas aparecerão em uma linha do tempo." />
                ) : (
                  <ol className="relative border-l border-slate-200 ml-2 space-y-3 pt-1">
                    {activityFeed.map((it) => (
                      <li key={it.id} className="pl-4 relative">
                        <span className={cn(
                          "absolute -left-[6px] top-1.5 size-3 rounded-full ring-4 ring-white",
                          it.tone === "teal" ? "bg-teal-500" : "bg-indigo-500",
                        )} />
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[12.5px] font-medium text-slate-900 truncate">{it.title}</p>
                            {it.subtitle && <p className="text-[11px] text-slate-500 truncate">{it.subtitle}</p>}
                          </div>
                          <span className="text-[10.5px] text-slate-400 tabular-nums shrink-0">{formatDate(it.when)}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </SectionCard>

              <SectionCard
                title="Notificações"
                icon={Bell}
                className="lg:col-span-2"
                action={
                  recentNotifications.length > 0 && (
                    <Badge variant="outline" className="text-[10px] bg-teal-50 text-teal-700 border-teal-200">
                      {(recentNotifications as any[]).filter((n) => !n.read_at).length} nova(s)
                    </Badge>
                  )
                }
              >
                {recentNotifications.length === 0 ? (
                  <EmptyState icon={Bell} title="Sem notificações" description="Você receberá avisos por aqui." />
                ) : (
                  <ul className="space-y-1.5">
                    {(recentNotifications as any[]).map((n) => {
                      const clickable = !!n.link;
                      const Wrap: any = clickable ? "button" : "div";
                      return (
                        <li key={n.id}>
                          <Wrap
                            {...(clickable ? { type: "button", onClick: () => navigate(n.link) } : {})}
                            className={cn(
                              "w-full text-left rounded-md p-2 border text-[12px] transition",
                              n.read_at ? "border-slate-100 bg-white" : "border-teal-100 bg-teal-50/40",
                              clickable && "hover:border-teal-300 hover:bg-teal-50 cursor-pointer",
                            )}
                          >
                            <div className="flex items-start gap-2">
                              <div className={cn("size-1.5 rounded-full mt-1.5 shrink-0", n.read_at ? "bg-slate-300" : "bg-teal-500")} />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-slate-900 truncate">{n.title || n.kind}</p>
                                {n.message && <p className="text-[11px] text-slate-500 truncate">{n.message}</p>}
                                <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">{formatDate(n.created_at)}</p>
                              </div>
                              {clickable && <ArrowUpRight className="size-3 text-slate-400 mt-0.5 shrink-0" />}
                            </div>
                          </Wrap>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SectionCard>
            </div>

            {/* Ações rápidas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Reportar status", icon: ClipboardCheck, tone: "from-teal-500 to-emerald-500", onClick: () => onNavigate("demandas") },
                { label: "Nova solicitação", icon: MessageSquare, tone: "from-amber-500 to-orange-500", onClick: () => navigate("/minhas-solicitacoes") },
                { label: "Ver documentos", icon: FileText, tone: "from-indigo-500 to-blue-500", onClick: () => onNavigate("documentos") },
                { label: "Comissões", icon: Wallet, tone: "from-emerald-500 to-green-500", onClick: () => onNavigate("comissoes") },
              ].map((a) => (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  className="group relative overflow-hidden rounded-xl border border-slate-200/70 bg-white p-4 text-left shadow-sm hover:shadow-md hover:border-teal-300 transition-all"
                >
                  <div className={cn("absolute -right-6 -top-6 size-20 rounded-full bg-gradient-to-br opacity-10 group-hover:opacity-20 transition", a.tone)} />
                  <div className={cn("size-9 rounded-lg bg-gradient-to-br text-white flex items-center justify-center shadow-sm", a.tone)}>
                    <a.icon className="size-4" />
                  </div>
                  <div className="mt-3 text-[13px] font-semibold text-slate-900 flex items-center justify-between">
                    {a.label}
                    <ArrowUpRight className="size-3.5 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
                  </div>
                </button>
              ))}
            </div>

          </div>
        )}



        {activeKey === "demandas" && (
          <>
            <PanelHero role="prestador" eyebrow="Operação" title="Demandas atribuídas" subtitle={`${clientProducts.length} demanda(s) no total.`} />
            {clientProducts.length === 0 ? <SectionCard title=""><EmptyState icon={Briefcase} title="Sem demandas" /></SectionCard> :
              <div className="grid sm:grid-cols-2 gap-3">
                {(clientProducts as any[]).map((cp) => {
                  const u = getDemandUrgency(cp);
                  return (
                  <div key={cp.id} className={cn("rounded-xl border p-4 shadow-sm hover:shadow-md transition bg-white", u.border, u.ring)}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className={cn("text-[10px] border font-medium", u.level === "overdue" ? "bg-rose-50 text-rose-700 border-rose-200" : (STATUS_META[cp.status]?.tone || "bg-slate-100 text-slate-700 border-slate-200"))}>{STATUS_META[cp.status]?.label || prettyStatus(cp.status)}</Badge>
                        {u.level === "overdue" && (
                          <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 animate-pulse">
                            <AlertTriangle className="size-3 mr-1" /> {u.label}
                          </Badge>
                        )}
                        {u.level === "stale" && (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                            <AlertTriangle className="size-3 mr-1" /> {u.label}
                          </Badge>
                        )}
                        {u.level === "soon" && (
                          <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200">
                            {u.label}
                          </Badge>
                        )}

                      </div>
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
                        <Button size="sm" className={cn("h-8 text-[11px]", u.level === "overdue" ? "bg-rose-600 hover:bg-rose-700" : "bg-teal-600 hover:bg-teal-700")} onClick={() => setReportTarget({ id: cp.id, productName: cp.products?.name, clientName: cp.clients?.full_name })}>Reportar status</Button>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>}
          </>
        )}

        {activeKey === "reportes" && (
          <>
            <PanelHero role="prestador" eyebrow="Atividade" title="Reportes enviados" subtitle={`${reports.length} reporte(s)`} />
            <SectionCard title="">
              {reports.length === 0 ? <EmptyState icon={ClipboardCheck} title="Nenhum reporte enviado" /> :
                <ul className="grid gap-2">
                  {(reports as any[]).map((r) => {
                    const cp = (clientProducts as any[]).find((x) => x.id === r.client_product_id);
                    const clientName = cp?.clients?.full_name || "—";
                    const productName = cp?.products?.name || cp?.custom_product_name || "";
                    const statusColor =
                      r.status === "concluido" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : r.status === "em_andamento" ? "bg-blue-50 text-blue-700 border-blue-200"
                      : r.status === "atrasado" ? "bg-rose-50 text-rose-700 border-rose-200"
                      : r.status === "em_analise" ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-slate-50 text-slate-700 border-slate-200";
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => setReportView({ ...r, _clientName: clientName, _productName: productName })}
                          className="w-full text-left group cursor-pointer rounded-xl border border-slate-200/70 bg-white p-4 hover:border-teal-300 hover:shadow-sm transition"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-slate-900 truncate">{clientName} · <span className="font-medium text-slate-600">{productName}</span></p>
                              <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(r.created_at)}</p>
                            </div>
                            <Badge variant="outline" className={cn("text-[10px] capitalize shrink-0", statusColor)}>{String(r.status).replace(/_/g, " ")}</Badge>
                          </div>
                          {r.notes && <p className="text-[12.5px] text-slate-600 line-clamp-2 mt-2">{r.notes}</p>}
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                            {r.pending && <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-amber-400" /> Pendências</span>}
                            {r.next_steps && <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full bg-blue-400" /> Próximos passos</span>}
                            {Array.isArray(r.attachments) && r.attachments.length > 0 && <span>{r.attachments.length} anexo(s)</span>}
                            <span className="ml-auto text-teal-700 font-medium">Ver detalhes →</span>
                          </div>
                        </button>
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

            {authorizedFolderClients.length > 0 && (
              <SectionCard title="Pastas autorizadas pela Zenon" icon={FileText}>
                <p className="text-[12px] text-slate-500 mb-3">
                  Você recebeu permissão de visualização em pastas de documentos de clientes. Apenas leitura — o envio é feito pela Zenon ou pelo próprio cliente.
                </p>
                <div className="space-y-6">
                  {authorizedFolderClients.map((c: any) => (
                    <div key={c.client_id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Cliente</p>
                      <p className="text-sm font-semibold text-slate-900 mb-3">{c.client_name}</p>
                      <ClientDocumentFolders clientId={c.client_id} viewerRole="provider" />
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </>
        )}


        {activeKey === "comissoes" && (() => {
          const splits = commissions as any[];
          const cps = clientProducts as any[];
          const activeStatus = (s: string) => !["cancelado","cancelada"].includes(s);
          const doneStatus = (s: string) => ["concluido","concluida"].includes(s);

          // ===== Recebíveis (baseado nas demandas do prestador) =====
          const recCps = cps.filter((c) => activeStatus(c.status) && Number(c.value || 0) > 0);
          const recebido = recCps.filter((c) => c.sales?.paid_at || doneStatus(c.status)).reduce((s, c) => s + Number(c.value || 0), 0);
          const aReceber = recCps.filter((c) => !(c.sales?.paid_at || doneStatus(c.status))).reduce((s, c) => s + Number(c.value || 0), 0);
          const recorrenteMensal = recCps.reduce((s, c) => {
            const sale = c.sales;
            if (sale?.revenue_type === "recorrente" && sale?.recurrence_months && Number(sale.recurrence_months) > 0) {
              return s + Number(c.value || 0) / Number(sale.recurrence_months);
            }
            return s;
          }, 0);
          const totalHist = recebido + aReceber;

          // Agrupar por cliente
          type Row = { clientId: string; clientName: string; items: any[]; total: number; recebido: number; aReceber: number; recorrente: number };
          const byClient = new Map<string, Row>();
          recCps.forEach((c) => {
            const cid = c.clients?.id || c.client_id;
            const cname = c.clients?.full_name || "—";
            if (!byClient.has(cid)) byClient.set(cid, { clientId: cid, clientName: cname, items: [], total: 0, recebido: 0, aReceber: 0, recorrente: 0 });
            const row = byClient.get(cid)!;
            const val = Number(c.value || 0);
            row.items.push(c);
            row.total += val;
            const isPaid = c.sales?.paid_at || doneStatus(c.status);
            if (isPaid) row.recebido += val; else row.aReceber += val;
            if (c.sales?.revenue_type === "recorrente" && c.sales?.recurrence_months) {
              row.recorrente += val / Number(c.sales.recurrence_months);
            }
          });
          const clientRows = Array.from(byClient.values()).sort((a, b) => b.total - a.total);

          // ===== Comissões (commission_splits) — se houver =====
          const monthKey = (d: string) => { const dt = new Date(d); return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`; };
          const monthLabel = (k: string) => { const [y,m] = k.split("-"); return new Date(Number(y), Number(m)-1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }); };
          const thisMonthKey = monthKey(new Date().toISOString());
          const paidThisMonth = splits.filter((c) => c.status === "pago" && c.paid_at && monthKey(c.paid_at) === thisMonthKey).reduce((s, c) => s + Number(c.amount || 0), 0);

          return (
            <>
              <div className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 p-6 sm:p-8 mb-5 shadow-sm">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_60%)]" />
                <div className="relative">
                  <div className="text-[10.5px] uppercase tracking-[0.18em] font-semibold text-emerald-50/90">Financeiro</div>
                  <h1 className="text-2xl sm:text-3xl font-semibold text-white mt-1 tracking-tight">Extrato de recebíveis</h1>
                  <p className="text-[13px] text-emerald-50/85 mt-1">Panorama financeiro completo — por cliente e geral. Somente visualização.</p>
                  <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: "A receber", value: formatBRL(aReceber), sub: `${recCps.filter((c) => !(c.sales?.paid_at || doneStatus(c.status))).length} demandas em aberto` },
                      { label: "Recebido", value: formatBRL(recebido), sub: `${recCps.filter((c) => (c.sales?.paid_at || doneStatus(c.status))).length} quitadas` },
                      { label: "Recorrente/mês", value: formatBRL(recorrenteMensal), sub: `${recCps.filter((c) => c.sales?.revenue_type === "recorrente").length} contratos mensais` },
                      { label: "Total geral", value: formatBRL(totalHist), sub: `${clientRows.length} cliente(s) ativos` },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm px-3.5 py-3">
                        <div className="text-[10px] uppercase tracking-[0.12em] font-medium text-emerald-50/80">{s.label}</div>
                        <div className="text-lg font-semibold text-white tabular-nums mt-0.5">{s.value}</div>
                        <div className="text-[10.5px] text-emerald-50/75 mt-0.5">{s.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {clientRows.length === 0 && splits.length === 0 ? (
                <SectionCard title=""><EmptyState icon={Wallet} title="Sem recebíveis" description="Assim que suas demandas gerarem receita, você verá aqui." /></SectionCard>
              ) : (
                <>
                  {clientRows.length > 0 && (
                    <SectionCard title="Extrato por cliente" icon={Sparkles}>
                      <div className="space-y-2">
                        {clientRows.map((row) => (
                          <details key={row.clientId} className="group rounded-lg border border-slate-200/70 bg-white overflow-hidden">
                            <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50/60 list-none">
                              <div className="size-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-[11px] font-semibold shrink-0">{initials(row.clientName)}</div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-semibold text-slate-900 truncate">{row.clientName}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {row.items.length} demanda(s)
                                  {row.recorrente > 0 && <> · <span className="text-teal-700 font-medium">{formatBRL(row.recorrente)}/mês</span></>}
                                </div>
                              </div>
                              <div className="text-right shrink-0 hidden sm:block">
                                <div className="text-[10px] uppercase tracking-wider text-slate-400">A receber</div>
                                <div className="text-[13px] font-semibold text-amber-700 tabular-nums">{formatBRL(row.aReceber)}</div>
                              </div>
                              <div className="text-right shrink-0 hidden md:block">
                                <div className="text-[10px] uppercase tracking-wider text-slate-400">Recebido</div>
                                <div className="text-[13px] font-semibold text-emerald-700 tabular-nums">{formatBRL(row.recebido)}</div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-[10px] uppercase tracking-wider text-slate-400">Total</div>
                                <div className="text-[13px] font-semibold text-slate-900 tabular-nums">{formatBRL(row.total)}</div>
                              </div>
                              <ArrowUpRight className="size-4 text-slate-400 group-open:rotate-90 transition-transform ml-1" />
                            </summary>
                            <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/30">
                              {row.items.map((it) => {
                                const isPaid = it.sales?.paid_at || doneStatus(it.status);
                                const isRec = it.sales?.revenue_type === "recorrente";
                                return (
                                  <li key={it.id} className="flex items-center gap-3 px-4 py-2.5">
                                    <div className={cn("size-2 rounded-full shrink-0", isPaid ? "bg-emerald-500" : "bg-amber-400")} />
                                    <div className="min-w-0 flex-1">
                                      <div className="text-[12.5px] font-medium text-slate-900 truncate">{it.products?.name || "Demanda"}</div>
                                      <div className="text-[10.5px] text-slate-500 mt-0.5">
                                        {isRec ? <span className="text-teal-700 font-medium">Recorrente {it.sales?.recurrence_months}m</span> : <span>Avulso</span>}
                                        {it.deadline && <> · vence {formatDate(it.deadline)}</>}
                                        {it.sales?.paid_at && <> · pago {formatDate(it.sales.paid_at)}</>}
                                      </div>
                                    </div>
                                    <Badge variant="outline" className={cn("text-[10px] border capitalize hidden sm:inline-flex", isPaid ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>{isPaid ? "recebido" : "a receber"}</Badge>
                                    <div className="text-right shrink-0 tabular-nums text-[13px] font-semibold text-slate-900 min-w-[90px]">{formatBRL(it.value)}</div>
                                  </li>
                                );
                              })}
                            </ul>
                          </details>
                        ))}
                      </div>
                    </SectionCard>
                  )}

                  {splits.length > 0 && (
                    <SectionCard title="Comissões lançadas" icon={Wallet} className="mt-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/40 px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wider text-emerald-700">Pagas</div>
                          <div className="text-[15px] font-semibold text-emerald-900 tabular-nums">{formatBRL(commKpis.pago)}</div>
                        </div>
                        <div className="rounded-lg border border-amber-200/60 bg-amber-50/40 px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wider text-amber-700">Pendentes</div>
                          <div className="text-[15px] font-semibold text-amber-900 tabular-nums">{formatBRL(commKpis.pendente)}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200/70 bg-white px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500">No mês</div>
                          <div className="text-[15px] font-semibold text-slate-900 tabular-nums">{formatBRL(paidThisMonth)}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200/70 bg-white px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wider text-slate-500">Lançamentos</div>
                          <div className="text-[15px] font-semibold text-slate-900 tabular-nums">{commKpis.count}</div>
                        </div>
                      </div>
                      <ul className="divide-y divide-slate-100 -mx-1">
                        {splits.map((c) => (
                          <li key={c.id} className="flex items-center gap-3 px-3 py-3">
                            <div className={cn("size-10 rounded-lg flex items-center justify-center border shrink-0", c.status === "pago" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
                              <Wallet className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-semibold text-slate-900 tabular-nums">{formatBRL(c.amount)} <span className="text-[11px] text-slate-400 font-normal">· {Number(c.percent || 0)}%</span></p>
                              <p className="text-[11.5px] text-slate-500 truncate mt-0.5">{c.client_name || "—"}{c.product_name ? ` · ${c.product_name}` : ""}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <Badge variant="outline" className={cn("text-[10px] border capitalize", c.status === "pago" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200")}>{c.status}</Badge>
                              <p className="text-[10.5px] text-slate-400 mt-1">{c.paid_at ? `pago ${formatDate(c.paid_at)}` : formatDate(c.created_at)}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </SectionCard>
                  )}
                </>
              )}
            </>
          );
        })()}


        {activeKey === "perfil" && (() => {
          const F = ({ label, value, onChange, placeholder, colSpan, disabled, maxLength }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; colSpan?: string; disabled?: boolean; maxLength?: number }) => (
            <div className={cn("space-y-1.5", colSpan)}>
              <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">{label}</Label>
              <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled || !editingProfile} maxLength={maxLength} className={cn(!editingProfile && "bg-slate-50/70")} />
            </div>
          );
          const set = (k: keyof typeof profileForm) => (v: string) => setProfileForm((f) => ({ ...f, [k]: v }));
          return (
            <>
              <PanelHero role="prestador" eyebrow="Perfil" title="Sua conta" subtitle={provider.email} />

              <div className={cn("rounded-lg border px-3 py-2.5 text-[12px] mb-4", editingProfile ? "border-teal-200 bg-teal-50 text-teal-800" : "border-slate-200 bg-slate-50 text-slate-700")}>
                {editingProfile
                  ? "Preencha seus dados e clique em Salvar. Você pode editar quando quiser."
                  : "Mantenha seus dados atualizados. Clique em Editar para preencher ou corrigir."}
              </div>

              <SectionCard
                title="Dados pessoais"
                icon={UserCog}
                action={
                  editingProfile ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => { setEditingProfile(false); if (provider) setProfileForm(hydrateProfile(provider)); }}>Cancelar</Button>
                      <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>{saveProfile.isPending ? "Salvando..." : "Salvar"}</Button>
                    </div>
                  ) : (
                    <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => setEditingProfile(true)}>Editar dados</Button>
                  )
                }
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <F label="Nome" value={profileForm.name} onChange={set("name")} />
                  <F label="Especialidade" value={profileForm.specialty} onChange={set("specialty")} placeholder="Ex.: Tráfego pago, Design, Consultoria..." />
                  <F label="E-mail" value={provider.email || ""} onChange={() => {}} disabled />
                  <F label="Documento (CPF / CNPJ)" value={profileForm.document_number} onChange={set("document_number")} />
                  <F label="Telefone" value={profileForm.phone} onChange={set("phone")} placeholder="(00) 00000-0000" />
                  <F label="WhatsApp" value={profileForm.whatsapp} onChange={set("whatsapp")} placeholder="(00) 00000-0000" />
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Mini-bio</Label>
                    <textarea
                      value={profileForm.bio}
                      onChange={(e) => set("bio")(e.target.value)}
                      disabled={!editingProfile}
                      rows={3}
                      maxLength={500}
                      placeholder="Um resumo curto sobre você e sua atuação (até 500 caracteres)"
                      className={cn("w-full rounded-md border border-slate-200 px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-teal-500/30", !editingProfile && "bg-slate-50/70")}
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Endereço" icon={UserCog} className="mt-4">
                <div className="grid sm:grid-cols-6 gap-4">
                  <F label="CEP" value={profileForm.address_zip} onChange={set("address_zip")} placeholder="00000-000" colSpan="sm:col-span-2" />
                  <F label="Rua" value={profileForm.address_street} onChange={set("address_street")} colSpan="sm:col-span-4" />
                  <F label="Número" value={profileForm.address_number} onChange={set("address_number")} colSpan="sm:col-span-1" />
                  <F label="Complemento" value={profileForm.address_complement} onChange={set("address_complement")} colSpan="sm:col-span-2" />
                  <F label="Bairro" value={profileForm.address_neighborhood} onChange={set("address_neighborhood")} colSpan="sm:col-span-3" />
                  <F label="Cidade" value={profileForm.address_city} onChange={set("address_city")} colSpan="sm:col-span-4" />
                  <F label="Estado (UF)" value={profileForm.address_state} onChange={(v) => set("address_state")(v.toUpperCase())} colSpan="sm:col-span-2" maxLength={2} />
                </div>
              </SectionCard>

              <SectionCard title="Dados bancários" icon={Wallet} className="mt-4">
                <p className="text-[12px] text-slate-500 mb-3">Usamos esses dados para pagar suas comissões e recebíveis.</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <F label="Chave PIX" value={profileForm.pix_key} onChange={set("pix_key")} placeholder="CPF, e-mail, telefone ou chave aleatória" />
                  </div>
                  <F label="Banco" value={profileForm.bank_name} onChange={set("bank_name")} />
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Tipo de conta</Label>
                    <select
                      value={profileForm.bank_account_type}
                      onChange={(e) => set("bank_account_type")(e.target.value)}
                      disabled={!editingProfile}
                      className={cn("w-full h-10 rounded-md border border-slate-200 px-3 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30", !editingProfile && "bg-slate-50/70")}
                    >
                      <option value="corrente">Conta corrente</option>
                      <option value="poupanca">Conta poupança</option>
                      <option value="pagamento">Conta de pagamento</option>
                    </select>
                  </div>
                  <F label="Agência" value={profileForm.bank_agency} onChange={set("bank_agency")} />
                  <F label="Conta" value={profileForm.bank_account} onChange={set("bank_account")} placeholder="00000-0" />
                </div>
              </SectionCard>

              <SectionCard title="" className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12px] text-slate-500">Encerrar sua sessão nesta janela.</p>
                  <Button variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => signOut?.()}>Sair</Button>
                </div>
              </SectionCard>
            </>
          );
        })()}
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

      <Dialog open={!!reportView} onOpenChange={(o) => !o && setReportView(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">Reporte enviado</DialogTitle>
          </DialogHeader>
          {reportView && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200/70 bg-slate-50/60 p-3">
                <p className="text-[11px] uppercase tracking-wider text-slate-400">Demanda</p>
                <p className="text-[13px] font-semibold text-slate-900 mt-0.5">{reportView._clientName} · <span className="font-medium text-slate-600">{reportView._productName}</span></p>
                <p className="text-[11px] text-slate-400 mt-1">{formatDate(reportView.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-slate-400">Status</span>
                <Badge variant="outline" className="capitalize">{String(reportView.status).replace(/_/g, " ")}</Badge>
              </div>
              {reportView.notes && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Notas do reporte</p>
                  <p className="text-[13px] text-slate-700 whitespace-pre-wrap">{reportView.notes}</p>
                </div>
              )}
              {reportView.pending && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-amber-600 mb-1">Pendências</p>
                  <p className="text-[13px] text-slate-700 whitespace-pre-wrap">{reportView.pending}</p>
                </div>
              )}
              {reportView.next_steps && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-blue-600 mb-1">Próximos passos</p>
                  <p className="text-[13px] text-slate-700 whitespace-pre-wrap">{reportView.next_steps}</p>
                </div>
              )}
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/demanda/${reportView.client_product_id}`}>Abrir demanda</Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </PanelShell>
  );
}
