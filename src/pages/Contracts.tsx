/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { openDownloadUrl } from "@/lib/download";
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
  Ban,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Eye,
  FileCheck2,
  FileSignature,
  FileText,
  Filter,
  History,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  X,
} from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { confirmAction } from "@/lib/confirm";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ContractDialog } from "@/components/contracts/ContractDialog";

export type ContractStatus =
  | "rascunho"
  | "criado"
  | "enviado"
  | "aguardando_assinatura"
  | "assinado"
  | "finalizado"
  | "vencido"
  | "pendente_correcao"
  | "cancelado";

type PeriodKey = "HOJE" | "7 DIAS" | "30 DIAS" | "MÊS" | "TUDO";
type SortDir = "asc" | "desc";

const PERIODS: PeriodKey[] = ["HOJE", "7 DIAS", "30 DIAS", "MÊS", "TUDO"];
const ACTIVE_STATUSES: ContractStatus[] = ["rascunho", "criado", "enviado", "aguardando_assinatura", "pendente_correcao"];
const SIGNED_STATUSES: ContractStatus[] = ["assinado", "finalizado"];

const statusConfig: Record<ContractStatus, { label: string; color: string; dot: string; icon: any }> = {
  rascunho: { label: "Rascunho", color: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400", icon: FileText },
  criado: { label: "Criado", color: "bg-slate-100 text-slate-700 border-slate-200", dot: "bg-slate-400", icon: FileText },
  enviado: { label: "Enviado", color: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-500", icon: Clock },
  aguardando_assinatura: { label: "Aguardando assinatura", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500", icon: FileSignature },
  assinado: { label: "Assinado", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", icon: FileCheck2 },
  finalizado: { label: "Finalizado", color: "bg-indigo-50 text-indigo-700 border-indigo-200", dot: "bg-indigo-500", icon: CheckCircle2 },
  vencido: { label: "Vencido", color: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500", icon: AlertCircle },
  pendente_correcao: { label: "Pendente correção", color: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500", icon: AlertCircle },
  cancelado: { label: "Cancelado", color: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500", icon: Ban },
};

const norm = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getDateRange = (range: PeriodKey) => {
  const today = startOfToday();
  if (range === "7 DIAS") return { start: subDays(today, 6), end: endOfDay(today) };
  if (range === "30 DIAS") return { start: subDays(today, 29), end: endOfDay(today) };
  if (range === "MÊS") return { start: startOfMonth(today), end: endOfDay(today) };
  if (range === "HOJE") return { start: today, end: endOfDay(today) };
  return { start: new Date(0), end: new Date(8640000000000000) };
};

const isExpired = (contract: any) => {
  if (!contract.expires_at || ["cancelado", "finalizado"].includes(contract.status)) return false;
  return new Date(contract.expires_at) < startOfToday();
};

const isExpiringSoon = (contract: any) => {
  if (!contract.expires_at || ["cancelado", "finalizado", "vencido"].includes(contract.status)) return false;
  const expiry = new Date(contract.expires_at).getTime();
  const now = startOfToday().getTime();
  const fifteenDays = 15 * 24 * 60 * 60 * 1000;
  return expiry >= now && expiry <= now + fifteenDays;
};

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

export default function Contracts() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [rangeKey, setRangeKey] = useState<PeriodKey>("TUDO");
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [relationFilter, setRelationFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyContractId, setHistoryContractId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { isAdmin, isAdminSecondary } = useAuth();
  const canManage = isAdmin || isAdminSecondary;

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["contracts-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select(`
          *,
          clients(id, full_name),
          partners(id, full_name),
          service_providers(id, name),
          products(id, name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: contractHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ["contract-history-admin", historyContractId],
    enabled: !!historyContractId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_history")
        .select("*, profiles:action_by(full_name)")
        .eq("contract_id", historyContractId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["contracts-all"] });
    qc.invalidateQueries({ queryKey: ["contract-history-admin"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const updateStatus = async (contract: any, status: ContractStatus) => {
    if (!canManage) return toast.error("Você não tem permissão para alterar contratos.");
    if (contract.status === status) return;

    const destructive = ["cancelado", "vencido"].includes(status);
    const ok = await confirmAction({
      title: "Atualizar contrato",
      description: `Alterar "${contract.name}" para ${statusConfig[status].label}?`,
      confirmText: "Atualizar",
      destructive,
    });
    if (!ok) return;

    const updateData: any = { status };
    const now = new Date().toISOString();
    if (status === "enviado") updateData.sent_at = now;
    if (status === "assinado") updateData.signed_at = now;
    if (status === "finalizado") updateData.finished_at = now;

    const { error } = await supabase.from("contracts").update(updateData).eq("id", contract.id);
    if (error) return toast.error(error.message);
    toast.success(`Contrato atualizado para ${statusConfig[status].label}`);
    invalidate();
  };

  const viewFile = async (path?: string | null) => {
    if (!path) return toast.error("Este contrato ainda não possui arquivo.");
    const { data, error } = await supabase.storage.from("contracts").createSignedUrl(path, 3600);
    if (error) return toast.error(error.message);
    openDownloadUrl(data.signedUrl);
  };

  const downloadFile = async (path?: string | null, name = "contrato") => {
    if (!path) return toast.error("Este contrato ainda não possui arquivo.");
    const { data, error } = await supabase.storage.from("contracts").download(path);
    if (error) return toast.error(error.message);
    const ext = path.includes(".") ? `.${path.split(".").pop()}` : "";
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = name.includes(".") ? name : `${name}${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const kpis = useMemo(() => {
    const total = contracts.length;
    const pendentes = contracts.filter((c: any) => ACTIVE_STATUSES.includes(c.status)).length;
    const aguardando = contracts.filter((c: any) => c.status === "aguardando_assinatura").length;
    const assinados = contracts.filter((c: any) => SIGNED_STATUSES.includes(c.status)).length;
    const vencidos = contracts.filter((c: any) => c.status === "vencido" || isExpired(c)).length;
    const valorTotal = contracts.reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
    return { total, pendentes, aguardando, assinados, vencidos, valorTotal };
  }, [contracts]);

  const relationOptions = useMemo(() => ({
    cliente: contracts.filter((c: any) => c.client_id).length,
    parceiro: contracts.filter((c: any) => c.partner_id).length,
    prestador: contracts.filter((c: any) => c.provider_id).length,
    com_arquivo: contracts.filter((c: any) => c.file_path).length,
    sem_arquivo: contracts.filter((c: any) => !c.file_path).length,
    vencendo: contracts.filter(isExpiringSoon).length,
  }), [contracts]);

  const filteredContracts = useMemo(() => {
    const { start, end } = getDateRange(rangeKey);
    const q = norm(search);
    return contracts.filter((c: any) => {
      const createdAt = c.created_at ? new Date(c.created_at) : null;
      if (rangeKey !== "TUDO" && (!createdAt || createdAt < start || createdAt > end)) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "vencido") {
          if (c.status !== "vencido" && !isExpired(c)) return false;
        } else if (c.status !== statusFilter) return false;
      }
      if (relationFilter === "cliente" && !c.client_id) return false;
      if (relationFilter === "parceiro" && !c.partner_id) return false;
      if (relationFilter === "prestador" && !c.provider_id) return false;
      if (relationFilter === "com_arquivo" && !c.file_path) return false;
      if (relationFilter === "sem_arquivo" && c.file_path) return false;
      if (relationFilter === "vencendo" && !isExpiringSoon(c)) return false;
      if (q) {
        const hay = norm(`${c.name} ${c.clients?.full_name ?? ""} ${c.partners?.full_name ?? ""} ${c.service_providers?.name ?? ""} ${c.products?.name ?? ""} ${c.contract_type ?? ""} ${c.status ?? ""}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [contracts, rangeKey, search, statusFilter, relationFilter]);

  const sortedContracts = useMemo(() => {
    const arr = [...filteredContracts];
    arr.sort((a: any, b: any) => {
      let av: any;
      let bv: any;
      switch (sortKey) {
        case "name":
          av = a.name ?? "";
          bv = b.name ?? "";
          break;
        case "related":
          av = a.clients?.full_name ?? a.partners?.full_name ?? a.service_providers?.name ?? "";
          bv = b.clients?.full_name ?? b.partners?.full_name ?? b.service_providers?.name ?? "";
          break;
        case "product":
          av = a.products?.name ?? "";
          bv = b.products?.name ?? "";
          break;
        case "amount":
          av = Number(a.amount || 0);
          bv = Number(b.amount || 0);
          break;
        case "status":
          av = a.status ?? "";
          bv = b.status ?? "";
          break;
        case "expires_at":
          av = a.expires_at ?? "";
          bv = b.expires_at ?? "";
          break;
        case "created_at":
        default:
          av = a.created_at ?? "";
          bv = b.created_at ?? "";
      }
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredContracts, sortKey, sortDir]);

  const toggleSort = (k: string) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
    setPage(1);
  };

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(sortedContracts.length / pageSize));
  const pageRows = sortedContracts.slice((page - 1) * pageSize, page * pageSize);

  const activeChips: { label: string; clear: () => void }[] = [];
  if (search) activeChips.push({ label: `Busca: "${search}"`, clear: () => setSearch("") });
  if (statusFilter !== "all") activeChips.push({ label: `Status: ${statusConfig[statusFilter as ContractStatus]?.label ?? statusFilter}`, clear: () => setStatusFilter("all") });
  if (relationFilter !== "all") activeChips.push({ label: `Filtro: ${relationFilter.replace(/_/g, " ")}`, clear: () => setRelationFilter("all") });
  if (rangeKey !== "TUDO") activeChips.push({ label: `Período: ${rangeKey}`, clear: () => setRangeKey("TUDO") });

  const exportContracts = () => {
    downloadCsv(
      `contratos-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Contrato", "Relacionado", "Produto", "Tipo", "Valor", "Status", "Criado em", "Validade", "Arquivo"],
      sortedContracts.map((c: any) => [
        c.name,
        c.clients?.full_name || c.partners?.full_name || c.service_providers?.name || "Sem vínculo",
        c.products?.name || "Geral",
        c.contract_type ? c.contract_type.replace(/_/g, " ") : "—",
        Number(c.amount || 0).toFixed(2).replace(".", ","),
        statusConfig[c.status as ContractStatus]?.label ?? c.status,
        formatDate(c.created_at),
        formatDate(c.expires_at),
        c.file_path ? "Sim" : "Não",
      ])
    );
  };

  const openHistory = (contract: any) => {
    setHistoryContractId(contract.id);
    setIsHistoryOpen(true);
  };

  return (
    <div className="min-h-dvh bg-slate-50/60 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <PageHero
        eyebrow="Jurídico"
        category="Contratos & Termos"
        title="Contratos"
        description="Centralize minutas, assinaturas, validade e histórico auditado de contratos vinculados a clientes."
        icon={<FileSignature className="size-6" />}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex max-w-full overflow-x-auto bg-white p-1 rounded-lg border border-slate-200/70 shadow-sm">
              {PERIODS.map((k) => (
                <button
                  key={k}
                  onClick={() => { setRangeKey(k); setPage(1); }}
                  className={cn(
                    "px-3 py-2 rounded-md text-[10px] font-bold transition-all uppercase whitespace-nowrap",
                    rangeKey === k ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
            {canManage && (
              <Button onClick={() => { setSelectedContract(null); setIsDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="size-4 mr-2" /> Novo contrato
              </Button>
            )}
          </div>
        }
        kpis={[
          { label: "Total", value: kpis.total, tone: "primary", icon: <FileSignature className="size-4" />, onClick: () => { setStatusFilter("all"); setRelationFilter("all"); } } as any,
          { label: "Em andamento", value: kpis.pendentes, tone: "warning", icon: <Clock className="size-4" />, onClick: () => setStatusFilter("enviado") } as any,
          { label: "Aguardando", value: kpis.aguardando, tone: "info", icon: <FileSignature className="size-4" />, onClick: () => setStatusFilter("aguardando_assinatura") } as any,
          { label: "Assinados", value: kpis.assinados, tone: "success", icon: <CheckCircle2 className="size-4" />, onClick: () => setStatusFilter("assinado") } as any,
          { label: "Vencidos", value: kpis.vencidos, tone: "danger", icon: <AlertCircle className="size-4" />, onClick: () => setStatusFilter("vencido") } as any,
          { label: "Valor total", value: formatBRL(kpis.valorTotal), tone: "primary", icon: <DollarSign className="size-4" /> },
        ]}
      />

      <div className="max-w-[1600px] mx-auto px-5 lg:px-8 space-y-6 pb-10">
        {kpis.vencidos > 0 && (
          <div className="rounded-lg border border-rose-200/70 bg-rose-50 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="size-5 text-rose-700 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-rose-900">Existem {kpis.vencidos} contrato(s) vencido(s) ou com validade expirada.</p>
                <p className="text-xs text-rose-700 mt-1">Revise validade, status e necessidade de renovação.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="border-rose-200 text-rose-700 hover:bg-rose-100" onClick={() => setStatusFilter("vencido")}>Ver vencidos</Button>
          </div>
        )}

        <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Filter className="size-4 text-slate-500" /> Filtros e busca
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportContracts} className="text-xs">
                <Download className="size-3.5 mr-1.5" /> Exportar CSV
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setRelationFilter("all"); setRangeKey("TUDO"); setPage(1); }} className="text-xs">
                Limpar
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px_220px] gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input className="pl-9 bg-white border-slate-200" placeholder="Buscar por contrato, cliente, parceiro, prestador, produto ou tipo..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="bg-white border-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(statusConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={relationFilter} onValueChange={(v) => { setRelationFilter(v); setPage(1); }}>
              <SelectTrigger className="bg-white border-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os vínculos</SelectItem>
                <SelectItem value="cliente">Clientes ({relationOptions.cliente})</SelectItem>
                <SelectItem value="parceiro">Parceiros ({relationOptions.parceiro})</SelectItem>
                <SelectItem value="prestador">Prestadores ({relationOptions.prestador})</SelectItem>
                <SelectItem value="com_arquivo">Com arquivo ({relationOptions.com_arquivo})</SelectItem>
                <SelectItem value="sem_arquivo">Sem arquivo ({relationOptions.sem_arquivo})</SelectItem>
                <SelectItem value="vencendo">Vencem em 15 dias ({relationOptions.vencendo})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {activeChips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeChips.map((chip) => (
                <button key={chip.label} onClick={chip.clear} className="inline-flex items-center gap-1 rounded-md border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                  {chip.label}<X className="size-3" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/70">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Lista de contratos</h2>
              <p className="text-xs text-slate-500">{sortedContracts.length} contrato(s) encontrado(s)</p>
            </div>
          </div>
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-md" />)}
            </div>
          ) : sortedContracts.length === 0 ? (
            <div className="p-12 text-center">
              <FileSignature className="size-10 mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-800">Nenhum contrato encontrado</p>
              <p className="text-xs text-slate-500 mt-1">Ajuste os filtros ou cadastre um novo contrato.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200/70">
                      <SortableTh label="Contrato" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortableTh label="Relacionado" k="related" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortableTh label="Produto" k="product" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortableTh label="Valor" k="amount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortableTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortableTh label="Validade" k="expires_at" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider font-semibold text-slate-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageRows.map((c: any) => {
                      const status = (isExpired(c) && c.status !== "vencido" ? "vencido" : c.status) as ContractStatus;
                      const config = statusConfig[status] || statusConfig.criado;
                      const StatusIcon = config.icon;
                      const related = c.clients?.full_name || c.partners?.full_name || c.service_providers?.name || "Sem vínculo";
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-4 min-w-[260px]">
                            <div className="flex items-center gap-3">
                              <div className="size-10 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center shrink-0">
                                <FileSignature className="size-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate max-w-[260px]">{c.name}</p>
                                <p className="text-xs text-slate-500 truncate max-w-[260px]">{c.contract_type ? c.contract_type.replace(/_/g, " ") : "Contrato geral"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 min-w-[180px] text-xs font-medium text-slate-600">{related}</td>
                          <td className="px-4 py-4 min-w-[160px] text-xs text-slate-500">{c.products?.name || "Geral"}</td>
                          <td className="px-4 py-4 font-mono text-xs font-semibold text-slate-900">{c.amount ? formatBRL(c.amount) : "—"}</td>
                          <td className="px-4 py-4">
                            <Badge variant="outline" className={cn("w-fit gap-1.5 text-[10px] font-bold uppercase py-1 whitespace-nowrap", config.color)}>
                              <StatusIcon className="size-3" /> {config.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-4 min-w-[150px]">
                            <div className="space-y-1 text-[11px] text-slate-500">
                              <p>Criado: {formatDate(c.created_at)}</p>
                              {c.expires_at && <p className={cn("font-semibold", isExpired(c) ? "text-rose-700" : isExpiringSoon(c) ? "text-amber-700" : "text-slate-600")}>Validade: {formatDate(c.expires_at)}</p>}
                              {c.signed_at && <p className="text-emerald-700 font-semibold">Assinado: {formatDate(c.signed_at)}</p>}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-1">
                              {c.file_path ? (
                                <>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="icon" variant="ghost" aria-label="Ver contrato" className="size-8 text-slate-500 hover:text-indigo-700" onClick={() => viewFile(c.file_path)}><Eye className="size-4" /></Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Ver contrato</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button size="icon" variant="ghost" aria-label="Baixar contrato" className="size-8 text-slate-500 hover:text-indigo-700" onClick={() => downloadFile(c.file_path, c.name)}><Download className="size-4" /></Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Baixar arquivo</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </>
                              ) : (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex size-8 items-center justify-center text-slate-300"><Paperclip className="size-4" /></span>
                                    </TooltipTrigger>
                                    <TooltipContent>Sem arquivo anexado</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" className="size-8" aria-label="Mais ações"><MoreHorizontal className="size-4 text-slate-500" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-60">
                                  {canManage && (
                                    <>
                                      <DropdownMenuItem onClick={() => updateStatus(c, "enviado")}><Clock className="size-4 mr-2" /> Marcar como enviado</DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => updateStatus(c, "aguardando_assinatura")}><FileSignature className="size-4 mr-2" /> Aguardando assinatura</DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => updateStatus(c, "assinado")} className="text-emerald-700"><FileCheck2 className="size-4 mr-2" /> Marcar como assinado</DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => updateStatus(c, "finalizado")} className="text-indigo-700"><CheckCircle2 className="size-4 mr-2" /> Finalizar contrato</DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => updateStatus(c, "pendente_correcao")} className="text-orange-700"><AlertCircle className="size-4 mr-2" /> Solicitar correção</DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => updateStatus(c, "vencido")} className="text-rose-700"><AlertCircle className="size-4 mr-2" /> Marcar vencido</DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => updateStatus(c, "cancelado")} className="text-rose-700"><Ban className="size-4 mr-2" /> Cancelar contrato</DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem onClick={() => { setSelectedContract(c); setIsDialogOpen(true); }}><FileText className="size-4 mr-2" /> Editar detalhes</DropdownMenuItem>
                                    </>
                                  )}
                                  <DropdownMenuItem onClick={() => openHistory(c)}><History className="size-4 mr-2" /> Ver histórico auditado</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationControl currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={sortedContracts.length} itemsPerPage={pageSize} />
            </>
          )}
        </div>
      </div>

      {canManage && (
        <ContractDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          contract={selectedContract}
          onSuccess={invalidate}
        />
      )}

      <Dialog open={isHistoryOpen} onOpenChange={(open) => { setIsHistoryOpen(open); if (!open) setHistoryContractId(null); }}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-slate-950">Histórico de alterações</DialogTitle>
            <DialogDescription>Rastreabilidade de status, arquivos e movimentações do contrato.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 my-2 max-h-[60vh] overflow-y-auto pr-1">
            {historyLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)
            ) : contractHistory.length === 0 ? (
              <p className="text-center py-8 text-sm text-slate-500">Nenhuma alteração registrada até o momento.</p>
            ) : (
              contractHistory.map((h: any) => {
                const config = statusConfig[h.status as ContractStatus] || statusConfig.criado;
                return (
                  <div key={h.id} className="relative rounded-lg border border-slate-200/70 bg-slate-50/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="outline" className={cn("text-[10px] font-bold uppercase", config.color)}>{config.label}</Badge>
                      <span className="text-[10px] font-mono text-slate-500">{formatDate(h.created_at)}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-800 mt-2">{h.notes || "Alteração de status"}</p>
                    <p className="text-[11px] text-slate-500 mt-1">Por: {h.profiles?.full_name || "Sistema"}</p>
                    {h.file_path && (
                      <Button variant="link" size="sm" className="h-auto p-0 mt-2 text-xs text-indigo-700" onClick={() => downloadFile(h.file_path, "contrato-historico")}>Baixar arquivo deste registro</Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsHistoryOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
