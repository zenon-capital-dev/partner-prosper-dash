import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/use-debounce";
import { UserCircle, Search, Plus, Mail, Phone, Shield, Loader2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PaginationControl } from "@/components/ui/PaginationControl";

type CollabRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  active: boolean | null;
  has_system_access: boolean | null;
  internal_notes: string | null;
  role: "admin" | "admin_secondary" | "colaborador";
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  admin_secondary: "Admin Secundário",
  colaborador: "Colaborador",
};

export default function Collaborators() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CollabRow | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

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
        .select("id, full_name, email, phone, active, has_system_access, internal_notes")
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
          role: r.role,
        };
      });
    },
  });

  const filtered = rows.filter((r) => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      (r.full_name ?? "").toLowerCase().includes(q) ||
      (r.email ?? "").toLowerCase().includes(q) ||
      (r.phone ?? "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage]);

  const updateProfile = useMutation({
    mutationFn: async (payload: Partial<CollabRow> & { id: string; role?: string }) => {
      const { id, role, ...rest } = payload;
      const { error } = await supabase.from("profiles").update(rest).eq("id", id);
      if (error) throw error;
      if (role) {
        await supabase.from("user_roles").delete().eq("user_id", id);
        await supabase.from("user_roles").insert({ user_id: id, role: role as any });
      }
    },
    onSuccess: () => {
      toast.success("Colaborador atualizado");
      qc.invalidateQueries({ queryKey: ["collaborators-list"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });

  return (
    <div className="page-shell space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-500">
            <UserCircle className="size-3 text-indigo-600" /> Equipe Interna
          </div>
          <h1 className="font-display text-[34px] sm:text-[40px] font-bold tracking-[-0.03em] leading-[1.02] text-slate-900 mt-3">
            Colaboradores
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gerencie sua equipe, permissões e acessos ao sistema.
          </p>
        </div>

        <Button
          onClick={() => setCreateOpen(true)}
          className="h-11 sm:h-9 text-xs font-bold uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto"
        >
          <Plus className="size-3.5 mr-2" /> Novo Colaborador
        </Button>
      </header>

      <div className="bg-white border border-slate-200/70 rounded-xl shadow-sm p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            className="pl-10 h-10 text-sm"
            placeholder="Buscar por nome, e-mail ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200/70 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">
            <Loader2 className="size-5 animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <UserCircle className="size-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">Nenhum colaborador encontrado</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[800px]">
                <thead className="bg-slate-50 border-b border-slate-200/70">
                  <tr>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Nome</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Contato</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Função</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Acesso</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm">
                            {(c.full_name ?? c.email ?? "?").charAt(0).toUpperCase()}
                          </div>
                          <div className="font-semibold text-sm text-slate-900">{c.full_name ?? "—"}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5"><Mail className="size-3 text-slate-400" /> {c.email ?? "—"}</div>
                        {c.phone && <div className="flex items-center gap-1.5 mt-1"><Phone className="size-3 text-slate-400" /> {c.phone}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {ROLE_LABEL[c.role]}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        {c.has_system_access ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                            <Shield className="size-3" /> Habilitado
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-bold">Bloqueado</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={c.active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-slate-200 text-slate-600 hover:bg-slate-200"}>
                          {c.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setEditing(c)}>
                          Editar
                        </Button>
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
              totalItems={filtered.length}
              itemsPerPage={itemsPerPage}
            />
          </>
        )}
      </div>

      <CreateCollaboratorDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["collaborators-list"] })} />

      {editing && (
        <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar colaborador</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={editing.full_name ?? ""} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone</Label>
                  <Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input value={editing.email ?? ""} disabled />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Função</Label>
                  <Select value={editing.role} onValueChange={(v) => setEditing({ ...editing, role: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="colaborador">Colaborador</SelectItem>
                      <SelectItem value="admin_secondary">Admin Secundário</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={editing.active ? "1" : "0"} onValueChange={(v) => setEditing({ ...editing, active: v === "1" })}>
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
                />
              </div>
              <div className="space-y-1.5">
                <Label>Observações internas</Label>
                <Textarea
                  rows={3}
                  value={editing.internal_notes ?? ""}
                  onChange={(e) => setEditing({ ...editing, internal_notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button
                disabled={updateProfile.isPending}
                onClick={() =>
                  updateProfile.mutate({
                    id: editing.id,
                    full_name: editing.full_name,
                    phone: editing.phone,
                    active: editing.active,
                    has_system_access: editing.has_system_access,
                    internal_notes: editing.internal_notes,
                    role: editing.role,
                  })
                }
              >
                {updateProfile.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function CreateCollaboratorDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    phone: "",
    role: "colaborador" as "colaborador" | "admin_secondary" | "admin",
    has_system_access: true,
    internal_notes: "",
    send_invite: false,
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const reset = () => {
    setForm({
      email: "",
      full_name: "",
      phone: "",
      role: "colaborador",
      has_system_access: true,
      internal_notes: "",
      send_invite: true,
      password: "",
    });
    setTempPassword(null);
  };

  const submit = async () => {
    if (!form.email || !form.full_name) {
      toast.error("Nome e e-mail são obrigatórios");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: form.email,
          full_name: form.full_name,
          phone: form.phone || undefined,
          role: form.role,
          has_system_access: form.has_system_access,
          internal_notes: form.internal_notes || undefined,
          send_invite: form.send_invite && !form.password,
          password: form.password || undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const tp = (data as any)?.temp_password as string | null;
      toast.success("Colaborador criado");
      onCreated();
      if (tp) {
        setTempPassword(tp);
      } else {
        onOpenChange(false);
        reset();
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar colaborador");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Cadastrar colaborador</DialogTitle>
        </DialogHeader>

        {tempPassword ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50">
              <p className="text-sm font-bold text-emerald-800 mb-1">Senha temporária gerada</p>
              <p className="text-xs text-emerald-700 mb-3">
                Compartilhe com o colaborador. Ele poderá alterá-la após o primeiro login.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white border border-emerald-200 rounded px-3 py-2 font-mono text-sm">
                  {tempPassword}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { navigator.clipboard.writeText(tempPassword); toast.success("Copiado"); }}
                >
                  <Copy className="size-3.5" />
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => { onOpenChange(false); reset(); }}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
              <div className="space-y-1.5">
                <Label>Nome completo *</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Ex: Ana Silva" />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ana@empresa.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-1.5">
                <Label>Função</Label>
                <Select value={form.role} onValueChange={(v: any) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="colaborador">Colaborador</SelectItem>
                    <SelectItem value="admin_secondary">Admin Secundário</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-1 sm:col-span-2">
                <Label>Senha inicial (opcional)</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Se vazio, um convite será enviado"
                />
              </div>
              <div className="space-y-1.5 col-span-1 sm:col-span-2">
                <Label>Observações internas</Label>
                <Textarea value={form.internal_notes} onChange={(e) => setForm({ ...form, internal_notes: e.target.value })} placeholder="Ex: Setor comercial, turno manhã..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button disabled={loading} onClick={submit}>
                {loading && <Loader2 className="size-4 animate-spin mr-2" />}
                Cadastrar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
