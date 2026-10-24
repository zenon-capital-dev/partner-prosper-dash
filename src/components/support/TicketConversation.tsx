import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { STATUS_META, SupportMessage, SupportTicket, categoryLabel } from "./supportShared";

interface Props {
  ticket: SupportTicket;
  viewer: "admin" | "requester";
  headerExtra?: React.ReactNode;
}

/** Conversa de um chamado de suporte (usada pelo usuário e pelo admin). */
export function TicketConversation({ ticket, viewer, headerExtra }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const closed = ticket.status === "fechado" || ticket.status === "resolvido";
  const key = ["support-msgs", ticket.id];

  const { data: messages = [], isLoading } = useQuery({
    queryKey: key,
    refetchInterval: 15000,
    queryFn: async (): Promise<SupportMessage[]> => {
      const { data, error } = await (supabase as any).from("support_ticket_messages")
        .select("*").eq("ticket_id", ticket.id).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  async function send() {
    const text = body.trim();
    if (!text) return;
    if (text.length > 5000) { toast.error("Mensagem muito longa"); return; }
    setSending(true);
    const { error } = await (supabase as any).from("support_ticket_messages").insert({
      ticket_id: ticket.id, sender_user_id: user?.id, sender_role: viewer, body: text,
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setBody("");
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["support-tickets"] });
  }

  const st = STATUS_META[ticket.status];
  return (
    <div className="flex flex-col h-full min-h-[420px]">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 truncate">{ticket.subject}</h3>
          <p className="text-xs text-slate-500">{categoryLabel(ticket.category)} · prioridade {ticket.priority}</p>
        </div>
        <Badge variant="outline" className={cn("text-[10px]", st.cls)}>{st.label}</Badge>
        {headerExtra}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 max-h-[55dvh]">
        {isLoading ? <Loader2 className="size-5 animate-spin mx-auto text-slate-400" /> : messages.map((m) => {
          const mine = m.sender_role === viewer;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm whitespace-pre-wrap break-words",
                mine ? "bg-indigo-600 text-white rounded-br-sm" : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm")}>
                {!mine && <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60 mb-0.5">{m.sender_role === "admin" ? "Equipe" : "Solicitante"}</p>}
                {m.body}
                <p className={cn("text-[10px] mt-1", mine ? "text-indigo-100" : "text-slate-400")}>
                  {new Date(m.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {closed && viewer === "requester" ? (
        <p className="p-3 text-center text-xs text-slate-500 border-t">Chamado encerrado. Abra um novo se precisar.</p>
      ) : (
        <div className="p-3 border-t border-slate-100 flex gap-2 items-end">
          <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escreva sua mensagem…"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }} className="resize-none" />
          <Button onClick={send} disabled={sending || !body.trim()} aria-label="Enviar">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
