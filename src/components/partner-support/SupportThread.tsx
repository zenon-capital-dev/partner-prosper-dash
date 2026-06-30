import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Send, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

type Props = {
  ticket: any;
  viewerRole: "partner" | "admin";
  onChanged?: () => void;
};

export function SupportThread({ ticket, viewerRole, onChanged }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const isClosed = ticket.status === "fechado" || ticket.status === "resolvido";

  const messagesKey = ["partner-ticket-messages", ticket.id];
  const { data: messages = [], isLoading } = useQuery({
    queryKey: messagesKey,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("partner_support_ticket_messages")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const send = useMutation({
    mutationFn: async () => {
      const text = body.trim();
      if (!text) throw new Error("Escreva uma mensagem");
      const { error } = await (supabase as any).from("partner_support_ticket_messages").insert({
        ticket_id: ticket.id,
        sender_role: viewerRole,
        sender_user_id: user?.id,
        body: text,
      });
      if (error) throw error;
      // Update ticket status so the other side sees the new activity.
      if (viewerRole === "admin") {
        await (supabase as any).from("partner_support_tickets")
          .update({ status: "em_andamento", admin_responded_at: new Date().toISOString() })
          .eq("id", ticket.id);
      } else if (ticket.status === "fechado" || ticket.status === "resolvido") {
        await (supabase as any).from("partner_support_tickets").update({ status: "aberto" }).eq("id", ticket.id);
      }
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: messagesKey });
      onChanged?.();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao enviar"),
  });

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await (supabase as any)
        .from("partner_support_tickets")
        .update({ status })
        .eq("id", ticket.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chamado atualizado");
      onChanged?.();
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-slate-200 bg-white">
        <div className="max-h-[360px] overflow-y-auto p-3 space-y-3">
          {/* Original message as the first bubble */}
          <Bubble
            side="left"
            author={viewerRole === "admin" ? "Parceiro" : "Você"}
            when={ticket.created_at}
            body={ticket.message}
            color="slate"
          />
          {isLoading && <div className="text-[12px] text-slate-400">Carregando histórico…</div>}
          {messages.map((m: any) => {
            const mine = m.sender_role === viewerRole;
            const author =
              m.sender_role === "admin"
                ? viewerRole === "admin" ? "Você (equipe)" : "Equipe"
                : viewerRole === "partner" ? "Você" : "Parceiro";
            return (
              <Bubble
                key={m.id}
                side={mine ? "right" : "left"}
                author={author}
                when={m.created_at}
                body={m.body}
                color={m.sender_role === "admin" ? "indigo" : "slate"}
              />
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-slate-200 p-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder={isClosed && viewerRole === "partner"
              ? "Chamado concluído — envie uma mensagem para reabrir"
              : "Escreva sua mensagem…"}
            className="text-[13px] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <div className="flex items-center justify-between gap-2 px-1 pt-1">
            <div className="text-[10.5px] text-slate-400">{body.length}/2000</div>
            <div className="flex gap-2">
              {viewerRole === "partner" && !isClosed && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus.mutate("fechado")}
                  disabled={setStatus.isPending}
                  className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                >
                  <CheckCircle2 className="size-3.5" /> Concluir
                </Button>
              )}
              {viewerRole === "admin" && !isClosed && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus.mutate("fechado")}
                  disabled={setStatus.isPending}
                  className="gap-1.5"
                >
                  <CheckCircle2 className="size-3.5" /> Marcar fechado
                </Button>
              )}
              {viewerRole === "admin" && isClosed && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setStatus.mutate("aberto")}
                  disabled={setStatus.isPending}
                  className="gap-1.5"
                >
                  <RotateCcw className="size-3.5" /> Reabrir
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => send.mutate()}
                disabled={send.isPending || !body.trim()}
                className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"
              >
                {send.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                Enviar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ side, author, when, body, color }: { side: "left" | "right"; author: string; when: string; body: string; color: "slate" | "indigo" }) {
  return (
    <div className={cn("flex", side === "right" ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[85%] rounded-lg px-3 py-2 text-[13px] whitespace-pre-wrap border",
        color === "indigo" ? "bg-indigo-50 border-indigo-100 text-slate-800" : "bg-slate-50 border-slate-200 text-slate-800",
      )}>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">{author}</span>
          <span className="text-[10px] text-slate-400">{formatDate(when)}</span>
        </div>
        {body}
      </div>
    </div>
  );
}
