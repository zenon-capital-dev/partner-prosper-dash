import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Plus, Trash2, MessageSquare, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  taskId: string;
}

export function TaskDetailsExtras({ taskId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [newComment, setNewComment] = useState("");
  const [newItem, setNewItem] = useState("");

  const { data: comments = [], isLoading: lc } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_comments")
        .select("*, author:profiles!task_comments_author_id_fkey(full_name)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) {
        const r = await supabase.from("task_comments").select("*").eq("task_id", taskId).order("created_at");
        return r.data ?? [];
      }
      return data ?? [];
    },
  });

  const { data: items = [], isLoading: li } = useQuery({
    queryKey: ["task-checklist", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_checklist_items")
        .select("*")
        .eq("task_id", taskId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!newComment.trim() || !user) return;
      const { error } = await supabase.from("task_comments").insert({
        task_id: taskId, author_id: user.id, content: newComment.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment("");
      qc.invalidateQueries({ queryKey: ["task-comments", taskId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-comments", taskId] }),
  });

  const addItem = useMutation({
    mutationFn: async () => {
      if (!newItem.trim()) return;
      const { error } = await supabase.from("task_checklist_items").insert({
        task_id: taskId, label: newItem.trim(), position: items.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewItem("");
      qc.invalidateQueries({ queryKey: ["task-checklist", taskId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleItem = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("task_checklist_items").update({
        is_done: done,
        done_by: done ? user?.id ?? null : null,
        done_at: done ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-checklist", taskId] }),
  });

  const delItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_checklist_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-checklist", taskId] }),
  });

  const done = items.filter((i: any) => i.is_done).length;
  const progress = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div className="space-y-5 pt-2 border-t">
      {/* Sub-checklist */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <ListChecks className="size-4 text-primary" /> Sub-itens
          </h4>
          {items.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">{done}/{items.length} · {progress}%</span>
          )}
        </div>
        {items.length > 0 && (
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        {li ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <ul className="space-y-1">
            {items.map((it: any) => (
              <li key={it.id} className="flex items-center gap-2 group">
                <Checkbox
                  checked={it.is_done}
                  onCheckedChange={(v) => toggleItem.mutate({ id: it.id, done: !!v })}
                />
                <span className={cn("text-sm flex-1", it.is_done && "line-through text-muted-foreground")}>{it.label}</span>
                <Button
                  variant="ghost" size="icon"
                  className="size-6 opacity-0 group-hover:opacity-100 text-rose-500"
                  onClick={() => delItem.mutate(it.id)}
                ><Trash2 className="size-3" /></Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <Input
            value={newItem} onChange={(e) => setNewItem(e.target.value)}
            placeholder="Adicionar sub-item..." className="h-8 text-xs"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem.mutate(); } }}
          />
          <Button size="sm" variant="outline" onClick={() => addItem.mutate()} disabled={!newItem.trim()}>
            <Plus className="size-3" />
          </Button>
        </div>
      </section>

      {/* Comentários */}
      <section className="space-y-2">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="size-4 text-primary" /> Comentários ({comments.length})
        </h4>
        {lc ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {comments.map((c: any) => (
              <li key={c.id} className="rounded-md border bg-muted/30 p-2 text-xs group">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold">{c.author?.full_name || "Usuário"}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{formatDate(c.created_at)}</span>
                    {c.author_id === user?.id && (
                      <Button variant="ghost" size="icon" className="size-5 opacity-0 group-hover:opacity-100 text-rose-500"
                        onClick={() => delComment.mutate(c.id)}>
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="whitespace-pre-wrap">{c.content}</p>
              </li>
            ))}
            {comments.length === 0 && <p className="text-xs text-muted-foreground">Nenhum comentário ainda.</p>}
          </ul>
        )}
        <div className="flex gap-2">
          <Textarea
            value={newComment} onChange={(e) => setNewComment(e.target.value)}
            rows={2} placeholder="Escrever comentário..." className="text-xs resize-none"
          />
          <Button size="sm" onClick={() => addComment.mutate()} disabled={!newComment.trim() || addComment.isPending}>
            Enviar
          </Button>
        </div>
      </section>
    </div>
  );
}
