import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SectionCard, EmptyState } from "@/components/panels/SectionCard";
import { HelpCircle, Plus, Send, CheckCircle2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<string, string> = {
  aberto: "bg-amber-50 text-amber-700 border-amber-200",
  em_andamento: "bg-sky-50 text-sky-700 border-sky-200",
  aguardando_cliente: "bg-indigo-50 text-indigo-700 border-indigo-200",
  resolvido: "bg-emerald-50 text-emerald-700 border-emerald-200",
  fechado: "bg-slate-100 text-slate-600 border-slate-200",
};

export function ClientSupportTab({ clientId, demandas }: { clientId: string; demandas: any[] }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [productId, setProductId] = useState<string>("geral");
  const [priority, setPriority] = useState("normal");

  const { data: tickets = [] } = useQuery({
    queryKey: ["client-support", clientId],
    enabled: !!clientId,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data } = await (supabase as any).from("client_support_tickets")
        .select("*, client_product:client_products(id, custom_product_name, products(name))")
        .eq("client_id", clientId).order("last_message_at", { ascending: false });
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!subject.trim() || !body.trim()) throw new Error("Preencha assunto e mensagem");
      const { data: ticket, error } = await (supabase as any).from("client_support_tickets").insert({
        client_id: clientId,
        client_product_id: productId === "geral" ? null : productId,
        subject: subject.trim(),
        priority,
        created_by: user?.id,
        status: "aberto",
      }).select().single();
      if (error) throw error;
      await (supabase as any).from("client_support_ticket_messages").insert({
        ticket_id: ticket.id, sender_id: user?.id, sender_role: "client", body: body.trim(),
      });
      return ticket;
    },
    onSuccess: () => {
      toast.success("Chamado aberto");
      setOpen(false); setSubject(""); setBody(""); setProductId("geral"); setPriority("normal");
      qc.invalidateQueries({ queryKey: ["client-support", clientId] });
    },
    onError: (e: any) => toast.error(e.message || "Falha ao abrir chamado"),
  });

  const selected = tickets.find((t: any) => t.id === selectedId);

  return (
    <div className="space-y-5">
      <SectionCard
        title="Meus chamados"
        icon={HelpCircle}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="size-4 mr-1.5" />Abrir chamado</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Novo chamado de suporte</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Vínculo</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="geral">Geral (sem serviço)</SelectItem>
                      {demandas.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.products?.name || d.custom_product_name || "Serviço"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Prioridade</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Assunto</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Resuma seu chamado" />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Descreva o que precisa" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={() => create.mutate()} disabled={create.isPending}>
                    {create.isPending ? "Enviando..." : "Abrir chamado"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      >
        {tickets.length === 0 ? (
          <EmptyState icon={MessageCircle} title="Nenhum chamado" description="Abra um chamado para falar com a equipe." />
        ) : (
          <ul className="divide-y divide-slate-100 -mx-1">
            {tickets.map((t: any) => (
              <li key={t.id}>
                <button type="button" onClick={() => setSelectedId(t.id)} className="w-full text-left px-3 py-3 hover:bg-slate-50 rounded-md">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13.5px] font-medium text-slate-900 truncate">{t.subject}</p>
                    <Badge variant="outline" className={cn("text-[10px] border capitalize", STATUS_TONE[t.status] || "bg-slate-100")}>{t.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="text-[11.5px] text-slate-500 mt-1">
                    {t.client_product?.products?.name || t.client_product?.custom_product_name || "Geral"} · atualizado {formatDate(t.last_message_at || t.created_at)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <Dialog open={!!selectedId} onOpenChange={(v) => !v && setSelectedId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.subject}</DialogTitle>
          </DialogHeader>
          {selected && <ClientTicketThread ticket={selected} clientId={clientId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientTicketThread({ ticket, clientId }: { ticket: any; clientId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const isClosed = ["fechado", "resolvido"].includes(ticket.status);

  const { data: messages = [] } = useQuery({
    queryKey: ["client-ticket-msg", ticket.id],
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
        ticket_id: ticket.id, sender_id: user?.id, sender_role: "client", body: body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["client-ticket-msg", ticket.id] });
      qc.invalidateQueries({ queryKey: ["client-support", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const close = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("client_support_tickets")
        .update({ status: "fechado", closed_at: new Date().toISOString() }).eq("id", ticket.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chamado concluído");
      qc.invalidateQueries({ queryKey: ["client-support", clientId] });
    },
  });

  return (
    <div className="space-y-3">
      <div className="max-h-[400px] overflow-y-auto border rounded-lg p-3 bg-slate-50/50 space-y-2">
        {messages.length === 0 && <p className="text-xs text-slate-500 text-center py-6">Sem mensagens ainda.</p>}
        {messages.map((m: any) => {
          const mine = m.sender_role === "client";
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[80%] rounded-lg px-3 py-2 text-[13px]", mine ? "bg-sky-600 text-white" : "bg-white border border-slate-200")}>
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={cn("text-[10px] mt-1", mine ? "text-sky-100" : "text-slate-400")}>
                  {mine ? "Você" : "Equipe"} · {formatDate(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {!isClosed ? (
        <>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Digite sua mensagem..." />
          <div className="flex justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => close.mutate()} disabled={close.isPending}>
              <CheckCircle2 className="size-4 mr-1.5" />Concluir chamado
            </Button>
            <Button size="sm" onClick={() => send.mutate()} disabled={send.isPending || !body.trim()}>
              <Send className="size-4 mr-1.5" />Enviar
            </Button>
          </div>
        </>
      ) : (
        <p className="text-center text-xs text-slate-500 py-2">Chamado {ticket.status}.</p>
      )}
    </div>
  );
}
