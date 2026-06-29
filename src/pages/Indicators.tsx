import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/use-debounce";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MaskedInput } from "@/components/ui/masked-input";
import { isValidCPFOrCNPJ, isValidPhoneBR } from "@/lib/validators";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  UserCheck, Plus, Search, MoreHorizontal, Pencil, Trash2, Award, Wallet, Users2, TrendingUp,
  Power, Download, X, LayoutGrid, List, ArrowUp, ArrowDown, ArrowUpDown, KeyRound, Mail, Phone,
} from "lucide-react";
import { formatBRL, formatPercent, initials, formatPhone } from "@/lib/format";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { cn } from "@/lib/utils";
import { CredentialsManager } from "@/components/CredentialsManager";

type SortKey = "name" | "clients" | "total" | "pending" | "percent" | "status" | "recent";
type SortDir = "asc" | "desc";
type ViewMode = "list" | "grid";

const emptyForm: any = { active: true, commission_percent: 5 };

const norm = (s: any) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const onlyDigits = (s: any) => String(s ?? "").replace(/\D+/g, "");
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export default function Indicators() {
  const qc = useQueryClient();
  const { isAdmin, isAdminSecondary } = useAuth();
  const canManage = isAdmin || isAdminSecondary;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [credRow, setCredRow] = useState<any>(null);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativos" | "inativos">("todos");
  const [accessFilter, setAccessFilter] = useState<"todos" | "com" | "sem">("todos");
  const [finFilter, setFinFilter] = useState<"todos" | "pendentes" | "sem_pendencia">("todos");
  const [view, setView] = useState<ViewMode>("list");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, statusFilter, accessFilter, finFilter, sortKey, sortDir]);

  const { data: referrers = [], isLoading: loadingR } = useQuery({
    queryKey: ["referrers-rich"],
    queryFn: async () => {
      const { data, error } = await supabase.from("referrers").select("*").order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const { data: splits = [], isLoading: loadingS } = useQuery({
    queryKey: ["referrer-commissions-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_splits")
        .select("beneficiary_id, amount, status")
        .eq("beneficiary_type", "referrer")
        .limit(300);
      return (data ?? []).map((s: any) => ({ ...s, referrer_id: s.beneficiary_id }));
    },
    staleTime: 60_000,
  });

  const { data: clientsByReferrer = [] } = useQuery({
    queryKey: ["clients-by-referrer"],
    queryFn: async () => (await supabase.from("clients").select("id, referrer_id").not("referrer_id", "is", null).limit(300)).data ?? [],
    staleTime: 60_000,
  });

  const isLoading = loadingR || loadingS;

  const enriched = useMemo(() => {
    return (referrers ?? []).map((r: any) => {
      const mySplits = splits.filter((s: any) => s.referrer_id === r.id);
      const total = mySplits.reduce((a: number, s: any) => a + Number(s.amount || 0), 0);
      const paid = mySplits.filter((s: any) => s.status === "pago").reduce((a: number, s: any) => a + Number(s.amount || 0), 0);
      const pending = mySplits.filter((s: any) => s.status === "pendente").reduce((a: number, s: any) => a + Number(s.amount || 0), 0);
      const clientIds = new Set(clientsByReferrer.filter((c: any) => c.referrer_id === r.id).map((c: any) => c.id));
      return {
        ...r,
        _total: total,
        _paid: paid,
        _pending: pending,
        _clients: clientIds.size,
        _hasAccess: !!r.user_id,
      };
    });
  }, [referrers, splits, clientsByReferrer]);

  const filtered = useMemo(() => {
    const q = norm(debouncedSearch);
    const qD = onlyDigits(debouncedSearch);
    return enriched.filter((r: any) => {
      if (statusFilter === "ativos" && !r.active) return false;
      if (statusFilter === "inativos" && r.active) return false;
      if (accessFilter === "com" && !r._hasAccess) return false;
      if (accessFilter === "sem" && r._hasAccess) return false;
      if (finFilter === "pendentes" && r._pending <= 0) return false;
      if (finFilter === "sem_pendencia" && r._pending > 0) return false;
      if (q) {
        const hay = `${norm(r.full_name)} ${norm(r.email)} ${norm(r.pix_key)} ${norm(r.notes)}`;
        if (hay.includes(q)) return true;
        if (qD && (onlyDigits(r.phone).includes(qD) || onlyDigits(r.document).includes(qD) || onlyDigits(r.pix_key).includes(qD))) return true;
        return false;
      }
      return true;
    });
  }, [enriched, debouncedSearch, statusFilter, accessFilter, finFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    const get = (r: any) => {
      switch (sortKey) {
        case "name": return norm(r.full_name);
        case "clients": return r._clients;
        case "total": return r._total;
        case "pending": return r._pending;
        case "percent": return Number(r.commission_percent ?? 0);
        case "status": return r.active ? 1 : 0;
        case "recent": return +new Date(r.created_at);
      }
    };
    arr.sort((a, b) => {
      const av = get(a), bv = get(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / itemsPerPage));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sorted.slice(start, start + itemsPerPage);
  }, [sorted, currentPage]);

  const kpis = useMemo(() => {
    const count = enriched.length;
    const active = enriched.filter((r: any) => r.active).length;
    const totalClients = enriched.reduce((s: number, r: any) => s + r._clients, 0);
    const revenue = enriched.reduce((s: number, r: any) => s + r._total, 0);
    const pending = enriched.reduce((s: number, r: any) => s + r._pending, 0);
    return { count, active, totalClients, revenue, pending };
  }, [enriched]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "name" ? "asc" : "desc"); }
  };

  const hasFilters = !!search || statusFilter !== "todos" || accessFilter !== "todos" || finFilter !== "todos";
  const clearFilters = () => { setSearch(""); setStatusFilter("todos"); setAccessFilter("todos"); setFinFilter("todos"); };

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (r: any) => { setEditing(r); setForm({ ...r }); setOpen(true); };

  const submit = async () => {
    if (!canManage) return;
    const name = String(form.full_name ?? "").trim();
    if (!name) { toast.error("Nome obrigatório"); return; }
    const email = String(form.email ?? "").trim();
    if (email && !isEmail(email)) { toast.error("Email inválido"); return; }
    if (form.document && !isValidCPFOrCNPJ(form.document)) { toast.error("CPF/CNPJ inválido"); return; }
    if (form.phone && !isValidPhoneBR(form.phone)) { toast.error("Telefone inválido"); return; }
    const pct = Number(form.commission_percent);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) { toast.error("Comissão deve estar entre 0 e 100"); return; }

    const payload = {
      full_name: name,
      email: email || null,
      phone: form.phone ? onlyDigits(form.phone) : null,
      document: form.document ? onlyDigits(form.document) : null,
      pix_key: String(form.pix_key ?? "").trim() || null,
      commission_percent: pct,
      active: form.active ?? true,
      notes: String(form.notes ?? "").trim() || null,
    };
    const { error } = editing?.id
      ? await supabase.from("referrers").update(payload).eq("id", editing.id)
      : await supabase.from("referrers").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(editing?.id ? "Indicador atualizado" : "Indicador cadastrado");
    setOpen(false); setEditing(null); setForm(emptyForm);
    invalidateAll();
  };

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["referrers-rich"] });
    qc.invalidateQueries({ queryKey: ["referrer-splits-all"] });
    qc.invalidateQueries({ queryKey: ["clients-by-referrer"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const remove = async (r: any) => {
    if (!canManage) return;
    const { checkFkLinks, summarizeBlocks } = await import("@/lib/safe-delete");
    const res = await checkFkLinks(r.id, [
      { table: "clients", column: "referrer_id", label: "cliente(s)" },
      { table: "sales", column: "referrer_id", label: "venda(s)" },
    ]);
    if (!res.canDelete) {
      const summary = summarizeBlocks(res.blockedBy);
      if (!(await confirmAction(`${r.full_name} está vinculado a ${summary}. DESATIVAR em vez de excluir?`))) return;
      const { error } = await supabase.from("referrers").update({ active: false }).eq("id", r.id);
      if (error) return toast.error(error.message);
      toast.success("Indicador desativado");
      invalidateAll();
      return;
    }
    if (!(await confirmAction(`Excluir definitivamente "${r.full_name}"? Esta ação é irreversível.`))) return;
    const { error } = await supabase.from("referrers").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Indicador removido");
    invalidateAll();
  };

  const toggleActive = async (r: any) => {
    if (!canManage) return;
    if (r.active && r._pending > 0) {
      if (!(await confirmAction(`${r.full_name} possui ${formatBRL(r._pending)} em comissões pendentes. Desativar mesmo assim?`))) return;
    } else if (r.active && r._clients > 0) {
      if (!(await confirmAction(`${r.full_name} tem ${r._clients} cliente(s) vinculado(s). Desativar?`))) return;
    }
    const { error } = await supabase.from("referrers").update({ active: !r.active }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(r.active ? "Indicador desativado" : "Indicador ativado");
    invalidateAll();
  };

  const exportCsv = () => {
    if (!canManage) return;
    const headers = ["Nome", "Email", "Telefone", "Documento", "PIX", "% Comissão", "Clientes indicados", "Comissões geradas", "Pago", "A pagar", "Status", "Acesso ao painel", "Criado em"];
    const rows = sorted.map((r: any) => [
      r.full_name ?? "",
      r.email ?? "",
      r.phone ?? "",
      r.document ?? "",
      r.pix_key ?? "",
      Number(r.commission_percent ?? 0).toFixed(2),
      r._clients,
      Number(r._total).toFixed(2),
      Number(r._paid).toFixed(2),
      Number(r._pending).toFixed(2),
      r.active ? "Ativo" : "Inativo",
      r._hasAccess ? "Sim" : "Não",
      r.created_at ? new Date(r.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
    ]);
    const csv = [headers, ...rows].map(line => line.map(c => {
      const s = String(c ?? "");
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `indicadores_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${sorted.length} indicador(es) exportado(s)`);
  };

  return (
    <div className="page-shell space-y-6 animate-fade-up">
      <PageHero
        eyebrow="Network"
        category="Receita Indicada"
        title="Indicadores"
        description="Pessoas que trazem clientes e recebem comissão por venda fechada. Acompanhe alcance, pagamentos e quem está performando."
        icon={<UserCheck className="size-6" />}
        actions={
          canManage && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportCsv} className="h-9" disabled={sorted.length === 0}>
                <Download className="size-4 mr-1.5" /> Exportar
              </Button>
              <Button onClick={openNew} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="size-4 mr-1.5" /> Novo indicador
              </Button>
            </div>
          )
        }
        kpis={[
          { label: "Indicadores", value: kpis.count, hint: `${kpis.active} ativos`, tone: "primary", icon: <Users2 className="size-4" /> },
          { label: "Ativos", value: kpis.active, tone: "success", icon: <UserCheck className="size-4" />, onClick: () => setStatusFilter(statusFilter === "ativos" ? "todos" : "ativos") },
          { label: "Clientes indicados", value: kpis.totalClients, tone: "info", icon: <TrendingUp className="size-4" /> },
          { label: "Comissões geradas", value: formatBRL(kpis.revenue), tone: "primary", icon: <Award className="size-4" /> },
          { label: "A pagar", value: formatBRL(kpis.pending), tone: "warning", icon: <Wallet className="size-4" />, onClick: () => setFinFilter(finFilter === "pendentes" ? "todos" : "pendentes") },
        ]}
      />

      <div className="px-5 lg:px-8 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por nome, email, telefone, documento ou PIX..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-md bg-white border-slate-200/70"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="h-10 w-[140px] rounded-md text-xs bg-white border-slate-200/70"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="inativos">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={accessFilter} onValueChange={(v) => setAccessFilter(v as any)}>
            <SelectTrigger className="h-10 w-[170px] rounded-md text-xs bg-white border-slate-200/70"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos acessos</SelectItem>
              <SelectItem value="com">Com acesso ao painel</SelectItem>
              <SelectItem value="sem">Sem acesso ao painel</SelectItem>
            </SelectContent>
          </Select>
          <Select value={finFilter} onValueChange={(v) => setFinFilter(v as any)}>
            <SelectTrigger className="h-10 w-[160px] rounded-md text-xs bg-white border-slate-200/70"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas pendências</SelectItem>
              <SelectItem value="pendentes">Com pendência</SelectItem>
              <SelectItem value="sem_pendencia">Sem pendência</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center bg-white border border-slate-200/70 rounded-md p-1">
            <button onClick={() => setView("list")} className={cn("size-8 rounded flex items-center justify-center transition-colors", view === "list" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-700")}>
              <List className="size-4" />
            </button>
            <button onClick={() => setView("grid")} className={cn("size-8 rounded flex items-center justify-center transition-colors", view === "grid" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:text-slate-700")}>
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {hasFilters && (
        <div className="px-5 lg:px-8 flex items-center gap-2 flex-wrap">
          {search && <FilterChip label={`Busca: "${search}"`} onClear={() => setSearch("")} />}
          {statusFilter !== "todos" && <FilterChip label={`Status: ${statusFilter}`} onClear={() => setStatusFilter("todos")} />}
          {accessFilter !== "todos" && <FilterChip label={`Acesso: ${accessFilter === "com" ? "com painel" : "sem painel"}`} onClear={() => setAccessFilter("todos")} />}
          {finFilter !== "todos" && <FilterChip label={finFilter === "pendentes" ? "Com pendência" : "Sem pendência"} onClear={() => setFinFilter("todos")} />}
          <button onClick={clearFilters} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 ml-1">Limpar tudo</button>
        </div>
      )}

      <div className="px-5 lg:px-8 pb-10">
        {isLoading ? (
          view === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 rounded-lg bg-white border border-slate-200/70 shadow-sm animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          )
        ) : sorted.length === 0 ? (
          <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-16 text-center">
            <UserCheck className="size-12 mx-auto text-slate-300 mb-4" />
            <p className="font-display text-lg text-slate-700">
              {hasFilters ? "Nenhum indicador bate com os filtros" : "Nenhum indicador cadastrado"}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {hasFilters ? "Ajuste ou limpe os filtros para ver outros resultados." : "Cadastre quem traz clientes e configure a comissão padrão."}
            </p>
            {hasFilters ? (
              <Button variant="outline" onClick={clearFilters} className="mt-5">Limpar filtros</Button>
            ) : canManage && (
              <Button onClick={openNew} className="mt-5 bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="size-4 mr-1.5" /> Cadastrar primeiro indicador
              </Button>
            )}
          </div>
        ) : view === "grid" ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {paginated.map((r: any) => (
                <ReferrerCard
                  key={r.id}
                  r={r}
                  canManage={canManage}
                  onEdit={() => openEdit(r)}
                  onToggle={() => toggleActive(r)}
                  onDelete={() => remove(r)}
                  onCredentials={() => setCredRow(r)}
                />
              ))}
            </div>
            <PaginationControl
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={sorted.length}
              itemsPerPage={itemsPerPage}
              className="mt-6 bg-white border border-slate-200/70 rounded-lg"
            />
          </>
        ) : (
          <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1100px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/70 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                    <SortableTh label="Indicador" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-5 py-3 text-left">Contato</th>
                    <th className="px-5 py-3 text-left">Documento / PIX</th>
                    <SortableTh label="% Padrão" k="percent" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableTh label="Clientes" k="clients" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
                    <SortableTh label="Pago" k="total" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableTh label="A pagar" k="pending" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                    <SortableTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
                    <th className="px-5 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {paginated.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-md bg-indigo-50 text-indigo-700 border border-slate-200/70 flex items-center justify-center font-semibold text-xs">
                            {initials(r.full_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                              {r.full_name}
                              {r._hasAccess && <KeyRound className="size-3 text-emerald-600 shrink-0" aria-label="Tem acesso ao painel" />}
                            </p>
                            {r.notes && <p className="text-[11px] text-slate-500 truncate max-w-[260px]">{r.notes}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600">
                        <div className="truncate max-w-[220px]">{r.email ?? "—"}</div>
                        <div className="font-mono">{formatPhone(r.phone) || "—"}</div>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600">
                        <div className="font-mono">{r.document ?? "—"}</div>
                        <div className="font-mono text-slate-500 truncate max-w-[220px]">{r.pix_key ?? "—"}</div>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-mono text-slate-800">{formatPercent(r.commission_percent)}</td>
                      <td className="px-5 py-3 text-center tabular-nums font-mono font-semibold text-slate-800">{r._clients}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-mono text-emerald-700">{formatBRL(r._paid)}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-mono text-amber-700">{formatBRL(r._pending)}</td>
                      <td className="px-5 py-3 text-center">
                        <Badge className={cn("text-[10px] border", r.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200")}>
                          {r.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {canManage ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="size-8" aria-label="Mais ações"><MoreHorizontal className="size-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(r)}><Pencil className="size-4 mr-2" /> Editar</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setCredRow(r)} disabled={!r.user_id}>
                                <KeyRound className="size-4 mr-2" /> Alterar e-mail/senha
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleActive(r)}><Power className="size-4 mr-2" /> {r.active ? "Desativar" : "Ativar"}</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => remove(r)} className="text-destructive focus:text-destructive">
                                <Trash2 className="size-4 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControl
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={sorted.length}
              itemsPerPage={itemsPerPage}
            />
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-slate-900">
              {editing?.id ? "Editar indicador" : "Novo indicador"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-2">
              <Label>Nome completo *</Label>
              <Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <MaskedInput mask="phone" value={form.phone ?? ""} onChange={(v) => setForm({ ...form, phone: v })} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label>CPF/CNPJ</Label>
              <MaskedInput mask="cpfcnpj" value={form.document ?? ""} onChange={(v) => setForm({ ...form, document: v })} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-2">
              <Label>Chave PIX</Label>
              <Input value={form.pix_key ?? ""} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>% Comissão padrão</Label>
              <Input type="number" step="0.01" min={0} max={100} value={form.commission_percent ?? 5} onChange={(e) => setForm({ ...form, commission_percent: e.target.value })} />
            </div>
            <div className="space-y-2 flex items-end gap-3">
              <Switch checked={!!form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <Label>Ativo</Label>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} className="bg-indigo-600 hover:bg-indigo-700 text-white">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!credRow} onOpenChange={(v) => !v && setCredRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Acesso de {credRow?.full_name}</DialogTitle>
          </DialogHeader>
          {credRow && (
            <CredentialsManager
              userId={credRow.user_id}
              currentEmail={credRow.email}
              entityLabel="indicador"
              entityType="indicador"
              entityId={credRow.id}
              entityName={credRow.full_name}
            />

          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[11px] font-medium text-indigo-700">
      {label}
      <button onClick={onClear} className="hover:bg-indigo-100 rounded-full p-0.5"><X className="size-3" /></button>
    </span>
  );
}

function SortableTh({ label, k, sortKey, sortDir, onSort, align = "left" }: any) {
  const active = sortKey === k;
  return (
    <th className={cn("px-5 py-3 select-none", align === "center" && "text-center", align === "right" && "text-right")}>
      <button onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 hover:text-slate-700 transition-colors", active && "text-indigo-700")}>
        {label}
        {active ? (sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
      </button>
    </th>
  );
}

function ReferrerCard({ r, canManage, onEdit, onToggle, onDelete, onCredentials }: any) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-slate-200/70 bg-white shadow-sm p-5 hover:border-indigo-200 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-11 rounded-md bg-indigo-50 text-indigo-700 border border-slate-200/70 flex items-center justify-center font-semibold shrink-0">
            {initials(r.full_name)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5 truncate">
              {r.full_name}
              {r._hasAccess && <KeyRound className="size-3 text-emerald-600 shrink-0" />}
            </p>
            <Badge className={cn("mt-1 text-[10px] border", r.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200")}>
              {r.active ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </div>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="size-8" aria-label="Mais ações"><MoreHorizontal className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}><Pencil className="size-4 mr-2" /> Editar</DropdownMenuItem>
              <DropdownMenuItem onClick={onCredentials} disabled={!r.user_id}><KeyRound className="size-4 mr-2" /> Alterar e-mail/senha</DropdownMenuItem>
              <DropdownMenuItem onClick={onToggle}><Power className="size-4 mr-2" /> {r.active ? "Desativar" : "Ativar"}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="size-4 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="space-y-1 text-xs text-slate-600 mb-4">
        {r.email && <div className="flex items-center gap-1.5 truncate"><Mail className="size-3 text-slate-400" /> {r.email}</div>}
        {r.phone && <div className="flex items-center gap-1.5 font-mono"><Phone className="size-3 text-slate-400" /> {formatPhone(r.phone)}</div>}
      </div>

      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
        <Metric label="Clientes" value={String(r._clients)} />
        <Metric label="Pago" value={formatBRL(r._paid)} tone="emerald" />
        <Metric label="A pagar" value={formatBRL(r._pending)} tone="amber" />
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">{label}</p>
      <p className={cn("text-sm font-semibold font-mono tabular-nums truncate", tone === "emerald" && "text-emerald-700", tone === "amber" && "text-amber-700", !tone && "text-slate-800")}>
        {value}
      </p>
    </div>
  );
}
