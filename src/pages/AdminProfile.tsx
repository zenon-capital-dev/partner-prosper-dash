import { formatBR as format } from "@/lib/datetime";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Shield, User, Activity } from "lucide-react";
;
import { ptBR } from "date-fns/locale";

export default function AdminProfile() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      setRoles((r || []).map((x: any) => x.role));

      const { data: l } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      setLogs(l || []);
    })();
  }, [user]);

  if (!user) return <div className="p-12 text-center text-muted-foreground">Carregando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
          {(user.email || "?").charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold">Meu Perfil</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados"><User className="h-3 w-3 mr-1" />Dados</TabsTrigger>
          <TabsTrigger value="permissoes"><Shield className="h-3 w-3 mr-1" />Permissões</TabsTrigger>
          <TabsTrigger value="atividade"><Activity className="h-3 w-3 mr-1" />Atividade</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4">
          <Card><CardContent className="p-6 grid md:grid-cols-2 gap-4 text-sm">
            <Field label="Nome" value={(user.user_metadata as any)?.full_name || (user.user_metadata as any)?.name} />
            <Field label="E-mail" value={user.email} />
            <Field label="ID" value={user.id} />
            <Field label="Cadastro" value={user.created_at ? format(new Date(user.created_at), "dd/MM/yyyy", { locale: ptBR }) : "—"} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="permissoes" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Funções atribuídas</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {roles.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma função atribuída</p>}
              {roles.map((r) => (
                <Badge key={r} variant="default">{r}</Badge>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="atividade" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Atividade recente</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {logs.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma atividade registrada</p>}
              {logs.map((l) => (
                <div key={l.id} className="flex justify-between items-center border rounded p-3 text-sm">
                  <div>
                    <p className="font-medium">{l.action}</p>
                    <p className="text-xs text-muted-foreground">{l.entity_type}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(l.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="font-medium break-all">{value || "—"}</p>
    </div>
  );
}
