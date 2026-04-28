import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function Settings() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [profile, setProfile] = useState<any>({});

  const { data: prof } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
    enabled: !!user,
  });

  useEffect(() => { if (prof) setProfile(prof); }, [prof]);

  const { data: users } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email");
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      return (profiles ?? []).map((p) => ({ ...p, roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role) }));
    },
    enabled: isAdmin,
  });

  const saveProfile = async () => {
    const { error } = await supabase.from("profiles").update({ full_name: profile.full_name, phone: profile.phone }).eq("id", user!.id);
    if (error) toast.error(error.message);
    else toast.success("Perfil atualizado");
  };

  const setRole = async (userId: string, role: string) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    if (role !== "none") {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Papel atualizado");
    qc.invalidateQueries({ queryKey: ["all-users"] });
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto animate-fade-in">
      <PageHeader title="Configurações" description="Gerencie seu perfil e usuários do sistema." />

      <div className="vx-card p-6 mb-6">
        <h2 className="font-display text-lg font-bold mb-4">Meu perfil</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Nome</Label><Input value={profile.full_name ?? ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Email</Label><Input value={profile.email ?? ""} disabled /></div>
          <div className="space-y-2"><Label>Telefone</Label><Input value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
        </div>
        <Button onClick={saveProfile} className="mt-4 bg-gradient-primary hover:opacity-90">Salvar</Button>
      </div>

      {isAdmin && (
        <div className="vx-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-display text-lg font-bold">Usuários do sistema</h2>
            <p className="text-xs text-muted-foreground mt-1">Defina o papel de cada usuário cadastrado.</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 text-left font-semibold">Usuário</th>
                <th className="px-6 py-3 text-left font-semibold">Email</th>
                <th className="px-6 py-3 text-left font-semibold">Papel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(users ?? []).map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-6 py-4 font-medium">{u.full_name ?? "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground">{u.email}</td>
                  <td className="px-6 py-4">
                    <Select value={u.roles[0] ?? "none"} onValueChange={(v) => setRole(u.id, v)}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem papel</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="vendedor">Vendedor</SelectItem>
                        <SelectItem value="parceiro">Parceiro</SelectItem>
                        <SelectItem value="cliente">Cliente</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-6 py-3 border-t border-border bg-muted/30 text-xs text-muted-foreground">
            💡 Dica: peça aos usuários para se cadastrarem na tela de login. Eles aparecerão aqui pra você definir o papel.
          </div>
        </div>
      )}
    </div>
  );
}
