import { useState, useMemo, useEffect } from "react";
import { nowBR } from "@/lib/datetime";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Lock, ShieldAlert, Users, User, Sparkles, Send, AtSign } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Visibility = "internal" | "admin" | "provider" | "client" | "system";

const VIS_META: Record<Visibility, { label: string; tone: string; icon: any; description: string }> = {
  internal: { label: "Interno Zenon", tone: "bg-slate-100 text-slate-700 border-slate-200", icon: Lock, description: "Apenas equipe Zenon" },
  admin: { label: "Admin", tone: "bg-rose-50 text-rose-700 border-rose-200", icon: ShieldAlert, description: "Apenas administradores" },
  provider: { label: "Prestador", tone: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: Users, description: "Visível para Zenon e prestador" },
  client: { label: "Cliente", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: User, description: "Visível para o cliente" },
  system: { label: "Sistema", tone: "bg-blue-50 text-blue-700 border-blue-200", icon: Sparkles, description: "Eventos automáticos" },
};

interface Props {
  clientProductId: string;
  role: "admin" | "provider" | "client";
}

export function DemandComments({ clientProductId, role }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const visKey = `demand-comment-vis:${role}:${clientProductId}`;
  // Persist a última visibilidade escolhida por demanda/role (padrão: "client" para todos exceto admin)
  const [visibility, setVisibility] = useState<Visibility>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(visKey) as Visibility | null;
      if (stored) return stored;
    }
    return role === "admin" ? "internal" : "client";
  });
  useEffect(() => {
    try { window.localStorage.setItem(visKey, visibility); } catch {}
  }, [visibility, visKey]);
  const [filter, setFilter] = useState<"all" | Visibility>("all");
  const [submitting, setSubmitting] = useState(false);

  // Available visibility options based on role
  const availableVisibilities: Visibility[] = useMemo(() => role === "admin"
    ? ["internal", "provider", "client"]
    : role === "provider"
      ? ["provider"]
      : ["client"], [role]);


  useEffect(() => {
    if (availableVisibilities.includes(visibility)) return;
    setVisibility(role === "admin" ? "internal" : "client");
  }, [availableVisibilities, role, visibility]);

  const { data: comments = [] } = useQuery({
    queryKey: ["demand-comments", clientProductId],
    queryFn: async () => {
      const { data } = await supabase
        .from("demand_comments")
        .select("*")
        .eq("client_product_id", clientProductId)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!clientProductId) return;
    const channel = supabase
      .channel(`demand-comments:${clientProductId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "demand_comments",
          filter: `client_product_id=eq.${clientProductId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["demand-comments", clientProductId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientProductId, qc]);

  // Resolve author profiles
  const authorIds = useMemo(() => Array.from(new Set(comments.map((c: any) => c.author_id).filter(Boolean))), [comments]);
  const { data: authors = [] } = useQuery({
    queryKey: ["demand-comments-authors", authorIds],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const [{ data: profs }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", authorIds),
        supabase.from("user_roles").select("user_id, role").in("user_id", authorIds),
      ]);
      const roleMap = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });
      return (profs ?? []).map((p: any) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
    },
  });
  const authorMap = useMemo(() => {
    const m = new Map<string, any>();
    authors.forEach((a: any) => m.set(a.id, a));
    return m;
  }, [authors]);

  const resolveAuthorLabel = (author: any) => {
    if (author?.full_name && author.full_name.trim()) return author.full_name;
    const roles: string[] = author?.roles ?? [];
    if (roles.some((r) => ["admin", "super_admin", "admin_secondary"].includes(r))) return "Zenon · Operacional";
    if (roles.includes("colaborador")) return "Time Operacional";
    if (roles.includes("prestador")) return "Prestador";
    if (roles.includes("parceiro")) return "Parceiro";
    if (roles.includes("cliente")) return "Cliente";
    if (author?.email) return author.email.split("@")[0];
    return "Sistema";
  };


  const filtered = useMemo(() => {
    if (filter === "all") return comments;
    return comments.filter((c: any) => c.visibility === filter);
  }, [comments, filter]);

  const submit = async () => {
    if (!content.trim()) return toast.error("Escreva um comentário");
    let authorId = user?.id;
    if (!authorId) {
      const { getCurrentUserId } = await import("@/lib/current-user");
      authorId = (await getCurrentUserId()) ?? undefined;
    }
    if (!authorId) return toast.error("Sua sessão expirou. Faça login novamente.");
    setSubmitting(true);
    const { error } = await supabase.from("demand_comments").insert({
      client_product_id: clientProductId,
      author_id: authorId,
      content: content.trim(),
      visibility,
      created_at: nowBR().toISOString(),
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success(visibility === "client" ? "Comentário publicado e visível para o cliente" : "Comentário publicado");
    setContent("");
    qc.invalidateQueries({ queryKey: ["demand-comments", clientProductId] });
  };

  const renderContent = (text: string) => {
    // Highlight @mentions
    const parts = text.split(/(@[A-Za-z0-9_.\-]{2,40})/g);
    return parts.map((p, i) =>
      p.startsWith("@") ? (
        <span key={i} className="font-semibold text-primary bg-primary/10 px-1 rounded">{p}</span>
      ) : (
        <span key={i}>{p}</span>
      )
    );
  };

  const countBy = (v: string) => comments.filter((c: any) => c.visibility === v).length;
  const filterLabel = filter === "all" ? "" : (VIS_META[filter as Visibility]?.label ?? filter);

  return (
    <div className="space-y-6">
      {/* Filters */}
      {role !== "client" && (
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList className="bg-muted/40 flex-wrap h-auto">
            <TabsTrigger value="all" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Todos <span className="ml-1 text-[10px] text-muted-foreground">({comments.length})</span>
            </TabsTrigger>
            {availableVisibilities.map((v) => (
              <TabsTrigger key={v} value={v} className="text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                {VIS_META[v].label} <span className="text-[10px] text-muted-foreground">({countBy(v)})</span>
              </TabsTrigger>
            ))}
            <TabsTrigger value="system" className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm">
              Sistema <span className="ml-1 text-[10px] text-muted-foreground">({countBy("system")})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Thread */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/60 to-white shadow-sm overflow-hidden">
        <div className="max-h-[560px] overflow-y-auto px-4 sm:px-6 py-6 space-y-5 scrollbar-thin">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <MessageSquare className="size-5 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {filter === "all" ? "Nenhum comentário ainda" : `Nenhum comentário em "${filterLabel}"`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Inicie a conversa no campo abaixo.</p>
            </div>
          ) : (
            filtered.map((c: any) => {
              const meta = VIS_META[c.visibility as Visibility] ?? VIS_META.client;
              const Icon = meta.icon;
              const author = authorMap.get(c.author_id);
              const authorName = resolveAuthorLabel(author);
              const initials = authorName.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() || "?";
              const isMine = c.author_id === user?.id;
              const isRestricted = c.visibility === "internal" || c.visibility === "admin";

              return (
                <div key={c.id} className={cn("flex gap-2.5 items-end", isMine ? "flex-row-reverse" : "flex-row")}>
                  <div className={cn(
                    "size-8 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 shadow-sm border",
                    isMine ? "bg-primary text-primary-foreground border-primary/20" : "bg-white text-slate-700 border-slate-200"
                  )}>
                    {initials}
                  </div>
                  <div className={cn("flex flex-col gap-1 min-w-0 max-w-[calc(100%-3rem)] sm:max-w-[75%]", isMine ? "items-end" : "items-start")}>
                    <div className={cn("flex items-center gap-1.5 text-[11px] px-1 flex-wrap", isMine ? "flex-row-reverse" : "")}>
                      <span className="font-semibold text-foreground truncate max-w-[160px]">{isMine ? "Você" : authorName}</span>
                      <Badge variant="outline" className={cn("text-[9px] uppercase tracking-wider gap-1 py-0 h-4 font-semibold", meta.tone)}>
                        <Icon className="size-2.5" /> {meta.label}
                      </Badge>
                      <span className="text-muted-foreground font-mono text-[10px]">{formatDate(c.created_at)}</span>
                    </div>
                    <div className={cn(
                      "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm border max-w-full overflow-hidden",
                      isMine
                        ? "bg-primary text-primary-foreground border-primary rounded-br-sm"
                        : "bg-white text-foreground border-slate-200 rounded-bl-sm",
                      isRestricted && !isMine && "bg-rose-50/70 border-rose-200",
                      isRestricted && isMine && "bg-rose-600 border-rose-600",
                    )}>
                      {renderContent(c.content)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>


      {/* Composer */}
      <div className="vx-card p-4 space-y-3 bg-card/95 backdrop-blur border-primary/10 shadow-lg">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Visibilidade</span>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as Visibility)}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableVisibilities.map((v) => {
                  const m = VIS_META[v];
                  return (
                    <SelectItem key={v} value={v} className="text-xs">
                      <div className="flex items-center gap-2">
                        <m.icon className="size-3.5" />
                        <div>
                          <div className="font-bold">{m.label}</div>
                          <div className="text-[10px] text-muted-foreground">{m.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <AtSign className="size-3" /> use @nome para mencionar
          </div>
        </div>
        <Textarea
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={role === "client"
            ? "Escreva uma mensagem para a equipe..."
            : "Escreva um comentário, mencione com @nome..."}
          className="resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />
        <div className="flex items-center justify-end gap-2">
          <span className="text-[10px] text-muted-foreground mr-auto">⌘/Ctrl + Enter para enviar</span>
          <Button onClick={submit} disabled={submitting || !content.trim()} size="sm" className="gap-1.5">
            <Send className="size-3.5" /> {submitting ? "Enviando..." : "Publicar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
