import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { LifeBuoy, MessageSquare, Hand, Send, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<string, string> = {
  aberto: "bg-amber-50 text-amber-700 border-amber-200",
  em_andamento: "bg-sky-50 text-sky-700 border-sky-200",
  aguardando_cliente: "bg-indigo-50 text-indigo-700 border-indigo-200",
  resolvido: "bg-emerald-50 text-emerald-700 border-emerald-200",
  fechado: "bg-slate-100 text-slate-600 border-slate-200",
};

type Filter = "fila" | "meus" | "pendentes" | "fechado" | "all";

export default function ClientSupportAdmin() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState<any | null>(null);
  const [filter, setFilter] = useState<Filter>("fila");

  const { data: tickets = [] } = useQuery({
    queryKey: ["client-support-admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("client_support_tickets")
        .select("*, clients(full_name, email), client_product:client_products(id, custom_product_name, products(name))")
        .order("last_message_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const isOpen = (s: string) => s !== "fechado" && s !== "resolvido";
  const filtered = (tickets as any[]).filter((t) => {
    if (filter === "all") return true;
    if (filter === "fila") return isOpen(t.status) && !t.assigned_to;
    if (filter === "meus") return isOpen(t.status) && t.assigned_to === user?.id;
    if (filter === "pendentes") return isOpen(t.status);
    if (filter === "fechado") return !isOpen(t.status);
    return true;
  });
  const counts = {
    fila: (tickets as any[]).filter((t) => isOpen(t.status) && !t.assigned_to).length,
    meus: (tickets as any[]).filter((t) => isOpen(t.status) && t.assigned_to === user?.id).length,
    pendentes: (tickets as any[]).filter((t) => isOpen(t.status)).length,
    fechado: (tickets as any[]).filter((t) => !isOpen(t.status)).length,
    all: tickets.length,
  };

  const assume = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("client_support_tickets")
        .update({ assigned_to: user?.id, status: "em_andamento" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Chamado assumido"); qc.invalidateQueries({ queryKey: ["client-support-admin"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-2">
        <LifeBuoy className="size-5 text-indigo-600" />
        <h1 className="text-xl font-semibold text-slate-900">Suporte de Clientes</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["fila", "meus", "pendentes", "fechado", "all"] as Filter[]).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "fila" ? "Fila" : f === "meus" ? "Meus" : f === "pendentes" ? "Pendentes" : f === "fechado" ? "Fechados" : "Todos"}
            <Badge variant="secondary" className="ml-2">{counts[f]}</Badge>
          </Button>
        ))}
      </div>

      <div className="bg-white border border-slate-200/70 rounded-lg divide-y divide-slate-100">
        {filtered.length === 0 && <div className="py-12 text-center text-sm text-slate-500">Nenhum chamado nesta visão.</div>}
        {filtered.map((t) => (
          <div key={t.id} className="p-4 flex items-start gap-3 hover:bg-slate-50">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[14px] font-semibold text-slate-900">{t.subject}</p>
                <Badge variant="outline" className={cn("text-[10px] border capitalize", STATUS_TONE[t.status])}>{t.status.replace(/_/g, " ")}</Badge>
                {t.priority && t.priority !== "normal" && <Badge variant="outline" className="text-[10px] capitalize">{t.priority}</Badge>}
              </div>
              <p className="text-[12px] text-slate-500 mt-1">
                {t.clients?.full_name || "Cliente"} · {t.client_product?.products?.name || t.client_product?.custom_product_name || "Geral"} · {formatDate(t.last_message_at || t.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!t.assigned_to && isOpen(t.status) && (
                <Button size="sm" variant="outline" onClick={() => assume.mutate(t.id)}><Hand className="size-3.5 mr-1" />Assumir</Button>
              )}
              <Button size="sm" onClick={() => setActive(t)}><MessageSquare className="size-3.5 mr-1" />Abrir</Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{active?.subject}</DialogTitle>
          </DialogHeader>
          {active && <AdminThread ticket={active} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AdminThread({ ticket }: { ticket: any }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [status, setStatus] = useState(ticket.status);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["client-ticket-msg-admin", ticket.id],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await (supabase as any).from("client_support_ticket_messages")
        .select("*").eq("ticket_id", ticket.id).order("created_at", { ascending: true });
      return data || [];
    },
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = useMutation({
    mutationFn: async () => {
      if (!body.trim()) return;
      const { error } = await (supabase as any).from("client_support_ticket_messages").insert({
        ticket_id: ticket.id, sender_id: user?.id, sender_role: "admin", body: body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => { setBody(""); qc.invalidateQueries({ queryKey: ["client-ticket-msg-admin", ticket.id] }); qc.invalidateQueries({ queryKey: ["client-support-admin"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const patch: any = { status: newStatus };
      if (newStatus === "fechado" || newStatus === "resolvido") patch.closed_at = new Date().toISOString();
      const { error } = await (supabase as any).from("client_support_tickets").update(patch).eq("id", ticket.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status atualizado"); qc.invalidateQueries({ queryKey: ["client-support-admin"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500">Cliente: <b className="text-slate-900">{ticket.clients?.full_name}</b></span>
        <span className="text-slate-500">· Serviço: {ticket.client_product?.products?.name || ticket.client_product?.custom_product_name || "Geral"}</span>
      </div>
      <div className="max-h-[400px] overflow-y-auto border rounded-lg p-3 bg-slate-50/50 space-y-2">
        {messages.length === 0 && <p className="text-xs text-slate-500 text-center py-6">Sem mensagens.</p>}
        {messages.map((m: any) => {
          const mine = m.sender_role === "admin";
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-lg px-3 py-2 text-[13px]", mine ? "bg-indigo-600 text-white" : "bg-white border border-slate-200")}>
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={cn("text-[10px] mt-1", mine ? "text-indigo-100" : "text-slate-400")}>
                  {mine ? "Equipe" : "Cliente"} · {formatDate(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Resposta ao cliente..." />
      <div className="flex items-center justify-between gap-2">
        <Select value={status} onValueChange={(v) => { setStatus(v); updateStatus.mutate(v); }}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="aberto">Aberto</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="aguardando_cliente">Aguardando cliente</SelectItem>
            <SelectItem value="resolvido">Resolvido</SelectItem>
            <SelectItem value="fechado">Fechado</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => send.mutate()} disabled={send.isPending || !body.trim()}>
          <Send className="size-4 mr-1.5" />Enviar
        </Button>
      </div>
    </div>
  );
}
