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
import { generateSecurePassword } from "@/lib/password";
import {
  Plus, Search, Pencil, Handshake, Users2, Wallet, TrendingUp, Clock3,
  Award, Crown, LayoutGrid, List, Download, X, Power, PowerOff, Mail,
  Copy, KeyRound, Eye, EyeOff, Sparkles, ArrowUpRight, ArrowUp, ArrowDown,
  Inbox, ShieldCheck, Filter, Trash2,
} from "lucide-react";
import { formatBRL, formatPercent, initials, formatPhone } from "@/lib/format";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PartnerDetailDrawer } from "@/components/PartnerDetailDrawer";
import { cn } from "@/lib/utils";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { confirmAction } from "@/lib/confirm";
import { CredentialsManager } from "@/components/CredentialsManager";

const emptyForm = { active: true, commission_percent: 10, partner_category: "indicador" };
type SortKey = "recent" | "name" | "commissions" | "pending" | "clients";
type SortDir = "asc" | "desc";
type ViewMode = "list" | "grid";

const norm = (s: any) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const onlyDigits = (s: any) => String(s ?? "").replace(/\D+/g, "");
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const CATEGORY_META: Record<string, { label: string; cls: string }> = {
  indicador: { label: "Indicador", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  afiliado: { label: "Afiliado", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  estrategico: { label: "Estratégico", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export default function Partners() {
  const { isAdmin, isAdminSecondary } = useAuth();
  const canManage = isAdmin || isAdminSecondary;

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativos" | "inativos">("todos");
  const [categoryFilter, setCategoryFilter] = useState<"todos" | "indicador" | "afiliado" | "estrategico">("todos");
  const [accessFilter, setAccessFilter] = useState<"todos" | "sim" | "nao">("todos");
  const [sortBy, setSortBy] = useState<SortKey>("commissions");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  const [createAccess, setCreateAccess] = useState(false);
  const [accessPwd, setAccessPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [credRow, setCredRow] = useState<any>(null);

  const qc = useQueryClient();

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, categoryFilter, accessFilter, sortBy, sortDir]);

  const { data: partners, isLoading } = useQuery({
    queryKey: ["partners-rich"],
    queryFn: async () => {
      const [{ data: ps }, { data: splits }] = await Promise.all([
        supabase
          .from("partners")
          .select("*, clients(id), partner_products(id)")
          .order("created_at", { ascending: false }),
        supabase
          .from("commission_splits")
          .select("beneficiary_id, amount, status, created_at")
          .eq("beneficiary_type", "partner"),
      ]);
      const byPartner = new Map<string, any[]>();
      (splits ?? []).forEach((s: any) => {
        const arr = byPartner.get(s.beneficiary_id) ?? [];
        arr.push(s);
        byPartner.set(s.beneficiary_id, arr);
      });
      return (ps ?? []).map((p: any) => ({ ...p, commissions: byPartner.get(p.id) ?? [] }));
    },
  });

  const enriched = useMemo(() => {
    return (partners ?? []).map((p: any) => {
      const comms = p.commissions ?? [];
      const total = comms.reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
      const pending = comms.filter((c: any) => c.status === "pendente").reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
      const now = new Date();
      const months: { key: string; total: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, total: 0 });
      }
      comms.forEach((c: any) => {
        const d = new Date(c.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const m = months.find((mm) => mm.key === key);
        if (m) m.total += Number(c.amount || 0);
      });
      const clientsCount = new Set((p.clients ?? []).map((c: any) => c.id)).size;
      return {
        ...p,
        _total: total,
        _pending: pending,
        _spark: months.map((m) => m.total),
        _clientsCount: clientsCount,
        _productsCount: p.partner_products?.length ?? 0,
      };
    });
  }, [partners]);

  const filtered = useMemo(() => {
    const q = norm(debouncedSearch);
    const qDigits = onlyDigits(debouncedSearch);
    let list = enriched.filter((p: any) => {
      if (statusFilter === "ativos" && !p.active) return false;
      if (statusFilter === "inativos" && p.active) return false;
      if (categoryFilter !== "todos" && (p.partner_category ?? "indicador") !== categoryFilter) return false;
      if (accessFilter === "sim" && !p.has_system_access) return false;
      if (accessFilter === "nao" && p.has_system_access) return false;
      if (q) {
        const hay = norm(`${p.full_name ?? ""} ${p.email ?? ""} ${p.pix_key ?? ""}`);
        const docHay = onlyDigits(`${p.document ?? ""}${p.phone ?? ""}${p.whatsapp ?? ""}`);
        if (!hay.includes(q) && !(qDigits && docHay.includes(qDigits))) return false;
      }
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    list = [...list].sort((a, b) => {
      let va: any, vb: any;
      switch (sortBy) {
        case "name": va = norm(a.full_name); vb = norm(b.full_name); break;
        case "commissions": va = a._total; vb = b._total; break;
        case "pending": va = a._pending; vb = b._pending; break;
        case "clients": va = a._clientsCount; vb = b._clientsCount; break;
        case "recent": va = +new Date(a.created_at); vb = +new Date(b.created_at); break;
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return list;
  }, [enriched, debouncedSearch, statusFilter, categoryFilter, accessFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage]);

  const topIds = useMemo(() => {
    const ranking = [...enriched].sort((a, b) => b._total - a._total).slice(0, 3);
    return new Map(ranking.filter((r) => r._total > 0).map((r, i) => [r.id, i + 1]));
  }, [enriched]);

  const kpis = useMemo(() => {
    const total = enriched.length;
    const active = enriched.filter((p: any) => p.active).length;
    const totalComms = enriched.reduce((s: number, p: any) => s + p._total, 0);
    const totalPending = enriched.reduce((s: number, p: any) => s + p._pending, 0);
    const totalClients = enriched.reduce((s: number, p: any) => s + p._clientsCount, 0);
    return { total, active, totalComms, totalPending, totalClients };
  }, [enriched]);

  const toggleSort = (k: SortKey) => {
    if (sortBy === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortBy(k); setSortDir(k === "name" ? "asc" : "desc"); }
  };

  const generatePassword = () => {
    setAccessPwd(generateSecurePassword(12));
    setShowPwd(true);
  };

  const openNew = () => {
    setEditing(null); setForm(emptyForm); setCreateAccess(false); setAccessPwd(""); setOpen(true);
  };

  const openEdit = (p: any) => {
    setEditing(p); setForm({ ...p }); setCreateAccess(false); setAccessPwd(""); setOpen(true);
  };

  const submit = async () => {
    if (!form.full_name?.trim()) { toast.error("Nome obrigatório"); return; }
    if (form.email && !isEmail(form.email)) { toast.error("Email inválido"); return; }
    if (form.document && !isValidCPFOrCNPJ(form.document)) { toast.error("CPF/CNPJ inválido"); return; }
    if (form.phone && !isValidPhoneBR(form.phone)) { toast.error("Telefone inválido"); return; }
    if (form.whatsapp && !isValidPhoneBR(form.whatsapp)) { toast.error("WhatsApp inválido"); return; }
    const pct = Number(form.commission_percent ?? 0);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) { toast.error("Comissão deve estar entre 0 e 100"); return; }

    if (!editing && createAccess) {
      if (!form.email) { toast.error("Email obrigatório para criar acesso"); return; }
      if (!accessPwd || accessPwd.length < 8) { toast.error("Senha deve ter no mínimo 8 caracteres"); return; }
    }

    // Duplicidade
    const dupEmail = form.email && enriched.find((p: any) => p.id !== editing?.id && norm(p.email) === norm(form.email));
    const dupDoc = form.document && enriched.find((p: any) => p.id !== editing?.id && onlyDigits(p.document) === onlyDigits(form.document));
    if (dupEmail || dupDoc) {
      const who = dupEmail?.full_name || dupDoc?.full_name;
      if (!(await confirmAction(`Já existe um parceiro com mesmo ${dupEmail ? "email" : "documento"} (${who}). Continuar mesmo assim?`))) return;
    }

    setSubmitting(true);
    const payload: Record<string, any> = {
      full_name: form.full_name.trim(),
      email: form.email || null,
      phone: form.phone ? onlyDigits(form.phone) : null,
      whatsapp: form.whatsapp ? onlyDigits(form.whatsapp) : null,
      document: form.document ? onlyDigits(form.document) : null,
      pix_key: form.pix_key || null,
      bank_name: form.bank_name || null,
      bank_agency: form.bank_agency || null,
      bank_account: form.bank_account || null,
      partner_category: form.partner_category || "indicador",
      partner_type: form.partner_type || (form.partner_category === "indicador" ? "indicador" : "parceiro"),
      commission_percent: pct,
      default_commission_value: form.default_commission_value != null && form.default_commission_value !== ""
        ? Number(form.default_commission_value) : null,
      notes: form.notes || null,
      active: form.active ?? true,
      has_system_access: form.has_system_access ?? false,
      show_product_name: !!form.show_product_name,
    };
    const { data: partner, error } = editing
      ? await supabase.from("partners").update(payload as any).eq("id", editing.id).select().single()
      : await supabase.from("partners").insert(payload as any).select().single();

    if (error) { setSubmitting(false); toast.error(error.message); return; }

    if (!editing && createAccess && partner) {
      const { error: invErr } = await supabase.functions.invoke("invite-user", {
        body: {
          email: form.email,
          full_name: form.full_name,
          phone: form.phone || null,
          role: "parceiro",
          send_invite: false,
          password: accessPwd,
          link_partner_id: partner.id,
        },
      });
      if (invErr) {
        setSubmitting(false);
        toast.warning("Parceiro criado, mas o acesso falhou: " + invErr.message);
        qc.invalidateQueries({ queryKey: ["partners-rich"] });
        return;
      }
      try { await navigator.clipboard.writeText(`Email: ${form.email}\nSenha: ${accessPwd}`); } catch {}
      toast.success(`Acesso criado para ${form.email}`, {
        description: `Senha: ${accessPwd} (copiada para a área de transferência)`,
        duration: 20000,
      });
    } else {
      toast.success(editing ? "Parceiro atualizado" : "Parceiro cadastrado");
    }

    setSubmitting(false);
    setOpen(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["partners-rich"] });
    qc.invalidateQueries({ queryKey: ["commissions"] });
  };

  const toggleActive = async (p: any) => {
    if (!canManage) return;
    if (p.active && p._pending > 0) {
      if (!(await confirmAction(`${p.full_name} tem ${formatBRL(p._pending)} em comissões pendentes. Desativar mesmo assim?`))) return;
    }
    const { error } = await supabase.from("partners").update({ active: !p.active }).eq("id", p.id);
    if (error) toast.error(error.message);
    else {
      toast.success(p.active ? "Parceiro desativado" : "Parceiro ativado");
      qc.invalidateQueries();
    }
  };

  const removePartner = async (p: any) => {
    if (!canManage) return;
    const { checkFkLinks, summarizeBlocks } = await import("@/lib/safe-delete");
    const res = await checkFkLinks(p.id, [
      { table: "clients", column: "partner_id", label: "cliente(s)" },
      { table: "sales", column: "partner_id", label: "venda(s)" },
      { table: "commissions", column: "partner_id", label: "comissão(ões)" },
      { table: "partner_products", column: "partner_id", label: "produto(s) vinculado(s)" },
    ]);
    if (!res.canDelete) {
      const summary = summarizeBlocks(res.blockedBy);
      if (!(await confirmAction(`${p.full_name} está vinculado a ${summary}. DESATIVAR em vez de excluir?`))) return;
      const { error } = await supabase.from("partners").update({ active: false }).eq("id", p.id);
      if (error) return toast.error(error.message);
      toast.success("Parceiro desativado");
      qc.invalidateQueries();
      return;
    }
    if (!(await confirmAction(`Excluir definitivamente "${p.full_name}"? Esta ação é irreversível.`))) return;
    const { error } = await supabase.from("partners").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Parceiro removido");
    qc.invalidateQueries();
  };

  const exportCSV = () => {
    const headers = ["Nome", "Email", "Telefone", "Documento", "Categoria", "% Comissão", "Indicações", "Total Ganho", "Pendente", "Status", "Criado em"];
    const rows = filtered.map((p: any) => [
      p.full_name ?? "",
      p.email ?? "",
      p.phone ?? "",
      p.document ?? "",
      CATEGORY_META[p.partner_category ?? "indicador"]?.label ?? p.partner_category ?? "",
      Number(p.commission_percent ?? 0).toFixed(2),
      p._clientsCount,
      p._total.toFixed(2),
      p._pending.toFixed(2),
      p.active ? "ativo" : "inativo",
      p.created_at?.slice(0, 10) ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `parceiros-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => { setSearch(""); setStatusFilter("todos"); setCategoryFilter("todos"); setAccessFilter("todos"); };
  const activeChips: { label: string; clear: () => void }[] = [];
  if (search) activeChips.push({ label: `Busca: ${search}`, clear: () => setSearch("") });
  if (statusFilter !== "todos") activeChips.push({ label: `Status: ${statusFilter}`, clear: () => setStatusFilter("todos") });
  if (categoryFilter !== "todos") activeChips.push({ label: `Categoria: ${CATEGORY_META[categoryFilter]?.label}`, clear: () => setCategoryFilter("todos") });
  if (accessFilter !== "todos") activeChips.push({ label: `Acesso: ${accessFilter === "sim" ? "Com acesso" : "Sem acesso"}`, clear: () => setAccessFilter("todos") });
  const hasActiveFilters = activeChips.length > 0;

  const avgPerActive = kpis.active > 0 ? kpis.totalComms / kpis.active : 0;

  return (
    <div className="min-h-dvh bg-slate-50/60 text-slate-900 font-sans admin-shell">
      <PageHero
        eyebrow="Ecosystem"
        category="Partner Network"
        title="Parceiros"
        description="Gerencie sua rede de indicações e parceiros estratégicos com visibilidade total de ganhos e performance."
        icon={<Handshake className="size-6" />}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV} className="h-10 px-4 gap-2 border-slate-200/70 bg-white hover:bg-slate-50">
              <Download className="size-4" /> Exportar
            </Button>
            {canManage && (
              <Button size="sm" onClick={openNew} className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                <Plus className="size-4" /> Novo Parceiro
              </Button>
            )}
          </div>
        }
        kpis={[
          { label: "Total Rede", value: String(kpis.total), tone: "primary", icon: <Users2 className="size-4" /> },
          { label: "Ativos", value: String(kpis.active), tone: "success", icon: <Power className="size-4" /> },
          { label: "Indicações", value: String(kpis.totalClients), tone: "info", icon: <TrendingUp className="size-4" /> },
          { label: "Total Comissões", value: formatBRL(kpis.totalComms), tone: "primary", icon: <Wallet className="size-4" /> },
          { label: "A Pagar", value: formatBRL(kpis.totalPending), tone: "warning", icon: <Clock3 className="size-4" /> },
          { label: "Médio / Ativo", value: formatBRL(avgPerActive), tone: "info", icon: <Award className="size-4" /> },
        ]}
      />

      <div className="max-w-[1600px] mx-auto px-5 lg:px-8 mt-4 space-y-4 pb-10">
        {/* Toolbar */}
        <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar por nome, email, documento, telefone, PIX..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-white border-slate-200 rounded-md text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="h-10 w-[130px] bg-white border-slate-200 text-xs font-medium"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="inativos">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v: any) => setCategoryFilter(v)}>
            <SelectTrigger className="h-10 w-[150px] bg-white border-slate-200 text-xs font-medium"><Filter className="size-3.5 mr-1" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas categorias</SelectItem>
              <SelectItem value="indicador">Indicador</SelectItem>
              <SelectItem value="afiliado">Afiliado</SelectItem>
              <SelectItem value="estrategico">Estratégico</SelectItem>
            </SelectContent>
          </Select>
          <Select value={accessFilter} onValueChange={(v: any) => setAccessFilter(v)}>
            <SelectTrigger className="h-10 w-[150px] bg-white border-slate-200 text-xs font-medium"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Acesso (todos)</SelectItem>
              <SelectItem value="sim">Com acesso</SelectItem>
              <SelectItem value="nao">Sem acesso</SelectItem>
            </SelectContent>
          </Select>
          <Select value={`${sortBy}:${sortDir}`} onValueChange={(v) => { const [k, d] = v.split(":"); setSortBy(k as SortKey); setSortDir(d as SortDir); }}>
            <SelectTrigger className="h-10 w-[180px] bg-white border-slate-200 text-xs font-medium"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="commissions:desc">Maior comissão</SelectItem>
              <SelectItem value="pending:desc">Mais pendente</SelectItem>
              <SelectItem value="clients:desc">Mais indicações</SelectItem>
              <SelectItem value="name:asc">Nome A–Z</SelectItem>
              <SelectItem value="recent:desc">Mais recentes</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center bg-slate-100/80 rounded-md p-1">
            <button onClick={() => setView("list")} className={cn("size-8 rounded flex items-center justify-center transition-all", view === "list" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-900")}>
              <List className="size-4" />
            </button>
            <button onClick={() => setView("grid")} className={cn("size-8 rounded flex items-center justify-center transition-all", view === "grid" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-900")}>
              <LayoutGrid className="size-4" />
            </button>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10 text-slate-500 hover:text-slate-900">
              <X className="size-3.5 mr-1" /> Limpar
            </Button>
          )}
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeChips.map((c, i) => (
              <button key={i} onClick={c.clear} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-semibold border border-indigo-100 hover:bg-indigo-100">
                {c.label}<X className="size-3" />
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-50 rounded animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-16 text-center">
            <Inbox className="size-10 text-slate-300 mx-auto mb-3" />
            <p className="text-lg font-semibold text-slate-700">Nenhum parceiro encontrado</p>
            <p className="text-sm text-slate-500 mt-1">
              {hasActiveFilters ? "Ajuste os filtros para ver mais resultados." : "Cadastre seu primeiro parceiro para começar."}
            </p>
            {canManage && !hasActiveFilters && (
              <Button onClick={openNew} className="mt-4 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"><Plus className="size-4" /> Novo parceiro</Button>
            )}
            {hasActiveFilters && (
              <Button variant="link" onClick={clearFilters} className="mt-2 text-indigo-600">Limpar filtros</Button>
            )}
          </div>
        ) : view === "list" ? (
          <div className="bg-white border border-slate-200/70 rounded-lg overflow-hidden shadow-sm">
            <ListView
              partners={paginated}
              topIds={topIds}
              onDetail={setDrawerId}
              onEdit={openEdit}
              onToggle={toggleActive}
              onDelete={removePartner}
              onCredentials={setCredRow}
              canManage={canManage}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={toggleSort}
            />
            <PaginationControl currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filtered.length} itemsPerPage={itemsPerPage} />
          </div>
        ) : (
          <div className="space-y-4">
            <GridView partners={paginated} topIds={topIds} onDetail={setDrawerId} onEdit={openEdit} onToggle={toggleActive} onDelete={removePartner} onCredentials={setCredRow} canManage={canManage} />
            <PaginationControl currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filtered.length} itemsPerPage={itemsPerPage} />
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-md bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <Handshake className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-xl">{editing ? "Editar Parceiro" : "Novo Parceiro"}</DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">Cadastre indicadores e parceiros estratégicos com dados completos para repasses.</p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-3">
            <PartnerSection title="Identificação" icon={<Users2 className="size-3.5" />}>
              <div className="grid grid-cols-2 gap-3">
                <PartnerField label="Nome Completo / Razão Social *" wide>
                  <Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Ex: João da Silva ou Acme Indicações" />
                </PartnerField>
                <PartnerField label="CPF / CNPJ">
                  <MaskedInput mask="cpfcnpj" value={form.document ?? ""} onChange={(v) => setForm({ ...form, document: v })} placeholder="000.000.000-00" />
                </PartnerField>
                <PartnerField label="Categoria">
                  <Select value={form.partner_category ?? "indicador"} onValueChange={(v) => setForm({ ...form, partner_category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="indicador">Indicador (apenas indicações)</SelectItem>
                      <SelectItem value="afiliado">Afiliado (link próprio)</SelectItem>
                      <SelectItem value="estrategico">Parceiro estratégico</SelectItem>
                    </SelectContent>
                  </Select>
                </PartnerField>
              </div>
            </PartnerSection>

            <PartnerSection title="Contato" icon={<Mail className="size-3.5" />}>
              <div className="grid grid-cols-2 gap-3">
                <PartnerField label="E-mail">
                  <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
                </PartnerField>
                <PartnerField label="Telefone">
                  <MaskedInput mask="phone" value={form.phone ?? ""} onChange={(v) => setForm({ ...form, phone: v })} placeholder="(11) 99999-9999" />
                </PartnerField>
                <PartnerField label="WhatsApp">
                  <MaskedInput mask="phone" value={form.whatsapp ?? ""} onChange={(v) => setForm({ ...form, whatsapp: v })} placeholder="(11) 99999-9999" />
                </PartnerField>
                <PartnerField label="% Comissão padrão">
                  <Input type="number" step="0.01" min={0} max={100} value={form.commission_percent ?? 10} onChange={(e) => setForm({ ...form, commission_percent: e.target.value })} />
                </PartnerField>
              </div>
            </PartnerSection>

            <PartnerSection title="Dados bancários para repasse" icon={<Wallet className="size-3.5" />}>
              <div className="grid grid-cols-2 gap-3">
                <PartnerField label="Chave Pix" wide>
                  <Input value={form.pix_key ?? ""} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} placeholder="CPF, e-mail, telefone ou chave aleatória" />
                </PartnerField>
                <PartnerField label="Banco">
                  <Input value={form.bank_name ?? ""} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="Ex: Itaú" />
                </PartnerField>
                <PartnerField label="Agência">
                  <Input value={form.bank_agency ?? ""} onChange={(e) => setForm({ ...form, bank_agency: e.target.value })} placeholder="0000" />
                </PartnerField>
                <PartnerField label="Conta" wide>
                  <Input value={form.bank_account ?? ""} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} placeholder="00000-0" />
                </PartnerField>
              </div>
            </PartnerSection>

            <PartnerSection title="Notas e Status" icon={<Crown className="size-3.5" />}>
              <PartnerField label="Notas internas">
                <textarea
                  value={form.notes ?? ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                  placeholder="Histórico, observações, condições especiais..."
                />
              </PartnerField>
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50/60 px-4 py-3 mt-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-700">Parceria ativa</p>
                  <p className="text-[11px] text-slate-500">{form.active ? "Recebe novas indicações e comissões" : "Pausado / inativo"}</p>
                </div>
                <Switch checked={!!form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </div>
              {editing && form.has_system_access && (
                <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 mt-2 text-emerald-800 text-xs">
                  <ShieldCheck className="size-4" />
                  Este parceiro tem acesso ao painel.
                </div>
              )}
            </PartnerSection>

            {!editing && (
              <PartnerSection title="Acesso ao Painel" icon={<KeyRound className="size-3.5" />}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-md border border-slate-200 bg-indigo-50/40 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-700">
                        <KeyRound className="size-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-900">Criar acesso ao painel</p>
                        <p className="text-[11px] text-slate-500">O parceiro poderá logar e ver suas comissões</p>
                      </div>
                    </div>
                    <Switch checked={createAccess} onCheckedChange={setCreateAccess} />
                  </div>

                  {createAccess && (
                    <div className="grid grid-cols-1 gap-4 p-4 rounded-md border border-indigo-100 bg-white">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">Senha de acesso *</Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              type={showPwd ? "text" : "password"}
                              value={accessPwd}
                              onChange={(e) => setAccessPwd(e.target.value)}
                              placeholder="Mínimo 8 caracteres"
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPwd(!showPwd)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                          </div>
                          <Button variant="outline" size="icon" aria-label="Gerar senha forte" onClick={generatePassword} title="Gerar senha forte" className="shrink-0">
                            <Sparkles className="size-4 text-indigo-600" />
                          </Button>
                          {accessPwd && (
                            <Button variant="outline" size="icon" aria-label="Copiar senha" title="Copiar senha" className="shrink-0" onClick={async () => {
                              try { await navigator.clipboard.writeText(accessPwd); toast.success("Senha copiada"); } catch {}
                            }}>
                              <Copy className="size-4 text-slate-600" />
                            </Button>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1">
                          <Copy className="size-3" /> A senha também será copiada ao salvar
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </PartnerSection>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancelar</Button>
            <Button onClick={submit} disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {submitting ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar parceiro"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PartnerDetailDrawer partnerId={drawerId} open={!!drawerId} onOpenChange={(o) => !o && setDrawerId(null)} />

      <Dialog open={!!credRow} onOpenChange={(v) => !v && setCredRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Acesso de {credRow?.full_name}</DialogTitle>
          </DialogHeader>
          {credRow && (
            <CredentialsManager
              userId={credRow.user_id}
              currentEmail={credRow.email}
              entityLabel="parceiro"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ListView({ partners, topIds, onDetail, onEdit, onToggle, onDelete, onCredentials, canManage, sortBy, sortDir, onSort }: any) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] min-w-[960px]">
        <thead>
          <tr className="border-b border-slate-200/70 bg-slate-50/60">
            <SortableTh label="Parceiro" k="name" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <Th>Categoria</Th>
            <SortableTh label="Indicações" k="clients" sortBy={sortBy} sortDir={sortDir} onSort={onSort} align="right" />
            <SortableTh label="Total Ganho" k="commissions" sortBy={sortBy} sortDir={sortDir} onSort={onSort} align="right" />
            <SortableTh label="Pendente" k="pending" sortBy={sortBy} sortDir={sortDir} onSort={onSort} align="right" />
            <Th align="center">Trend (6m)</Th>
            <Th align="right">Ações</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {partners.map((p: any) => {
            const rank = topIds.get(p.id);
            const cat = CATEGORY_META[p.partner_category ?? "indicador"];
            return (
              <tr key={p.id} className="hover:bg-slate-50/60 transition-colors group">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className={cn("size-10 rounded-md flex items-center justify-center text-sm font-bold", p.active ? "bg-indigo-50 border border-indigo-100 text-indigo-700" : "bg-slate-100 border border-slate-200 text-slate-500")}>
                        {initials(p.full_name)}
                      </div>
                      {rank && <RankBadge rank={rank} />}
                    </div>
                    <div className="min-w-0">
                      <button onClick={() => onDetail(p.id)} className="font-semibold text-slate-900 hover:text-indigo-700 transition-colors text-[14px] text-left truncate flex items-center gap-1.5">
                        {p.full_name}
                        {p.has_system_access && <ShieldCheck className="size-3.5 text-emerald-600" />}
                        {!p.active && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">Inativo</span>}
                      </button>
                      <p className="text-[11px] text-slate-500 font-mono truncate">{p.email || formatPhone(p.phone) || "—"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className={cn("inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border", cat.cls)}>{cat.label}</span>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{formatPercent(p.commission_percent)} base</p>
                </td>
                <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-700">{p._clientsCount}</td>
                <td className="px-5 py-3.5 text-right font-mono font-bold text-indigo-700">{formatBRL(p._total)}</td>
                <td className="px-5 py-3.5 text-right font-mono font-semibold">
                  {p._pending > 0 ? <span className="text-amber-700">{formatBRL(p._pending)}</span> : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-5 py-3.5"><Sparkline data={p._spark} /></td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => onDetail(p.id)} className="size-8 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-indigo-700 flex items-center justify-center transition-colors" title="Ver detalhe">
                      <ArrowUpRight className="size-3.5" />
                    </button>
                    {canManage && (
                      <>
                        <button onClick={() => onEdit(p)} className="size-8 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-indigo-700 flex items-center justify-center transition-colors" title="Editar">
                          <Pencil className="size-3.5" />
                        </button>
                        <button onClick={() => onToggle(p)} className="size-8 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-amber-700 flex items-center justify-center transition-colors" title={p.active ? "Desativar" : "Ativar"}>
                          {p.active ? <PowerOff className="size-3.5" /> : <Power className="size-3.5" />}
                        </button>
                        <button onClick={() => onCredentials(p)} className="size-8 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-indigo-700 flex items-center justify-center transition-colors" title="Alterar e-mail/senha">
                          <KeyRound className="size-3.5" />
                        </button>
                        <button onClick={() => onDelete(p)} className="size-8 rounded-md border border-slate-200 bg-white hover:bg-red-50 text-slate-600 hover:text-red-700 hover:border-red-200 flex items-center justify-center transition-colors" title="Excluir">
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GridView({ partners, topIds, onDetail, onEdit, onToggle, onDelete, onCredentials, canManage }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {partners.map((p: any) => {
        const rank = topIds.get(p.id);
        const cat = CATEGORY_META[p.partner_category ?? "indicador"];
        return (
          <div key={p.id} className="bg-white border border-slate-200/70 rounded-lg p-5 hover:border-indigo-200 hover:shadow-md transition-all shadow-sm flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className="relative">
                <div className={cn("size-12 rounded-md flex items-center justify-center text-base font-bold", p.active ? "bg-indigo-50 border border-indigo-100 text-indigo-700" : "bg-slate-100 border border-slate-200 text-slate-500")}>
                  {initials(p.full_name)}
                </div>
                {rank && <RankBadge rank={rank} />}
              </div>
              <div className="flex items-center gap-1">
                {canManage && (
                  <>
                    <button onClick={() => onEdit(p)} className="size-8 rounded-md hover:bg-slate-100 text-slate-500 hover:text-indigo-700 flex items-center justify-center" title="Editar">
                      <Pencil className="size-3.5" />
                    </button>
                    <button onClick={() => onToggle(p)} className="size-8 rounded-md hover:bg-slate-100 text-slate-500 hover:text-amber-700 flex items-center justify-center" title={p.active ? "Desativar" : "Ativar"}>
                      {p.active ? <PowerOff className="size-3.5" /> : <Power className="size-3.5" />}
                    </button>
                    <button onClick={() => onCredentials(p)} className="size-8 rounded-md hover:bg-slate-100 text-slate-500 hover:text-indigo-700 flex items-center justify-center" title="Alterar e-mail/senha">
                      <KeyRound className="size-3.5" />
                    </button>
                    <button onClick={() => onDelete(p)} className="size-8 rounded-md hover:bg-red-50 text-slate-500 hover:text-red-700 flex items-center justify-center" title="Excluir">
                      <Trash2 className="size-3.5" />
                    </button>
                  </>
                )}
                <button onClick={() => onDetail(p.id)} className="size-8 rounded-md bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 flex items-center justify-center transition-colors" title="Ver detalhe">
                  <ArrowUpRight className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 mb-1">
              <span className={cn("inline-flex px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider border", cat.cls)}>{cat.label}</span>
              {p.has_system_access && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider border bg-emerald-50 text-emerald-700 border-emerald-200"><ShieldCheck className="size-3" /> Acesso</span>}
              {!p.active && <span className="inline-flex px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider border bg-slate-100 text-slate-600 border-slate-200">Inativo</span>}
            </div>
            <h3 className="text-base font-bold text-slate-900 truncate">{p.full_name}</h3>
            <p className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold truncate">{p.email || formatPhone(p.phone) || "Sem contato"}</p>

            <div className="grid grid-cols-3 gap-3 pt-4 mt-4 border-t border-slate-100">
              <div>
                <p className="text-[9.5px] uppercase tracking-widest text-slate-400 font-bold mb-0.5">Indicações</p>
                <p className="text-[15px] font-bold font-mono text-slate-900">{p._clientsCount}</p>
              </div>
              <div>
                <p className="text-[9.5px] uppercase tracking-widest text-slate-400 font-bold mb-0.5">Ganho</p>
                <p className="text-[15px] font-bold font-mono text-indigo-700">{formatBRL(p._total)}</p>
              </div>
              <div>
                <p className="text-[9.5px] uppercase tracking-widest text-slate-400 font-bold mb-0.5">Pendente</p>
                <p className={cn("text-[15px] font-bold font-mono", p._pending > 0 ? "text-amber-700" : "text-slate-400")}>{p._pending > 0 ? formatBRL(p._pending) : "—"}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0 || data.every((v) => v === 0)) return <div className="h-5 w-20 bg-slate-100 rounded-full mx-auto" />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 80, H = 20;
  const points = data.map((v, i) => `${i * (W / (data.length - 1))},${H - ((v - min) / range) * H}`).join(" ");
  return (
    <svg width={W} height={H} className="mx-auto">
      <polyline points={points} fill="none" stroke="currentColor" className="text-indigo-600" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const Icon = rank === 1 ? Crown : Award;
  const colors = rank === 1 ? "bg-amber-400 text-amber-950" : rank === 2 ? "bg-slate-300 text-slate-800" : "bg-amber-700 text-amber-50";
  return (
    <div className={cn("absolute -top-1.5 -right-1.5 size-5 rounded-full flex items-center justify-center shadow-sm ring-2 ring-white", colors)}>
      <Icon className="size-2.5" />
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" | "center" }) {
  return (
    <th className={cn("px-5 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500",
      align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left")}>
      {children}
    </th>
  );
}

function SortableTh({ label, k, sortBy, sortDir, onSort, align = "left" }: any) {
  const active = sortBy === k;
  return (
    <th className={cn("px-5 py-3", align === "right" ? "text-right" : "text-left")}>
      <button
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors",
          active ? "text-indigo-700" : "text-slate-500 hover:text-slate-900",
          align === "right" && "flex-row-reverse"
        )}
      >
        {label}
        {active && (sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );
}

function PartnerSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
        <span className="size-6 rounded-md bg-indigo-50 text-indigo-700 flex items-center justify-center">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function PartnerField({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`space-y-1.5 ${wide ? "col-span-2" : ""}`}>
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</Label>
      {children}
    </div>
  );
}
