import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck, Settings2 } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

const PREF_TYPES: { key: string; label: string }[] = [
  { key: "comment", label: "Comentários" },
  { key: "document", label: "Documentos" },
  { key: "status", label: "Mudanças de status" },
  { key: "task", label: "Tarefas atribuídas" },
  { key: "commission", label: "Comissões" },
  { key: "contract", label: "Contratos" },
  { key: "demand_request", label: "Solicitações" },
  { key: "lead", label: "Leads" },
];

export default function NotificationsCenter() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data: notes = [] } = useQuery({
    queryKey: ["notifications-center", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, title, message, link, type, read, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: prefs = [] } = useQuery({
    queryKey: ["notification-prefs", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("type, in_app, email")
        .eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const prefMap = useMemo(() => {
    const m = new Map<string, { in_app: boolean; email: boolean }>();
    prefs.forEach((p: any) => m.set(p.type, { in_app: p.in_app, email: p.email }));
    return m;
  }, [prefs]);

  const savePref = useMutation({
    mutationFn: async ({ type, patch }: { type: string; patch: { in_app?: boolean; email?: boolean } }) => {
      const current = prefMap.get(type) ?? { in_app: true, email: false };
      const next = { ...current, ...patch };
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: user!.id, type, ...next }, { onConflict: "user_id,type" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-prefs"] }),
    onError: (e: any) => toast.error(e.message || "Falha ao salvar preferência"),
  });

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`notif-center-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications-center"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, qc]);

  const filtered = notes.filter((n: any) => (filter === "unread" ? !n.read : true));
  const unread = notes.filter((n: any) => !n.read).length;

  const markAllRead = async () => {
    await supabase.from("notifications").update({ read: true }).eq("user_id", user!.id).eq("read", false);
    qc.invalidateQueries({ queryKey: ["notifications-center"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const openNote = async (n: any) => {
    if (!n.read) {
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
      qc.invalidateQueries({ queryKey: ["notifications-center"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
    if (n.link) navigate(n.link);
  };

  const toggleRead = async (n: any, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("notifications").update({ read: !n.read }).eq("id", n.id);
    qc.invalidateQueries({ queryKey: ["notifications-center"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Bell className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Notificações</h1>
            <p className="text-xs text-muted-foreground">
              {unread > 0 ? `${unread} não lida${unread > 1 ? "s" : ""}` : "Tudo em dia"}
            </p>
          </div>
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="size-4 mr-1" /> Marcar todas como lidas
          </Button>
        )}
      </div>

      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox">Caixa de entrada</TabsTrigger>
          <TabsTrigger value="prefs"><Settings2 className="size-3.5 mr-1" /> Preferências</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-3">
          <div className="flex gap-2 text-xs">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded-full border ${filter === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
            >Todas</button>
            <button
              onClick={() => setFilter("unread")}
              className={`px-3 py-1 rounded-full border ${filter === "unread" ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
            >Não lidas</button>
          </div>

          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">Nenhuma notificação</div>
            ) : (
              filtered.map((n: any) => (
                <div
                  key={n.id}
                  onClick={() => openNote(n)}
                  className={`p-4 flex items-start gap-3 cursor-pointer hover:bg-muted/40 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
                >
                  <div className={`mt-1.5 size-2 rounded-full shrink-0 ${!n.read ? "bg-primary" : "bg-transparent"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">{n.title}</p>
                      {n.type && (
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {n.type}
                        </span>
                      )}
                    </div>
                    {n.message && <p className="text-xs text-muted-foreground mt-1 break-words">{n.message}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  <button
                    onClick={(e) => toggleRead(n, e)}
                    className="text-muted-foreground hover:text-foreground p-1"
                    title={n.read ? "Marcar como não lida" : "Marcar como lida"}
                  >
                    <Check className="size-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="prefs">
          <div className="rounded-xl border border-border bg-card p-2">
            <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <div>Tipo</div>
              <div className="text-center w-16">No app</div>
              <div className="text-center w-16">E-mail</div>
            </div>
            {PREF_TYPES.map((t) => {
              const p = prefMap.get(t.key) ?? { in_app: true, email: false };
              return (
                <div key={t.key} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-3 py-3 border-t border-border">
                  <div className="text-sm">{t.label}</div>
                  <div className="w-16 flex justify-center">
                    <Switch
                      checked={p.in_app}
                      onCheckedChange={(v) => savePref.mutate({ type: t.key, patch: { in_app: v } })}
                    />
                  </div>
                  <div className="w-16 flex justify-center">
                    <Switch
                      checked={p.email}
                      onCheckedChange={(v) => savePref.mutate({ type: t.key, patch: { email: v } })}
                    />
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] text-muted-foreground px-3 py-3">
              As preferências valem para o seu perfil em qualquer portal. Desativar "No app" impede que novas notificações desse tipo sejam registradas para você.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
