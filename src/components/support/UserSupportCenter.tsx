import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LifeBuoy, Plus, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CATEGORIES, PRIORITIES, RequesterRole, STATUS_META, SupportTicket } from "./supportShared";
import { TicketConversation } from "./TicketConversation";

/** Central de suporte do colaborador / prestador. */
export function UserSupportCenter({ role }: { role: RequesterRole }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "geral", priority: "normal", message: "" });
  const [saving, setSaving] = useState(false);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["support-tickets", "mine", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<SupportTicket[]> => {
      const { data, error } = await (supabase as any).from("support_tickets")
        .select("*").eq("requester_id", user!.id).order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const selected = tickets.find((t) => t.id === selectedId) ?? null;

  async function create() {
    const subject = form.subject.trim(); const message = form.message.trim();
    if (subject.length < 2 || !message) { toast.error("Preencha assunto e mensagem"); return; }
    setSaving(true);
    const { data, error } = await (supabase as any).from("support_tickets").insert({
      requester_id: user?.id, requester_role: role, subject, category: form.category, priority: form.priority,
    }).select().single();
    if (!error && data) {
      const r = await (supabase as any).from("support_ticket_messages").insert({
        ticket_id: data.id, sender_user_id: user?.id, sender_role: "requester", body: message,
      });
      if (r.error) toast.error(r.error.message);
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Chamado aberto! A equipe vai responder em breve.");
    setCreating(false); setForm({ subject: "", category: "geral", priority: "normal", message: "" });
    setSelectedId(data.id);
    qc.invalidateQueries({ queryKey: ["support-tickets"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center"><LifeBuoy className="size-5 text-indigo-700" /></div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Suporte</h2>
            <p className="text-sm text-slate-500">Fale direto com a equipe. Respostas chegam nas notificações.</p>
          </div>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="size-4 mr-1" />Novo chamado</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
          {isLoading ? <div className="p-3 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
            : tickets.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="size-7 mx-auto text-slate-300" />
                <p className="text-sm mt-2 text-slate-600">Nenhum chamado ainda</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-[60dvh] overflow-y-auto">
                {tickets.map((t) => (
                  <li key={t.id}>
                    <button onClick={() => setSelectedId(t.id)} className={cn("w-full text-left px-4 py-3 hover:bg-slate-50 transition", selectedId === t.id && "bg-indigo-50/60")}>
                      <div className="flex items-center gap-2">
                        <span className="flex-1 text-sm font-medium text-slate-900 truncate">{t.subject}</span>
                        <Badge variant="outline" className={cn("text-[9px]", STATUS_META[t.status].cls)}>{STATUS_META[t.status].label}</Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">Atualizado {new Date(t.updated_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </div>
        <div className="rounded-xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
          {selected ? <TicketConversation ticket={selected} viewer="requester" /> : (
            <div className="h-full min-h-[300px] flex items-center justify-center text-sm text-slate-500 p-8 text-center">Selecione um chamado ou abra um novo.</div>
          )}
        </div>
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo chamado</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Assunto</Label><Input maxLength={200} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Resumo do problema" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Mensagem</Label><Textarea rows={5} maxLength={5000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Descreva o que está acontecendo" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button onClick={create} disabled={saving}>{saving && <Loader2 className="size-4 mr-1 animate-spin" />}Abrir chamado</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
