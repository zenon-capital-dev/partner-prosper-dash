import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserCog, UserPlus, Search, Mail, Copy, Shield } from "lucide-react";
import { initials } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

type Role = "admin" | "vendedor" | "parceiro" | "colaborador" | "prestador" | "cliente" | "none";

const roleLabel: Record<string, string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
  parceiro: "Parceiro",
  colaborador: "Colaborador",
  prestador: "Prestador",
  cliente: "Cliente",
};
const roleClass: Record<string, string> = {
  admin: "bg-primary-muted text-primary",
  vendedor: "bg-info-muted text-info",
  parceiro: "bg-warning-muted text-warning",
  colaborador: "bg-emerald-100 text-emerald-700",
  prestador: "bg-slate-200 text-slate-800",
  cliente: "bg-muted text-foreground",
};

export default function UsersPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ role: "vendedor", send_invite: true });
  const [createdInfo, setCreatedInfo] = useState<{ email: string; password?: string } | null>(null);

  const { data: users = [] } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, phone, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
      }));
    },
  });

  const filtered = useMemo(() =>
    users.filter((u: any) =>
      !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase())
    ), [users, search]);

  const setRole = async (userId: string, role: Role) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    if (role !== "none") {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) return toast.error(error.message);
    }
    toast.success("Papel atualizado");
    qc.invalidateQueries({ queryKey: ["users-with-roles"] });
  };

  const invite = async () => {
    if (!form.email) return toast.error("Email obrigatório");
    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: {
        email: form.email,
        full_name: form.full_name,
        phone: form.phone,
        role: form.role,
        send_invite: !!form.send_invite,
      },
    });
    if (error) return toast.error(error.message);
    if ((data as any)?.error) return toast.error((data as any).error);
    toast.success("Usuário criado");
    setCreatedInfo({ email: form.email, password: (data as any)?.temp_password });
    setForm({ role: "vendedor", send_invite: true });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["users-with-roles"] });
  };

  if (!isAdmin) {
    return <div className="p-12 text-center text-muted-foreground">Apenas administradores acessam esta página.</div>;
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in space-y-6">
      <PageHeader
        title="Usuários"
        description="Crie logins, atribua papéis e gerencie o acesso ao sistema."
        actions={
          <Button onClick={() => setOpen(true)} className="gap-2"><UserPlus className="size-4" /> Convidar usuário</Button>
        }
      />

      <div className="vx-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Buscar usuário" className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Badge variant="secondary" className="text-[10px]">{filtered.length} usuários</Badge>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Usuário</th>
              <th className="px-4 py-3 text-left font-semibold">Email</th>
              <th className="px-4 py-3 text-left font-semibold">Telefone</th>
              <th className="px-4 py-3 text-left font-semibold">Papel atual</th>
              <th className="px-4 py-3 text-left font-semibold">Alterar papel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((u: any) => (
              <tr key={u.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-full bg-primary-muted text-primary flex items-center justify-center text-xs font-bold">{initials(u.full_name)}</div>
                    <p className="font-medium">{u.full_name ?? "—"}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{u.email}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{u.phone ?? "—"}</td>
                <td className="px-4 py-3">
                  {u.roles.length === 0 ? (
                    <Badge variant="outline" className="text-[10px]">Sem papel</Badge>
                  ) : u.roles.map((r: string) => (
                    <Badge key={r} className={`text-[10px] mr-1 ${roleClass[r]}`}>{roleLabel[r]}</Badge>
                  ))}
                </td>
                <td className="px-4 py-3">
                  <Select value={u.roles[0] ?? "none"} onValueChange={(v) => setRole(u.id, v as Role)}>
                    <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem papel</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="vendedor">Vendedor</SelectItem>
                      <SelectItem value="colaborador">Colaborador</SelectItem>
                      <SelectItem value="parceiro">Parceiro</SelectItem>
                      <SelectItem value="prestador">Prestador</SelectItem>
                      <SelectItem value="cliente">Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2"><UserPlus className="size-5" /> Convidar novo usuário</DialogTitle>
            <DialogDescription>Crie o login e defina o papel. O sistema envia o email de definição de senha.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-2"><Label>Nome completo</Label><Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="col-span-2 space-y-2"><Label>Email *</Label><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                  <SelectItem value="parceiro">Parceiro</SelectItem>
                  <SelectItem value="prestador">Prestador</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="size-3.5" /> O usuário receberá um email para definir a própria senha.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={invite} className="gap-2"><Mail className="size-4" /> Enviar convite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!createdInfo} onOpenChange={() => setCreatedInfo(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Usuário criado</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p><span className="text-muted-foreground">Email:</span> <strong>{createdInfo?.email}</strong></p>
            {createdInfo?.password && (
              <div className="rounded-lg bg-muted p-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Senha temporária</p>
                  <p className="font-mono">{createdInfo.password}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(createdInfo.password!); toast.success("Copiado"); }}>
                  <Copy className="size-4" />
                </Button>
              </div>
            )}
            {!createdInfo?.password && <p className="text-xs text-muted-foreground">Email de convite enviado.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
