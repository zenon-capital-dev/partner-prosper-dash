import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Users, Wallet, FileText, UserCog, Inbox, Clock, Eye, EyeOff, Save,
  BookOpen, LifeBuoy, Download, ExternalLink, Plus, MessageSquare, FileSignature, Upload, FileCheck2,
  Briefcase,
  CalendarClock,
} from "lucide-react";
import { PanelShell } from "@/components/panels/PanelShell";
import Agenda from "@/pages/Agenda";
import { PanelHero } from "@/components/panels/PanelHero";
import { PanelContainer } from "@/components/panels/PanelContainer";
import { SectionCard, EmptyState } from "@/components/panels/SectionCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatBRL, formatDate, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ClientDocumentsTab } from "@/components/client/ClientDocumentsTab";
import { DemandRequestsPanel } from "@/components/demands/DemandRequestsPanel";
import { downloadStorageFile, openDownloadUrl } from "@/lib/download";
import { sanitizeStorageFileName, uploadErrorMessage, uploadStorageFileFast } from "@/lib/uploads";
import { SupportThread } from "@/components/partner-support/SupportThread";

const NAV = [
  { key: "dashboard",  label: "Início",     icon: LayoutDashboard },
  { key: "clientes",   label: "Clientes",   icon: Users },
  { key: "servicos",   label: "Serviços",   icon: Briefcase },
  { key: "documentos", label: "Documentos", icon: FileText, shortLabel: "Docs" },
  { key: "agenda",     label: "Agenda",     icon: CalendarClock },
  { key: "comissoes",  label: "Comissões",  icon: Wallet, shortLabel: "Comissões" },
  { key: "extrato",    label: "Extrato",    icon: FileText },
  { key: "materiais",  label: "Materiais",  icon: BookOpen },
  { key: "contratos",  label: "Contratos",  icon: FileSignature },
  { key: "suporte",    label: "Suporte",    icon: LifeBuoy },
  { key: "perfil",     label: "Perfil",     icon: UserCog },
];

const MATERIAL_CATEGORIES: Record<string, string> = {
  institucional: "Institucional",
  vendas: "Argumentos de venda",
  treinamento: "Treinamentos",
  gatilhos: "Gatilhos mentais",
  produtos: "Produtos",
  outros: "Outros",
};

const CLIENT_TONE: Record<string, string> = {
  ativo: "bg-emerald-50 text-emerald-700 border-emerald-200",
  prospecto: "bg-slate-100 text-slate-700 border-slate-200",
  inativo: "bg-slate-100 text-slate-500 border-slate-200",
};

const SERVICE_TONE: Record<string, { label: string; tone: string }> = {
  aguardando_inicio: { label: "Aguardando", tone: "bg-slate-100 text-slate-700 border-slate-200" },
  em_andamento: { label: "Em andamento", tone: "bg-violet-50 text-violet-700 border-violet-200" },
  em_execucao: { label: "Em execução", tone: "bg-violet-50 text-violet-700 border-violet-200" },
  pausado: { label: "Pausado", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  concluido: { label: "Concluído", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  concluida: { label: "Concluído", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelado: { label: "Cancelado", tone: "bg-rose-50 text-rose-700 border-rose-200" },
  cancelada: { label: "Cancelado", tone: "bg-rose-50 text-rose-700 border-rose-200" },
};

export default function PartnerPanel() {
  const { user, signOut } = useAuth() as any;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { tab } = useParams<{ tab?: string }>();
  const activeKey = NAV.find((n) => n.key === tab)?.key ?? "dashboard";
  const onNavigate = (k: string) => navigate(k === "dashboard" ? "/parceiro" : `/parceiro/${k}`);
  const [requestsTarget, setRequestsTarget] = useState<{ id: string; clientName?: string } | null>(null);

  const { data: partner } = useQuery({
    queryKey: ["partner-self", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      let { data } = await supabase.from("partners").select("*").eq("user_id", user!.id).maybeSingle();
      if (!data && user?.email) {
        const { data: be } = await supabase.from("partners").select("*").ilike("email", user.email).maybeSingle();
        data = be;
        // best-effort self-link so future queries hit by user_id
        if (data && !data.user_id) {
          try {
            await supabase.from("partners").update({ user_id: user!.id }).eq("id", data.id);
            data.user_id = user!.id;
          } catch (_) { /* ignore */ }
        }
      }
      return data;
    },
    staleTime: 60_000,
  });


  const showProductName: boolean = !!(partner as any)?.show_product_name;

  const { data: clients = [] } = useQuery({
    queryKey: ["partner-clients", partner?.id],
    enabled: !!partner?.id,
    queryFn: async () => {
      const [{ data: primary }, { data: linked }] = await Promise.all([
        supabase
          .from("clients")
          .select("id, full_name, email, phone, status, created_at, partner_id")
          .eq("partner_id", partner!.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("client_partners")
          .select("client_id, clients(id, full_name, email, phone, status, created_at, partner_id)")
          .eq("partner_id", partner!.id),
      ]);

      const map = new Map<string, any>();
      (primary ?? []).forEach((c: any) => map.set(c.id, { ...c, partner_link_type: "principal" }));
      (linked ?? []).forEach((row: any) => {
        const c = Array.isArray(row.clients) ? row.clients[0] : row.clients;
        if (c?.id) map.set(c.id, { ...c, partner_link_type: c.partner_id === partner!.id ? "principal" : "vinculado" });
      });
      return Array.from(map.values()).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    },
    staleTime: 2 * 60_000,
  });

  const clientIds = useMemo(() => (clients as any[]).map((c) => c.id).filter(Boolean), [clients]);

  const { data: services = [] } = useQuery({
    queryKey: ["partner-services", partner?.id, clientIds.join(",")],
    enabled: !!partner?.id && clientIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_products")
        .select("id, product_id, client_id, status, value, deadline, sla_due_date, created_at, updated_at, custom_product_name, notes, service_provider_id, responsible_provider_id, clients(id, full_name, email, phone), products(id, name, description), service_providers:service_provider_id(id, name, specialty), responsible_provider:responsible_provider_id(id, name, specialty)")
        .in("client_id", clientIds)
        .order("created_at", { ascending: false })
        .limit(300);
      return data ?? [];
    },
    staleTime: 2 * 60_000,
  });

  const serviceIds = useMemo(() => (services as any[]).map((s) => s.id).filter(Boolean), [services]);

  const { data: documents = [] } = useQuery({
    queryKey: ["partner-docs", partner?.id, clientIds.join(","), serviceIds.join(",")],
    enabled: !!partner?.id && clientIds.length > 0,
    queryFn: async () => {
      const [docsRes, cdrRes, reqRes] = await Promise.all([
        supabase
          .from("documents")
          .select("id, client_id, product_id, name, status, created_at, updated_at, client_product_id, due_date, description, file_path, uploaded_at, rejection_reason, priority, clients(full_name), products(name)")
          .in("client_id", clientIds)
          .order("created_at", { ascending: false })
          .limit(300),
        supabase
          .from("client_document_requests")
          .select("id, client_id, title, status, file_url, created_at, updated_at, client_product_id, due_date, description, reviewed_at, priority, clients(full_name)")
          .in("client_id", clientIds)
          .order("created_at", { ascending: false })
          .limit(300),
        serviceIds.length > 0
          ? supabase
              .from("document_requests")
              .select("id, client_id, product_id, request_title, status, file_url, requested_at, updated_at, client_product_id, deadline, description, rejection_reason, submission_date, priority, clients(full_name), products(name)")
              .in("client_product_id", serviceIds)
              .order("requested_at", { ascending: false })
              .limit(300)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const serviceById = new Map((services as any[]).map((s) => [s.id, s]));
      const productNameFor = (row: any) => row.products?.name || serviceById.get(row.client_product_id)?.products?.name || serviceById.get(row.client_product_id)?.custom_product_name || null;
      const clientNameFor = (row: any) => row.clients?.full_name || serviceById.get(row.client_product_id)?.clients?.full_name || null;

      const docs = (docsRes.data ?? []).map((d: any) => ({
        id: d.id, client_id: d.client_id, product_id: d.product_id, name: d.name, status: d.status, created_at: d.created_at,
        updated_at: d.updated_at, client_product_id: d.client_product_id, due_date: d.due_date,
        description: d.description, file_path: d.file_path, file_url: d.file_path, uploaded_at: d.uploaded_at,
        rejection_reason: d.rejection_reason, reviewed_at: d.reviewed_at, priority: d.priority,
        client_name: clientNameFor(d), product_name: productNameFor(d), source: "documents",
      }));
      const cdr = (cdrRes.data ?? []).map((d: any) => ({
        id: d.id, client_id: d.client_id, product_id: serviceById.get(d.client_product_id)?.product_id || null, name: d.title,
        status: d.status, created_at: d.created_at, updated_at: d.updated_at, client_product_id: d.client_product_id, due_date: d.due_date,
        description: d.description, file_path: null, file_url: d.file_url, uploaded_at: d.updated_at,
        rejection_reason: null, reviewed_at: d.reviewed_at, priority: d.priority,
        client_name: clientNameFor(d), product_name: productNameFor(d), source: "client_document_requests",
      }));
      // document_requests usa status em inglês (pending/submitted/approved/rejected)
      // Normalizamos para o vocabulário PT-BR usado pelo componente ClientDocumentsTab
      // (que só reconhece pendente/solicitado/enviado/em_analise/aprovado/reprovado).
      const REQ_STATUS_MAP: Record<string, string> = {
        pending: "pendente",
        submitted: "enviado",
        approved: "aprovado",
        rejected: "reprovado",
      };
      const reqs = (reqRes.data ?? []).map((r: any) => ({
        id: r.id, client_id: r.client_id, product_id: r.product_id || serviceById.get(r.client_product_id)?.product_id || null, name: r.request_title,
        status: REQ_STATUS_MAP[r.status] ?? r.status, created_at: r.requested_at, updated_at: r.updated_at, client_product_id: r.client_product_id, due_date: r.deadline,
        description: r.description, file_path: null, file_url: r.file_url, uploaded_at: r.submission_date,
        rejection_reason: r.rejection_reason, reviewed_at: null, priority: r.priority,
        client_name: clientNameFor(r), product_name: productNameFor(r), source: "document_requests",
      }));
      return [...reqs, ...cdr, ...docs].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    },
    staleTime: 2 * 60_000,
  });

  // Documents addressed TO this partner (by admin)
  const { data: myDocs = [] } = useQuery({
    queryKey: ["partner-mydocs", partner?.id],
    enabled: !!partner?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("id, name, status, description, due_date, file_path, file_size, mime_type, uploaded_at, created_at, rejection_reason")
        .eq("partner_id", partner!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [openHistoryId, setOpenHistoryId] = useState<string | null>(null);

  const uploadPartnerDoc = async (docId: string, file: File, currentDoc?: any) => {
    if (!partner?.id) return;
    if (currentDoc?.status === "aprovado") {
      toast.error("Este documento já foi aprovado e não pode ser substituído.");
      return;
    }
    if (currentDoc?.file_path) {
      const ok = window.confirm("Substituir o arquivo enviado? O arquivo anterior ficará no histórico.");
      if (!ok) return;
    }
    setUploadingDocId(docId);
    try {
      const path = `partners/${partner.id}/${docId}-${Date.now()}-${sanitizeStorageFileName(file.name)}`;
      await uploadStorageFileFast("documents", path, file, false);

      // Save previous file in history before replacing
      if (currentDoc?.file_path) {
        const { count } = await supabase
          .from("document_versions")
          .select("id", { count: "exact", head: true })
          .eq("document_id", docId);
        await supabase.from("document_versions").insert({
          document_id: docId,
          version_number: (count ?? 0) + 1,
          file_path: currentDoc.file_path,
          file_size: currentDoc.file_size ?? null,
          mime_type: currentDoc.mime_type ?? null,
          uploaded_by: user?.id ?? null,
          note: "Substituído pelo parceiro",
        });
      }

      const { error: updErr } = await supabase
        .from("documents")
        .update({ file_path: path, file_size: file.size, mime_type: file.type, status: "enviado", uploaded_at: new Date().toISOString(), uploaded_by: user?.id ?? null, rejection_reason: null })
        .eq("id", docId);
      if (updErr) throw updErr;
      toast.success("Documento enviado");
      qc.invalidateQueries({ queryKey: ["partner-mydocs", partner.id] });
      qc.invalidateQueries({ queryKey: ["partner-doc-versions", docId] });
    } catch (e: any) {
      toast.error(uploadErrorMessage(e) || "Falha ao enviar");
    } finally {
      setUploadingDocId(null);
    }
  };

  const removePartnerDoc = async (doc: any) => {
    if (!partner?.id || !doc?.file_path) return;
    if (doc.status === "aprovado") { toast.error("Documento já aprovado — não pode ser removido."); return; }
    if (!window.confirm("Remover o arquivo enviado? Será mantido no histórico.")) return;
    try {
      const { count } = await supabase
        .from("document_versions")
        .select("id", { count: "exact", head: true })
        .eq("document_id", doc.id);
      await supabase.from("document_versions").insert({
        document_id: doc.id,
        version_number: (count ?? 0) + 1,
        file_path: doc.file_path,
        file_size: doc.file_size ?? null,
        mime_type: doc.mime_type ?? null,
        uploaded_by: user?.id ?? null,
        note: "Removido pelo parceiro",
      });
      const { error } = await supabase
        .from("documents")
        .update({ file_path: null, file_size: null, mime_type: null, status: "solicitado", uploaded_at: null })
        .eq("id", doc.id);
      if (error) throw error;
      toast.success("Arquivo removido");
      qc.invalidateQueries({ queryKey: ["partner-mydocs", partner.id] });
      qc.invalidateQueries({ queryKey: ["partner-doc-versions", doc.id] });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao remover");
    }
  };

  const downloadPartnerDoc = async (d: any) => {
    if (!d.file_path) return;
    const filename = d.name || (d.file_path as string).split("/").pop() || "documento";
    try {
      await downloadStorageFile("documents", d.file_path, filename);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao baixar");
    }
  };



  const { data: commissions = [] } = useQuery({
    queryKey: ["partner-commissions", partner?.id],
    enabled: !!partner?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_splits")
        .select("id, amount, percent, status, paid_at, created_at, sale_id, sales(clients(full_name), products(name))")
        .eq("beneficiary_type", "partner")
        .eq("beneficiary_id", partner!.id)
        .order("created_at", { ascending: false });
      return (data ?? []).map((c: any) => ({
        ...c,
        clients: c.sales?.clients,
        products: c.sales?.products,
      }));
    },
    staleTime: 2 * 60_000,
  });

  const kpis = useMemo(() => {
    const all = commissions as any[];
    const paid = all.filter((c) => c.status === "pago");
    const pending = all.filter((c) => c.status === "pendente");
    const totalPaid = paid.reduce((s, c) => s + Number(c.amount || 0), 0);
    const totalPending = pending.reduce((s, c) => s + Number(c.amount || 0), 0);

    const thisMonth = new Date(); const m = thisMonth.getMonth(); const y = thisMonth.getFullYear();
    const monthPaid = paid.filter((c) => { const d = c.paid_at ? new Date(c.paid_at) : new Date(c.created_at); return d.getMonth() === m && d.getFullYear() === y; })
      .reduce((s, c) => s + Number(c.amount || 0), 0);

    return {
      totalPaid, totalPending, monthPaid,
      clients: (clients as any[]).length,
      activeClients: (clients as any[]).filter((c) => c.status === "ativo").length,
      services: (services as any[]).length,
      pendingDocs: (documents as any[]).filter((d) => ["pendente", "solicitado", "reprovado", "pendente_correcao"].includes(d.status)).length,
    };
  }, [commissions, clients, services, documents]);

  const firstName = (partner?.full_name || user?.user_metadata?.full_name || user?.email || "Parceiro").split(" ")[0];

  // ----- Edit profile -----
  const [editing, setEditing] = useState(false);
  const emptyForm = {
    full_name: "", email: "", phone: "", whatsapp: "", document: "",
    pix_key: "", bank_name: "", bank_agency: "", bank_account: "", bank_account_type: "",
    address_zip: "", address_street: "", address_number: "", address_complement: "",
    address_neighborhood: "", address_city: "", address_state: "",
  };
  const [form, setForm] = useState(emptyForm);
  const hydrate = (p: any) => ({
    full_name: p?.full_name || "",
    email: p?.email || "",
    phone: p?.phone || "",
    whatsapp: p?.whatsapp || "",
    document: p?.document || "",
    pix_key: p?.pix_key || "",
    bank_name: p?.bank_name || "",
    bank_agency: p?.bank_agency || "",
    bank_account: p?.bank_account || "",
    bank_account_type: p?.bank_account_type || "",
    address_zip: p?.address_zip || "",
    address_street: p?.address_street || "",
    address_number: p?.address_number || "",
    address_complement: p?.address_complement || "",
    address_neighborhood: p?.address_neighborhood || "",
    address_city: p?.address_city || "",
    address_state: p?.address_state || "",
  });
  useEffect(() => { if (partner) setForm(hydrate(partner)); }, [partner]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!partner?.id) throw new Error("Parceiro não encontrado");
      const { error } = await supabase.from("partners").update(form as any).eq("id", partner.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados de contato atualizados");
      qc.invalidateQueries({ queryKey: ["partner-self", user?.id] });
      qc.invalidateQueries({ queryKey: ["partner-self"] });
      setEditing(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  // ----- Materials (read-only for partner) -----
  const { data: materials = [] } = useQuery({
    queryKey: ["partner-materials", partner?.id],
    enabled: !!partner?.id,
    queryFn: async () => {
      const { data } = await (supabase as any).from("partner_materials").select("*").eq("active", true).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const downloadMaterial = async (m: any) => {
    if (m.external_url) { openDownloadUrl(m.external_url); return; }
    if (!m.file_path) { toast.error("Material sem arquivo anexado"); return; }
    const filename = (m.file_path as string).split("/").pop() || "material";
    try {
      await downloadStorageFile("partner-materials", m.file_path, filename);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível baixar o arquivo");
    }
  };

  // ----- Support tickets -----
  const { data: tickets = [] } = useQuery({
    queryKey: ["partner-tickets", partner?.id],
    enabled: !!partner?.id,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await (supabase as any).from("partner_support_tickets").select("*").eq("partner_id", partner!.id).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: "", message: "", priority: "normal" });
  const submitTicket = useMutation({
    mutationFn: async () => {
      if (!partner?.id) throw new Error("Parceiro não encontrado");
      if (!ticketForm.subject.trim() || !ticketForm.message.trim()) throw new Error("Preencha assunto e mensagem");
      const { error } = await (supabase as any).from("partner_support_tickets").insert({
        partner_id: partner.id,
        user_id: user?.id,
        subject: ticketForm.subject.trim(),
        message: ticketForm.message.trim(),
        priority: ticketForm.priority,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chamado enviado. Nossa equipe responderá em breve.");
      setTicketOpen(false);
      setTicketForm({ subject: "", message: "", priority: "normal" });
      qc.invalidateQueries({ queryKey: ["partner-tickets", partner?.id] });
      qc.invalidateQueries({ queryKey: ["partner-tickets"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao enviar chamado"),
  });

  // ----- Contratos -----
  const { data: contract } = useQuery({
    queryKey: ["partner-contract", partner?.id],
    enabled: !!partner?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("partner_contracts").select("*").eq("partner_id", partner!.id).maybeSingle();
      return data;
    },
  });

  const emptyContract = {
    person_type: "pf",
    full_name: "", cpf: "", rg: "", rg_issuer: "", birth_date: "",
    marital_status: "", nationality: "Brasileira", profession: "",
    company_name: "", company_cnpj: "",
    legal_representative_name: "", legal_representative_cpf: "", legal_representative_role: "",
    email: "", phone: "", whatsapp: "",
    address_zip: "", address_street: "", address_number: "", address_complement: "",
    address_neighborhood: "", address_city: "", address_state: "",
    bank_name: "", bank_agency: "", bank_account: "", bank_account_type: "corrente", pix_key: "",
    notes: "",
  };
  const [contractForm, setContractForm] = useState<any>(emptyContract);
  useEffect(() => {
    if (contract) {
      setContractForm({ ...emptyContract, ...contract, birth_date: contract.birth_date || "" });
    } else if (partner) {
      const p: any = partner;
      setContractForm((cf: any) => ({
        ...cf,
        full_name: partner.full_name || cf.full_name,
        email: partner.email || cf.email,
        phone: partner.phone || cf.phone,
        whatsapp: partner.whatsapp || cf.whatsapp,
        cpf: partner.document || cf.cpf,
        address_zip: p.address_zip || cf.address_zip,
        address_street: p.address_street || cf.address_street,
        address_number: p.address_number || cf.address_number,
        address_complement: p.address_complement || cf.address_complement,
        address_neighborhood: p.address_neighborhood || cf.address_neighborhood,
        address_city: p.address_city || cf.address_city,
        address_state: p.address_state || cf.address_state,
        bank_name: partner.bank_name || cf.bank_name,
        bank_agency: partner.bank_agency || cf.bank_agency,
        bank_account: partner.bank_account || cf.bank_account,
        bank_account_type: p.bank_account_type || cf.bank_account_type,
        pix_key: partner.pix_key || cf.pix_key,
      }));
    }
  }, [contract, partner]);

  const contractLocked = contract?.status === "assinado";

  const saveContract = useMutation({
    mutationFn: async (submit: boolean) => {
      if (!partner?.id) throw new Error("Parceiro não encontrado");
      const payload: any = {
        ...contractForm,
        partner_id: partner.id,
        user_id: user?.id,
        birth_date: contractForm.birth_date || null,
      };
      if (submit) {
        payload.status = "enviado";
        payload.form_submitted_at = new Date().toISOString();
      }
      if (contract?.id) {
        const { error } = await (supabase as any).from("partner_contracts").update(payload).eq("id", contract.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("partner_contracts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_d, submit) => {
      toast.success(submit ? "Dados enviados para nossa equipe" : "Rascunho salvo");
      qc.invalidateQueries({ queryKey: ["partner-contract", partner?.id] });
      qc.invalidateQueries({ queryKey: ["partner-contract"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const downloadContractFile = async (path: string) => {
    const filename = path.split("/").pop() || "contrato";
    try {
      await downloadStorageFile("partner-contracts", path, filename);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível baixar o arquivo");
    }
  };

  const productLabel = (c: any) => (showProductName ? (c.products?.name || "") : "Produto contratado");




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
                        <div className="flex items-center gap-1.5 shrink-0">
                         {c.partner_link_type === "vinculado" && <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-700 bg-indigo-50">vinculado</Badge>}
                         <Badge variant="outline" className={cn("text-[10px] border capitalize", CLIENT_TONE[c.status] || "bg-slate-100")}>{c.status}</Badge>
                       </div>
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
                        <p className="text-[11px] text-slate-500 truncate">{c.clients?.full_name || "—"} · {productLabel(c)}</p>
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
                      <div className="flex items-center gap-1.5 shrink-0">
                        {c.partner_link_type === "vinculado" && <Badge variant="outline" className="text-[10px] border-indigo-200 text-indigo-700 bg-indigo-50">vinculado</Badge>}
                        <Badge variant="outline" className={cn("text-[10px] border capitalize", CLIENT_TONE[c.status] || "bg-slate-100")}>{c.status}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>}
            </SectionCard>
          </>
        )}

        {activeKey === "servicos" && (
          <>
            <PanelHero role="parceiro" eyebrow="Operação" title="Serviços dos clientes" subtitle={`${services.length} serviço(s) em acompanhamento na sua carteira.`} stats={[
              { label: "Ativos", value: (services as any[]).filter((s) => !["concluido", "concluida", "cancelado", "cancelada"].includes(s.status)).length },
              { label: "Concluídos", value: (services as any[]).filter((s) => ["concluido", "concluida"].includes(s.status)).length },
              { label: "Valor total", value: formatBRL((services as any[]).reduce((sum, s) => sum + Number(s.value || 0), 0)) },
              { label: "Docs pendentes", value: kpis.pendingDocs },
            ]} />
            {services.length === 0 ? <SectionCard title=""><EmptyState icon={Briefcase} title="Nenhum serviço vinculado" description="Quando seus clientes tiverem serviços/demandas, eles aparecerão aqui." /></SectionCard> :
              <div className="grid sm:grid-cols-2 gap-3">
                {(services as any[]).map((service) => {
                  const meta = SERVICE_TONE[service.status] || { label: service.status || "—", tone: "bg-slate-100 text-slate-700 border-slate-200" };
                  const productName = service.products?.name || service.custom_product_name || "Serviço";
                  return (
                    <div key={service.id} className="bg-white rounded-xl border border-slate-200/70 p-4 shadow-sm hover:shadow-md hover:border-violet-200 transition">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <Badge variant="outline" className={cn("text-[10px] border", meta.tone)}>{meta.label}</Badge>
                        <p className="font-mono text-[13px] font-semibold text-slate-900 tabular-nums">{formatBRL(service.value)}</p>
                      </div>
                      <p className="text-[14.5px] font-semibold text-slate-900 leading-tight">{service.clients?.full_name || "—"}</p>
                      <p className="text-[12px] text-slate-500 mt-0.5 truncate">{productName}</p>
                      <p className="text-[11.5px] text-slate-500 mt-1 truncate">Prestador: {service.service_providers?.name || service.responsible_provider?.name || "Não definido"}</p>
                      {service.notes && <p className="text-[11.5px] text-slate-500 mt-2 line-clamp-2">{service.notes}</p>}
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-[11.5px] text-slate-500 flex-wrap">
                        <span>Início: {formatDate(service.created_at)}{service.sla_due_date || service.deadline ? ` · prazo ${formatDate(service.sla_due_date || service.deadline)}` : ""}</span>
                        <div className="flex gap-1.5">
                          <Link to={`/demandas/${service.id}`} className="inline-flex items-center h-8 px-2 rounded border border-slate-200 text-[11px] text-slate-700 hover:bg-slate-50">Abrir</Link>
                          <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => setRequestsTarget({ id: service.id, clientName: service.clients?.full_name })}>
                            <MessageSquare className="size-3 mr-1" /> Solicitar
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>}
          </>
        )}

        {activeKey === "documentos" && (
          <>
            <PanelHero role="parceiro" eyebrow="Arquivos" title="Documentos dos clientes" subtitle={`${documents.length} documento(s) e solicitação(ões) da sua carteira.`} stats={[
              { label: "Pendentes", value: kpis.pendingDocs },
              { label: "Em análise", value: (documents as any[]).filter((d) => ["enviado", "em_analise"].includes(d.status)).length },
              { label: "Aprovados", value: (documents as any[]).filter((d) => d.status === "aprovado").length },
              { label: "Clientes", value: clients.length },
            ]} />

            <SectionCard title="Meus documentos solicitados" subtitle="Documentos que a equipe pediu para você enviar.">
              {(myDocs as any[]).length === 0 ? (
                <EmptyState icon={FileText} title="Nenhum documento pendente" description="Quando a equipe solicitar um documento, ele aparecerá aqui." />
              ) : (
                <div className="space-y-2">
                  {(myDocs as any[]).map((d) => {
                    const sent = !!d.file_path;
                    const statusTone = d.status === "aprovado" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : d.status === "reprovado" ? "bg-rose-50 text-rose-700 border-rose-200"
                      : sent ? "bg-sky-50 text-sky-700 border-sky-200"
                      : "bg-amber-50 text-amber-700 border-amber-200";
                    const approved = d.status === "aprovado";
                    const isHistoryOpen = openHistoryId === d.id;
                    return (
                      <div key={d.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm truncate">{d.name}</p>
                              <span className={cn("text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border", statusTone)}>{d.status}</span>
                            </div>
                            {d.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{d.description}</p>}
                            {d.due_date && <p className="text-[11px] text-slate-400 mt-0.5">Prazo: {formatDate(d.due_date)}</p>}
                            {d.uploaded_at && <p className="text-[11px] text-slate-400 mt-0.5">Último envio: {formatDate(d.uploaded_at)}</p>}
                            {d.rejection_reason && <p className="text-[11px] text-rose-600 mt-0.5">Motivo: {d.rejection_reason}</p>}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                            {sent && (
                              <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => downloadPartnerDoc(d)}>
                                <Download className="size-3 mr-1" /> Baixar último
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-8 text-[11px]" onClick={() => setOpenHistoryId(isHistoryOpen ? null : d.id)}>
                              <Clock className="size-3 mr-1" /> Histórico
                            </Button>
                            {sent && !approved && (
                              <Button size="sm" variant="outline" className="h-8 text-[11px] text-rose-600 border-rose-200 hover:bg-rose-50" onClick={() => removePartnerDoc(d)}>
                                Remover
                              </Button>
                            )}
                            {!approved && (
                              <label className="inline-flex items-center h-8 px-2.5 rounded-md text-[11px] font-medium bg-primary text-white hover:opacity-90 cursor-pointer">
                                <Upload className="size-3 mr-1" />
                                {uploadingDocId === d.id ? "Enviando..." : sent ? "Substituir" : "Enviar"}
                                <input type="file" className="hidden" disabled={uploadingDocId === d.id} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPartnerDoc(d.id, f, d); e.target.value = ""; }} />
                              </label>
                            )}
                          </div>
                        </div>
                        {isHistoryOpen && <PartnerDocHistory docId={d.id} currentDoc={d} onDownload={downloadPartnerDoc} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>


            <ClientDocumentsTab
              clientId={partner?.id || "partner"}
              requests={documents as any[]}
              products={(services as any[]).map((service) => ({ id: service.product_id || service.id, name: service.products?.name || service.custom_product_name || "Serviço" }))}
              getUploadFolder={(req) => req.client_product_id || req.client_id || partner?.id}
              invalidateKeys={[["partner-docs", partner?.id, clientIds.join(","), serviceIds.join(",")]]}
              hideEmptyState
            />
          </>
        )}

        {activeKey === "agenda" && (
          <div className="-mx-4 sm:-mx-6">
            <Agenda />
          </div>
        )}



        {activeKey === "comissoes" && (
          <>
            <PanelHero role="parceiro" eyebrow="Financeiro" title="Comissões" subtitle="Histórico completo das suas comissões." stats={[
              { label: "Pagas", value: formatBRL(kpis.totalPaid) },
              { label: "Pendentes", value: formatBRL(kpis.totalPending) },
              { label: "Total", value: commissions.length },
              { label: "Mês atual", value: formatBRL(kpis.monthPaid) },
            ]} />
            <div className="flex items-center justify-end gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 px-2 py-1 rounded-md border border-slate-200 bg-white">
                {showProductName ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                {showProductName ? "Nome do produto visível" : "Nome do produto oculto (definido pelo admin)"}
              </span>
            </div>
            <SectionCard title="">
              {commissions.length === 0 ? <EmptyState icon={Wallet} title="Sem comissões" /> :
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-100">
                        <th className="px-3 py-2.5">Cliente</th>
                        {showProductName && <th className="px-3 py-2.5">Produto</th>}
                        <th className="px-3 py-2.5 text-right">Valor</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(commissions as any[]).map((c) => (
                        <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                          <td className="px-3 py-2.5 text-slate-900 font-medium">{c.clients?.full_name || "—"}</td>
                          {showProductName && <td className="px-3 py-2.5 text-slate-600">{c.products?.name || "—"}</td>}
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
                        <p className="text-[11.5px] text-slate-500 capitalize">{paid ? "Comissão paga" : "Aguardando pagamento"} · {productLabel(c)}</p>
                      </li>
                    );
                  })}
                </ol>}
            </SectionCard>
          </>
        )}

        {activeKey === "contratos" && (
          <>
            <PanelHero role="parceiro" eyebrow="Documentação" title="Contratos"
              subtitle="Preencha seus dados para que possamos gerar o Contrato de Parceria e o NDA. Depois de assinados, eles ficam disponíveis aqui." />

            {contract?.status && (
              <div className="mb-4">
                <Badge variant="outline" className={cn(
                  "text-[11px]",
                  contract.status === "rascunho" && "bg-slate-100 text-slate-700 border-slate-200",
                  contract.status === "enviado" && "bg-amber-50 text-amber-700 border-amber-200",
                  contract.status === "em_analise" && "bg-blue-50 text-blue-700 border-blue-200",
                  contract.status === "assinado" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                )}>
                  Status: {contract.status === "em_analise" ? "Em análise" : contract.status === "assinado" ? "Assinado" : contract.status === "enviado" ? "Enviado para análise" : "Rascunho"}
                </Badge>
                {contract.admin_notes && (
                  <p className="mt-2 text-[12.5px] text-slate-700 p-3 bg-amber-50/60 border border-amber-100 rounded">
                    <span className="font-semibold">Mensagem da equipe:</span> {contract.admin_notes}
                  </p>
                )}
              </div>
            )}

            <SectionCard title="📥 Contratos enviados pela equipe" icon={Download}>
              <p className="text-[12px] text-slate-500 mb-3">Baixe, assine e devolva os arquivos abaixo. Após enviar o assinado, nossa equipe confirma.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { key: "contract", label: "Contrato de Parceria", tplPath: contract?.contract_template_path, tplAt: contract?.contract_template_uploaded_at, signedPath: contract?.contract_signed_path, signedAt: contract?.contract_uploaded_at, dbField: "contract_signed_path", dbAt: "contract_uploaded_at" },
                  { key: "nda", label: "NDA — Confidencialidade", tplPath: contract?.nda_template_path, tplAt: contract?.nda_template_uploaded_at, signedPath: contract?.nda_signed_path, signedAt: contract?.nda_uploaded_at, dbField: "nda_signed_path", dbAt: "nda_uploaded_at" },
                ].map((doc) => (
                  <div key={doc.key} className="border border-slate-200 rounded-lg p-4 bg-white space-y-2">
                    <p className="text-[12px] font-bold text-slate-800">{doc.label}</p>
                    {doc.tplPath ? (
                      <Button size="sm" variant="outline" className="gap-2 w-full" onClick={() => downloadContractFile(doc.tplPath)}>
                        <Download className="size-3.5" /> Baixar original p/ assinar
                      </Button>
                    ) : <p className="text-[11.5px] text-slate-500">Aguardando envio do original pela nossa equipe.</p>}
                    <label className="cursor-pointer inline-flex items-center justify-center gap-2 w-full h-9 rounded border border-dashed border-indigo-300 text-[12px] text-indigo-700 hover:bg-indigo-50">
                      <Upload className="size-3.5" /> {doc.signedPath ? "Substituir assinado" : "Enviar assinado"}
                      <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={async (e) => {
                        const f = e.target.files?.[0]; e.target.value = "";
                        if (!f || !partner?.id) return;
                        try {
                          const path = `${partner.id}/${doc.key}_signed-${Date.now()}-${sanitizeStorageFileName(f.name)}`;
                          await uploadStorageFileFast("partner-contracts", path, f, false);
                          const patch: any = { [doc.dbField]: path, [doc.dbAt]: new Date().toISOString() };
                          let upsertError: any = null;
                          if (contract?.id) {
                            const { error } = await (supabase as any).from("partner_contracts").update(patch).eq("id", contract.id);
                            upsertError = error;
                          } else {
                            const { error } = await (supabase as any).from("partner_contracts").insert({ partner_id: partner.id, ...patch });
                            upsertError = error;
                          }
                          if (upsertError) throw upsertError;
                          toast.success("Arquivo assinado enviado");
                          qc.invalidateQueries({ queryKey: ["partner-contract", partner.id] });
                        } catch (err: any) {
                          toast.error(uploadErrorMessage(err) || err.message || "Erro no upload");
                        }
                      }} />
                    </label>
                    {doc.signedPath && (
                      <div className="pt-2 border-t border-slate-100 space-y-1">
                        <p className="text-[10.5px] uppercase tracking-wider font-semibold text-emerald-700">✓ Você enviou assinado</p>
                        <Button size="sm" variant="ghost" className="gap-2 w-full text-[11.5px]" onClick={() => downloadContractFile(doc.signedPath)}>
                          <Download className="size-3.5" /> Baixar seu envio
                        </Button>
                        {doc.signedAt && <p className="text-[10.5px] text-slate-400">Enviado em {formatDate(doc.signedAt)}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Dados para gerar os contratos" icon={FileSignature}>
              <p className="text-[12px] text-slate-500 mb-4">
                Preencha com cuidado — esses dados vão direto para os contratos. Se mudar algo, salve e nos avise.
                {contractLocked && <span className="block mt-1 text-emerald-700 font-semibold">Contrato já assinado. Os campos estão bloqueados.</span>}
              </p>

              <div className="mb-4">
                <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Você assinará como</Label>
                <Select value={contractForm.person_type} onValueChange={(v) => setContractForm({ ...contractForm, person_type: v })} disabled={contractLocked}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pf">Pessoa Física</SelectItem>
                    <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {contractForm.person_type === "pf" ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  <Cf label="Nome completo" value={contractForm.full_name} onChange={(v) => setContractForm({ ...contractForm, full_name: v })} locked={contractLocked} />
                  <Cf label="CPF" value={contractForm.cpf} onChange={(v) => setContractForm({ ...contractForm, cpf: v })} locked={contractLocked} />
                  <Cf label="RG" value={contractForm.rg} onChange={(v) => setContractForm({ ...contractForm, rg: v })} locked={contractLocked} />
                  <Cf label="Órgão emissor / UF" value={contractForm.rg_issuer} onChange={(v) => setContractForm({ ...contractForm, rg_issuer: v })} locked={contractLocked} />
                  <Cf label="Data de nascimento" type="date" value={contractForm.birth_date} onChange={(v) => setContractForm({ ...contractForm, birth_date: v })} locked={contractLocked} />
                  <Cf label="Nacionalidade" value={contractForm.nationality} onChange={(v) => setContractForm({ ...contractForm, nationality: v })} locked={contractLocked} />
                  <Cf label="Estado civil" value={contractForm.marital_status} onChange={(v) => setContractForm({ ...contractForm, marital_status: v })} locked={contractLocked} />
                  <Cf label="Profissão" value={contractForm.profession} onChange={(v) => setContractForm({ ...contractForm, profession: v })} locked={contractLocked} />
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  <Cf label="Razão social" value={contractForm.company_name} onChange={(v) => setContractForm({ ...contractForm, company_name: v })} locked={contractLocked} />
                  <Cf label="CNPJ" value={contractForm.company_cnpj} onChange={(v) => setContractForm({ ...contractForm, company_cnpj: v })} locked={contractLocked} />
                  <Cf label="Nome do representante legal" value={contractForm.legal_representative_name} onChange={(v) => setContractForm({ ...contractForm, legal_representative_name: v })} locked={contractLocked} />
                  <Cf label="CPF do representante" value={contractForm.legal_representative_cpf} onChange={(v) => setContractForm({ ...contractForm, legal_representative_cpf: v })} locked={contractLocked} />
                  <Cf label="Cargo do representante" value={contractForm.legal_representative_role} onChange={(v) => setContractForm({ ...contractForm, legal_representative_role: v })} locked={contractLocked} />
                </div>
              )}
            </SectionCard>

            <SectionCard title="Contato">
              <div className="grid sm:grid-cols-3 gap-4">
                <Cf label="E-mail" value={contractForm.email} onChange={(v) => setContractForm({ ...contractForm, email: v })} locked={contractLocked} />
                <Cf label="Telefone" value={contractForm.phone} onChange={(v) => setContractForm({ ...contractForm, phone: v })} locked={contractLocked} />
                <Cf label="WhatsApp" value={contractForm.whatsapp} onChange={(v) => setContractForm({ ...contractForm, whatsapp: v })} locked={contractLocked} />
              </div>
            </SectionCard>

            <SectionCard title="Endereço">
              <div className="grid sm:grid-cols-6 gap-4">
                <div className="sm:col-span-2"><Cf label="CEP" value={contractForm.address_zip} onChange={(v) => setContractForm({ ...contractForm, address_zip: v })} locked={contractLocked} /></div>
                <div className="sm:col-span-3"><Cf label="Rua" value={contractForm.address_street} onChange={(v) => setContractForm({ ...contractForm, address_street: v })} locked={contractLocked} /></div>
                <div className="sm:col-span-1"><Cf label="Número" value={contractForm.address_number} onChange={(v) => setContractForm({ ...contractForm, address_number: v })} locked={contractLocked} /></div>
                <div className="sm:col-span-2"><Cf label="Complemento" value={contractForm.address_complement} onChange={(v) => setContractForm({ ...contractForm, address_complement: v })} locked={contractLocked} /></div>
                <div className="sm:col-span-2"><Cf label="Bairro" value={contractForm.address_neighborhood} onChange={(v) => setContractForm({ ...contractForm, address_neighborhood: v })} locked={contractLocked} /></div>
                <div className="sm:col-span-2"><Cf label="Cidade" value={contractForm.address_city} onChange={(v) => setContractForm({ ...contractForm, address_city: v })} locked={contractLocked} /></div>
                <div className="sm:col-span-2"><Cf label="UF" value={contractForm.address_state} onChange={(v) => setContractForm({ ...contractForm, address_state: v })} locked={contractLocked} /></div>
              </div>
            </SectionCard>

            <SectionCard title="Dados bancários (para repasse de comissões)">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2"><Cf label="Chave PIX" value={contractForm.pix_key} onChange={(v) => setContractForm({ ...contractForm, pix_key: v })} locked={contractLocked} /></div>
                <Cf label="Banco" value={contractForm.bank_name} onChange={(v) => setContractForm({ ...contractForm, bank_name: v })} locked={contractLocked} />
                <div>
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Tipo de conta</Label>
                  <Select value={contractForm.bank_account_type || "corrente"} onValueChange={(v) => setContractForm({ ...contractForm, bank_account_type: v })} disabled={contractLocked}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corrente">Conta corrente</SelectItem>
                      <SelectItem value="poupanca">Conta poupança</SelectItem>
                      <SelectItem value="pagamento">Conta de pagamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Cf label="Agência" value={contractForm.bank_agency} onChange={(v) => setContractForm({ ...contractForm, bank_agency: v })} locked={contractLocked} />
                <Cf label="Conta" value={contractForm.bank_account} onChange={(v) => setContractForm({ ...contractForm, bank_account: v })} locked={contractLocked} />
              </div>
            </SectionCard>

            <SectionCard title="Observações (opcional)">
              <Textarea value={contractForm.notes ?? ""} onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })} disabled={contractLocked} rows={3} placeholder="Algo que devemos saber ao gerar os contratos?" />
            </SectionCard>

            {!contractLocked && (
              <SectionCard title="">
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={() => saveContract.mutate(false)} disabled={saveContract.isPending} className="gap-2">
                    <Save className="size-4" /> Salvar rascunho
                  </Button>
                  <Button onClick={() => saveContract.mutate(true)} disabled={saveContract.isPending} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                    <Upload className="size-4" /> Enviar dados para análise
                  </Button>
                  <p className="text-[11.5px] text-slate-500 ml-2">Você pode editar e reenviar enquanto os contratos não forem assinados.</p>
                </div>
              </SectionCard>
            )}
          </>
        )}

        {activeKey === "materiais" && (
          <>
            <PanelHero role="parceiro" eyebrow="Educacional" title="Materiais" subtitle="Institucional, treinamentos, argumentos de vendas e gatilhos." />
            <SectionCard title="">
              {materials.length === 0 ? (
                <EmptyState icon={BookOpen} title="Nenhum material disponível" description="Assim que nossa equipe publicar materiais, eles aparecerão aqui." />
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(materials as any[]).map((m) => (
                    <div key={m.id} className="border border-slate-200/70 rounded-lg p-4 hover:shadow-md transition-shadow bg-white flex flex-col">
                      <Badge variant="outline" className="text-[10px] mb-2 w-fit capitalize">{MATERIAL_CATEGORIES[m.category] || m.category}</Badge>
                      <h3 className="font-semibold text-slate-900 text-[14px] mb-1">{m.title}</h3>
                      {m.description && <p className="text-[12px] text-slate-500 line-clamp-3 mb-3">{m.description}</p>}
                      <div className="mt-auto pt-3">
                        <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => downloadMaterial(m)}>
                          {m.external_url ? <><ExternalLink className="size-3.5" /> Acessar link</> : <><Download className="size-3.5" /> Baixar</>}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </>
        )}

        {activeKey === "suporte" && (
          <>
            <PanelHero role="parceiro" eyebrow="Atendimento" title="Suporte" subtitle="Fale com nossa equipe — tire dúvidas, peça ajuda ou reporte problemas." />
            <div className="flex items-center justify-end mb-3">
              <Button onClick={() => setTicketOpen(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                <Plus className="size-4" /> Novo chamado
              </Button>
            </div>
            <SectionCard title="Seus chamados" icon={MessageSquare}>
              {tickets.length === 0 ? (
                <EmptyState icon={LifeBuoy} title="Nenhum chamado aberto" description="Clique em 'Novo chamado' para falar com nossa equipe." />
              ) : (
                <ul className="space-y-3 -mx-1">
                  {(tickets as any[]).map((t) => (
                    <li key={t.id} className="px-3 py-3 rounded-lg border border-slate-200/70 bg-white">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="text-[13.5px] font-semibold text-slate-900">{t.subject}</p>
                            <Badge variant="outline" className={cn("text-[10px] capitalize", t.priority === "alta" && "border-red-200 text-red-700 bg-red-50")}>{t.priority}</Badge>
                          </div>
                          <p className="text-[10.5px] text-slate-400">Aberto em {formatDate(t.created_at)}</p>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] capitalize shrink-0", t.status === "aberto" ? "bg-amber-50 text-amber-700 border-amber-200" : t.status === "fechado" || t.status === "resolvido" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200")}>{(t.status || "aberto").replace("_"," ")}</Badge>
                      </div>
                      <SupportThread
                        ticket={t}
                        viewerRole="partner"
                        onChanged={() => qc.invalidateQueries({ queryKey: ["partner-tickets", partner?.id] })}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <Dialog open={ticketOpen} onOpenChange={setTicketOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Novo chamado de suporte</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Assunto</Label>
                    <Input value={ticketForm.subject} onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })} maxLength={150} placeholder="Ex.: Dúvida sobre comissão" />
                  </div>
                  <div>
                    <Label>Prioridade</Label>
                    <Select value={ticketForm.priority} onValueChange={(v) => setTicketForm({ ...ticketForm, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Mensagem</Label>
                    <Textarea value={ticketForm.message} onChange={(e) => setTicketForm({ ...ticketForm, message: e.target.value })} rows={5} maxLength={2000} placeholder="Descreva sua dúvida ou solicitação..." />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTicketOpen(false)}>Cancelar</Button>
                  <Button onClick={() => submitTicket.mutate()} disabled={submitTicket.isPending} className="bg-indigo-600 hover:bg-indigo-700">
                    {submitTicket.isPending ? "Enviando..." : "Enviar chamado"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}

        {activeKey === "perfil" && (
          <>
            <PanelHero role="parceiro" eyebrow="Perfil" title="Sua conta" subtitle={user?.email} />

            <SectionCard title="Dados de contato" icon={UserCog}>
              <p className="text-[12px] text-slate-500 mb-4">
                Esses são os dados que nossa equipe usa para entrar em contato com você. Mantenha-os sempre atualizados.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Nome</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} disabled={!editing} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">E-mail</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!editing} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Telefone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!editing} className="mt-1" placeholder="(00) 0000-0000" />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Documento (CPF/CNPJ)</Label>
                  <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} disabled={!editing} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">WhatsApp</Label>
                  <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} disabled={!editing} className="mt-1" placeholder="(00) 00000-0000" />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Endereço" icon={UserCog}>
              <div className="grid sm:grid-cols-6 gap-4">
                <div className="sm:col-span-2">
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">CEP</Label>
                  <Input value={form.address_zip} onChange={(e) => setForm({ ...form, address_zip: e.target.value })} disabled={!editing} className="mt-1" placeholder="00000-000" />
                </div>
                <div className="sm:col-span-4">
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Rua</Label>
                  <Input value={form.address_street} onChange={(e) => setForm({ ...form, address_street: e.target.value })} disabled={!editing} className="mt-1" />
                </div>
                <div className="sm:col-span-1">
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Número</Label>
                  <Input value={form.address_number} onChange={(e) => setForm({ ...form, address_number: e.target.value })} disabled={!editing} className="mt-1" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Complemento</Label>
                  <Input value={form.address_complement} onChange={(e) => setForm({ ...form, address_complement: e.target.value })} disabled={!editing} className="mt-1" />
                </div>
                <div className="sm:col-span-3">
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Bairro</Label>
                  <Input value={form.address_neighborhood} onChange={(e) => setForm({ ...form, address_neighborhood: e.target.value })} disabled={!editing} className="mt-1" />
                </div>
                <div className="sm:col-span-4">
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Cidade</Label>
                  <Input value={form.address_city} onChange={(e) => setForm({ ...form, address_city: e.target.value })} disabled={!editing} className="mt-1" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Estado (UF)</Label>
                  <Input value={form.address_state} onChange={(e) => setForm({ ...form, address_state: e.target.value })} disabled={!editing} className="mt-1" maxLength={2} />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Dados bancários" icon={UserCog}>
              <p className="text-[12px] text-slate-500 mb-4">Usamos esses dados para pagar suas comissões.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Chave PIX</Label>
                  <Input value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} disabled={!editing} className="mt-1" placeholder="CPF, e-mail, telefone ou chave aleatória" />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Banco</Label>
                  <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} disabled={!editing} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Tipo de conta</Label>
                  <Select value={form.bank_account_type || "corrente"} onValueChange={(v) => setForm({ ...form, bank_account_type: v })} disabled={!editing}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corrente">Conta corrente</SelectItem>
                      <SelectItem value="poupanca">Conta poupança</SelectItem>
                      <SelectItem value="pagamento">Conta de pagamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Agência</Label>
                  <Input value={form.bank_agency} onChange={(e) => setForm({ ...form, bank_agency: e.target.value })} disabled={!editing} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Conta</Label>
                  <Input value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} disabled={!editing} className="mt-1" placeholder="00000-0" />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="">
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                      <Save className="size-4" /> {saveProfile.isPending ? "Salvando..." : "Salvar todos os dados"}
                    </Button>
                    <Button variant="outline" onClick={() => { setEditing(false); if (partner) setForm(hydrate(partner)); }}>Cancelar</Button>
                  </>
                ) : (
                  <Button onClick={() => setEditing(true)} className="bg-indigo-600 hover:bg-indigo-700">Editar dados</Button>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Preferências" icon={Eye}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] font-medium text-slate-900">Nome do produto nas comissões</p>
                  <p className="text-[11.5px] text-slate-500">
                    {showProductName
                      ? "Visível — o administrador habilitou a exibição do produto vendido."
                      : "Oculto — definido pelo administrador. Solicite a liberação se necessário."}
                  </p>
                </div>
                <Switch checked={showProductName} disabled />
              </div>
            </SectionCard>

            <SectionCard title="">
              <Button variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => signOut?.()}>Sair</Button>
            </SectionCard>
          </>
        )}
      </PanelContainer>

      <Dialog open={!!requestsTarget} onOpenChange={(open) => !open && setRequestsTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Solicitações · {requestsTarget?.clientName ?? ""}</DialogTitle>
          </DialogHeader>
          {requestsTarget && <DemandRequestsPanel clientProductId={requestsTarget.id} currentRole="parceiro" />}
        </DialogContent>
      </Dialog>
    </PanelShell>
  );
}

function Cf({ label, value, onChange, locked, type = "text" }: { label: string; value: string; onChange: (v: string) => void; locked?: boolean; type?: string }) {
  return (
    <div>
      <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">{label}</Label>
      <Input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={locked} className="mt-1" />
    </div>
  );
}

function PartnerDocHistory({ docId, currentDoc, onDownload }: { docId: string; currentDoc: any; onDownload: (d: any) => void }) {
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ["partner-doc-versions", docId],
    queryFn: async () => {
      const { data } = await supabase
        .from("document_versions")
        .select("id, version_number, file_path, mime_type, file_size, note, created_at")
        .eq("document_id", docId)
        .order("version_number", { ascending: false });
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const items: any[] = [];
  if (currentDoc?.file_path) {
    items.push({ id: "current", label: "Atual", file_path: currentDoc.file_path, name: currentDoc.name, created_at: currentDoc.uploaded_at, note: null });
  }
  for (const v of versions as any[]) {
    items.push({ id: v.id, label: `v${v.version_number}`, file_path: v.file_path, name: currentDoc.name, created_at: v.created_at, note: v.note });
  }

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2">Histórico de arquivos</p>
      {isLoading ? (
        <p className="text-xs text-slate-400">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400">Nenhum arquivo enviado ainda.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0 flex items-center gap-2">
                <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600">{it.label}</span>
                <span className="text-slate-500 truncate">{it.created_at ? formatDate(it.created_at) : "—"}{it.note ? ` · ${it.note}` : ""}</span>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => onDownload(it)}>
                <Download className="size-3 mr-1" /> Baixar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
