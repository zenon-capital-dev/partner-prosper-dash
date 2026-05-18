import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Plus, Pencil, Trash2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { confirmAction } from "@/lib/confirm";

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { value: "email", label: "E-mail", icon: Mail },
  { value: "sms", label: "SMS", icon: Phone },
];

export default function MessageTemplates() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", channel: "whatsapp", subject: "", body: "" });

  const { data: templates, isLoading } = useQuery({
    queryKey: ["message-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", channel: "whatsapp", subject: "", body: "" });
    setOpen(true);
  };

  const openEdit = (t: any) => {
    setEditing(t);
    setForm({ name: t.name, channel: t.channel, subject: t.subject || "", body: t.body });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name || !form.body) {
      toast.error("Nome e mensagem são obrigatórios");
      return;
    }
    const payload = {
      name: form.name,
      channel: form.channel,
      subject: form.subject || null,
      body: form.body,
      created_by: user?.id ?? null,
    };
    const { error } = editing
      ? await supabase.from("message_templates").update(payload).eq("id", editing.id)
      : await supabase.from("message_templates").insert(payload);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(editing ? "Template atualizado" : "Template criado");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["message-templates"] });
    }
  };

  const remove = async (id: string) => {
    if (!(await confirmAction("Excluir este template?"))) return;
    const { error } = await supabase.from("message_templates").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Template excluído");
      qc.invalidateQueries({ queryKey: ["message-templates"] });
    }
  };

  return (
    <div className="page-shell space-y-7 animate-fade-in">
      <header className="flex items-end justify-between gap-4 flex-wrap pb-2">
        <div className="min-w-0 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <MessageSquare className="size-3 text-primary" />
            Comunicação
          </div>
          <h1 className="font-display text-[34px] sm:text-[40px] font-bold tracking-[-0.03em] leading-[1.02] text-foreground">
            Templates(Desenvolvimento) de Mensagens
          </h1>
          <p className="text-sm text-muted-foreground">
            Modelos prontos para WhatsApp, e-mail e SMS. Use variáveis como{" "}
            <code className="px-1 py-0.5 bg-muted rounded text-[11px]">{"{{nome}}"}</code>,{" "}
            <code className="px-1 py-0.5 bg-muted rounded text-[11px]">{"{{produto}}"}</code>.
          </p>
        </div>
        <Button onClick={openNew} className="h-9 text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/20 bg-gradient-primary">
          <Plus className="size-3.5 mr-2" /> Novo Template
        </Button>
      </header>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full vx-card p-12 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : (templates ?? []).length === 0 ? (
          <div className="col-span-full vx-card p-12 text-center text-sm text-muted-foreground">
            Nenhum template criado ainda. Clique em "Novo Template" para começar.
          </div>
        ) : (
          templates?.map((t: any) => {
            const ch = CHANNELS.find((c) => c.value === t.channel);
            const Icon = ch?.icon ?? MessageSquare;
            return (
              <div key={t.id} className="vx-card p-4 hover:shadow-lg transition-shadow group">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{t.name}</p>
                      <Badge variant="outline" className="mt-0.5 text-[9px]">{ch?.label || t.channel}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(t)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => remove(t.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
                {t.subject && <p className="text-[11px] font-bold text-muted-foreground mb-1">Assunto: {t.subject}</p>}
                <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap">{t.body}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-2">{formatDate(t.created_at)}</p>
              </div>
            );
          })
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Template" : "Novo Template"}</DialogTitle>
            <DialogDescription>
              Use variáveis com chaves duplas: <code>{"{{nome}}"}</code>, <code>{"{{produto}}"}</code>, <code>{"{{valor}}"}</code>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Boas-vindas cliente novo" />
            </div>
            <div>
              <Label>Canal</Label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            {form.channel === "email" && (
              <div>
                <Label>Assunto</Label>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </div>
            )}
            <div>
              <Label>Mensagem *</Label>
              <Textarea
                rows={6}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Olá {{nome}}, tudo bem? Estou entrando em contato sobre {{produto}}..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
