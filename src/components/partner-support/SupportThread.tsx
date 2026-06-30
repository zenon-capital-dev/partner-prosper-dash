import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Send, Loader2, RotateCcw, Paperclip, X, FileText, Download, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { uploadStorageFileFast } from "@/lib/uploads";
import { downloadStorageFile } from "@/lib/download";

type Props = {
  ticket: any;
  viewerRole: "partner" | "admin";
  onChanged?: () => void;
};

const MAX_FILE_MB = 15;

export function SupportThread({ ticket, viewerRole, onChanged }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      if (!text && !file) throw new Error("Escreva uma mensagem ou anexe um arquivo");
      let attachment_path: string | null = null;
      let attachment_name: string | null = null;
      let attachment_mime: string | null = null;
      let attachment_size: number | null = null;
      if (file) {
        if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`Arquivo acima de ${MAX_FILE_MB}MB`);
        const partnerId = ticket.partner_id;
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${partnerId}/${ticket.id}/${Date.now()}_${safe}`;
        await uploadStorageFileFast("support-attachments", path, file);
        attachment_path = path;
        attachment_name = file.name;
        attachment_mime = file.type || null;
        attachment_size = file.size;
      }
      const { error } = await (supabase as any).from("partner_support_ticket_messages").insert({
        ticket_id: ticket.id,
        sender_role: viewerRole,
        sender_user_id: user?.id,
        body: text || (attachment_name ? `📎 ${attachment_name}` : ""),
        attachment_path,
        attachment_name,
        attachment_mime,
        attachment_size,
      });
      if (error) throw error;
      // Update ticket status + auto-assign admin on first reply
      if (viewerRole === "admin") {
        const patch: any = { status: "em_andamento", admin_responded_at: new Date().toISOString() };
        if (!ticket.assigned_to && user?.id) {
          patch.assigned_to = user.id;
          patch.assigned_at = new Date().toISOString();
        }
        await (supabase as any).from("partner_support_tickets").update(patch).eq("id", ticket.id);
      } else if (ticket.status === "fechado" || ticket.status === "resolvido") {
        await (supabase as any).from("partner_support_tickets").update({ status: "aberto" }).eq("id", ticket.id);
      }
    },
    onSuccess: () => {
      setBody("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
                attachment={m.attachment_path ? {
                  path: m.attachment_path,
                  name: m.attachment_name || "arquivo",
                  mime: m.attachment_mime || "",
                  size: m.attachment_size || 0,
                } : null}
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
          {file && (
            <div className="mx-1 mb-1 flex items-center gap-2 text-[12px] bg-slate-50 border border-slate-200 rounded px-2 py-1">
              <Paperclip className="size-3.5 text-slate-500" />
              <span className="truncate flex-1 text-slate-700">{file.name}</span>
              <span className="text-slate-400">{(file.size / 1024).toFixed(0)} KB</span>
              <button onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-slate-400 hover:text-rose-600">
                <X className="size-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 px-1 pt-1">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5 h-7 px-2 text-slate-600"
              >
                <Paperclip className="size-3.5" /> Anexar
              </Button>
              <div className="text-[10.5px] text-slate-400">{body.length}/2000</div>
            </div>
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
                disabled={send.isPending || (!body.trim() && !file)}
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

function Attachment({ path, name, mime, size }: { path: string; name: string; mime: string; size: number }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage = mime.startsWith("image/");

  useEffect(() => {
    if (!isImage) return;
    let revoked = false;
    let objectUrl: string | null = null;
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const url = `https://iptzhxbffiheclntoqlz.supabase.co/storage/v1/object/authenticated/support-attachments/${path}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!revoked) setPreviewUrl(objectUrl);
      } catch {/* ignore */}
    })();
    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, isImage]);

  const handleDownload = async () => {
    try {
      await downloadStorageFile("support-attachments", path, name);
    } catch (e: any) {
      toast.error(e.message || "Falha no download");
    }
  };

  return (
    <div className="mt-2">
      {isImage && previewUrl ? (
        <button onClick={handleDownload} className="block">
          <img src={previewUrl} alt={name} className="max-h-48 rounded border border-slate-200" />
        </button>
      ) : (
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px] hover:bg-slate-50"
        >
          {isImage ? <ImageIcon className="size-4 text-slate-500" /> : <FileText className="size-4 text-slate-500" />}
          <span className="truncate max-w-[180px]">{name}</span>
          <span className="text-slate-400 text-[10.5px]">{size ? `${(size / 1024).toFixed(0)} KB` : ""}</span>
          <Download className="size-3.5 text-slate-500" />
        </button>
      )}
    </div>
  );
}

function Bubble({ side, author, when, body, color, attachment }: {
  side: "left" | "right";
  author: string;
  when: string;
  body: string;
  color: "slate" | "indigo";
  attachment?: { path: string; name: string; mime: string; size: number } | null;
}) {
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
        {attachment && <Attachment {...attachment} />}
      </div>
    </div>
  );
}
