import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfDay, startOfMonth, startOfToday, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHero } from "@/components/PageHero";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Clock,
  Download,
  Eye,
  FilePlus,
  FileText,
  Filter,
  FolderOpen,
  History,
  Lock,
  MessageSquare,
  MoreVertical,
  RefreshCw,
  Search,
  Unlock,
  X,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { DocumentDialog } from "@/components/documents/DocumentDialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { confirmAction } from "@/lib/confirm";
import { logAudit } from "@/lib/audit";
import { cn } from "@/lib/utils";

export type DocumentStatus = "solicitado" | "enviado" | "em_analise" | "aprovado" | "rejeitado" | "reprovado" | "atrasado" | "vencido" | "pendente_correcao";

type ActionMode = "reject" | "request_resend" | "comment" | null;
type PeriodKey = "HOJE" | "7 DIAS" | "30 DIAS" | "MÊS" | "TUDO";
type SortDir = "asc" | "desc";

const PERIODS: PeriodKey[] = ["HOJE", "7 DIAS", "30 DIAS", "MÊS", "TUDO"];
const PENDING_STATUSES = ["solicitado", "enviado", "em_analise", "pendente_correcao"];
const REJECTED_STATUSES = ["rejeitado", "reprovado"];

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  solicitado: { label: "Solicitado", color: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  enviado: { label: "Enviado", color: "bg-sky-50 text-sky-700 border-sky-200", icon: FileText },
  em_analise: { label: "Em análise", color: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: Eye },
  aprovado: { label: "Aprovado", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: Check },
  rejeitado: { label: "Rejeitado", color: "bg-rose-50 text-rose-700 border-rose-200", icon: X },
  reprovado: { label: "Rejeitado", color: "bg-rose-50 text-rose-700 border-rose-200", icon: X },
  atrasado: { label: "Atrasado", color: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle },
  vencido: { label: "Atrasado", color: "bg-red-50 text-red-700 border-red-200", icon: AlertCircle },
  pendente_correcao: { label: "Pendente correção", color: "bg-orange-50 text-orange-700 border-orange-200", icon: RefreshCw },
};

const norm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const getDateRange = (range: PeriodKey) => {
  const today = startOfToday();
  if (range === "7 DIAS") return { start: subDays(today, 6), end: endOfDay(today) };
  if (range === "30 DIAS") return { start: subDays(today, 29), end: endOfDay(today) };
  if (range === "MÊS") return { start: startOfMonth(today), end: endOfDay(today) };
  if (range === "HOJE") return { start: today, end: endOfDay(today) };
  return { start: new Date(0), end: new Date(8640000000000000) };
};

const effectiveStatus = (doc: any) => {
  if (["aprovado", "enviado", "em_analise", "pendente_correcao"].includes(doc.status)) return doc.status;
  if (doc.status === "vencido") return "atrasado";
  if (doc.due_date && new Date(doc.due_date) < startOfToday()) return "atrasado";
  return doc.status;
};

const getProductName = (doc: any) => doc.products?.name || doc.client_products?.products?.name || doc.client_products?.custom_product_name || "Geral";
const getFileExt = (doc: any) => doc.file_path?.split(".").pop()?.toUpperCase() || "SOLIC.";
const fileNameFromPath = (path?: string | null) => path?.split("/").pop()?.replace(/^\d+-/, "") || "arquivo";

const downloadCsv = (filename: string, headers: string[], rows: unknown[][]) => {
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => {
      const value = String(c ?? "");
      return /[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(";"))
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

function SortableTh({ label, k, sortKey, sortDir, onSort, align = "left" }: any) {
  const active = sortKey === k;
  return (
    <th className={cn("px-4 py-3 text-[11px] uppercase tracking-wider font-semibold text-slate-500", align === "right" && "text-right")}>
      <button onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 hover:text-slate-700", active && "text-indigo-700")}>
        {label}
        {active ? (sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
      </button>
    </th>
  );
}

export default function Documents() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [rangeKey, setRangeKey] = useState<PeriodKey>("TUDO");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [requiredFilter, setRequiredFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [actionDoc, setActionDoc] = useState<any>(null);
  const [actionReason, setActionReason] = useState("");
  const [historyDoc, setHistoryDoc] = useState<any>(null);
  const [historyVersions, setHistoryVersions] = useState<any[]>([]);
  const [historyAudit, setHistoryAudit] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const qc = useQueryClient();
  const { isAdmin, isAdminSecondary } = useAuth();
  const canManage = isAdmin || isAdminSecondary;

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["docs-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select(`
          *,
          clients(id, full_name),
          products(id, name),
          client_products(
            id,
            product_id,
            custom_product_name,
            products:product_id(id, name),
            service_providers:service_provider_id(id, name)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const userIds = useMemo(() => {
    const ids = new Set<string>();
    docs.forEach((d: any) => {
      if (d.uploaded_by) ids.add(d.uploaded_by);
      if (d.approved_by) ids.add(d.approved_by);
      if (d.requested_by) ids.add(d.requested_by);
    });
    return Array.from(ids);
  }, [docs]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["docs-profiles", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email").in("id", userIds)).data ?? [],
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, any>();
    profiles.forEach((p: any) => m.set(p.id, p));
    return m;
  }, [profiles]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["docs-all"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const updateStatus = async (doc: any, status: DocumentStatus, extra: Partial<any> = {}) => {
    if (!canManage) return toast.error("Você não tem permissão para alterar documentos.");
    if (doc.status === status && Object.keys(extra).length === 0) return;
    const updateData: any = { status, reviewed_at: new Date().toISOString(), ...extra };
    if (status === "aprovado") {
      const { data: { user } } = await supabase.auth.getUser();
      updateData.approved_by = user?.id ?? null;
      updateData.rejection_reason = null;
    }
    const { error } = await supabase.from("documents").update(updateData).eq("id", doc.id);
    if (error) return toast.error(error.message);
    toast.success(`Documento atualizado para ${statusConfig[status].label}`);
    logAudit("DOCUMENT_UPDATE" as any, "documents", doc.id, { status, ...extra });
    invalidate();
  };

  const approveDoc = async (doc: any) => {
    const ok = await confirmAction({ title: "Aprovar documento", description: `Aprovar "${doc.name}"?`, confirmText: "Aprovar" });
    if (ok) await updateStatus(doc, "aprovado");
  };

  const viewFile = async (doc: any) => {
    if (!doc.file_path) return toast.error("Arquivo ainda não enviado.");
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 3600);
    if (error) return toast.error(error.message);
    logAudit("DOCUMENT_VIEW", "documents", doc.id, { name: doc.name });
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const downloadFile = async (doc: any) => {
    if (!doc.file_path) return toast.error("Arquivo ainda não enviado.");
    const { data, error } = await supabase.storage.from("documents").download(doc.file_path);
    if (error) return toast.error(error.message);
    logAudit("DOCUMENT_DOWNLOAD", "documents", doc.id, { name: doc.name });
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileNameFromPath(doc.file_path) || doc.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleVisibility = async (doc: any) => {
    if (!canManage) return toast.error("Você não tem permissão para alterar a visibilidade.");
    const next = !doc.is_public;
    const ok = await confirmAction({ title: "Alterar visibilidade", description: `Tornar "${doc.name}" ${next ? "visível ao cliente" : "interno"}?`, confirmText: "Alterar" });
    if (!ok) return;
    const { error } = await supabase.from("documents").update({ is_public: next }).eq("id", doc.id);
    if (error) return toast.error(error.message);
    toast.success(`Documento agora está ${next ? "público para o cliente" : "interno"}`);
    invalidate();
  };

  const deleteDoc = async (doc: any) => {
    if (!canManage) return toast.error("Você não tem permissão para excluir documentos.");
    const ok = await confirmAction({
      title: "Excluir documento",
      description: `Excluir definitivamente "${doc.name}" e seus arquivos versionados? Esta ação não pode ser desfeita.`,
      confirmText: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    const paths: string[] = [];
    if (doc.file_path) paths.push(doc.file_path);
    const { data: versions } = await supabase.from("document_versions").select("file_path").eq("document_id", doc.id);
    (versions ?? []).forEach((v: any) => { if (v.file_path) paths.push(v.file_path); });
    if (paths.length > 0) await supabase.storage.from("documents").remove(paths);
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) return toast.error(error.message);
    logAudit("DOCUMENT_DELETE" as any, "documents", doc.id, { name: doc.name });
    toast.success("Documento excluído");
    invalidate();
  };

  const openHistory = async (doc: any) => {
    setHistoryDoc(doc);
    setHistoryVersions([]);
    setHistoryAudit([]);
    setHistoryLoading(true);
    const [{ data: versions }, { data: audit }] = await Promise.all([
      supabase.from("document_versions").select("*").eq("document_id", doc.id).order("version_number", { ascending: false }),
      supabase.from("activity_logs").select("id, action, new_data, old_data, created_at, user_id").eq("entity_type", "documents").eq("entity_id", doc.id).order("created_at", { ascending: false }).limit(50),
    ]);
    setHistoryVersions(versions ?? []);
    setHistoryAudit(audit ?? []);
    setHistoryLoading(false);
  };

  const downloadVersion = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage.from("documents").download(filePath);
    if (error) return toast.error(error.message);
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openActionDialog = (mode: ActionMode, doc: any) => {
    if (!canManage) return toast.error("Você não tem permissão para executar esta ação.");
    setActionMode(mode);
    setActionDoc(doc);
    setActionReason("");
  };

  const submitActionDialog = async () => {
    if (!actionDoc || !actionMode) return;
    if (!actionReason.trim()) return toast.error(actionMode === "comment" ? "Informe o comentário" : "É obrigatório informar o motivo");
    if (actionMode === "reject") await updateStatus(actionDoc, "reprovado", { rejection_reason: actionReason.trim() });
    if (actionMode === "request_resend") await updateStatus(actionDoc, "pendente_correcao", { rejection_reason: actionReason.trim() });
    if (actionMode === "comment") {
      const prev = actionDoc.internal_notes ?? "";
      const stamp = new Date().toLocaleString("pt-BR");
      const merged = `${prev ? `${prev}\n\n` : ""}[${stamp}] ${actionReason.trim()}`;
      const { error } = await supabase.from("documents").update({ internal_notes: merged }).eq("id", actionDoc.id);
      if (error) return toast.error(error.message);
      toast.success("Comentário adicionado");
      invalidate();
    }
    setActionMode(null);
    setActionDoc(null);
    setActionReason("");
  };

  const clientOptions = useMemo(() => {
    const m = new Map<string, string>();
    docs.forEach((d: any) => { if (d.clients?.id) m.set(d.clients.id, d.clients.full_name); });
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [docs]);

  const productOptions = useMemo(() => {
    const m = new Map<string, string>();
    docs.forEach((d: any) => {
      const id = d.product_id || d.client_products?.product_id || d.client_products?.products?.id;
      const name = getProductName(d);
      if (id && name !== "Geral") m.set(id, name);
    });
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [docs]);

  const providerOptions = useMemo(() => {
    const m = new Map<string, string>();
    docs.forEach((d: any) => {
      const sp = d.client_products?.service_providers;
      if (sp?.id) m.set(sp.id, sp.name);
    });
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [docs]);

  const kpis = useMemo(() => ({
    total: docs.length,
    pendentes: docs.filter((d: any) => PENDING_STATUSES.includes(d.status)).length,
    aprovados: docs.filter((d: any) => d.status === "aprovado").length,
    rejeitados: docs.filter((d: any) => REJECTED_STATUSES.includes(d.status)).length,
    atrasados: docs.filter((d: any) => effectiveStatus(d) === "atrasado").length,
    semArquivo: docs.filter((d: any) => !d.file_path).length,
  }), [docs]);

  const filteredDocs = useMemo(() => {
    const { start, end } = getDateRange(rangeKey);
    const q = norm(search);
    return docs.filter((d: any) => {
      const refDate = d.uploaded_at || d.requested_at || d.created_at;
      const createdAt = refDate ? new Date(refDate) : null;
      if (rangeKey !== "TUDO" && (!createdAt || createdAt < start || createdAt > end)) return false;
      const eff = effectiveStatus(d);
      if (statusFilter !== "all") {
        if (statusFilter === "rejeitado" && !REJECTED_STATUSES.includes(d.status)) return false;
        else if (statusFilter !== "rejeitado" && eff !== statusFilter && d.status !== statusFilter) return false;
      }
      if (clientFilter !== "all" && d.clients?.id !== clientFilter) return false;
      if (productFilter !== "all") {
        const pid = d.product_id || d.client_products?.product_id || d.client_products?.products?.id;
        if (pid !== productFilter) return false;
      }
      if (providerFilter !== "all" && d.client_products?.service_providers?.id !== providerFilter) return false;
      if (requiredFilter === "required" && !d.is_required) return false;
      if (requiredFilter === "optional" && d.is_required) return false;
      if (requiredFilter === "with_file" && !d.file_path) return false;
      if (requiredFilter === "without_file" && d.file_path) return false;
      if (visibilityFilter === "public" && !d.is_public) return false;
      if (visibilityFilter === "internal" && d.is_public) return false;
      if (dateFrom && (!refDate || refDate < dateFrom)) return false;
      if (dateTo && (!refDate || refDate > `${dateTo}T23:59:59`)) return false;
      if (q) {
        const uploader = d.uploaded_by ? profileMap.get(d.uploaded_by) : null;
        const hay = norm(`${d.name} ${d.description ?? ""} ${d.clients?.full_name ?? ""} ${getProductName(d)} ${d.client_products?.service_providers?.name ?? ""} ${uploader?.full_name ?? ""} ${d.status ?? ""}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [docs, rangeKey, search, statusFilter, clientFilter, productFilter, providerFilter, requiredFilter, visibilityFilter, dateFrom, dateTo, profileMap]);

  const sortedDocs = useMemo(() => {
    const arr = [...filteredDocs];
    arr.sort((a: any, b: any) => {
      let av: any;
      let bv: any;
      switch (sortKey) {
        case "client": av = a.clients?.full_name ?? ""; bv = b.clients?.full_name ?? ""; break;
        case "product": av = getProductName(a); bv = getProductName(b); break;
        case "name": av = a.name ?? ""; bv = b.name ?? ""; break;
        case "status": av = effectiveStatus(a); bv = effectiveStatus(b); break;
        case "uploaded_at": av = a.uploaded_at ?? ""; bv = b.uploaded_at ?? ""; break;
        case "due_date": av = a.due_date ?? ""; bv = b.due_date ?? ""; break;
        case "created_at":
        default: av = a.created_at ?? ""; bv = b.created_at ?? "";
      }
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredDocs, sortKey, sortDir]);

  const toggleSort = (k: string) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
    setPage(1);
  };

  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(sortedDocs.length / pageSize));
  const pageRows = sortedDocs.slice((page - 1) * pageSize, page * pageSize);

  const clearFilters = () => {
    setStatusFilter("all"); setClientFilter("all"); setProductFilter("all"); setProviderFilter("all"); setRequiredFilter("all"); setVisibilityFilter("all"); setDateFrom(""); setDateTo(""); setSearch(""); setRangeKey("TUDO"); setPage(1);
  };

  const activeChips: { label: string; clear: () => void }[] = [];
  if (search) activeChips.push({ label: `Busca: "${search}"`, clear: () => setSearch("") });
  if (rangeKey !== "TUDO") activeChips.push({ label: `Período: ${rangeKey}`, clear: () => setRangeKey("TUDO") });
  if (statusFilter !== "all") activeChips.push({ label: `Status: ${statusConfig[statusFilter]?.label ?? statusFilter}`, clear: () => setStatusFilter("all") });
  if (clientFilter !== "all") activeChips.push({ label: "Cliente filtrado", clear: () => setClientFilter("all") });
  if (productFilter !== "all") activeChips.push({ label: "Produto filtrado", clear: () => setProductFilter("all") });
  if (providerFilter !== "all") activeChips.push({ label: "Prestador filtrado", clear: () => setProviderFilter("all") });
  if (requiredFilter !== "all") activeChips.push({ label: requiredFilter.replace(/_/g, " "), clear: () => setRequiredFilter("all") });
  if (visibilityFilter !== "all") activeChips.push({ label: visibilityFilter === "public" ? "Cliente" : "Interno", clear: () => setVisibilityFilter("all") });

  const exportDocs = () => {
    downloadCsv(
      `documentos-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Documento", "Cliente", "Produto/Demanda", "Status", "Obrigatório", "Visibilidade", "Arquivo", "Solicitado em", "Enviado em", "Prazo", "Quem enviou"],
      sortedDocs.map((d: any) => {
        const uploader = d.uploaded_by ? profileMap.get(d.uploaded_by) : null;
        return [d.name, d.clients?.full_name || "—", getProductName(d), statusConfig[effectiveStatus(d)]?.label ?? d.status, d.is_required ? "Sim" : "Não", d.is_public ? "Cliente" : "Interno", d.file_path ? fileNameFromPath(d.file_path) : "Não enviado", formatDate(d.created_at), formatDate(d.uploaded_at), formatDate(d.due_date), uploader?.full_name || uploader?.email || "—"];
      })
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <PageHero
        eyebrow="Documentos"
        category="Central de Arquivos"
        title="Central de Documentos"
        description="Solicite, valide, versiona e arquive documentos de clientes com rastreabilidade completa."
        icon={<FolderOpen className="size-6" />}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex max-w-full overflow-x-auto bg-white p-1 rounded-lg border border-slate-200/70 shadow-sm">
              {PERIODS.map((k) => <button key={k} onClick={() => { setRangeKey(k); setPage(1); }} className={cn("px-3 py-2 rounded-md text-[10px] font-bold transition-all uppercase whitespace-nowrap", rangeKey === k ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-700")}>{k}</button>)}
            </div>
            {canManage && <Button onClick={() => { setSelectedDoc(null); setIsDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white"><FilePlus className="size-4 mr-2" /> Solicitar documento</Button>}
          </div>
        }
        kpis={[
          { label: "Total", value: kpis.total, tone: "primary", icon: <FileText className="size-4" />, onClick: () => setStatusFilter("all") } as any,
          { label: "Pendentes", value: kpis.pendentes, tone: "warning", icon: <Clock className="size-4" />, onClick: () => setStatusFilter("solicitado") } as any,
          { label: "Aprovados", value: kpis.aprovados, tone: "success", icon: <Check className="size-4" />, onClick: () => setStatusFilter("aprovado") } as any,
          { label: "Rejeitados", value: kpis.rejeitados, tone: "danger", icon: <X className="size-4" />, onClick: () => setStatusFilter("rejeitado") } as any,
          { label: "Atrasados", value: kpis.atrasados, tone: "danger", icon: <AlertCircle className="size-4" />, onClick: () => setStatusFilter("atrasado") } as any,
          { label: "Sem arquivo", value: kpis.semArquivo, tone: "info", icon: <FolderOpen className="size-4" />, onClick: () => setRequiredFilter("without_file") } as any,
        ]}
      />

      <div className="max-w-[1600px] mx-auto px-5 lg:px-8 space-y-6 pb-10">
        {kpis.atrasados > 0 && (
          <div className="rounded-lg border border-amber-200/70 bg-amber-50 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="size-5 text-amber-700 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">{kpis.atrasados} documento(s) atrasado(s).</p>
                <p className="text-xs text-amber-700 mt-1">Priorize a cobrança, análise ou reenvio para destravar as demandas.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="border-amber-200 text-amber-800 hover:bg-amber-100" onClick={() => setStatusFilter("atrasado")}>Ver atrasados</Button>
          </div>
        )}

        <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><Filter className="size-4 text-slate-500" /> Filtros e busca</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportDocs} className="text-xs"><Download className="size-3.5 mr-1.5" /> Exportar CSV</Button>
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">Limpar</Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            <div className="relative md:col-span-2 xl:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input className="pl-9 bg-white border-slate-200" placeholder="Buscar por documento, cliente, produto, prestador ou responsável..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="bg-white border-slate-200"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="solicitado">Solicitado</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="em_analise">Em análise</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="rejeitado">Rejeitado</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
                <SelectItem value="pendente_correcao">Pendente correção</SelectItem>
              </SelectContent>
            </Select>
            <Select value={clientFilter} onValueChange={(v) => { setClientFilter(v); setPage(1); }}>
              <SelectTrigger className="bg-white border-slate-200"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{clientOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={productFilter} onValueChange={(v) => { setProductFilter(v); setPage(1); }}>
              <SelectTrigger className="bg-white border-slate-200"><SelectValue placeholder="Produto" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos os produtos</SelectItem>{productOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={providerFilter} onValueChange={(v) => { setProviderFilter(v); setPage(1); }}>
              <SelectTrigger className="bg-white border-slate-200"><SelectValue placeholder="Prestador" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos os prestadores</SelectItem>{providerOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={requiredFilter} onValueChange={(v) => { setRequiredFilter(v); setPage(1); }}>
              <SelectTrigger className="bg-white border-slate-200"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="required">Obrigatórios</SelectItem>
                <SelectItem value="optional">Opcionais</SelectItem>
                <SelectItem value="with_file">Com arquivo</SelectItem>
                <SelectItem value="without_file">Sem arquivo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={visibilityFilter} onValueChange={(v) => { setVisibilityFilter(v); setPage(1); }}>
              <SelectTrigger className="bg-white border-slate-200"><SelectValue placeholder="Acesso" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as visibilidades</SelectItem>
                <SelectItem value="public">Cliente</SelectItem>
                <SelectItem value="internal">Interno</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2 md:col-span-2 xl:col-span-2">
              <Input type="date" className="bg-white border-slate-200" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
              <Input type="date" className="bg-white border-slate-200" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
            </div>
          </div>
          {activeChips.length > 0 && <div className="flex flex-wrap gap-2">{activeChips.map((chip) => <button key={chip.label} onClick={chip.clear} className="inline-flex items-center gap-1 rounded-md border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">{chip.label}<X className="size-3" /></button>)}</div>}
        </div>

        <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/70">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Lista de documentos</h2>
              <p className="text-xs text-slate-500">{sortedDocs.length} documento(s) encontrado(s)</p>
            </div>
          </div>
          {isLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div>
          ) : sortedDocs.length === 0 ? (
            <div className="p-12 text-center"><FolderOpen className="size-10 mx-auto text-slate-300 mb-3" /><p className="text-sm font-semibold text-slate-800">Nenhum documento encontrado</p><p className="text-xs text-slate-500 mt-1">Ajuste os filtros ou solicite um novo documento.</p></div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 border-b border-slate-200/70">
                    <SortableTh label="Cliente" k="client" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Demanda" k="product" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Documento" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-500">Arquivo</th>
                    <SortableTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Última versão" k="uploaded_at" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Prazo" k="due_date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-500">Acesso</th>
                    <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider font-semibold text-slate-500">Ações</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageRows.map((d: any) => {
                      const eff = effectiveStatus(d);
                      const config = statusConfig[eff] || statusConfig.solicitado;
                      const StatusIcon = config.icon;
                      const uploader = d.uploaded_by ? profileMap.get(d.uploaded_by) : null;
                      return (
                        <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-4 min-w-[180px]"><div className="flex items-center gap-2"><div className="size-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-[10px] font-bold border border-indigo-100">{d.clients?.full_name?.substring(0, 2).toUpperCase() || "??"}</div><span className="text-xs font-medium text-slate-800 truncate max-w-[150px]">{d.clients?.full_name || "—"}</span></div></td>
                          <td className="px-4 py-4 min-w-[160px] text-xs text-slate-500">{getProductName(d)}{d.client_products?.service_providers?.name && <span className="block text-[10px] text-slate-400 mt-0.5">{d.client_products.service_providers.name}</span>}</td>
                          <td className="px-4 py-4 min-w-[230px]"><span className="text-xs font-semibold text-slate-900 truncate max-w-[220px] block">{d.name}</span><div className="flex gap-1 mt-1">{d.is_required && <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-rose-200 text-rose-700 bg-rose-50">Obrigatório</Badge>}{d.description && <span className="text-[10px] text-slate-500 truncate max-w-[180px]">{d.description}</span>}</div></td>
                          <td className="px-4 py-4"><div className="flex items-center gap-2 text-xs text-slate-500"><FileText className={cn("size-4", d.file_path ? "text-indigo-600" : "text-slate-300")} /><span className="font-mono text-[10px]">{getFileExt(d)}</span></div></td>
                          <td className="px-4 py-4"><Badge variant="outline" className={cn("gap-1 text-[10px] font-bold uppercase py-0.5 whitespace-nowrap", config.color)}><StatusIcon className="size-2.5" />{config.label}</Badge>{eff === "atrasado" && d.due_date && <span className="block text-[9px] text-rose-700 font-medium mt-1">Venceu em {formatDate(d.due_date)}</span>}</td>
                          <td className="px-4 py-4 min-w-[150px]"><span className="text-[11px] text-slate-500">{d.uploaded_at ? formatDate(d.uploaded_at) : "Não enviado"}</span><span className="block text-[10px] text-slate-400 truncate max-w-[140px]">{uploader?.full_name || uploader?.email || "—"}</span></td>
                          <td className="px-4 py-4 text-[11px] text-slate-500">{formatDate(d.due_date)}</td>
                          <td className="px-4 py-4"><Badge variant="outline" className={cn("text-[9px] font-bold py-0 h-5", d.is_public ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200")}>{d.is_public ? "CLIENTE" : "INTERNO"}</Badge></td>
                          <td className="px-4 py-4"><div className="flex items-center justify-end gap-1">
                            {d.file_path && <><TooltipProvider><Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="size-8 text-slate-500 hover:text-indigo-700" onClick={() => viewFile(d)}><Eye className="size-4" /></Button></TooltipTrigger><TooltipContent>Visualizar</TooltipContent></Tooltip></TooltipProvider><TooltipProvider><Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="size-8 text-slate-500 hover:text-indigo-700" onClick={() => downloadFile(d)}><Download className="size-4" /></Button></TooltipTrigger><TooltipContent>Baixar</TooltipContent></Tooltip></TooltipProvider></>}
                            <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="size-8"><MoreVertical className="size-4 text-slate-500" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-60">
                              {canManage && <><DropdownMenuLabel className="text-xs">Análise</DropdownMenuLabel><DropdownMenuItem onClick={() => approveDoc(d)} className="text-emerald-700"><Check className="size-4 mr-2" /> Aprovar</DropdownMenuItem><DropdownMenuItem onClick={() => updateStatus(d, "em_analise")}><Eye className="size-4 mr-2" /> Marcar em análise</DropdownMenuItem><DropdownMenuItem onClick={() => openActionDialog("request_resend", d)} className="text-orange-700"><RefreshCw className="size-4 mr-2" /> Solicitar reenvio</DropdownMenuItem><DropdownMenuItem onClick={() => openActionDialog("reject", d)} className="text-rose-700"><X className="size-4 mr-2" /> Rejeitar</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuLabel className="text-xs">Outras ações</DropdownMenuLabel><DropdownMenuItem onClick={() => openActionDialog("comment", d)}><MessageSquare className="size-4 mr-2" /> Adicionar comentário</DropdownMenuItem><DropdownMenuItem onClick={() => toggleVisibility(d)}>{d.is_public ? <Lock className="size-4 mr-2" /> : <Unlock className="size-4 mr-2" />}Tornar {d.is_public ? "interno" : "público"}</DropdownMenuItem><DropdownMenuItem onClick={() => { setSelectedDoc(d); setIsDialogOpen(true); }}><FilePlus className="size-4 mr-2" /> Editar / reenviar</DropdownMenuItem><DropdownMenuSeparator /></>}
                              <DropdownMenuItem onClick={() => openHistory(d)}><History className="size-4 mr-2" /> Ver histórico e versões</DropdownMenuItem>{canManage && <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => deleteDoc(d)} className="text-rose-700"><X className="size-4 mr-2" /> Excluir documento</DropdownMenuItem></>}
                            </DropdownMenuContent></DropdownMenu>
                          </div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationControl currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={sortedDocs.length} itemsPerPage={pageSize} />
            </>
          )}
        </div>
      </div>

      {canManage && <DocumentDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} document={selectedDoc} onSuccess={invalidate} />}

      <Dialog open={actionMode !== null} onOpenChange={(o) => { if (!o) { setActionMode(null); setActionDoc(null); setActionReason(""); } }}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader><DialogTitle>{actionMode === "reject" && "Rejeitar documento"}{actionMode === "request_resend" && "Solicitar reenvio"}{actionMode === "comment" && "Adicionar comentário"}</DialogTitle><DialogDescription>{actionMode === "reject" && "Informe o motivo da reprovação para orientar o cliente."}{actionMode === "request_resend" && "Informe exatamente o que precisa ser reenviado ou corrigido."}{actionMode === "comment" && "Adicione uma observação interna a este documento."}</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label>{actionMode === "comment" ? "Comentário" : "Motivo"}<span className="text-rose-600 ml-1">*</span></Label><Textarea value={actionReason} onChange={(e) => setActionReason(e.target.value)} rows={5} placeholder="Descreva com clareza..." autoFocus /></div>
          <DialogFooter><Button variant="outline" onClick={() => setActionMode(null)}>Cancelar</Button><Button onClick={submitActionDialog} variant={actionMode === "reject" ? "destructive" : "default"}>Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyDoc} onOpenChange={(o) => { if (!o) setHistoryDoc(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto bg-white">
          <DialogHeader><DialogTitle>Histórico — {historyDoc?.name}</DialogTitle><DialogDescription>Versões arquivadas e linha do tempo de eventos do documento.</DialogDescription></DialogHeader>
          {historyLoading ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}</div> : <div className="space-y-6">
            <div><h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Versões do arquivo</h4>{historyDoc?.file_path && <div className="p-3 rounded-lg border border-indigo-100 bg-indigo-50/60 flex items-center justify-between mb-2"><div className="text-xs"><div className="font-bold text-slate-900">Versão atual</div><div className="text-slate-500">{historyDoc.uploaded_at ? formatDate(historyDoc.uploaded_at) : "—"}</div></div><Button size="sm" variant="outline" onClick={() => downloadVersion(historyDoc.file_path, historyDoc.name)} className="gap-1.5"><Download className="size-3.5" /> Baixar</Button></div>}{historyVersions.length === 0 ? <p className="text-xs text-slate-500 italic">Nenhuma versão anterior arquivada.</p> : historyVersions.map((v: any) => <div key={v.id} className="p-3 rounded-lg border border-slate-200/70 flex items-center justify-between mb-1.5"><div className="text-xs"><div className="font-bold text-slate-900">Versão {v.version_number}</div><div className="text-slate-500">{formatDate(v.created_at)} {v.note ? `· ${v.note}` : ""}</div></div><Button size="sm" variant="ghost" onClick={() => downloadVersion(v.file_path, `${historyDoc.name}-v${v.version_number}`)} className="gap-1.5"><Download className="size-3.5" /> Baixar</Button></div>)}</div>
            <div><h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Linha do tempo</h4>{historyAudit.length === 0 ? <p className="text-xs text-slate-500 italic">Nenhum evento registrado.</p> : <div className="space-y-1.5">{historyAudit.map((h: any) => { const oldStatus = h.old_data?.status; const newStatus = h.new_data?.status; const statusChanged = oldStatus && newStatus && oldStatus !== newStatus; return <div key={h.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 text-xs"><div className="flex items-center justify-between"><span className="font-semibold capitalize text-slate-800">{String(h.action).toLowerCase().replace(/_/g, " ")}</span><span className="text-slate-500 font-mono text-[10px]">{formatDate(h.created_at)}</span></div>{statusChanged && <p className="text-[11px] text-slate-500 mt-0.5">Status: {oldStatus} → {newStatus}</p>}{h.new_data?.rejection_reason && <p className="text-[11px] text-rose-600 mt-0.5">Motivo: {h.new_data.rejection_reason}</p>}</div>; })}</div>}</div>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setHistoryDoc(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
