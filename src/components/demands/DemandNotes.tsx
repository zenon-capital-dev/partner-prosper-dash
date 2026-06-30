import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { StickyNote, Plus, Trash2, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { confirmAction } from "@/lib/confirm";

/**
 * Notas livres por demanda (client_product) — para o usuário lembrar contexto
 * de cada produto do cliente ("estou fazendo X com crédito", etc).
 * Persistido em public.notes.client_product_id.
 */
export function DemandNotes({
  clientProductId,
  clientId,
  compact = false,
}: {
  clientProductId: string;
  clientId?: string | null;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(true);

  const { data: notes = [], isLoading, error } = useQuery({
    queryKey: ["demand-notes", clientProductId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("id, content, created_at, created_by")
        .eq("client_product_id", clientProductId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((n: any) => n.created_by).filter(Boolean)));
      let map: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        map = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }
      return (data ?? []).map((n: any) => ({ ...n, author_name: map[n.created_by] ?? null }));
    },
    enabled: !!clientProductId,
  });

  const add = useMutation({
    mutationFn: async (content: string) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("notes").insert({
        content: content.trim(),
        client_product_id: clientProductId,
        client_id: clientId ?? null,
        created_by: u.user?.id,
        is_private: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      setAdding(false);
      toast.success("Nota salva");
      qc.invalidateQueries({ queryKey: ["demand-notes", clientProductId] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Nota removida");
      qc.invalidateQueries({ queryKey: ["demand-notes", clientProductId] });
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao remover"),
  });

  const submit = () => {
    const t = draft.trim();
    if (!t) return toast.error("Escreva algo na nota");
    add.mutate(t);
  };

  return (
    <div className={compact ? "" : "p-5"}>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 -ml-1 px-1 py-0.5 rounded hover:bg-slate-100 transition"
        >
          {open ? <ChevronDown className="size-3.5 text-slate-500" /> : <ChevronRight className="size-3.5 text-slate-500" />}
          <StickyNote className="size-3.5 text-amber-600" />
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
            Histórico / Notas desta demanda
          </h5>
          {notes.length > 0 && (
            <Badge variant="outline" className="h-5 text-[10px] bg-amber-50 text-amber-700 border-amber-200">
              {notes.length}
            </Badge>
          )}
        </button>
        {open && !adding && (
          <Button
            variant="ghost" size="sm"
            className="h-7 px-2 text-[11px] text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
            onClick={() => setAdding(true)}
          >
            <Plus className="size-3.5 mr-1" /> Nova nota
          </Button>
        )}
      </div>

      {open && (<>
      {error && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700">
          Não foi possível carregar as notas: {(error as any)?.message || "erro desconhecido"}
        </div>
      )}

      {adding && (
        <div className="mb-3 space-y-2 rounded-lg border border-amber-200/70 bg-amber-50/40 p-3">
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ex.: cliente pediu para tentar via crédito antes do financiamento; aguardando retorno do banco."
            className="text-[13px] min-h-[80px] bg-white"
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => { setAdding(false); setDraft(""); }}>
              Cancelar
            </Button>
            <Button
              size="sm" className="h-7 text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={submit} disabled={add.isPending}
            >
              {add.isPending ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
              Salvar nota
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-4 text-center text-[12px] text-slate-400">Carregando…</div>
      ) : notes.length === 0 ? (
        <div className="py-4 text-center text-[12px] text-slate-500">
          Nenhuma nota ainda. Use este espaço para registrar tratativas, decisões e lembretes desta demanda.
        </div>
      ) : (
        <ul className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
          {notes.map((n: any) => (
            <li key={n.id} className="group rounded-lg border border-slate-200/70 bg-white p-3 hover:border-amber-200">
              <p className="text-[13px] text-slate-800 whitespace-pre-wrap leading-relaxed">{n.content}</p>
              <div className="mt-2 flex items-center justify-between text-[10.5px] text-slate-500">
                <span className="font-mono">
                  {formatDate(n.created_at)} {n.profiles?.full_name ? `· ${n.profiles.full_name}` : ""}
                </span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 transition"
                  onClick={async () => { if (await confirmAction("Remover esta nota?")) remove.mutate(n.id); }}
                  title="Remover nota"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
