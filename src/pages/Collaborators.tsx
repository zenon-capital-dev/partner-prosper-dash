import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/use-debounce";
import { useCepLookup } from "@/hooks/useCepLookup";

import {
  UserCircle, Search, Plus, Mail, Phone, Shield, Loader2, Copy, Users2, ShieldCheck,
  Crown, KeyRound, MoreHorizontal, Pencil, Power, Trash2, Download, X, ArrowUp, ArrowDown,
  ArrowUpDown, LayoutGrid, List,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PageHero } from "@/components/PageHero";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { confirmAction } from "@/lib/confirm";
import { cn } from "@/lib/utils";
import { initials, formatPhone, formatBRL } from "@/lib/format";
import { CredentialsManager } from "@/components/CredentialsManager";

type Role = "admin" | "admin_secondary" | "colaborador";
type CollabRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  active: boolean | null;
  has_system_access: boolean | null;
  internal_notes: string | null;
  created_at: string | null;
  role: Role;
};

type SortKey = "name" | "role" | "status" | "access" | "created";
type SortDir = "asc" | "desc";
type ViewMode = "list" | "grid";

const ROLE_META: Record<Role, { label: string; cls: string; icon: any }> = {
  admin: { label: "Admin", cls: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: Crown },
  admin_secondary: { label: "Admin Secundário", cls: "bg-sky-50 text-sky-700 border-sky-200", icon: ShieldCheck },
  colaborador: { label: "Colaborador", cls: "bg-slate-100 text-slate-700 border-slate-200", icon: UserCircle },
};
const ROLE_RANK: Record<Role, number> = { admin: 3, admin_secondary: 2, colaborador: 1 };

const norm = (s: any) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const onlyDigits = (s: any) => String(s ?? "").replace(/\D+/g, "");
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export default function Collaborators() {
  const qc = useQueryClient();
  const { user, isAdmin, isAdminSecondary } = useAuth();
  const canManage = isAdmin || isAdminSecondary;
  const myId = user?.id ?? null;

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [roleFilter, setRoleFilter] = useState<"todos" | Role>("todos");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativos" | "inativos">("todos");
  const [accessFilter, setAccessFilter] = useState<"todos" | "com" | "sem">("todos");
  const [view, setView] = useState<ViewMode>("list");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CollabRow | null>(null);
  const [credRow, setCredRow] = useState<CollabRow | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, roleFilter, statusFilter, accessFilter, sortKey, sortDir]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["collaborators-list"],
    queryFn: async (): Promise<CollabRow[]> => {
      const { data: ur, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "admin_secondary", "colaborador"]);
      if (error) throw error;
      const ids = (ur ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, active, has_system_access, internal_notes, created_at")
        .in("id", ids);
      const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return (ur ?? []).map((r: any) => {
        const p: any = byId.get(r.user_id) ?? {};
        return {
          id: r.user_id,
          full_name: p.full_name ?? null,
          email: p.email ?? null,
          phone: p.phone ?? null,
          active: p.active ?? true,
          has_system_access: p.has_system_access ?? true,
          internal_notes: p.internal_notes ?? null,
          created_at: p.created_at ?? null,
          role: r.role as Role,
        };
      });
    },
  });

  const { data: commissionTotals = {} } = useQuery({
    queryKey: ["collab-commission-totals"],
    queryFn: async (): Promise<Record<string, { total: number; pago: number; pendente: number }>> => {
      const { data } = await supabase
        .from("commission_splits")
        .select("beneficiary_id, amount, status")
        .eq("beneficiary_type", "collaborator");
      const map: Record<string, { total: number; pago: number; pendente: number }> = {};
      (data ?? []).forEach((s: any) => {
        const id = s.beneficiary_id;
        if (!id) return;
        if (!map[id]) map[id] = { total: 0, pago: 0, pendente: 0 };
        const amt = Number(s.amount || 0);
        map[id].total += amt;
        if (s.status === "pago") map[id].pago += amt;
        else map[id].pendente += amt;
      });
      return map;
    },
  });

  const filtered = useMemo(() => {
    const q = norm(debouncedSearch);
    const qD = onlyDigits(debouncedSearch);
    return rows.filter((r) => {
      if (roleFilter !== "todos" && r.role !== roleFilter) return false;
      if (statusFilter === "ativos" && !r.active) return false;
      if (statusFilter === "inativos" && r.active) return false;
      if (accessFilter === "com" && !r.has_system_access) return false;
      if (accessFilter === "sem" && r.has_system_access) return false;
      if (q) {
        const hay = `${norm(r.full_name)} ${norm(r.email)} ${norm(r.internal_notes)}`;
        if (hay.includes(q)) return true;
        if (qD && onlyDigits(r.phone).includes(qD)) return true;
        return false;
      }
      return true;
    });
  }, [rows, debouncedSearch, roleFilter, statusFilter, accessFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    const get = (r: CollabRow) => {
      switch (sortKey) {
        case "name": return norm(r.full_name || r.email);
        case "role": return ROLE_RANK[r.role];
        case "status": return r.active ? 1 : 0;
        case "access": return r.has_system_access ? 1 : 0;
        case "created": return r.created_at ? +new Date(r.created_at) : 0;
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
    const total = rows.length;
    const active = rows.filter((r) => r.active).length;
    const withAccess = rows.filter((r) => r.has_system_access).length;
    const admins = rows.filter((r) => r.role === "admin" || r.role === "admin_secondary").length;
    const totals = Object.values(commissionTotals as Record<string, { total: number; pago: number; pendente: number }>);
    const commTotal = totals.reduce((a, t) => a + t.total, 0);
    const commPago = totals.reduce((a, t) => a + t.pago, 0);
    const commPendente = totals.reduce((a, t) => a + t.pendente, 0);
    return { total, active, withAccess, admins, commTotal, commPago, commPendente };
  }, [rows, commissionTotals]);

  const adminCount = useMemo(
    () => rows.filter((r) => (r.role === "admin" || r.role === "admin_secondary") && r.active && r.has_system_access).length,
    [rows]
  );

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "name" ? "asc" : "desc"); }
  };

  const hasFilters = !!search || roleFilter !== "todos" || statusFilter !== "todos" || accessFilter !== "todos";
  const clearFilters = () => { setSearch(""); setRoleFilter("todos"); setStatusFilter("todos"); setAccessFilter("todos"); };

  const updateProfile = useMutation({
    mutationFn: async (payload: Partial<CollabRow> & { id: string; role?: Role }) => {
      const { id, role, ...rest } = payload;
      const { error } = await supabase.from("profiles").update(rest).eq("id", id);
      if (error) throw error;
      if (role) {
        const { error: rErr } = await supabase.from("user_roles").upsert({ user_id: id, role }, { onConflict: "user_id" });
        if (rErr) throw rErr;
      }
    },
    onSuccess: () => {
      toast.success("Colaborador atualizado");
      qc.invalidateQueries({ queryKey: ["collaborators-list"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });

  const toggleActive = async (r: CollabRow) => {
    if (!canManage) return;
    if (r.id === myId) { toast.error("Você não pode alterar seu próprio status"); return; }
    if (r.active && (r.role === "admin" || r.role === "admin_secondary") && adminCount <= 1) {
      toast.error("Não é possível desativar o último admin ativo");
      return;
    }
    if (r.active) {
      if (!(await confirmAction(`Desativar ${r.full_name ?? r.email}? O usuário não conseguirá mais acessar.`))) return;
    }
    const { error } = await supabase.from("profiles").update({ active: !r.active }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(r.active ? "Colaborador desativado" : "Colaborador ativado");
    qc.invalidateQueries({ queryKey: ["collaborators-list"] });
  };

  const toggleAccess = async (r: CollabRow) => {
    if (!canManage) return;
    if (r.id === myId) { toast.error("Você não pode alterar seu próprio acesso"); return; }
    if (r.has_system_access && (r.role === "admin" || r.role === "admin_secondary") && adminCount <= 1) {
      toast.error("Não é possível remover o acesso do último admin");
      return;
    }
    if (r.has_system_access) {
      if (!(await confirmAction(`Remover acesso ao sistema de ${r.full_name ?? r.email}?`))) return;
    }
    const { error } = await supabase.from("profiles").update({ has_system_access: !r.has_system_access }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(r.has_system_access ? "Acesso removido" : "Acesso habilitado");
    qc.invalidateQueries({ queryKey: ["collaborators-list"] });
  };

  const removeCollab = async (r: CollabRow) => {
    if (!canManage) return;
    if (r.id === myId) { toast.error("Você não pode remover sua própria conta"); return; }
    if ((r.role === "admin" || r.role === "admin_secondary") && adminCount <= 1) {
      toast.error("Não é possível remover o último admin");
      return;
    }
    if (!(await confirmAction(`Remover ${r.full_name ?? r.email} da equipe? Isso revoga o papel e o acesso.`))) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", r.id);
    if (error) return toast.error(error.message);
    await supabase.from("profiles").update({ active: false, has_system_access: false }).eq("id", r.id);
    toast.success("Colaborador removido da equipe");
    qc.invalidateQueries();
  };

  const exportCsv = () => {
    if (!canManage) return;
    const headers = ["Nome", "Email", "Telefone", "Função", "Status", "Acesso ao sistema", "Criado em"];
    const rows2 = sorted.map((r) => [
      r.full_name ?? "",
      r.email ?? "",
      r.phone ?? "",
      ROLE_META[r.role]?.label ?? r.role,
      r.active ? "Ativo" : "Inativo",
      r.has_system_access ? "Sim" : "Não",
      r.created_at ? new Date(r.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
    ]);
    const csv = [headers, ...rows2].map((line) =>
      line.map((c) => { const s = String(c ?? ""); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(";")
    ).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `colaboradores_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${sorted.length} colaborador(es) exportado(s)`);
  };

  return (
    <div className="page-shell space-y-6 animate-fade-up">
      <PageHero
        eyebrow="Equipe Interna"
        category="Acessos & Permissões"
        title="Colaboradores"
        description="Gerencie sua equipe, funções e quem pode acessar o sistema."
        icon={<Users2 className="size-6" />}
        actions={
          canManage && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={sorted.length === 0} className="h-9">
                <Download className="size-4 mr-1.5" /> Exportar
              </Button>
              <Button onClick={() => setCreateOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="size-4 mr-1.5" /> Novo colaborador
              </Button>
            </div>
          )
        }
        kpis={[
          { label: "Total", value: kpis.total, tone: "primary", icon: <Users2 className="size-4" /> },
          { label: "Ativos", value: kpis.active, tone: "success", icon: <UserCircle className="size-4" />, onClick: () => setStatusFilter(statusFilter === "ativos" ? "todos" : "ativos") },
          { label: "Com acesso", value: kpis.withAccess, tone: "info", icon: <KeyRound className="size-4" />, onClick: () => setAccessFilter(accessFilter === "com" ? "todos" : "com") },
          { label: "Admins", value: kpis.admins, tone: "violet", icon: <ShieldCheck className="size-4" />, onClick: () => setRoleFilter(roleFilter === "admin" ? "todos" : "admin") },
        ]}
      />

      <div className="px-5 lg:px-8 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por nome, e-mail, telefone ou observação..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-md bg-white border-slate-200/70"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
            <SelectTrigger className="h-10 w-[170px] rounded-md text-xs bg-white border-slate-200/70"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas funções</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="admin_secondary">Admin Secundário</SelectItem>
              <SelectItem value="colaborador">Colaborador</SelectItem>
            </SelectContent>
          </Select>
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
              <SelectItem value="com">Com acesso</SelectItem>
              <SelectItem value="sem">Sem acesso</SelectItem>
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
          {roleFilter !== "todos" && <FilterChip label={`Função: ${ROLE_META[roleFilter as Role]?.label}`} onClear={() => setRoleFilter("todos")} />}
          {statusFilter !== "todos" && <FilterChip label={`Status: ${statusFilter}`} onClear={() => setStatusFilter("todos")} />}
          {accessFilter !== "todos" && <FilterChip label={`Acesso: ${accessFilter === "com" ? "com" : "sem"}`} onClear={() => setAccessFilter("todos")} />}
          <button onClick={clearFilters} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 ml-1">Limpar tudo</button>
        </div>
      )}

      <div className="px-5 lg:px-8 pb-10">
        {isLoading ? (
          view === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-44 rounded-lg bg-white border border-slate-200/70 shadow-sm animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />)}
            </div>
          )
        ) : sorted.length === 0 ? (
          <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-16 text-center">
            <Users2 className="size-12 mx-auto text-slate-300 mb-4" />
            <p className="font-display text-lg text-slate-700">
              {hasFilters ? "Nenhum colaborador bate com os filtros" : "Nenhum colaborador cadastrado"}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {hasFilters ? "Ajuste ou limpe os filtros para ver outros resultados." : "Cadastre sua equipe interna e defina permissões."}
            </p>
            {hasFilters ? (
              <Button variant="outline" onClick={clearFilters} className="mt-5">Limpar filtros</Button>
            ) : canManage && (
              <Button onClick={() => setCreateOpen(true)} className="mt-5 bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="size-4 mr-1.5" /> Cadastrar primeiro colaborador
              </Button>
            )}
          </div>
        ) : view === "grid" ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {paginated.map((c) => (
                <CollabCard
                  key={c.id}
                  c={c}
                  canManage={canManage}
                  isMe={c.id === myId}
                  onEdit={() => setEditing(c)}
                  onToggleActive={() => toggleActive(c)}
                  onToggleAccess={() => toggleAccess(c)}
                  onRemove={() => removeCollab(c)}
                  onCredentials={() => setCredRow(c)}
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
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/70 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                    <SortableTh label="Colaborador" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-5 py-3 text-left">Contato</th>
                    <SortableTh label="Função" k="role" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                    <SortableTh label="Acesso" k="access" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
                    <SortableTh label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
                    <SortableTh label="Criado" k="created" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                    <th className="px-5 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {paginated.map((c) => {
                    const meta = ROLE_META[c.role];
                    const Icon = meta.icon;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="size-9 rounded-md bg-indigo-50 text-indigo-700 border border-slate-200/70 flex items-center justify-center font-semibold text-xs">
                              {initials(c.full_name ?? c.email ?? "?")}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate flex items-center gap-1.5">
                                {c.full_name ?? "—"}
                                {c.id === myId && <Badge className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200">você</Badge>}
                              </p>
                              {c.internal_notes && <p className="text-[11px] text-slate-500 truncate max-w-[260px]">{c.internal_notes}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-600">
                          <div className="truncate max-w-[220px] flex items-center gap-1.5"><Mail className="size-3 text-slate-400" />{c.email ?? "—"}</div>
                          {c.phone && <div className="flex items-center gap-1.5 mt-0.5 font-mono"><Phone className="size-3 text-slate-400" />{formatPhone(c.phone)}</div>}
                        </td>
                        <td className="px-5 py-3">
                          <Badge className={cn("text-[10px] border inline-flex items-center gap-1", meta.cls)}>
                            <Icon className="size-3" /> {meta.label}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-center">
                          {c.has_system_access ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><Shield className="size-3" /> Habilitado</span>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-semibold">Bloqueado</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center">
                          <Badge className={cn("text-[10px] border", c.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200")}>
                            {c.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right text-xs font-mono text-slate-500">
                          {c.created_at ? new Date(c.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {canManage ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="size-8"><MoreHorizontal className="size-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditing(c)}><Pencil className="size-4 mr-2" /> Editar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toggleAccess(c)} disabled={c.id === myId}>
                                  <KeyRound className="size-4 mr-2" /> {c.has_system_access ? "Remover acesso" : "Liberar acesso"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setCredRow(c)}>
                                  <KeyRound className="size-4 mr-2" /> Alterar e-mail/senha
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toggleActive(c)} disabled={c.id === myId}>
                                  <Power className="size-4 mr-2" /> {c.active ? "Desativar" : "Ativar"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => removeCollab(c)} disabled={c.id === myId} className="text-destructive focus:text-destructive">
                                  <Trash2 className="size-4 mr-2" /> Remover da equipe
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
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

      <CreateCollaboratorDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["collaborators-list"] })}
      />

      {editing && (
        <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
          <DialogContent className="max-w-lg bg-white">
            <DialogHeader>
              <DialogTitle className="font-display text-xl text-slate-900">Editar colaborador</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={editing.full_name ?? ""} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <MaskedInput mask="phone" value={editing.phone ?? ""} onChange={(v) => setEditing({ ...editing, phone: v })} placeholder="(00) 00000-0000" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input value={editing.email ?? ""} disabled />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Função</Label>
                  <Select
                    value={editing.role}
                    onValueChange={(v) => setEditing({ ...editing, role: v as Role })}
                    disabled={editing.id === myId}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="colaborador">Colaborador</SelectItem>
                      <SelectItem value="admin_secondary">Admin Secundário</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  {editing.id === myId && <p className="text-[11px] text-slate-500">Você não pode alterar sua própria função.</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={editing.active ? "1" : "0"}
                    onValueChange={(v) => setEditing({ ...editing, active: v === "1" })}
                    disabled={editing.id === myId}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Ativo</SelectItem>
                      <SelectItem value="0">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50/60">
                <div>
                  <Label>Acesso ao sistema</Label>
                  <p className="text-xs text-slate-500">Permite login na plataforma.</p>
                </div>
                <Switch
                  checked={!!editing.has_system_access}
                  onCheckedChange={(v) => setEditing({ ...editing, has_system_access: v })}
                  disabled={editing.id === myId}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Observações internas</Label>
                <Textarea rows={3} value={editing.internal_notes ?? ""} onChange={(e) => setEditing({ ...editing, internal_notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button
                disabled={updateProfile.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => {
                  const name = String(editing.full_name ?? "").trim();
                  if (!name) { toast.error("Nome obrigatório"); return; }
                  if (editing.id !== myId
                    && (editing.role === "colaborador")
                    && (rows.find((r) => r.id === editing.id)?.role === "admin" || rows.find((r) => r.id === editing.id)?.role === "admin_secondary")
                    && adminCount <= 1) {
                    toast.error("Não é possível rebaixar o último admin");
                    return;
                  }
                  updateProfile.mutate({
                    id: editing.id,
                    full_name: name,
                    phone: editing.phone ? onlyDigits(editing.phone) : null,
                    active: editing.active,
                    has_system_access: editing.has_system_access,
                    internal_notes: editing.internal_notes,
                    role: editing.id === myId ? undefined : editing.role,
                  });
                }}
              >
                {updateProfile.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={!!credRow} onOpenChange={(v) => !v && setCredRow(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Acesso de {credRow?.full_name ?? credRow?.email}</DialogTitle>
          </DialogHeader>
          {credRow && (
            <CredentialsManager
              userId={credRow.id}
              currentEmail={credRow.email}
              entityLabel="colaborador"
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

function CollabCard({ c, canManage, isMe, onEdit, onToggleActive, onToggleAccess, onRemove, onCredentials }: {
  c: CollabRow; canManage: boolean; isMe: boolean;
  onEdit: () => void; onToggleActive: () => void; onToggleAccess: () => void; onRemove: () => void;
  onCredentials: () => void;
}) {
  const meta = ROLE_META[c.role];
  const Icon = meta.icon;
  return (
    <div className="group relative overflow-hidden rounded-lg border border-slate-200/70 bg-white shadow-sm p-5 hover:border-indigo-200 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-11 rounded-md bg-indigo-50 text-indigo-700 border border-slate-200/70 flex items-center justify-center font-semibold shrink-0">
            {initials(c.full_name ?? c.email ?? "?")}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate flex items-center gap-1.5">
              {c.full_name ?? "—"}
              {isMe && <Badge className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200">você</Badge>}
            </p>
            <Badge className={cn("mt-1 text-[10px] border inline-flex items-center gap-1", meta.cls)}>
              <Icon className="size-3" /> {meta.label}
            </Badge>
          </div>
        </div>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="size-8"><MoreHorizontal className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}><Pencil className="size-4 mr-2" /> Editar</DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleAccess} disabled={isMe}><KeyRound className="size-4 mr-2" /> {c.has_system_access ? "Remover acesso" : "Liberar acesso"}</DropdownMenuItem>
              <DropdownMenuItem onClick={onCredentials}><KeyRound className="size-4 mr-2" /> Alterar e-mail/senha</DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleActive} disabled={isMe}><Power className="size-4 mr-2" /> {c.active ? "Desativar" : "Ativar"}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onRemove} disabled={isMe} className="text-destructive focus:text-destructive">
                <Trash2 className="size-4 mr-2" /> Remover
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <div className="space-y-1 text-xs text-slate-600 mb-4">
        {c.email && <div className="flex items-center gap-1.5 truncate"><Mail className="size-3 text-slate-400" /> {c.email}</div>}
        {c.phone && <div className="flex items-center gap-1.5 font-mono"><Phone className="size-3 text-slate-400" /> {formatPhone(c.phone)}</div>}
      </div>
      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-[11px]">
        <div>
          <p className="uppercase tracking-wider font-semibold text-slate-500">Status</p>
          <p className={cn("font-semibold", c.active ? "text-emerald-700" : "text-slate-500")}>{c.active ? "Ativo" : "Inativo"}</p>
        </div>
        <div>
          <p className="uppercase tracking-wider font-semibold text-slate-500">Acesso</p>
          <p className={cn("font-semibold", c.has_system_access ? "text-emerald-700" : "text-slate-500")}>{c.has_system_access ? "Habilitado" : "Bloqueado"}</p>
        </div>
      </div>
    </div>
  );
}

function generateStrongPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pw = pick(upper) + pick(lower) + pick(digits) + pick(symbols);
  for (let i = 0; i < 8; i++) pw += pick(all);
  return pw.split("").sort(() => Math.random() - 0.5).join("");
}

function CreateCollaboratorDialog({
  open, onOpenChange, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void; }) {
  const initialForm = {
    // Identificação
    full_name: "",
    document_number: "",
    email: "",
    phone: "",
    // Cargo
    position: "",
    department: "",
    admission_date: "",
    // Endereço
    address_zip: "",
    address_street: "",
    address_number: "",
    address_complement: "",
    address_neighborhood: "",
    address_city: "",
    address_state: "",
    // Observações
    internal_notes: "",
    // Acesso
    role: "colaborador" as Role,
    has_system_access: true,
    password: "",
    password_confirm: "",
  };
  const [form, setForm] = useState(initialForm);
  const [tab, setTab] = useState<"dados" | "acesso">("dados");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string | null } | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const { lookup } = useCepLookup();

  const reset = () => { setForm(initialForm); setTab("dados"); setCreated(null); };

  // Regras de senha em tempo real
  const pw = form.password;
  const pwRules = {
    len: pw.length >= 8,
    letter: /[A-Za-z]/.test(pw),
    digit: /\d/.test(pw),
    match: pw.length > 0 && pw === form.password_confirm,
  };
  const passwordValid = pwRules.len && pwRules.letter && pwRules.digit && pwRules.match;

  const handleCepBlur = async () => {
    const digits = onlyDigits(form.address_zip);
    if (digits.length !== 8) return;
    setCepLoading(true);
    const data = await lookup(digits);
    setCepLoading(false);
    if (data) {
      setForm((f) => ({
        ...f,
        address_street: f.address_street || data.street,
        address_neighborhood: f.address_neighborhood || data.neighborhood,
        address_city: f.address_city || data.city,
        address_state: f.address_state || data.state,
      }));
    }
  };

  const submit = async () => {
    const name = form.full_name.trim();
    const email = form.email.trim();
    if (!name) { toast.error("Nome obrigatório"); setTab("dados"); return; }
    if (!email || !isEmail(email)) { toast.error("E-mail inválido"); setTab("dados"); return; }
    if (form.has_system_access) {
      if (!passwordValid) {
        toast.error("Defina uma senha válida (8+ caracteres, com letra e número, e confirme)");
        setTab("acesso");
        return;
      }
    }
    setLoading(true);
    try {
      const passwordToSend = form.has_system_access ? form.password : undefined;
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email,
          full_name: name,
          phone: form.phone ? onlyDigits(form.phone) : undefined,
          role: form.role,
          has_system_access: form.has_system_access,
          internal_notes: form.internal_notes || undefined,
          send_invite: false,
          password: passwordToSend,
          document_number: form.document_number ? onlyDigits(form.document_number) : undefined,
          address_zip: form.address_zip ? onlyDigits(form.address_zip) : undefined,
          address_zip_code: form.address_zip ? onlyDigits(form.address_zip) : undefined,
          address_street: form.address_street || undefined,
          address_number: form.address_number || undefined,
          address_complement: form.address_complement || undefined,
          address_neighborhood: form.address_neighborhood || undefined,
          address_city: form.address_city || undefined,
          address_state: form.address_state || undefined,
          position: form.position || undefined,
          department: form.department || undefined,
          admission_date: form.admission_date || undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Colaborador criado");
      onCreated();
      if (form.has_system_access) {
        setCreated({ email, password: form.password });
      } else {
        onOpenChange(false); reset();
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar colaborador");
    } finally {
      setLoading(false);
    }
  };

  const Rule = ({ ok, text }: { ok: boolean; text: string }) => (
    <li className={cn("flex items-center gap-1.5 text-xs", ok ? "text-emerald-600" : "text-slate-400")}>
      <span className={cn("inline-block size-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-slate-300")} />
      {text}
    </li>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-slate-900">Cadastrar colaborador</DialogTitle>
        </DialogHeader>

        {created ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50">
              <p className="text-sm font-bold text-emerald-800 mb-1">Colaborador criado com sucesso</p>
              <p className="text-xs text-emerald-700 mb-3">
                Compartilhe as credenciais abaixo com o colaborador. Ele poderá trocar a senha após o primeiro login.
              </p>
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700/70 mb-1">E-mail</p>
                  <code className="block bg-white border border-emerald-200 rounded px-3 py-2 font-mono text-sm">{created.email}</code>
                </div>
                {created.password && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700/70 mb-1">Senha</p>
                    <code className="block bg-white border border-emerald-200 rounded px-3 py-2 font-mono text-sm">{created.password}</code>
                  </div>
                )}
              </div>
              {created.password && (
                <Button
                  size="sm" variant="outline" className="mt-3 w-full"
                  onClick={() => {
                    navigator.clipboard.writeText(`E-mail: ${created.email}\nSenha: ${created.password}`);
                    toast.success("Credenciais copiadas");
                  }}
                >
                  <Copy className="size-3.5 mr-1.5" /> Copiar credenciais
                </Button>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={reset} className="sm:mr-auto">Cadastrar outro</Button>
              <Button onClick={() => { onOpenChange(false); reset(); }} className="bg-indigo-600 hover:bg-indigo-700 text-white">Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="flex gap-1 border-b border-slate-200 -mx-6 px-6">
              <button
                type="button"
                onClick={() => setTab("dados")}
                className={cn("px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                  tab === "dados" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700")}
              >
                1. Dados do colaborador
              </button>
              <button
                type="button"
                onClick={() => setTab("acesso")}
                className={cn("px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                  tab === "acesso" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700")}
              >
                2. Acesso ao sistema
              </button>
            </div>

            {tab === "dados" && (
              <div className="space-y-4 py-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Identificação</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Nome completo *</Label>
                      <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Ex: Ana Maria Silva" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>CPF</Label>
                      <MaskedInput mask="cpf" value={form.document_number} onChange={(v) => setForm({ ...form, document_number: v })} placeholder="000.000.000-00" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>E-mail *</Label>
                      <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ana@empresa.com" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Telefone</Label>
                      <MaskedInput mask="phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="(00) 00000-0000" />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Cargo e setor</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Cargo</Label>
                      <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Analista de operações" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Setor / Departamento</Label>
                      <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Comercial" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Data de admissão</Label>
                      <Input type="date" value={form.admission_date} onChange={(e) => setForm({ ...form, admission_date: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Endereço</p>
                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>CEP {cepLoading && <Loader2 className="inline size-3 animate-spin ml-1" />}</Label>
                      <MaskedInput mask="cep" value={form.address_zip} onChange={(v) => setForm({ ...form, address_zip: v })} onBlur={handleCepBlur} placeholder="00000-000" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-4">
                      <Label>Rua</Label>
                      <Input value={form.address_street} onChange={(e) => setForm({ ...form, address_street: e.target.value })} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-1">
                      <Label>Número</Label>
                      <Input value={form.address_number} onChange={(e) => setForm({ ...form, address_number: e.target.value })} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Complemento</Label>
                      <Input value={form.address_complement} onChange={(e) => setForm({ ...form, address_complement: e.target.value })} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-3">
                      <Label>Bairro</Label>
                      <Input value={form.address_neighborhood} onChange={(e) => setForm({ ...form, address_neighborhood: e.target.value })} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-4">
                      <Label>Cidade</Label>
                      <Input value={form.address_city} onChange={(e) => setForm({ ...form, address_city: e.target.value })} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>UF</Label>
                      <Input maxLength={2} value={form.address_state} onChange={(e) => setForm({ ...form, address_state: e.target.value.toUpperCase() })} />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Observações internas</Label>
                  <Textarea value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} placeholder="Ex: Turno manhã, responsável pelo cliente X..." />
                </div>
              </div>
            )}

            {tab === "acesso" && (
              <div className="space-y-4 py-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Função no sistema</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {([
                      { v: "colaborador", t: "Colaborador", d: "Acesso ao painel /colaborador" },
                      { v: "admin_secondary", t: "Admin Secundário", d: "Acesso ao admin sem gerir admins" },
                      { v: "admin", t: "Admin", d: "Controle total da plataforma" },
                    ] as const).map((r) => (
                      <button
                        key={r.v}
                        type="button"
                        onClick={() => setForm({ ...form, role: r.v })}
                        className={cn("text-left p-3 border rounded-lg transition-all",
                          form.role === r.v ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-200" : "border-slate-200 hover:border-slate-300 bg-white")}
                      >
                        <p className="text-sm font-bold text-slate-900">{r.t}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{r.d}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50/60">
                  <div>
                    <Label>Permitir login no sistema</Label>
                    <p className="text-xs text-slate-500">Se desligado, o colaborador fica apenas como cadastro interno (sem acesso).</p>
                  </div>
                  <Switch checked={form.has_system_access} onCheckedChange={(v) => setForm({ ...form, has_system_access: v })} />
                </div>

                {form.has_system_access && (
                  <div className="space-y-3 p-3 border border-indigo-200 bg-indigo-50/40 rounded-lg">
                    <div className="flex items-center justify-between">
                      <Label className="text-slate-900">Senha de primeiro acesso *</Label>
                      <Button
                        type="button" size="sm" variant="outline"
                        onClick={() => {
                          const p = generateStrongPassword();
                          setForm((f) => ({ ...f, password: p, password_confirm: p }));
                        }}
                      >
                        <KeyRound className="size-3.5 mr-1.5" /> Gerar senha forte
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Senha</Label>
                        <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 8 caracteres" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Confirmar senha</Label>
                        <Input type="text" value={form.password_confirm} onChange={(e) => setForm({ ...form, password_confirm: e.target.value })} placeholder="Repita a senha" />
                      </div>
                    </div>
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <Rule ok={pwRules.len} text="Pelo menos 8 caracteres" />
                      <Rule ok={pwRules.letter} text="Contém letra" />
                      <Rule ok={pwRules.digit} text="Contém número" />
                      <Rule ok={pwRules.match} text="Senhas coincidem" />
                    </ul>
                    <p className="text-[11px] text-slate-600">
                      Esta será a senha de primeiro acesso. O colaborador poderá trocá-la em <strong>Perfil &gt; Segurança</strong> após logar.
                    </p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="flex-row gap-2 justify-between sm:justify-between">
              <div className="flex gap-2">
                {tab === "acesso" && (
                  <Button variant="outline" onClick={() => setTab("dados")}>Voltar</Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                {tab === "dados" ? (
                  <Button onClick={() => setTab("acesso")} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    Próximo: acesso →
                  </Button>
                ) : (
                  <Button disabled={loading} onClick={submit} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {loading && <Loader2 className="size-4 animate-spin mr-2" />}
                    Cadastrar colaborador
                  </Button>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

