import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { sanitizeStorageFileName, uploadErrorMessage, uploadStorageFileFast } from "@/lib/uploads";
import { toast } from "sonner";
import { Loader2, MessageSquare } from "lucide-react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Briefcase, FileText, Wallet, UserCog, Inbox, CheckCircle2,
  Calendar, HelpCircle, Receipt, Package, FileText as FileTextIcon,
  MessageCircle, Mail, Clock, ArrowUpRight, ShieldCheck, AlertTriangle, Upload,
  FileSignature,
} from "lucide-react";
import { ClientContractsTab } from "@/components/client/ClientContractsTab";
import { PanelShell } from "@/components/panels/PanelShell";
import { PanelHero } from "@/components/panels/PanelHero";
import { PanelContainer } from "@/components/panels/PanelContainer";
import { SectionCard, EmptyState } from "@/components/panels/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSystemSettings, buildMailtoLink, buildWhatsAppLink } from "@/hooks/useSystemSettings";
import { ClientDocumentsTab } from "@/components/client/ClientDocumentsTab";
import { PaymentReceiptDialog } from "@/components/client/PaymentReceiptDialog";
import { ClientSupportTab } from "@/components/client/ClientSupportTab";

const NAV = [
  { key: "dashboard",  label: "Início",     icon: LayoutDashboard },
  { key: "pendencias", label: "Pendências", icon: AlertTriangle },
  { key: "servicos",   label: "Serviços",   icon: Briefcase },
  { key: "documentos", label: "Documentos", icon: FileText, shortLabel: "Docs" },
  { key: "contratos",  label: "Contratos",  icon: FileSignature },
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

const OPEN_PAYMENT_STATUSES = ["pendente", "em_aberto", "parcial", "parcialmente_pago", "atrasado", "vencido"];

const splitPaymentDescription = (description?: string | null) => {
  if (!description) return { title: "Pendência de pagamento", note: "" };
  const [title, ...rest] = description.split(" — ");
  return { title: title?.trim() || "Pendência de pagamento", note: rest.join(" — ").trim() };
};

const isPaymentOverdue = (payment: any) => {
  if (!OPEN_PAYMENT_STATUSES.includes(payment.status) || !payment.due_date) return false;
  const [y, m, d] = String(payment.due_date).slice(0, 10).split("-").map(Number);
  const due = new Date(y, (m || 1) - 1, d || 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
};

const paymentStatusMeta = (payment: any) => {
  if (payment.status === "pago" || payment.status === "paga") {
    return { label: "Pago", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", iconTone: "bg-emerald-50 text-emerald-700 border-emerald-100" };
  }
  if (payment.status === "cancelado") {
    return { label: "Cancelado", tone: "bg-slate-100 text-slate-600 border-slate-200", iconTone: "bg-slate-50 text-slate-600 border-slate-200" };
  }
  if (isPaymentOverdue(payment)) {
    return { label: "Vencido", tone: "bg-rose-50 text-rose-700 border-rose-200", iconTone: "bg-rose-50 text-rose-700 border-rose-100" };
  }
  if (payment.status === "parcial" || payment.status === "parcialmente_pago") {
    return { label: "Parcial", tone: "bg-amber-50 text-amber-700 border-amber-200", iconTone: "bg-amber-50 text-amber-700 border-amber-100" };
  }
  return { label: "Pendente", tone: "bg-amber-50 text-amber-700 border-amber-200", iconTone: "bg-sky-50 text-sky-700 border-sky-100" };
};

export default function ClientPanel() {
  const { user, signOut } = useAuth() as any;
  const settings = useSystemSettings();
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeKey = NAV.find((n) => n.key === tab)?.key ?? "dashboard";
  const onNavigate = (k: string) => navigate(k === "dashboard" ? "/portal-cliente" : `/portal-cliente/${k}`);
  const supportMessage = `Olá! Preciso de suporte com ${settings.company_name}.`;
  const whatsappLink = buildWhatsAppLink(settings.support_whatsapp, supportMessage);
  const mailLink = buildMailtoLink(settings.support_email, `Suporte - ${settings.company_name}`);

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
    queryFn: async () => {
      const { data } = await supabase.from("client_products")
        .select("id, product_id, status, value, deadline, sla_due_date, created_at, custom_product_name, products(id, name, description)")
        .eq("client_id", clientId!).order("created_at", { ascending: false });
      return data ?? [];
    },
    staleTime: 2 * 60_000,
  });

  const { data: docs = [] } = useQuery({
    queryKey: ["client-docs", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      // Read from both legacy (client_document_requests) and the main documents table
      // used by the admin "Solicitar Documento" flow.
      const [{ data: cdr }, { data: docsTable }] = await Promise.all([
        supabase.from("client_document_requests")
          .select("id, title, description, status, due_date, file_url, created_at, updated_at, reviewed_at, client_product_id, priority")
          .eq("client_id", clientId!),
        supabase.from("documents")
          .select("id, name, description, status, due_date, file_path, created_at, updated_at, reviewed_at, product_id, client_product_id, priority, uploaded_at, rejection_reason")
          .eq("client_id", clientId!),
      ]);
      const normalized = [
        ...((cdr ?? []) as any[]).map((d) => ({
          id: d.id,
          client_id: clientId!,
          product_id: (demandas as any[]).find((cp) => cp.id === d.client_product_id)?.product_id ?? null,
          client_product_id: d.client_product_id,
          product_name: (demandas as any[]).find((cp) => cp.id === d.client_product_id)?.products?.name ?? null,
          name: d.title,
          title: d.title,
          description: d.description,
          status: d.status,
          due_date: d.due_date,
          file_path: null,
          file_url: d.file_url,
          created_at: d.created_at,
          updated_at: d.updated_at,
          reviewed_at: d.reviewed_at,
          uploaded_at: d.updated_at,
          rejection_reason: null,
          priority: d.priority,
          source: "client_document_requests",
          _source: "client_document_requests",
        })),
        ...((docsTable ?? []) as any[]).map((d: any) => ({
          id: d.id,
          client_id: clientId!,
          product_id: d.product_id,
          client_product_id: d.client_product_id,
          product_name: (demandas as any[]).find((cp) => cp.id === d.client_product_id)?.products?.name ?? null,
          name: d.name,
          title: d.name,
          description: d.description,
          status: d.status,
          due_date: d.due_date,
          file_path: d.file_path,
          file_url: d.file_path,
          created_at: d.created_at,
          updated_at: d.updated_at,
          reviewed_at: d.reviewed_at,
          uploaded_at: d.uploaded_at,
          rejection_reason: d.rejection_reason,
          priority: d.priority,
          source: "documents",
          _source: "documents",
        })),
      ];
      normalized.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
      return normalized;
    },
    staleTime: 2 * 60_000,
  });


  const { data: payments = [] } = useQuery({
    queryKey: ["client-payments", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase.from("payments")
        .select(`
          id, amount, amount_paid, status, due_date, paid_at, description, notes, receipt_url,
          installment_number, installments_count, created_at, client_id, client_product_id, product_id,
          client_product:client_products(custom_product_name, products(name)),
          product:products(name)
        `)
        .eq("client_id", clientId!).order("due_date", { ascending: false });
      return data ?? [];
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["client-contracts", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase.from("contracts")
        .select("id, name, status, amount, file_path, signed_at, sent_at, created_at, products(name)")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    staleTime: 2 * 60_000,
  });

  const qc = useQueryClient();
  const { data: openTickets = [] } = useQuery({
    queryKey: ["client-open-tickets", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("client_support_tickets")
        .select("id, subject, category, status, priority, client_product_id, created_at, last_message_at")
        .eq("client_id", clientId!)
        .not("status", "in", "(closed,resolved,fechado,resolvido)")
        .order("last_message_at", { ascending: false, nullsFirst: false });
      return data ?? [];
    },
    staleTime: 60_000,
  });

  // Inline document upload from the "Pendências → Documentos" sub-tab
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<any | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const pickFileFor = (doc: any) => {
    setUploadTarget(doc);
    setTimeout(() => uploadInputRef.current?.click(), 0);
  };
  const onFilePicked = async (files: File[]) => {
    const doc = uploadTarget;
    const [file, ...extraFiles] = files;
    if (!file || !doc || !clientId) { setUploadTarget(null); return; }
    try {
      setUploadingId(doc.id);
      const path = `${clientId}/${doc.id}/${Date.now()}-${sanitizeStorageFileName(file.name)}`;
      await uploadStorageFileFast("documents", path, file);
      const now = new Date().toISOString();
      if (doc._source === "client_document_requests") {
        const { error } = await supabase.from("client_document_requests")
          .update({ file_url: path, status: "enviado", updated_at: now }).eq("id", doc.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("documents")
          .update({ file_path: path, status: "enviado", uploaded_at: now, rejection_reason: null, file_size: file.size, mime_type: file.type } as any)
          .eq("id", doc.id);
        if (error) throw error;
      }
      if (extraFiles.length > 0) {
        const rows: any[] = [];
        for (const [index, extra] of extraFiles.entries()) {
          const extraPath = `${clientId}/${doc.id}/${Date.now()}-${index + 1}-${sanitizeStorageFileName(extra.name)}`;
          await uploadStorageFileFast("documents", extraPath, extra);
          rows.push({
            client_id: clientId,
            product_id: doc.product_id || null,
            client_product_id: doc.client_product_id || null,
            name: `${doc.name || doc.title || "Documento"} · ${extra.name}`,
            description: doc.description || null,
            status: "enviado",
            file_path: extraPath,
            uploaded_at: now,
            file_size: extra.size,
            mime_type: extra.type,
            source: "client_upload",
            is_required: false,
          });
        }
        const { error } = await supabase.from("documents").insert(rows as any);
        if (error) throw error;
      }
      toast.success(`${files.length} arquivo(s) enviado(s) para análise`);
      // Optimistically mark this document as sent so it disappears from "Pendências"
      // immediately, without waiting for the refetch.
      const patchCachedList = (old: unknown) => Array.isArray(old)
        ? old.map((item: any) => item?.id === doc.id ? {
            ...item,
            status: "enviado",
            file_path: doc._source === "documents" ? path : item.file_path,
            file_url: path,
            uploaded_at: now,
            updated_at: now,
            rejection_reason: null,
          } : item)
        : old;
      (qc as any).setQueriesData({ queryKey: ["client-docs"] }, patchCachedList);
      await qc.invalidateQueries({ queryKey: ["client-docs", clientId] });
      await qc.refetchQueries({ queryKey: ["client-docs", clientId] });
    } catch (e: any) {
      toast.error(uploadErrorMessage(e) ?? "Falha ao enviar documento");
    } finally {
      setUploadingId(null);
      setUploadTarget(null);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  };







  const pendingDocs = useMemo(
    () => (docs as any[]).filter((d) => ["solicitado", "pendente", "reprovado", "pendente_correcao"].includes(String(d.status || "").toLowerCase())),
    [docs]
  );
  const pendingPayments = useMemo(
    () => (payments as any[]).filter((p) => OPEN_PAYMENT_STATUSES.includes(p.status)),
    [payments]
  );
  const pendencias = useMemo(() => {
    const docItems = pendingDocs.map((d: any) => ({
      key: `doc-${d.id}`,
      type: "doc" as const,
      title: d.title,
      subtitle: d.product_name || "Documento solicitado",
      due: d.due_date,
      status: d.status,
      raw: d,
    }));
    const payItems = pendingPayments.map((p: any) => {
      const desc = splitPaymentDescription(p.description);
      const productName = p.client_product?.products?.name || p.client_product?.custom_product_name || p.product?.name || "Pendência avulsa";
      return {
        key: `pay-${p.id}`,
        type: "payment" as const,
        title: desc.title,
        subtitle: productName,
        due: p.due_date,
        amount: Math.max(Number(p.amount || 0) - Number(p.amount_paid || 0), 0) || Number(p.amount || 0),
        status: isPaymentOverdue(p) ? "vencido" : p.status,
        raw: p,
      };
    });
    return [...docItems, ...payItems].sort((a, b) => (a.due || "").localeCompare(b.due || ""));
  }, [pendingDocs, pendingPayments]);

  const kpis = useMemo(() => {
    const active = (demandas as any[]).filter((d) => !["concluida","concluido","cancelada"].includes(d.status)).length;
    const totalPaid = (payments as any[]).filter((p) => p.status === "pago").reduce((s, p) => s + Number(p.amount || 0), 0);
    const totalDue = (payments as any[]).filter((p) => p.status !== "pago" && p.status !== "cancelado").reduce((s, p) => s + Number(p.amount || 0), 0);
    return { active, docsPend: pendingDocs.length, totalPaid, totalDue, totalPending: pendingDocs.length + pendingPayments.length };
  }, [demandas, payments, pendingDocs, pendingPayments]);

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
    <PanelShell role="cliente" nav={NAV} activeKey={activeKey} onNavigate={onNavigate} userName={client.full_name} userSubtitle={client.email} notifCount={kpis.totalPending}>
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

              <SectionCard title="Pendências" icon={AlertTriangle} action={pendencias.length > 0 ? <Button size="sm" variant="outline" onClick={() => onNavigate("pendencias")}>Ver todas</Button> : undefined}>
                {pendencias.length === 0 ?
                  <EmptyState icon={CheckCircle2} title="Tudo em dia" description="Sem documentos ou pagamentos pendentes." /> :
                  <ul className="divide-y divide-slate-100 -mx-1">
                    {pendencias.slice(0, 6).map((p) => (
                      <li key={p.key}>
                        <button
                          type="button"
                          onClick={() => onNavigate(p.type === "doc" ? "documentos" : "pagamentos")}
                          className="w-full text-left px-3 py-2.5 hover:bg-slate-50 rounded-md transition"
                        >
                          <div className="flex items-center gap-2">
                            {p.type === "doc" ? <Upload className="size-3.5 text-amber-600 shrink-0" /> : <Receipt className="size-3.5 text-sky-600 shrink-0" />}
                            <p className="text-[13px] font-medium text-slate-900 truncate flex-1">{p.title}</p>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-1 pl-5">
                            <p className="text-[11px] text-slate-500 truncate">{p.due ? `vence ${formatDate(p.due)}` : "sem prazo"}</p>
                            <Badge variant="outline" className={cn("text-[10px] border capitalize", p.status === "vencido" || p.status === "reprovado" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200")}>{p.status}</Badge>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>}
              </SectionCard>
            </div>
          </>
        )}

        {activeKey === "pendencias" && (
          <>
            <PanelHero
              role="cliente"
              eyebrow="Ação necessária"
              title="Minhas pendências"
              subtitle={pendencias.length === 0 && openTickets.length === 0
                ? "Você está em dia — nada pendente no momento."
                : `${pendencias.length + openTickets.length} item(ns) aguardando sua ação.`}
              stats={[
                { label: "Documentos", value: pendingDocs.length },
                { label: "Financeiras", value: pendingPayments.length },
                { label: "Dúvidas", value: openTickets.length },
                { label: "Vencidos", value: pendencias.filter((p) => p.status === "vencido" || p.status === "reprovado").length },
              ]}
            />

            <input
              ref={uploadInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => onFilePicked(Array.from(e.target.files ?? []))}
            />

            <Tabs defaultValue="documentos" className="w-full">
              <TabsList className="grid grid-cols-3 w-full max-w-lg mb-4">
                <TabsTrigger value="documentos" className="gap-2">
                  <Upload className="size-3.5" /> Documentos
                  {pendingDocs.length > 0 && <Badge variant="outline" className="ml-1 h-4 px-1.5 text-[10px] bg-amber-50 border-amber-200 text-amber-700">{pendingDocs.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="financeiras" className="gap-2">
                  <Receipt className="size-3.5" /> Financeiras
                  {pendingPayments.length > 0 && <Badge variant="outline" className="ml-1 h-4 px-1.5 text-[10px] bg-sky-50 border-sky-200 text-sky-700">{pendingPayments.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="duvidas" className="gap-2">
                  <MessageSquare className="size-3.5" /> Dúvidas
                  {openTickets.length > 0 && <Badge variant="outline" className="ml-1 h-4 px-1.5 text-[10px] bg-indigo-50 border-indigo-200 text-indigo-700">{openTickets.length}</Badge>}
                </TabsTrigger>
              </TabsList>

              {/* DOCUMENTOS */}
              <TabsContent value="documentos" className="mt-0">
                <SectionCard title="" padding="none">
                  {pendingDocs.length === 0 ? (
                    <EmptyState icon={CheckCircle2} title="Nenhum documento pendente" description="Assim que solicitarem novos documentos, aparecerão aqui." />
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {pendingDocs.map((d: any) => (
                        <li key={d.id} className="px-4 sm:px-5 py-4 flex items-start gap-3 hover:bg-slate-50/60 transition">
                          <div className="size-10 rounded-lg border bg-amber-50 text-amber-700 border-amber-100 flex items-center justify-center shrink-0">
                            <Upload className="size-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-[14px] font-semibold text-slate-900">{d.title || d.name}</p>
                              <Badge variant="outline" className={cn("text-[10px] border capitalize", d.status === "reprovado" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
                                {d.status === "reprovado" ? "Reenviar" : "Pendente"}
                              </Badge>
                            </div>
                            {d.product_name && <p className="text-[12px] text-slate-500 mt-1 truncate">Vinculado a: <span className="font-medium text-slate-700">{d.product_name}</span></p>}
                            {d.description && <p className="text-[12px] text-slate-500 mt-1 line-clamp-2">{d.description}</p>}
                            <div className="flex items-center gap-3 mt-2 text-[11.5px] text-slate-500">
                              <span><Calendar className="size-3 inline mr-1" />{d.due_date ? `Prazo: ${formatDate(d.due_date)}` : "sem prazo"}</span>
                            </div>
                            <div className="mt-3 flex items-center gap-2 flex-wrap">
                              <Button
                                size="sm"
                                className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                                onClick={() => pickFileFor(d)}
                                disabled={uploadingId === d.id}
                              >
                                {uploadingId === d.id ? <><Loader2 className="size-3.5 animate-spin" /> Enviando…</> : <><Upload className="size-3.5" /> Enviar arquivo</>}
                              </Button>
                              <Button size="sm" variant="outline" className="h-8" onClick={() => onNavigate("documentos")}>
                                Abrir na aba Documentos →
                              </Button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </SectionCard>
              </TabsContent>

              {/* FINANCEIRAS */}
              <TabsContent value="financeiras" className="mt-0">
                <SectionCard title="" padding="none">
                  {pendingPayments.length === 0 ? (
                    <EmptyState icon={CheckCircle2} title="Sem pendências financeiras" description="Você está em dia com todos os pagamentos." />
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {pendingPayments.map((p: any) => {
                        const desc = splitPaymentDescription(p.description);
                        const productName = p.client_product?.products?.name || p.client_product?.custom_product_name || p.product?.name || "Pendência avulsa";
                        const overdue = isPaymentOverdue(p);
                        const amount = Math.max(Number(p.amount || 0) - Number(p.amount_paid || 0), 0) || Number(p.amount || 0);
                        return (
                          <li key={p.id} className="px-4 sm:px-5 py-4 flex items-start gap-3 hover:bg-slate-50/60 transition">
                            <div className={cn("size-10 rounded-lg border flex items-center justify-center shrink-0", overdue ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-sky-50 text-sky-700 border-sky-100")}>
                              <Receipt className="size-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-[14px] font-semibold text-slate-900">{desc.title}</p>
                                <Badge variant="outline" className={cn("text-[10px] border capitalize", overdue ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
                                  {overdue ? "Vencido" : p.status}
                                </Badge>
                              </div>
                              <p className="text-[12px] text-slate-500 mt-1 truncate">{productName}</p>
                              <div className="flex items-center gap-3 mt-2 text-[11.5px] text-slate-500">
                                <span><Calendar className="size-3 inline mr-1" />{p.due_date ? formatDate(p.due_date) : "sem prazo"}</span>
                                <span className="font-mono tabular-nums text-slate-900 font-semibold">{formatBRL(amount)}</span>
                              </div>
                              <div className="mt-3">
                                <Button size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => onNavigate("pagamentos")}>
                                  Ver pagamento →
                                </Button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </SectionCard>
              </TabsContent>

              {/* DÚVIDAS */}
              <TabsContent value="duvidas" className="mt-0">
                <SectionCard
                  title=""
                  padding="none"
                  action={<Button size="sm" onClick={() => onNavigate("suporte")}>Nova dúvida</Button>}
                >
                  {openTickets.length === 0 ? (
                    <EmptyState
                      icon={MessageSquare}
                      title="Sem dúvidas em aberto"
                      description="Ficou com alguma dúvida? Abra um chamado que nosso time responde por aqui."
                    />
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {openTickets.map((t: any) => {
                        const dem = (demandas as any[]).find((d) => d.id === t.client_product_id);
                        const prodName = dem?.products?.name || dem?.custom_product_name || null;
                        return (
                          <li key={t.id} className="px-4 sm:px-5 py-4 flex items-start gap-3 hover:bg-slate-50/60 transition">
                            <div className="size-10 rounded-lg border bg-indigo-50 text-indigo-700 border-indigo-100 flex items-center justify-center shrink-0">
                              <MessageSquare className="size-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-[14px] font-semibold text-slate-900 truncate">{t.subject}</p>
                                <Badge variant="outline" className="text-[10px] capitalize bg-indigo-50 text-indigo-700 border-indigo-200">
                                  {String(t.status || "aberto").replace(/_/g, " ")}
                                </Badge>
                              </div>
                              {prodName && <p className="text-[12px] text-slate-500 mt-1 truncate">Sobre: <span className="font-medium text-slate-700">{prodName}</span></p>}
                              <div className="flex items-center gap-3 mt-2 text-[11.5px] text-slate-500">
                                <span><Clock className="size-3 inline mr-1" />Última atualização: {formatDate(t.last_message_at || t.created_at)}</span>
                              </div>
                              <div className="mt-3">
                                <Button size="sm" variant="outline" className="h-8" onClick={() => onNavigate("suporte")}>
                                  Abrir conversa →
                                </Button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </SectionCard>
              </TabsContent>
            </Tabs>
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
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11.5px] text-slate-500 gap-2 flex-wrap">
                      <span><Calendar className="size-3 inline mr-1" />Início: {formatDate(d.created_at)}</span>
                      {d.sla_due_date && <span className={cn(new Date(d.sla_due_date) < new Date() ? "text-rose-600" : "text-slate-600")}>Prazo: {formatDate(d.sla_due_date)}</span>}
                      <Link to={`/demandas/${d.id}`} className="text-indigo-600 hover:underline font-medium ml-auto">Abrir →</Link>
                    </div>
                  </div>
                ))}
              </div>}
          </>
        )}

        {activeKey === "documentos" && (
          <>
            <PanelHero role="cliente" eyebrow="Documentos" title="Meus documentos" subtitle={`${docs.length} documento(s) · ${kpis.docsPend} pendente(s)`} />
            <ClientDocumentsTab
              clientId={clientId}
              requests={docs as any[]}
              products={(demandas as any[]).map((d) => ({ id: d.product_id || d.id, name: d.products?.name || d.custom_product_name || "Serviço" }))}
              invalidateKeys={[["client-docs", clientId], ["client-demandas", clientId]]}
            />
          </>
        )}

        {activeKey === "pagamentos" && (
          <>
            <PanelHero role="cliente" eyebrow="Financeiro" title="Pagamentos" subtitle={`${payments.length} faturas`} stats={[
              { label: "Faturas", value: payments.length },
              { label: "Em aberto", value: formatBRL((payments as any[]).filter((p) => OPEN_PAYMENT_STATUSES.includes(p.status)).reduce((sum, p) => sum + Math.max(Number(p.amount || 0) - Number(p.amount_paid || 0), 0), 0)) },
              { label: "Vencidas", value: (payments as any[]).filter(isPaymentOverdue).length },
              { label: "Pagas", value: (payments as any[]).filter((p) => p.status === "pago" || p.status === "paga").length },
            ]} />
            <SectionCard title="" padding="none">
              {payments.length === 0 ? <EmptyState icon={Wallet} title="Sem faturas" /> :
                <ul className="divide-y divide-slate-100">
                  {(payments as any[]).map((p) => {
                    const status = paymentStatusMeta(p);
                    const desc = splitPaymentDescription(p.description);
                    const productName = p.client_product?.products?.name || p.client_product?.custom_product_name || p.product?.name || "Pendência avulsa";
                    const outstanding = Math.max(Number(p.amount || 0) - Number(p.amount_paid || 0), 0);
                    const installment = p.installments_count > 1 ? `${p.installment_number || 1}/${p.installments_count}` : "Única";

                    return (
                      <li key={p.id} className="px-4 sm:px-5 py-4 hover:bg-slate-50/70 transition-colors">
                        <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className={cn("size-11 rounded-lg border flex items-center justify-center shrink-0", status.iconTone)}>
                              {p.status === "pago" || p.status === "paga" ? <CheckCircle2 className="size-5" /> : <Receipt className="size-5" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-[14px] font-semibold text-slate-900 leading-tight">{desc.title}</p>
                                <Badge variant="outline" className={cn("text-[10px] border shrink-0", status.tone)}>{status.label}</Badge>
                              </div>
                              <div className="mt-2 grid sm:grid-cols-2 xl:grid-cols-4 gap-2 text-[12px] text-slate-600">
                                <span className="inline-flex items-center gap-1.5 min-w-0"><Package className="size-3.5 text-slate-400 shrink-0" /><span className="truncate">{productName}</span></span>
                                <span className="inline-flex items-center gap-1.5"><Calendar className="size-3.5 text-slate-400" />{p.paid_at ? `Pago em ${formatDate(p.paid_at)}` : `Vence em ${formatDate(p.due_date)}`}</span>
                                <span className="inline-flex items-center gap-1.5"><Wallet className="size-3.5 text-slate-400" />Parcela {installment}</span>
                                <span className="font-mono tabular-nums text-slate-900 sm:text-right xl:text-left">{formatBRL(p.amount)}</span>
                              </div>
                              {(desc.note || p.notes || Number(p.amount_paid || 0) > 0) && (
                                <div className="mt-3 rounded-lg border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-[12px] text-slate-600 space-y-1">
                                  {desc.note && <p><FileTextIcon className="size-3.5 inline mr-1.5 text-slate-400" />{desc.note}</p>}
                                  {p.notes && <p>{p.notes}</p>}
                                  {Number(p.amount_paid || 0) > 0 && <p className="font-mono text-emerald-700">Pago: {formatBRL(p.amount_paid)} · Saldo: {formatBRL(outstanding)}</p>}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="lg:text-right shrink-0 lg:min-w-[180px] space-y-2">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Valor da pendência</p>
                              <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900">{formatBRL(outstanding || Number(p.amount || 0))}</p>
                            </div>
                            {p.status !== "pago" && p.status !== "paga" && p.status !== "cancelado" && clientId && (
                              <PaymentReceiptDialog
                                clientId={clientId}
                                payment={p}
                                invalidateKey={["client-payments", clientId]}
                              />
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>}
            </SectionCard>
          </>
        )}

        {activeKey === "contratos" && (
          <>
            <PanelHero
              role="cliente"
              eyebrow="Contratos"
              title="Meus contratos"
              subtitle={`${contracts.length} contrato(s) · ${(contracts as any[]).filter((c) => c.status === "assinado" || c.status === "finalizado").length} assinado(s)`}
              stats={[
                { label: "Total", value: contracts.length },
                { label: "Aguardando", value: (contracts as any[]).filter((c) => c.status === "enviado" || c.status === "aguardando_assinatura").length },
                { label: "Assinados", value: (contracts as any[]).filter((c) => c.status === "assinado" || c.status === "finalizado").length },
              ]}
            />
            {clientId && <ClientContractsTab clientId={clientId} contracts={contracts as any[]} />}
          </>
        )}




        {activeKey === "suporte" && (
          <>
            <PanelHero
              role="cliente"
              eyebrow="Atendimento"
              title="Suporte"
              subtitle="Fale com a equipe pelo canal oficial de atendimento."
              actions={(
                <Button asChild className="bg-white text-sky-700 hover:bg-sky-50 border border-white/30 shadow-sm">
                  <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                    WhatsApp <ArrowUpRight className="size-4 ml-1.5" />
                  </a>
                </Button>
              )}
            />

            {clientId && <ClientSupportTab clientId={clientId} demandas={demandas as any[]} />}

            <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-5">

              <SectionCard title="Canais de atendimento" subtitle="Escolha como quer falar conosco" icon={HelpCircle}>
                <div className="grid sm:grid-cols-2 gap-3">
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 transition hover:border-sky-200 hover:bg-sky-50/60"
                  >
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-lg bg-sky-50 border border-sky-100 text-sky-700 flex items-center justify-center shrink-0 group-hover:bg-white">
                        <MessageCircle className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">WhatsApp</p>
                        <p className="mt-1 text-xs text-slate-500 leading-relaxed">Atendimento direto para dúvidas sobre serviços, documentos e pagamentos.</p>
                        <p className="mt-3 font-mono text-xs font-semibold text-sky-700">+{settings.support_whatsapp}</p>
                      </div>
                    </div>
                  </a>

                  <a
                    href={mailLink}
                    className="group rounded-xl border border-slate-200/70 bg-slate-50/60 p-4 transition hover:border-indigo-200 hover:bg-indigo-50/50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 group-hover:bg-white">
                        <Mail className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">E-mail</p>
                        <p className="mt-1 text-xs text-slate-500 leading-relaxed">Use para enviar informações, comprovantes ou detalhes mais completos.</p>
                        <p className="mt-3 text-xs font-semibold text-indigo-700 truncate">{settings.support_email}</p>
                      </div>
                    </div>
                  </a>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button asChild className="bg-sky-600 hover:bg-sky-700">
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer">Iniciar conversa</a>
                  </Button>
                  <Button asChild variant="outline">
                    <a href={mailLink}>Enviar e-mail</a>
                  </Button>
                </div>
              </SectionCard>

              <SectionCard title="Informações" icon={Clock}>
                <div className="space-y-4 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="size-9 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-500 shrink-0">
                      <Clock className="size-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Resposta rápida</p>
                      <p className="text-xs text-slate-500 mt-0.5">Retorno em horário comercial.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="size-9 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-500 shrink-0">
                      <ShieldCheck className="size-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Canal oficial</p>
                      <p className="text-xs text-slate-500 mt-0.5">Atendimento validado pela equipe {settings.company_name}.</p>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </div>
          </>
        )}

        {activeKey === "perfil" && (
          <>
            <PanelHero role="cliente" eyebrow="Perfil" title="Sua conta" subtitle={client.email} />
            <SectionCard title="Dados cadastrais" icon={UserCog}>
              <ClientProfileForm client={client} onSaved={() => qc.invalidateQueries({ queryKey: ["client-panel"] })} onSignOut={() => signOut?.()} />
            </SectionCard>
          </>
        )}
      </PanelContainer>
    </PanelShell>
  );
}

function ClientProfileForm({ client, onSaved, onSignOut }: { client: any; onSaved: () => void; onSignOut: () => void }) {
  const [form, setForm] = useState({
    full_name: client.full_name || "",
    email: client.email || "",
    phone: client.phone || "",
    document: client.document || "",
  });
  const [saving, setSaving] = useState(false);
  const dirty =
    form.full_name !== (client.full_name || "") ||
    form.email !== (client.email || "") ||
    form.phone !== (client.phone || "") ||
    form.document !== (client.document || "");

  async function save() {
    if (!form.full_name.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    const { error } = await supabase
      .from("clients")
      .update({
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        document: form.document.trim() || null,
      })
      .eq("id", client.id);
    setSaving(false);
    if (error) { toast.error(error.message || "Falha ao salvar"); return; }
    toast.success("Dados atualizados");
    onSaved();
  }

  const field = (key: keyof typeof form, label: string, placeholder = "") => (
    <div>
      <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 block mb-1">{label}</label>
      <input
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full h-9 px-3 rounded-md border border-slate-200 bg-white text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
      />
    </div>
  );

  return (
    <>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
        {field("full_name", "Nome", "Seu nome completo")}
        {field("email", "E-mail", "seu@email.com")}
        {field("phone", "Telefone", "(11) 99999-9999")}
        {field("document", "Documento", "CPF ou CNPJ")}
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-5">
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
        <Button variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50" onClick={onSignOut}>Sair</Button>
      </div>
    </>
  );
}
