import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { MessageSquare, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { initials, timeAgo } from "@/lib/format";

export function InternalChat() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery({
    queryKey: ["chat-general"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, sender_id, content, created_at, recipient_id")
        .is("recipient_id", null)
        .order("created_at", { ascending: true })
        .limit(100);
      return data ?? [];
    },
    enabled: !!user,
  });

  const senderIds = Array.from(new Set((messages ?? []).map((m: any) => m.sender_id)));
  const { data: profiles } = useQuery({
    queryKey: ["chat-profiles", senderIds.join(",")],
    queryFn: async () => {
      if (senderIds.length === 0) return [];
      const { data } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", senderIds);
      return data ?? [];
    },
    enabled: senderIds.length > 0,
  });

  // Realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("chat-general-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: "recipient_id=is.null" },
        () => qc.invalidateQueries({ queryKey: ["chat-general"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, qc]);

  // Auto-scroll
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const send = async () => {
    if (!user || !draft.trim()) return;
    setSending(true);
    const { error } = await supabase
      .from("chat_messages")
      .insert({ sender_id: user.id, recipient_id: null, content: draft.trim() });
    setSending(false);
    if (!error) {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["chat-general"] });
    }
  };

  const profileFor = (id: string) => profiles?.find((p: any) => p.id === id);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="size-9 rounded-lg border border-border hover:bg-accent flex items-center justify-center transition-colors"
          aria-label="Chat interno"
        >
          <MessageSquare className="size-4 text-muted-foreground" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[440px] flex flex-col p-0">
        <SheetHeader className="p-5 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="size-4 text-primary" /> Chat da equipe
          </SheetTitle>
          <SheetDescription>Canal geral — visível para todos os colaboradores</SheetDescription>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {(messages ?? []).length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-12">
              Nenhuma mensagem ainda. Diga olá!
            </div>
          ) : (
            messages?.map((m: any) => {
              const isMine = m.sender_id === user?.id;
              const p = profileFor(m.sender_id);
              return (
                <div key={m.id} className={`flex gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
                  <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                    {initials(p?.full_name || "?")}
                  </div>
                  <div className={`max-w-[75%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                    <span className="text-[9.5px] text-muted-foreground">
                      {p?.full_name || "Usuário"} · {timeAgo(m.created_at)}
                    </span>
                    <div
                      className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                        isMine
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted text-foreground rounded-tl-sm"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-border flex items-center gap-2">
          <Input
            placeholder="Escreva uma mensagem..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            disabled={sending}
          />
          <Button size="sm" onClick={send} disabled={sending || !draft.trim()}>
            <Send className="size-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
