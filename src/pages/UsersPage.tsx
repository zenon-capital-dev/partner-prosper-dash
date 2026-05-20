import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { onlyDigits } from "@/lib/masks";
import { isValidCPFOrCNPJ, isValidPhoneBR, lookupCEP } from "@/lib/validators";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserPlus, Search, Mail, Copy, Shield, MoreHorizontal, UserCheck, UserX,
  Lock, Key, ArrowUp, ArrowDown, ArrowUpDown, Eye, Trash2, X, RefreshCcw,
  Users, ShieldCheck, KeyRound, CircleSlash, Wand2,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/use-debounce";
import { confirmAction } from "@/lib/confirm";
import { PaginationControl } from "@/components/ui/PaginationControl";

type Role =
  | "admin" | "admin_secondary" | "colaborador" | "vendedor"
  | "parceiro" | "prestador" | "indicador" | "cliente" | "lead";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "admin", label: "Admin Principal" },
  { value: "admin_secondary", label: "Admin Secundário" },
  { value: "colaborador", label: "Colaborador" },
  { value: "vendedor", label: "Vendedor" },
  { value: "parceiro", label: "Parceiro" },
  { value: "prestador", label: "Prestador" },
  { value: "indicador", label: "Indicador" },
  { value: "cliente", label: "Cliente" },
  { value: "lead", label: "Lead / Convidado" },
];

const roleLabel: Record<string, string> = Object.fromEntries(ROLE_OPTIONS.map(r => [r.value, r.label]));

const roleClass: Record<string, string> = {
  admin: "bg-indigo-600 text-white border-indigo-600",
  admin_secondary: "bg-indigo-50 text-indigo-700 border-indigo-200",
  colaborador: "bg-blue-50 text-blue-700 border-blue-200",
  vendedor: "bg-cyan-50 text-cyan-700 border-cyan-200",
  parceiro: "bg-amber-50 text-amber-700 border-amber-200",
  prestador: "bg-emerald-50 text-emerald-700 border-emerald-200",
  indicador: "bg-pink-50 text-pink-700 border-pink-200",
  cliente: "bg-slate-100 text-slate-700 border-slate-200",
  lead: "bg-purple-50 text-purple-700 border-purple-200",
};

const PRIORITY: Role[] = ["admin","admin_secondary","colaborador","vendedor","parceiro","prestador","indicador","cliente","lead"];

const norm = (s: any) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const formatDate = (d?: string | null) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
};
const relativeLastSeen = (d?: string | null) => {
  if (!d) return "Nunca";
  const diffMs = Date.now() - new Date(d).getTime();
  const day = 86400000;
  if (diffMs < day) return "Hoje";
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d atrás`;
  if (diffMs < 30 * day) return `${Math.floor(diffMs / (7 * day))}sem atrás`;
  if (diffMs < 365 * day) return `${Math.floor(diffMs / (30 * day))}m atrás`;
  return `${Math.floor(diffMs / (365 * day))}a atrás`;
};

const generatePassword = () => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const num = "23456789";
  const sym = "!@#$%&*";
  const all = upper + lower + num + sym;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pwd = pick(upper) + pick(lower) + pick(num) + pick(sym);
  for (let i = 0; i < 8; i++) pwd += pick(all);
  return pwd.split("").sort(() => Math.random() - 0.5).join("");
};

type SortKey = "name" | "email" | "last_sign_in_at" | "created_at";
type SortDir = "asc" | "desc";

function SortableTh({ label, k, sort, onSort }: { label: string; k: SortKey; sort: {k: SortKey; d: SortDir}; onSort: (k: SortKey) => void }) {
  const active = sort.k === k;
  return (
    <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-500 select-none">
      <button onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 hover:text-slate-700", active && "text-indigo-700")}>
        {label}
        {active ? (sort.d === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
      </button>
    </th>
  );
}

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  document_number: string | null;
  active: boolean;
  has_system_access: boolean;
  internal_notes: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  manual_approval_required: boolean | null;
  onboarding_completed: boolean | null;
  onboarding_step: number | null;
  avatar_url: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip_code: string | null;
  roles: Role[];
  links: {
    clients: { id: string; name: string }[];
    partners: { id: string; name: string }[];
    providers: { id: string; name: string }[];
    referrers: { id: string; name: string }[];
  };
}

export default function UsersPage() {
  const qc = useQueryClient();
  const { isAdmin, isAdminSecondary, user: currentUser } = useAuth();
  const canManage = isAdmin || isAdminSecondary;

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [roleFilter, setRoleFilter] = useState<Role | "all" | "none">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "with_access" | "no_access">("all");
  const [sort, setSort] = useState<{k: SortKey; d: SortDir}>({ k: "created_at", d: "desc" });
  const [page, setPage] = useState(1);
  const perPage = 20;

  const [openCreate, setOpenCreate] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password?: string } | null>(null);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [pwdDialogUser, setPwdDialogUser] = useState<UserRow | null>(null);

  const { data: users = [], isLoading, refetch } = useQuery<UserRow[]>({
    queryKey: ["users-detailed"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("invite-user", { body: { action: "list" } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as any).users ?? [];
    },
  });

  const toggleSort = (k: SortKey) => setSort((s) => ({ k, d: s.k === k && s.d === "desc" ? "asc" : "desc" }));

  useEffect(() => { setPage(1); }, [debouncedSearch, roleFilter, statusFilter]);

  const filtered = useMemo(() => {
    const q = norm(debouncedSearch);
    let arr = users.filter((u) => {
      if (q) {
        const hay = norm(`${u.full_name ?? ""} ${u.email ?? ""} ${u.phone ?? ""} ${u.document_number ?? ""}`);
        if (!hay.includes(q)) return false;
      }
      if (roleFilter === "none") { if (u.roles.length > 0) return false; }
      else if (roleFilter !== "all") { if (!u.roles.includes(roleFilter as Role)) return false; }
      if (statusFilter === "active" && !u.active) return false;
      if (statusFilter === "inactive" && u.active) return false;
      if (statusFilter === "with_access" && !u.has_system_access) return false;
      if (statusFilter === "no_access" && u.has_system_access) return false;
      return true;
    });
    arr = [...arr].sort((a, b) => {
      const dir = sort.d === "asc" ? 1 : -1;
      const va: any = sort.k === "name" ? norm(a.full_name)
        : sort.k === "email" ? norm(a.email)
        : a[sort.k] ?? "";
      const vb: any = sort.k === "name" ? norm(b.full_name)
        : sort.k === "email" ? norm(b.email)
        : b[sort.k] ?? "";
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return arr;
  }, [users, debouncedSearch, roleFilter, statusFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = useMemo(() => filtered.slice((page - 1) * perPage, page * perPage), [filtered, page]);

  const detailUser = useMemo(() => users.find((u) => u.id === detailUserId) ?? null, [users, detailUserId]);

  const kpis = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.active).length;
    const withAccess = users.filter((u) => u.has_system_access).length;
    const admins = users.filter((u) => u.roles.includes("admin") || u.roles.includes("admin_secondary")).length;
    const noRole = users.filter((u) => u.roles.length === 0).length;
    return { total, active, withAccess, admins, noRole };
  }, [users]);

  // ---------- Mutations ----------
  const setRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Role | "none" }) => {
      const roles = role === "none" ? [] : [role];
      const { data, error } = await supabase.functions.invoke("invite-user", { body: { action: "update_profile", user_id: userId, roles } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => { toast.success("Papel atualizado"); qc.invalidateQueries({ queryKey: ["users-detailed"] }); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ userId, profile, roles }: { userId: string; profile?: any; roles?: Role[] }) => {
      const { data, error } = await supabase.functions.invoke("invite-user", { body: { action: "update_profile", user_id: userId, profile, roles } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => { toast.success("Usuário atualizado"); qc.invalidateQueries({ queryKey: ["users-detailed"] }); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const setPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const { data, error } = await supabase.functions.invoke("invite-user", { body: { action: "set_password", user_id: userId, password } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => toast.success("Senha alterada com sucesso"),
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("invite-user", { body: { action: "delete", user_id: userId } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => { toast.success("Usuário excluído"); qc.invalidateQueries({ queryKey: ["users-detailed"] }); setDetailUserId(null); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const toggleStatus = async (u: UserRow, field: "active" | "has_system_access") => {
    const turning = field === "active" ? (u.active ? "desativar" : "ativar") : (u.has_system_access ? "bloquear o login de" : "liberar o login de");
    const ok = await confirmAction({
      title: `Confirmar ação`,
      description: `Deseja realmente ${turning} ${u.full_name ?? u.email}?`,
      confirmText: "Confirmar",
    });
    if (!ok) return;
    const next = field === "active" ? { active: !u.active } : { has_system_access: !u.has_system_access };
    updateProfileMutation.mutate({ userId: u.id, profile: next });
  };

  const askDelete = async (u: UserRow) => {
    if (u.id === currentUser?.id) return toast.error("Você não pode excluir sua própria conta");
    const ok = await confirmAction({
      title: "Excluir usuário permanentemente",
      description: `Esta ação não pode ser desfeita. Todos os vínculos com ${u.full_name ?? u.email} serão removidos.`,
      confirmText: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    deleteMutation.mutate(u.id);
  };

  if (!canManage) {
    return <div className="p-12 text-center text-slate-500">Apenas administradores acessam esta página.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <PageHero
          eyebrow="Acessos"
          title="Usuários"
          description="Crie logins, defina senhas, atribua papéis e edite todos os detalhes dos usuários."
          icon={<Users className="size-5" />}
          actions={
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2"><RefreshCcw className="size-4" /> Atualizar</Button>
              <Button onClick={() => setOpenCreate(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700"><UserPlus className="size-4" /> Novo usuário</Button>
            </div>
          }
          kpis={[
            { label: "Total", value: kpis.total, tone: "primary", icon: <Users className="size-4" />, onClick: () => { setRoleFilter("all"); setStatusFilter("all"); } },
            { label: "Ativos", value: kpis.active, tone: "success", icon: <UserCheck className="size-4" />, onClick: () => setStatusFilter("active") },
            { label: "Com acesso", value: kpis.withAccess, tone: "info", icon: <KeyRound className="size-4" />, onClick: () => setStatusFilter("with_access") },
            { label: "Admins", value: kpis.admins, tone: "violet", icon: <ShieldCheck className="size-4" />, onClick: () => setRoleFilter("admin") },
            { label: "Sem papel", value: kpis.noRole, tone: "warning", icon: <CircleSlash className="size-4" />, onClick: () => setRoleFilter("none") },
          ]}
        />

        {/* Toolbar */}
        <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input placeholder="Buscar por nome, email, telefone, documento..." className="pl-9 h-9 bg-white border-slate-200" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
            <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Papel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os papéis</SelectItem>
              <SelectItem value="none">Sem papel</SelectItem>
              {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
              <SelectItem value="with_access">Com acesso</SelectItem>
              <SelectItem value="no_access">Sem acesso</SelectItem>
            </SelectContent>
          </Select>
          {(search || roleFilter !== "all" || statusFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setRoleFilter("all"); setStatusFilter("all"); }} className="gap-1 text-slate-500">
              <X className="size-4" /> Limpar
            </Button>
          )}
          <div className="ml-auto text-xs text-slate-500 font-mono">{filtered.length} resultado(s)</div>
        </div>

        {/* Active filter chips */}
        {(roleFilter !== "all" || statusFilter !== "all" || debouncedSearch) && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {debouncedSearch && (
              <Badge variant="outline" className="gap-1 pl-2 bg-white border-slate-200">
                Busca: "{debouncedSearch}"
                <button onClick={() => setSearch("")} className="ml-1 hover:text-red-600"><X className="size-3" /></button>
              </Badge>
            )}
            {roleFilter !== "all" && (
              <Badge variant="outline" className="gap-1 pl-2 bg-white border-slate-200">
                Papel: {roleFilter === "none" ? "Sem papel" : roleLabel[roleFilter]}
                <button onClick={() => setRoleFilter("all")} className="ml-1 hover:text-red-600"><X className="size-3" /></button>
              </Badge>
            )}
            {statusFilter !== "all" && (
              <Badge variant="outline" className="gap-1 pl-2 bg-white border-slate-200">
                Status: {statusFilter}
                <button onClick={() => setStatusFilter("all")} className="ml-1 hover:text-red-600"><X className="size-3" /></button>
              </Badge>
            )}
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/70 border-b border-slate-200/70">
                <tr>
                  <SortableTh label="Usuário" k="name" sort={sort} onSort={toggleSort} />
                  <SortableTh label="Email" k="email" sort={sort} onSort={toggleSort} />
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-500">Telefone</th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-500">Papéis</th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-500">Vínculo</th>
                  <SortableTh label="Último acesso" k="last_sign_in_at" sort={sort} onSort={toggleSort} />
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wider font-semibold text-slate-500">Status</th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wider font-semibold text-slate-500">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && Array.from({ length: 6 }).map((_, i) => (
                  <tr key={`sk-${i}`}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-10 w-full" /></td></tr>
                ))}
                {!isLoading && paged.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-16 text-center text-sm text-slate-500">Nenhum usuário encontrado com os filtros atuais.</td></tr>
                )}
                {!isLoading && paged.map((u) => {
                  const primary = PRIORITY.find((r) => u.roles.includes(r)) ?? ("none" as any);
                  const link =
                    u.links.clients[0] ? { label: `Cliente: ${u.links.clients[0].name}`, cls: "bg-slate-50 text-slate-700" }
                    : u.links.partners[0] ? { label: `Parceiro: ${u.links.partners[0].name}`, cls: "bg-amber-50 text-amber-700" }
                    : u.links.providers[0] ? { label: `Prestador: ${u.links.providers[0].name}`, cls: "bg-emerald-50 text-emerald-700" }
                    : u.links.referrers[0] ? { label: `Indicador: ${u.links.referrers[0].name}`, cls: "bg-pink-50 text-pink-700" }
                    : null;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60 transition-colors cursor-pointer" onClick={() => setDetailUserId(u.id)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="size-8 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-xs font-bold">{initials(u.full_name)}</div>
                          <div>
                            <p className="font-medium text-slate-800">{u.full_name ?? "—"}</p>
                            {u.internal_notes && <p className="text-[10px] text-slate-400">Possui nota interna</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs font-mono">{u.email}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{u.phone ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length === 0 ? (
                            <Badge variant="outline" className="text-[10px] border-slate-200 text-slate-500">Sem papel</Badge>
                          ) : u.roles.map((r) => (
                            <Badge key={r} variant="outline" className={cn("text-[10px]", roleClass[r])}>{roleLabel[r]}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {link ? <Badge variant="outline" className={cn("text-[10px]", link.cls)}>{link.label}</Badge> : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-600" title={formatDate(u.last_sign_in_at)}>{relativeLastSeen(u.last_sign_in_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className={cn("text-[10px] w-fit", u.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200")}>
                            {u.active ? "Ativo" : "Inativo"}
                          </Badge>
                          <Badge variant="outline" className={cn("text-[10px] w-fit", u.has_system_access ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-100 text-slate-500 border-slate-200")}>
                            {u.has_system_access ? "Com acesso" : "Sem acesso"}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-2">
                          <Select value={primary} onValueChange={(v) => setRoleMutation.mutate({ userId: u.id, role: v as any })}>
                            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem papel</SelectItem>
                              {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="size-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem onClick={() => setDetailUserId(u.id)}><Eye className="size-4 mr-2" /> Ver detalhes</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPwdDialogUser(u)}><Key className="size-4 mr-2" /> Definir senha</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(u.email ?? ""); toast.success("Email copiado"); }}>
                                <Copy className="size-4 mr-2" /> Copiar email
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => toggleStatus(u, "active")}>
                                {u.active ? <><UserX className="size-4 mr-2" /> Desativar</> : <><UserCheck className="size-4 mr-2" /> Ativar</>}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleStatus(u, "has_system_access")}>
                                {u.has_system_access ? <><Lock className="size-4 mr-2" /> Bloquear login</> : <><KeyRound className="size-4 mr-2" /> Liberar login</>}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-rose-600 focus:text-rose-700" onClick={() => askDelete(u)}>
                                <Trash2 className="size-4 mr-2" /> Excluir usuário
                              </DropdownMenuItem>
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
          {totalPages > 1 && (
            <div className="border-t border-slate-200/70 px-4 py-3">
              <PaginationControl currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      </div>

      {/* Create dialog */}
      <CreateUserDialog
        open={openCreate}
        onOpenChange={setOpenCreate}
        onCreated={(info) => { setCreatedInfo(info); qc.invalidateQueries({ queryKey: ["users-detailed"] }); }}
        canPromoteAdmin={isAdmin}
      />

      {/* Created info dialog */}
      <Dialog open={!!createdInfo} onOpenChange={() => setCreatedInfo(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Usuário criado</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p><span className="text-slate-500">Email:</span> <strong className="font-mono">{createdInfo?.email}</strong></p>
            {createdInfo?.password ? (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold">Senha gerada</p>
                  <p className="font-mono text-amber-900">{createdInfo.password}</p>
                  <p className="text-[11px] text-amber-700 mt-1">Copie e envie ao usuário. Não será mostrada novamente.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(createdInfo.password!); toast.success("Copiado"); }}>
                  <Copy className="size-4" />
                </Button>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Email de convite enviado.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Set password dialog (inline) */}
      <SetPasswordDialog
        user={pwdDialogUser}
        onClose={() => setPwdDialogUser(null)}
        onSubmit={async (pwd) => {
          if (!pwdDialogUser) return;
          await setPasswordMutation.mutateAsync({ userId: pwdDialogUser.id, password: pwd });
          setPwdDialogUser(null);
        }}
      />

      {/* Detail drawer */}
      <UserDetailDrawer
        user={detailUser}
        canDeleteAdmins={isAdmin}
        currentUserId={currentUser?.id}
        onClose={() => setDetailUserId(null)}
        onSave={async (payload) => {
          if (!detailUser) return;
          await updateProfileMutation.mutateAsync({ userId: detailUser.id, profile: payload.profile, roles: payload.roles });
        }}
        onSetPassword={async (pwd) => {
          if (!detailUser) return;
          await setPasswordMutation.mutateAsync({ userId: detailUser.id, password: pwd });
        }}
        onDelete={() => detailUser && askDelete(detailUser)}
      />
    </div>
  );
}

/* ============== CREATE DIALOG ============== */
function CreateUserDialog({ open, onOpenChange, onCreated, canPromoteAdmin }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onCreated: (info: { email: string; password?: string }) => void;
  canPromoteAdmin: boolean;
}) {
  const empty = { role: "colaborador" as Role, has_system_access: true, mode: "password" as "password" | "invite", password: "", full_name: "", email: "", phone: "", document_number: "", internal_notes: "" };
  const [form, setForm] = useState<any>(empty);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (open) setForm(empty); /* eslint-disable-next-line */ }, [open]);

  const submit = async () => {
    if (!form.email) return toast.error("Email obrigatório");
    if (form.phone && !isValidPhoneBR(form.phone)) return toast.error("Telefone inválido");
    if (form.document_number && !isValidCPFOrCNPJ(form.document_number)) return toast.error("CPF/CNPJ inválido");
    if (form.role === "admin" && !canPromoteAdmin) return toast.error("Apenas o admin principal pode criar outro admin");
    if (form.mode === "password" && form.password) {
      const check = validatePassword(form.password);
      if (!check.ok) return toast.error("Senha inválida: " + check.errors.join(", "));
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          action: "invite",
          email: form.email,
          full_name: form.full_name,
          phone: form.phone ? onlyDigits(form.phone) : null,
          document_number: form.document_number ? onlyDigits(form.document_number) : null,
          role: form.role,
          send_invite: form.mode === "invite",
          password: form.mode === "password" ? (form.password || undefined) : undefined,
          has_system_access: !!form.has_system_access,
          internal_notes: form.internal_notes,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Usuário criado");
      onCreated({ email: form.email, password: (data as any)?.temp_password });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="size-5 text-indigo-600" /> Novo usuário</DialogTitle>
          <DialogDescription>Crie o login e atribua o papel. Você pode definir a senha agora ou enviar email de convite.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <div className="col-span-2 space-y-2"><Label>Nome completo</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Ex: João Silva" /></div>
          <div className="space-y-2"><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" /></div>
          <div className="space-y-2"><Label>Telefone</Label><MaskedInput mask="phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="(00) 00000-0000" /></div>
          <div className="space-y-2"><Label>Documento</Label><MaskedInput mask="cpfcnpj" value={form.document_number} onChange={(v) => setForm({ ...form, document_number: v })} placeholder="CPF/CNPJ" /></div>
          <div className="space-y-2">
            <Label>Papel</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as Role })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.filter(r => canPromoteAdmin || r.value !== "admin").map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Modo de acesso inicial</Label>
            <div className="flex items-center gap-3 text-xs">
              <Button type="button" size="sm" variant={form.mode === "password" ? "default" : "outline"} className={form.mode === "password" ? "bg-indigo-600 hover:bg-indigo-700" : ""} onClick={() => setForm({ ...form, mode: "password" })}>
                <Key className="size-3.5 mr-1" /> Definir senha agora
              </Button>
              <Button type="button" size="sm" variant={form.mode === "invite" ? "default" : "outline"} className={form.mode === "invite" ? "bg-indigo-600 hover:bg-indigo-700" : ""} onClick={() => setForm({ ...form, mode: "invite" })}>
                <Mail className="size-3.5 mr-1" /> Enviar email de convite
              </Button>
            </div>
          </div>
          {form.mode === "password" && (
            <div className="col-span-2 space-y-2">
              <Label>Senha (deixe vazio para gerar automaticamente)</Label>
              <div className="flex gap-2">
                <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mín. 6 caracteres ou clique em gerar" />
                <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, password: generatePassword() })} className="gap-1"><Wand2 className="size-3.5" /> Gerar</Button>
              </div>
            </div>
          )}
          <div className="col-span-2 flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Acesso ao sistema</p>
              <p className="text-[11px] text-slate-500">Se desligado, usuário não consegue logar.</p>
            </div>
            <Switch checked={!!form.has_system_access} onCheckedChange={(v) => setForm({ ...form, has_system_access: v })} />
          </div>
          <div className="col-span-2 space-y-2"><Label>Observações internas</Label><Textarea rows={2} value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} placeholder="Notas privadas (somente admins veem)" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting} className="gap-2 bg-indigo-600 hover:bg-indigo-700"><UserPlus className="size-4" /> {submitting ? "Criando..." : "Criar usuário"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============== SET PASSWORD DIALOG ============== */
function SetPasswordDialog({ user, onClose, onSubmit }: { user: UserRow | null; onClose: () => void; onSubmit: (pwd: string) => Promise<void> }) {
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { setPwd(""); setConfirm(""); }, [user]);

  const submit = async () => {
    if (!pwd || pwd.length < 6) return toast.error("Senha precisa ter ao menos 6 caracteres");
    if (pwd !== confirm) return toast.error("As senhas não coincidem");
    setSubmitting(true);
    try {
      await onSubmit(pwd);
      navigator.clipboard.writeText(pwd).catch(() => {});
      toast.success("Senha copiada para a área de transferência");
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Key className="size-5 text-indigo-600" /> Definir nova senha</DialogTitle>
          <DialogDescription>
            Defina manualmente uma nova senha para <strong>{user?.full_name ?? user?.email}</strong>. Nenhum email será enviado — você precisa informar ao usuário.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <div className="flex gap-2">
              <Input type="text" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Mín. 6 caracteres" className="font-mono" />
              <Button type="button" variant="outline" size="sm" onClick={() => { const p = generatePassword(); setPwd(p); setConfirm(p); }} className="gap-1"><Wand2 className="size-3.5" /> Gerar</Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Confirmar senha</Label>
            <Input type="text" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repita" className="font-mono" />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex gap-2">
            <Shield className="size-4 flex-shrink-0" />
            A senha será aplicada imediatamente. Após salvar, será copiada para sua área de transferência.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting} className="gap-2 bg-indigo-600 hover:bg-indigo-700">{submitting ? "Salvando..." : "Salvar senha"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============== DETAIL DRAWER ============== */
function UserDetailDrawer({ user, currentUserId, canDeleteAdmins, onClose, onSave, onSetPassword, onDelete }: {
  user: UserRow | null; currentUserId?: string; canDeleteAdmins: boolean;
  onClose: () => void;
  onSave: (payload: { profile: any; roles?: Role[] }) => Promise<void>;
  onSetPassword: (pwd: string) => Promise<void>;
  onDelete: () => void;
}) {
  const [form, setForm] = useState<any>({});
  const [roles, setRoles] = useState<Role[]>([]);
  const [newPwd, setNewPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      full_name: user.full_name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      document_number: user.document_number ?? "",
      avatar_url: user.avatar_url ?? "",
      address_street: user.address_street ?? "",
      address_number: user.address_number ?? "",
      address_complement: user.address_complement ?? "",
      address_neighborhood: user.address_neighborhood ?? "",
      address_city: user.address_city ?? "",
      address_state: user.address_state ?? "",
      address_zip_code: user.address_zip_code ?? "",
      active: !!user.active,
      has_system_access: !!user.has_system_access,
      internal_notes: user.internal_notes ?? "",
      manual_approval_required: !!user.manual_approval_required,
      onboarding_completed: !!user.onboarding_completed,
      onboarding_step: user.onboarding_step ?? 1,
    });
    setRoles([...(user.roles ?? [])]);
    setNewPwd("");
  }, [user]);

  if (!user) return null;

  const handleSave = async () => {
    if (form.phone && !isValidPhoneBR(form.phone)) return toast.error("Telefone inválido");
    if (form.document_number && !isValidCPFOrCNPJ(form.document_number)) return toast.error("CPF/CNPJ inválido");
    const profile = {
      ...form,
      phone: form.phone ? onlyDigits(form.phone) : null,
      document_number: form.document_number ? onlyDigits(form.document_number) : null,
      address_zip_code: form.address_zip_code ? onlyDigits(form.address_zip_code) : null,
    };
    setSaving(true);
    try { await onSave({ profile, roles }); }
    finally { setSaving(false); }
  };

  const handleSavePwd = async () => {
    if (newPwd.length < 6) return toast.error("Senha precisa ter ao menos 6 caracteres");
    setSavingPwd(true);
    try {
      await onSetPassword(newPwd);
      navigator.clipboard.writeText(newPwd).catch(() => {});
      toast.success("Senha copiada para área de transferência");
      setNewPwd("");
    } finally { setSavingPwd(false); }
  };

  const toggleRole = (r: Role) => {
    setRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  };

  return (
    <Sheet open={!!user} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto bg-white">
        <SheetHeader className="pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">{initials(user.full_name)}</div>
            <div>
              <SheetTitle className="text-lg">{user.full_name ?? user.email}</SheetTitle>
              <SheetDescription className="font-mono text-xs">{user.email}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Tabs defaultValue="personal" className="mt-4">
          <TabsList className="bg-slate-100 p-1 rounded-lg">
            <TabsTrigger value="personal" className="data-[state=active]:bg-white data-[state=active]:text-indigo-700">Dados</TabsTrigger>
            <TabsTrigger value="address" className="data-[state=active]:bg-white data-[state=active]:text-indigo-700">Endereço</TabsTrigger>
            <TabsTrigger value="access" className="data-[state=active]:bg-white data-[state=active]:text-indigo-700">Acesso & papéis</TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-white data-[state=active]:text-indigo-700">Segurança</TabsTrigger>
            <TabsTrigger value="meta" className="data-[state=active]:bg-white data-[state=active]:text-indigo-700">Vínculos</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1"><Label>Nome completo</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="font-mono" /></div>
              <div className="space-y-1"><Label>Telefone</Label><MaskedInput mask="phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="(00) 00000-0000" /></div>
              <div className="space-y-1"><Label>Documento</Label><MaskedInput mask="cpfcnpj" value={form.document_number} onChange={(v) => setForm({ ...form, document_number: v })} placeholder="CPF/CNPJ" /></div>
              <div className="space-y-1"><Label>Avatar URL</Label><Input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} /></div>
              <div className="col-span-2 space-y-1"><Label>Observações internas</Label><Textarea rows={3} value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} /></div>
            </div>
          </TabsContent>

          <TabsContent value="address" className="space-y-3 mt-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1"><Label>Rua</Label><Input value={form.address_street} onChange={(e) => setForm({ ...form, address_street: e.target.value })} /></div>
              <div className="space-y-1"><Label>Número</Label><Input value={form.address_number} onChange={(e) => setForm({ ...form, address_number: e.target.value })} /></div>
              <div className="col-span-3 space-y-1"><Label>Complemento</Label><Input value={form.address_complement} onChange={(e) => setForm({ ...form, address_complement: e.target.value })} /></div>
              <div className="space-y-1"><Label>Bairro</Label><Input value={form.address_neighborhood} onChange={(e) => setForm({ ...form, address_neighborhood: e.target.value })} /></div>
              <div className="space-y-1"><Label>Cidade</Label><Input value={form.address_city} onChange={(e) => setForm({ ...form, address_city: e.target.value })} /></div>
              <div className="space-y-1"><Label>UF</Label><Input value={form.address_state} onChange={(e) => setForm({ ...form, address_state: e.target.value })} /></div>
              <div className="space-y-1"><Label>CEP</Label><MaskedInput mask="cep" value={form.address_zip_code} onChange={(v) => setForm({ ...form, address_zip_code: v })} onBlur={async () => {
                const r = await lookupCEP(form.address_zip_code ?? "");
                if (r) {
                  setForm((p: any) => ({
                    ...p,
                    address_street: p.address_street || r.logradouro,
                    address_neighborhood: p.address_neighborhood || r.bairro,
                    address_city: p.address_city || r.localidade,
                    address_state: p.address_state || r.uf,
                  }));
                  toast.success("Endereço preenchido pelo CEP");
                }
              }} placeholder="00000-000" /></div>
            </div>
          </TabsContent>

          <TabsContent value="access" className="space-y-3 mt-4">
            <div className="space-y-2">
              <Label>Papéis atribuídos</Label>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => toggleRole(r.value)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs border transition-all",
                      roles.includes(r.value) ? roleClass[r.value] : "bg-white border-slate-200 text-slate-500 hover:border-slate-300",
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">Clique para adicionar/remover. Papéis múltiplos suportados.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 mt-4">
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div><p className="text-sm font-medium">Usuário ativo</p><p className="text-[11px] text-slate-500">Inativo aparece riscado nas listas.</p></div>
                <Switch checked={!!form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </div>
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div><p className="text-sm font-medium">Acesso ao sistema</p><p className="text-[11px] text-slate-500">Se desligado, login bloqueado.</p></div>
                <Switch checked={!!form.has_system_access} onCheckedChange={(v) => setForm({ ...form, has_system_access: v })} />
              </div>
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div><p className="text-sm font-medium">Requer aprovação manual</p><p className="text-[11px] text-slate-500">Cadastros só liberados após admin aprovar.</p></div>
                <Switch checked={!!form.manual_approval_required} onCheckedChange={(v) => setForm({ ...form, manual_approval_required: v })} />
              </div>
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div><p className="text-sm font-medium">Onboarding concluído</p><p className="text-[11px] text-slate-500">Marcar pula etapas iniciais.</p></div>
                <Switch checked={!!form.onboarding_completed} onCheckedChange={(v) => setForm({ ...form, onboarding_completed: v, onboarding_step: v ? 5 : form.onboarding_step })} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-4 mt-4">
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2"><Key className="size-4 text-indigo-700" /><h4 className="font-semibold text-sm text-indigo-900">Definir nova senha</h4></div>
              <p className="text-xs text-indigo-800/80">Você define manualmente. Nenhum email é enviado — informe ao usuário.</p>
              <div className="flex gap-2">
                <Input type="text" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Mín. 6 caracteres" className="font-mono bg-white" />
                <Button type="button" variant="outline" size="sm" onClick={() => setNewPwd(generatePassword())} className="gap-1"><Wand2 className="size-3.5" /> Gerar</Button>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSavePwd} disabled={savingPwd || newPwd.length < 6} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                  {savingPwd ? "Salvando..." : "Salvar senha"}
                </Button>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
              <p><span className="text-slate-500">Email confirmado em:</span> <span className="font-mono">{formatDate(user.email_confirmed_at)}</span></p>
              <p><span className="text-slate-500">Último acesso:</span> <span className="font-mono">{formatDate(user.last_sign_in_at)}</span></p>
              <p><span className="text-slate-500">Conta criada em:</span> <span className="font-mono">{formatDate(user.created_at)}</span></p>
            </div>
          </TabsContent>

          <TabsContent value="meta" className="space-y-3 mt-4">
            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 text-xs">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2">Vínculos no sistema</p>
              {user.links.clients.length === 0 && user.links.partners.length === 0 && user.links.providers.length === 0 && user.links.referrers.length === 0 && (
                <p className="text-slate-400">Nenhum vínculo encontrado.</p>
              )}
              {user.links.clients.map((c) => <Badge key={c.id} variant="outline" className="mr-1 bg-slate-50">Cliente: {c.name}</Badge>)}
              {user.links.partners.map((c) => <Badge key={c.id} variant="outline" className="mr-1 bg-amber-50 text-amber-700 border-amber-200">Parceiro: {c.name}</Badge>)}
              {user.links.providers.map((c) => <Badge key={c.id} variant="outline" className="mr-1 bg-emerald-50 text-emerald-700 border-emerald-200">Prestador: {c.name}</Badge>)}
              {user.links.referrers.map((c) => <Badge key={c.id} variant="outline" className="mr-1 bg-pink-50 text-pink-700 border-pink-200">Indicador: {c.name}</Badge>)}
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs space-y-1 font-mono">
              <p><span className="text-slate-500 font-sans">ID:</span> {user.id}</p>
              <p><span className="text-slate-500 font-sans">Onboarding step:</span> {user.onboarding_step ?? "—"}</p>
            </div>
          </TabsContent>
        </Tabs>

        <SheetFooter className="mt-6 pt-4 border-t border-slate-200 flex flex-row items-center justify-between gap-2 sm:justify-between">
          <Button
            variant="ghost"
            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 gap-2"
            onClick={onDelete}
            disabled={user.id === currentUserId}
          >
            <Trash2 className="size-4" /> Excluir
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
