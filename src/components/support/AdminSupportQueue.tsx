import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PRIORITY_CLS, RequesterRole, STATUS_META, SupportStatus, SupportTicket } from "./supportShared";
import { TicketConversation } from "./TicketConversation";

type Filter = "fila" | "meus" | "em_andamento" | "fechados" | "todos";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "fila", label: "Fila" }, { key: "meus", label: "Meus" },
  { key: "em_andamento", label: "Em andamento" }, { key: "fechados", label: "Fechados" }, { key: "todos", label: "Todos" },
];

/** Fila de chamados de colaboradores ou prestadores no painel admin. */
export function AdminSupportQueue({ role }: { role: RequesterRole }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("fila");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["support-tickets", "admin", role],
    refetchInterval: 30000,
    queryFn: async (): Promise<(SupportTicket & { requester_name?: string })[]> => {
      const { data, error } = await (supabase as any).from("support_tickets")
        .select("*").eq("requester_role", role).order("updated_at", { ascending: false });
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((t: SupportTicket) => t.requester_id))];
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", ids as string[])
        : { data: [] as any[] };
      const byId = new Map((profs ?? []).map((p: any) => [p.id, p.full_name || p.email]));
      return (data ?? []).map((t: SupportTicket) => ({ ...t, requester_name: byId.get(t.requester_id) }));
    },
  });

  const counts = useMemo(() => ({
    fila: tickets.filter((t) => t.status === "aberto").length,
    meus: tickets.filter((t) => t.assigned_to === user?.id && !["fechado", "resolvido"].includes(t.status)).length,
    em_andamento: tickets.filter((t) => t.status === "em_andamento").length,
    fechados: tickets.filter((t) => ["fechado", "resolvido"].includes(t.status)).length,
    todos: tickets.length,
  }), [tickets, user?.id]);

  const visible = tickets.filter((t) => {
    if (filter === "fila") return t.status === "aberto";
    if (filter === "meus") return t.assigned_to === user?.id && !["fechado", "resolvido"].includes(t.status);
    if (filter === "em_andamento") return t.status === "em_andamento";
    if (filter === "fechados") return ["fechado", "resolvido"].includes(t.status);
    return true;
  });
  const selected = tickets.find((t) => t.id === selectedId) ?? null;

  async function update(patch: Partial<SupportTicket>) {
    if (!selected) return;
    const { error } = await (supabase as any).from("support_tickets").update(patch).eq("id", selected.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["support-tickets"] });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 bg-white border border-slate-200/70 rounded-lg p-1 w-fit shadow-sm">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition flex items-center gap-1.5",
              filter === f.key ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50")}>
            {f.label}
            <span className={cn("text-[10px] px-1.5 rounded-full", filter === f.key ? "bg-white/20" : "bg-slate-100")}>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="rounded-xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
          {isLoading ? <div className="p-3 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
            : visible.length === 0 ? (
              <div className="p-10 text-center"><MessageSquare className="size-7 mx-auto text-slate-300" /><p className="text-sm mt-2 text-slate-500">Nenhum chamado neste filtro.</p></div>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-[65dvh] overflow-y-auto">
                {visible.map((t) => (
                  <li key={t.id}>
                    <button onClick={() => setSelectedId(t.id)} className={cn("w-full text-left px-4 py-3 hover:bg-slate-50", selectedId === t.id && "bg-indigo-50/60")}>
                      <div className="flex items-center gap-2">
                        <span className="flex-1 text-sm font-medium text-slate-900 truncate">{t.subject}</span>
                        <Badge variant="outline" className={cn("text-[9px]", STATUS_META[t.status].cls)}>{STATUS_META[t.status].label}</Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 flex gap-2">
                        <span className="truncate">{t.requester_name ?? "—"}</span>
                        <span className={PRIORITY_CLS[t.priority]}>· {t.priority}</span>
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </div>
        <div className="rounded-xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
          {selected ? (
            <TicketConversation ticket={selected} viewer="admin" headerExtra={
              <div className="flex items-center gap-2">
                {selected.assigned_to !== user?.id && (
                  <Button size="sm" variant="outline" className="h-8" onClick={() => update({ assigned_to: user?.id ?? null, status: selected.status === "aberto" ? "em_andamento" : selected.status })}>Assumir</Button>
                )}
                <Select value={selected.status} onValueChange={(v) => update({ status: v as SupportStatus })}>
                  <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(STATUS_META) as SupportStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            } />
          ) : <div className="min-h-[300px] flex items-center justify-center text-sm text-slate-500">Selecione um chamado.</div>}
        </div>
      </div>
    </div>
  );
}
