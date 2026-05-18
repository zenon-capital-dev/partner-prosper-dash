import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Zap, Settings, Bell, Mail, MessageSquare, History } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Rule {
  id: string;
  trigger_key: string;
  name: string;
  description: string | null;
  is_active: boolean;
  config: any;
}

interface Log {
  id: string;
  trigger_key: string;
  status: string;
  payload: any;
  error_message: string | null;
  created_at: string;
}

const ICONS: Record<string, any> = {
  document_uploaded: Bell,
  document_rejected: Bell,
  demand_stale: History,
  payment_confirmed: Zap,
  commission_paid: Zap,
  demand_deadline_near: Bell,
  client_product_added: Settings,
  lead_converted: Settings,
};

export default function Automations() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [draft, setDraft] = useState<any>({});

  const load = async () => {
    setLoading(true);
    const [{ data: r }, { data: l }] = await Promise.all([
      supabase.from("automation_rules").select("*").order("name"),
      supabase.from("automation_logs").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setRules((r || []) as Rule[]);
    setLogs((l || []) as Log[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggleRule = async (rule: Rule, active: boolean) => {
    const { error } = await supabase
      .from("automation_rules")
      .update({ is_active: active })
      .eq("id", rule.id);
    if (error) {
      toast.error("Erro ao atualizar");
      return;
    }
    toast.success(active ? "Automação ativada" : "Automação desativada");
    load();
  };

  const openEdit = (rule: Rule) => {
    setEditing(rule);
    setDraft({
      stale_days: rule.config?.stale_days ?? 7,
      deadline_days: rule.config?.deadline_days ?? 3,
      notify_email: rule.config?.notify_email ?? true,
      notify_in_app: rule.config?.notify_in_app ?? true,
      notify_whatsapp: rule.config?.notify_whatsapp ?? false,
      message_template: rule.config?.message_template ?? "",
    });
  };

  const saveConfig = async () => {
    if (!editing) return;
    const { error } = await supabase
      .from("automation_rules")
      .update({ config: draft })
      .eq("id", editing.id);
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success("Configuração salva");
    setEditing(null);
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Zap className="h-6 w-6" /> Automações(Desenvolvimento) Internas
        </h1>
        <p className="text-muted-foreground">
          Configure gatilhos automáticos para notificações, lembretes e ações no sistema.
        </p>
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Regras</TabsTrigger>
          <TabsTrigger value="logs">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-3 mt-4">
          {loading && <p className="text-muted-foreground text-sm">Carregando...</p>}
          {rules.map((r) => {
            const Icon = ICONS[r.trigger_key] || Zap;
            return (
              <Card key={r.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{r.name}</h3>
                      <Badge variant={r.is_active ? "default" : "outline"}>
                        {r.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{r.description}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                    Configurar
                  </Button>
                  <Switch
                    checked={r.is_active}
                    onCheckedChange={(v) => toggleRule(r, v)}
                  />
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Últimas execuções</CardTitle>
              <CardDescription>Histórico das automações disparadas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {logs.length === 0 && (
                <p className="text-muted-foreground text-sm">Nenhuma execução registrada ainda.</p>
              )}
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between border rounded-lg p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{log.trigger_key}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge variant={log.status === "success" ? "default" : "destructive"}>
                    {log.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configurar — {editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editing?.trigger_key === "demand_stale" && (
              <div>
                <Label>Alertar após dias sem atualização</Label>
                <Input
                  type="number"
                  min="1"
                  value={draft.stale_days || 7}
                  onChange={(e) => setDraft({ ...draft, stale_days: Number(e.target.value) })}
                />
              </div>
            )}
            {editing?.trigger_key === "demand_deadline_near" && (
              <div>
                <Label>Alertar X dias antes do prazo</Label>
                <Input
                  type="number"
                  min="1"
                  value={draft.deadline_days || 3}
                  onChange={(e) => setDraft({ ...draft, deadline_days: Number(e.target.value) })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Canais de notificação</Label>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <Bell className="h-4 w-4" /> Notificação no sistema
                </span>
                <Switch
                  checked={draft.notify_in_app}
                  onCheckedChange={(v) => setDraft({ ...draft, notify_in_app: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4" /> E-mail
                </span>
                <Switch
                  checked={draft.notify_email}
                  onCheckedChange={(v) => setDraft({ ...draft, notify_email: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <MessageSquare className="h-4 w-4" /> WhatsApp
                </span>
                <Switch
                  checked={draft.notify_whatsapp}
                  onCheckedChange={(v) => setDraft({ ...draft, notify_whatsapp: v })}
                />
              </div>
            </div>

            <div>
              <Label>Modelo da mensagem (opcional)</Label>
              <Textarea
                rows={4}
                value={draft.message_template || ""}
                onChange={(e) => setDraft({ ...draft, message_template: e.target.value })}
                placeholder="Use variáveis como {cliente}, {produto}, {prazo}..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={saveConfig}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
