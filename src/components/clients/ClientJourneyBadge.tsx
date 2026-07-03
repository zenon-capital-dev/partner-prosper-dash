import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, CheckCircle2, Clock, Settings2, Plus, Trash2, History } from "lucide-react";
import { toast } from "sonner";
import { formatBR as format } from "@/lib/datetime";
import { parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { deriveClientStatusFromStageName, invalidateJourneyStageCaches } from "@/lib/journey-stage-sync";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  clientId: string;
  stageId: string | null;
}

export function ClientJourneyBadge({ clientId, stageId }: Props) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [managerOpen, setManagerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [newStage, setNewStage] = useState({ name: "", color: "#6366f1" });

  const { data: stages = [] } = useQuery({
    queryKey: ["journey-stages-mini"],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_journey_stages")
        .select("id, name, color, position")
        .eq("active", true)
        .order("position");
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: client } = useQuery({
    queryKey: ["client-closed-flag", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("is_closed, stage_changed_at" as any)
        .eq("id", clientId)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["client-stage-history", clientId],
    enabled: historyOpen,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_stage_history")
        .select("id, changed_at, from_stage_name, to_stage_name")
        .eq("client_id", clientId)
        .order("changed_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const current = stages.find((s: any) => s.id === stageId);

  const onChange = async (newId: string) => {
    if ((stageId ?? "") === (newId ?? "")) return;
    const nextStage = stages.find((s: any) => s.id === newId);
    const currentName = current?.name ?? "Sem estágio";
    const nextName = nextStage?.name ?? "Sem estágio";
    if (!window.confirm(`Mover cliente de "${currentName}" para "${nextName}"?`)) return;
    const derivedStatus = deriveClientStatusFromStageName(nextStage?.name);
    qc.setQueryData(["client", clientId], (old: any) => old ? { ...old, journey_stage_id: newId || null, status: derivedStatus ?? old.status } : old);
    qc.setQueryData<Map<string, string | null>>(["client-stage-map"], (old) => {
      if (!old) return old;
      const next = new Map(old);
      next.set(clientId, newId || null);
      return next;
    });
    const { error } = await supabase.from("clients").update({ journey_stage_id: newId || null } as any).eq("id", clientId);
    if (error) toast.error(error.message);
    else {
      toast.success(`Estágio atualizado${derivedStatus ? ` · status ${derivedStatus.replace(/_/g, " ")}` : ""} · registrado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`);
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["client-closed-flag", clientId] });
      qc.invalidateQueries({ queryKey: ["client-timeline", clientId] });
      qc.invalidateQueries({ queryKey: ["client-stage-history", clientId] });
      invalidateJourneyStageCaches(qc, clientId);
    }
  };

  const addStage = async () => {
    const name = newStage.name.trim();
    if (!name) { toast.error("Informe o nome do estágio"); return; }
    const pos = ((stages[stages.length - 1] as any)?.position ?? 0) + 1;
    const { error } = await supabase.from("client_journey_stages").insert({
      name, color: newStage.color, position: pos,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Estágio criado");
    setNewStage({ name: "", color: "#6366f1" });
    qc.invalidateQueries({ queryKey: ["journey-stages-mini"] });
    qc.invalidateQueries({ queryKey: ["journey-stages"] });
  };

  const renameStage = async (id: string, name: string, oldName: string) => {
    const v = name.trim();
    if (!v || v === oldName) return;
    const { error } = await supabase.from("client_journey_stages").update({ name: v } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Estágio renomeado");
    qc.invalidateQueries({ queryKey: ["journey-stages-mini"] });
    qc.invalidateQueries({ queryKey: ["journey-stages"] });
  };

  const recolorStage = async (id: string, color: string) => {
    await supabase.from("client_journey_stages").update({ color } as any).eq("id", id);
    qc.invalidateQueries({ queryKey: ["journey-stages-mini"] });
    qc.invalidateQueries({ queryKey: ["journey-stages"] });
  };

  const removeStage = async (id: string) => {
    if (!window.confirm("Excluir este estágio? Clientes nele ficarão sem estágio.")) return;
    const { error } = await supabase.from("client_journey_stages").update({ active: false } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["journey-stages-mini"] });
    qc.invalidateQueries({ queryKey: ["journey-stages"] });
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Activity className="size-4 shrink-0 text-slate-400" />
      <select
        className="text-xs font-medium rounded-md border border-slate-200 bg-white px-2 py-1 cursor-pointer hover:border-indigo-300"
        value={stageId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        style={{ color: current?.color || "#475569" }}
      >
        <option value="">Sem estágio</option>
        {stages.map((s: any) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      {isAdmin && (
        <button
          type="button"
          onClick={() => setManagerOpen(true)}
          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-slate-500 hover:text-indigo-700 size-6 transition"
          title="Gerenciar estágios da esteira"
        >
          <Settings2 className="size-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={() => setHistoryOpen(true)}
        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-slate-500 hover:text-indigo-700 size-6 transition"
        title="Histórico de mudanças de estágio"
      >
        <History className="size-3.5" />
      </button>
      {client?.stage_changed_at && (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500"
          title="Última alteração de estágio"
        >
          <Clock className="size-3" />
          {format(parseISO(client.stage_changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </span>
      )}
      {client?.is_closed && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5">
          <CheckCircle2 className="size-3" /> Fechado
        </span>
      )}

      {/* Gerenciador de estágios */}
      <Dialog open={managerOpen} onOpenChange={setManagerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Estágios da esteira</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500 -mt-2">
            Personalize os estágios livremente. Cada mudança de cliente é registrada com data e alimenta a meta de <b>Movimentações na esteira</b>.
          </p>
          <ul className="space-y-1.5 max-h-[45vh] overflow-y-auto">
            {stages.map((s: any) => (
              <li key={s.id} className="flex items-center gap-2 p-2 border border-slate-200 rounded-md bg-white">
                <Input
                  type="color"
                  defaultValue={s.color}
                  onBlur={(e) => recolorStage(s.id, e.target.value)}
                  className="w-10 h-8 p-0.5 shrink-0"
                  title="Cor"
                />
                <Input
                  defaultValue={s.name}
                  onBlur={(e) => renameStage(s.id, e.target.value, s.name)}
                  className="flex-1 h-8 text-sm"
                />
                <Button size="icon" variant="ghost" onClick={() => removeStage(s.id)} title="Remover">
                  <Trash2 className="size-4 text-rose-600" />
                </Button>
              </li>
            ))}
          </ul>
          <div className="border-t border-slate-200 pt-3 space-y-2">
            <p className="text-xs font-semibold text-slate-700">Novo estágio</p>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={newStage.color}
                onChange={(e) => setNewStage({ ...newStage, color: e.target.value })}
                className="w-10 h-9 p-0.5 shrink-0"
              />
              <Input
                placeholder="Ex.: Negociação, Follow-up, Pós-venda…"
                value={newStage.name}
                onChange={(e) => setNewStage({ ...newStage, name: e.target.value })}
                className="flex-1 h-9 text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") addStage(); }}
              />
              <Button size="sm" onClick={addStage}>
                <Plus className="size-4 mr-1" /> Adicionar
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManagerOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Histórico */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Histórico de estágios</DialogTitle>
          </DialogHeader>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Nenhuma alteração registrada.</p>
          ) : (
            <ul className="space-y-2 max-h-[50vh] overflow-y-auto">
              {history.map((h: any) => (
                <li key={h.id} className="flex items-start gap-2 text-sm border-l-2 border-indigo-200 pl-3 py-1">
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-800">
                      <span className="text-slate-500">{h.from_stage_name ?? "Sem estágio"}</span>
                      {" → "}
                      <span className="font-semibold text-indigo-700">{h.to_stage_name ?? "Sem estágio"}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock className="size-3" />
                      {format(parseISO(h.changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
