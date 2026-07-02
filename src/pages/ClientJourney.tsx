import { useMemo, useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { Plus, GripVertical, Settings, ChevronRight, Search, ExternalLink, Filter, History, TrendingUp, Wallet, Users } from "lucide-react";
import { initials, formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FilterPresets } from "@/components/filters/FilterPresets";
import { StageFilterBar } from "@/components/filters/StageFilterBar";
import { useSharedStageFilter } from "@/hooks/useSharedStageFilter";
import { deriveClientStatusFromStageName, invalidateJourneyStageCaches } from "@/lib/journey-stage-sync";
import { paymentReceivedAmount, paymentOutstandingAmount, saleIsFinalized } from "@/lib/financial";


interface Stage { id: string; name: string; position: number; color: string; description?: string | null; }
interface Client { id: string; full_name: string; status: string; journey_stage_id: string | null; company?: string | null; }
interface StageHistoryRow { id: string; from_stage_name: string | null; to_stage_name: string | null; changed_at: string; changed_by: string | null; }


export default function ClientJourney() {
  const qc = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [newStage, setNewStage] = useState({ name: "", color: "#6366f1", description: "" });
  const [search, setSearch] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const FKEY = "journey:visible-stages:v1";
  const [visibleStages, setVisibleStages] = useState<Set<string> | null>(() => {
    try {
      const raw = localStorage.getItem(FKEY);
      if (!raw) return null;
      const arr = JSON.parse(raw) as string[];
      return new Set(arr);
    } catch { return null; }
  });
  const [showUnassigned, setShowUnassigned] = useState<boolean>(() => {
    try { return localStorage.getItem("journey:show-unassigned:v1") !== "0"; } catch { return true; }
  });
  useEffect(() => {
    try {
      if (visibleStages) localStorage.setItem(FKEY, JSON.stringify(Array.from(visibleStages)));
      else localStorage.removeItem(FKEY);
      localStorage.setItem("journey:show-unassigned:v1", showUnassigned ? "1" : "0");
    } catch {}
  }, [visibleStages, showUnassigned]);


  const { data: stages = [] } = useQuery<Stage[]>({
    queryKey: ["journey-stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_journey_stages")
        .select("id, name, position, color, description, is_terminal, is_captation")
        .eq("active", true)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["journey-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, status, journey_stage_id, company")
        .order("full_name")
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Client[];
    },
    staleTime: 60_000,
  });

  const { data: salesRaw = [] } = useQuery({
    queryKey: ["journey-sales-agg"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, client_id, amount, status")
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const { data: paymentsRaw = [] } = useQuery({
    queryKey: ["journey-payments-agg"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, client_id, amount, amount_paid, status, paid_at, due_date")
        .limit(3000);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  // Agrega por cliente: vendas realizadas + pagamentos pendentes/a receber
  const clientAgg = useMemo(() => {
    const m = new Map<string, { salesValue: number; salesCount: number; pending: number; pendingCount: number }>();
    (salesRaw as any[]).forEach((s) => {
      if (!s.client_id || !saleIsFinalized(s)) return;
      const cur = m.get(s.client_id) ?? { salesValue: 0, salesCount: 0, pending: 0, pendingCount: 0 };
      cur.salesValue += Number(s.amount || 0);
      cur.salesCount += 1;
      m.set(s.client_id, cur);
    });
    (paymentsRaw as any[]).forEach((p) => {
      if (!p.client_id) return;
      const received = paymentReceivedAmount(p);
      const outstanding = paymentOutstandingAmount(p);
      const isReallyPending = outstanding > 0 && received < Number(p.amount || 0);
      if (!isReallyPending) return;
      const cur = m.get(p.client_id) ?? { salesValue: 0, salesCount: 0, pending: 0, pendingCount: 0 };
      cur.pending += outstanding;
      cur.pendingCount += 1;
      m.set(p.client_id, cur);
    });
    return m;
  }, [salesRaw, paymentsRaw]);

  const [historyClient, setHistoryClient] = useState<Client | null>(null);


  const { stageIds: sharedStageIds } = useSharedStageFilter();
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = clients;
    if (sharedStageIds.length > 0) {
      list = list.filter((c) => c.journey_stage_id && sharedStageIds.includes(c.journey_stage_id));
    }
    if (!q) return list;
    return list.filter((c) =>
      (c.full_name || "").toLowerCase().includes(q) ||
      (c.company || "").toLowerCase().includes(q),
    );
  }, [clients, search, sharedStageIds]);

  const byStage = useMemo(() => {
    const map = new Map<string, Client[]>();
    stages.forEach((s) => map.set(s.id, []));
    const unassigned: Client[] = [];
    filtered.forEach((c) => {
      if (c.journey_stage_id && map.has(c.journey_stage_id)) map.get(c.journey_stage_id)!.push(c);
      else unassigned.push(c);
    });
    return { map, unassigned };
  }, [stages, filtered]);

  const moveClient = useCallback(async (clientId: string, stageId: string | null) => {
    const stageName = stages.find((s) => s.id === stageId)?.name ?? "Sem estágio";
    const derivedStatus = deriveClientStatusFromStageName(stageName);
    // snapshot para rollback e otimista
    const previous = qc.getQueryData<Client[]>(["journey-clients"]);
    const previousStageMap = qc.getQueryData<Map<string, string | null>>(["client-stage-map"]);
    qc.setQueryData<Client[]>(["journey-clients"], (old) =>
      old?.map((c) => (c.id === clientId ? { ...c, journey_stage_id: stageId, status: derivedStatus ?? c.status } : c)),
    );
    qc.setQueryData<Map<string, string | null>>(["client-stage-map"], (old) => {
      if (!old) return old;
      const next = new Map(old);
      next.set(clientId, stageId);
      return next;
    });
    const { error } = await supabase.from("clients").update({ journey_stage_id: stageId } as any).eq("id", clientId);
    if (error) {
      toast.error(error.message);
      if (previous) qc.setQueryData(["journey-clients"], previous);
      if (previousStageMap) qc.setQueryData(["client-stage-map"], previousStageMap);
      else qc.invalidateQueries({ queryKey: ["journey-clients"] });
    } else {
      toast.success(`Movido para "${stageName}"${derivedStatus ? ` · status ${statusLabel(derivedStatus)}` : ""}`);
      invalidateJourneyStageCaches(qc, clientId);
    }
  }, [qc, stages]);

  const nextStageOf = (current: string | null) => {
    if (!current) return stages[0]?.id ?? null;
    const idx = stages.findIndex((s) => s.id === current);
    if (idx < 0 || idx >= stages.length - 1) return null;
    return stages[idx + 1].id;
  };

  const addStage = async () => {
    if (!newStage.name.trim()) { toast.error("Informe o nome"); return; }
    const pos = (stages[stages.length - 1]?.position ?? 0) + 1;
    const { error } = await supabase.from("client_journey_stages").insert({
      name: newStage.name.trim(),
      color: newStage.color,
      description: newStage.description.trim() || null,
      position: pos,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Estágio criado");
    setNewStage({ name: "", color: "#6366f1", description: "" });
    qc.invalidateQueries({ queryKey: ["journey-stages"] });
  };

  const deleteStage = async (id: string) => {
    if (!confirm("Excluir este estágio? Os clientes nele ficarão sem estágio.")) return;
    const { error } = await supabase.from("client_journey_stages").update({ active: false } as any).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["journey-stages"] });
  };

  const handleDrop = (stageId: string | null) => {
    if (dragId) moveClient(dragId, stageId);
    setDragId(null);
    setDragOver(null);
  };

  const totalShown = filtered.length;
  const totalAll = clients.length;

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Esteira de atendimento"
        description="Arraste o cliente entre as colunas ou clique em ✓ para avançar ao próximo estágio."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className="pl-8 h-9 text-sm bg-white"
              />
            </div>
            <StageFilterBar />
            <FilterPresets
              scope="journey"
              getState={() => ({
                search,
                visibleStages: visibleStages ? Array.from(visibleStages) : null,
                showUnassigned,
              })}
              applyState={(s) => {
                setSearch(s.search ?? "");
                setVisibleStages(s.visibleStages ? new Set(s.visibleStages) : null);
                setShowUnassigned(s.showUnassigned ?? true);
              }}
              currentSignature={JSON.stringify({
                search,
                visibleStages: visibleStages ? Array.from(visibleStages) : null,
                showUnassigned,
              })}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="relative">
                  <Filter className="size-4 mr-1" /> Filtrar colunas
                  {visibleStages && (
                    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-indigo-600 text-white text-[10px] font-semibold h-4 min-w-4 px-1">
                      {visibleStages.size}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-700">Colunas visíveis</p>
                  <button
                    type="button"
                    onClick={() => { setVisibleStages(null); setShowUnassigned(true); }}
                    className="text-[11px] text-indigo-600 hover:underline"
                  >
                    Mostrar todas
                  </button>
                </div>
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer p-1 rounded hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={showUnassigned}
                      onChange={(e) => setShowUnassigned(e.target.checked)}
                    />
                    <span className="inline-block size-2.5 rounded-full bg-slate-400" />
                    Sem estágio
                  </label>
                  {stages.map((s) => {
                    const checked = !visibleStages || visibleStages.has(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer p-1 rounded hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setVisibleStages((prev) => {
                              const base = prev ? new Set(prev) : new Set(stages.map((x) => x.id));
                              if (e.target.checked) base.add(s.id); else base.delete(s.id);
                              return base;
                            });
                          }}
                        />
                        <span className="inline-block size-2.5 rounded-full" style={{ background: s.color }} />
                        <span className="truncate">{s.name}</span>
                      </label>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" onClick={() => setEditorOpen(true)}>
              <Settings className="size-4 mr-1" /> Configurar
            </Button>
          </div>
        }

      />

      <p className="text-xs text-slate-500 mt-2 mb-4">
        Mostrando <span className="font-semibold text-slate-700">{totalShown}</span> de {totalAll} cliente{totalAll !== 1 ? "s" : ""}.
      </p>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {showUnassigned && byStage.unassigned.length > 0 && (
          <Column
            title="Sem estágio"
            color="#94a3b8"
            count={byStage.unassigned.length}
            isOver={dragOver === "__unassigned__"}
            onDragOver={(e) => { e.preventDefault(); setDragOver("__unassigned__"); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => handleDrop(null)}
          >
            {byStage.unassigned.map((c) => (
              <ClientCard
                key={c.id}
                client={c}
                stages={stages}
                nextStageId={nextStageOf(null)}
                onMove={moveClient}
                onDragStart={() => setDragId(c.id)}
                onDragEnd={() => { setDragId(null); setDragOver(null); }}
              />
            ))}
          </Column>
        )}
        {stages.filter((s) => !visibleStages || visibleStages.has(s.id)).map((stage) => {
          const list = byStage.map.get(stage.id) ?? [];
          return (
            <Column
              key={stage.id}
              title={stage.name}
              color={stage.color}
              count={list.length}
              isOver={dragOver === stage.id}
              onDragOver={(e) => { e.preventDefault(); setDragOver(stage.id); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => handleDrop(stage.id)}
            >
              {list.length === 0 ? (
                <p className="text-[11px] text-slate-400 text-center py-6">Solte um cliente aqui</p>
              ) : (
                list.map((c) => (
                  <ClientCard
                    key={c.id}
                    client={c}
                    stages={stages}
                    nextStageId={nextStageOf(stage.id)}
                    onMove={moveClient}
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => { setDragId(null); setDragOver(null); }}
                  />
                ))
              )}
            </Column>
          );
        })}
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Estágios da esteira</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <ul className="space-y-1.5 max-h-[40vh] overflow-y-auto">
              {stages.map((s) => (
                <li key={s.id} className="flex items-center gap-2 p-2 border border-slate-200 rounded">
                  <GripVertical className="size-4 text-slate-400" />
                  <Input
                    type="color"
                    value={s.color}
                    onChange={async (e) => {
                      await supabase.from("client_journey_stages").update({ color: e.target.value } as any).eq("id", s.id);
                      qc.invalidateQueries({ queryKey: ["journey-stages"] });
                      qc.invalidateQueries({ queryKey: ["journey-stages-mini"] });
                    }}
                    className="w-10 h-8 p-0.5"
                    title="Cor do estágio"
                  />
                  <Input
                    defaultValue={s.name}
                    onBlur={async (e) => {
                      const v = e.target.value.trim();
                      if (!v || v === s.name) return;
                      const { error } = await supabase.from("client_journey_stages").update({ name: v } as any).eq("id", s.id);
                      if (error) { toast.error(error.message); return; }
                      toast.success("Estágio renomeado");
                      qc.invalidateQueries({ queryKey: ["journey-stages"] });
                      qc.invalidateQueries({ queryKey: ["journey-stages-mini"] });
                    }}
                    className="flex-1 h-8 text-sm"
                  />
                  
                  <Button size="sm" variant="ghost" onClick={() => deleteStage(s.id)}>Remover</Button>
                </li>
              ))}
            </ul>

            <div className="border-t border-slate-200 pt-3 space-y-2">
              <p className="text-xs font-semibold text-slate-700">Adicionar estágio</p>
              <div className="grid grid-cols-[1fr,80px] gap-2">
                <Input placeholder="Nome do estágio" value={newStage.name} onChange={(e) => setNewStage({ ...newStage, name: e.target.value })} />
                <Input type="color" value={newStage.color} onChange={(e) => setNewStage({ ...newStage, color: e.target.value })} />
              </div>
              <Input placeholder="Descrição (opcional)" value={newStage.description} onChange={(e) => setNewStage({ ...newStage, description: e.target.value })} />
              <Button size="sm" onClick={addStage}><Plus className="size-3 mr-1" /> Adicionar</Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setEditorOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Column({
  title, color, count, children, isOver, onDragOver, onDragLeave, onDrop,
}: {
  title: string; color: string; count: number; children: React.ReactNode;
  isOver: boolean;
  onDragOver: React.DragEventHandler;
  onDragLeave: React.DragEventHandler;
  onDrop: React.DragEventHandler;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "min-w-[280px] w-[280px] bg-white border rounded-lg shadow-sm transition-colors flex flex-col",
        isOver ? "border-indigo-400 bg-indigo-50/40 ring-2 ring-indigo-200" : "border-slate-200",
      )}
    >
      <div
        className="p-3 border-b border-slate-200 flex items-center gap-2"
        style={{ borderTopColor: color, borderTopWidth: 3 }}
      >
        <span className="size-2.5 rounded-full" style={{ background: color }} />
        <p className="text-sm font-semibold text-slate-900 flex-1 truncate">{title}</p>
        <Badge variant="outline" className="bg-slate-50 text-slate-700 text-[10px]">{count}</Badge>
      </div>
      <div className="p-2 space-y-2 max-h-[70vh] overflow-y-auto flex-1">{children}</div>
    </div>
  );
}

function ClientCard({
  client, stages, nextStageId, onMove, onDragStart, onDragEnd,
}: {
  client: Client;
  stages: Stage[];
  nextStageId: string | null;
  onMove: (cid: string, sid: string | null) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const nextName = stages.find((s) => s.id === nextStageId)?.name;
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      className="p-2.5 bg-white border border-slate-200 rounded-md hover:border-indigo-300 hover:shadow-sm transition cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-2">
        <div className="size-7 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-[10px] font-semibold shrink-0">
          {initials(client.full_name)}
        </div>
        <div className="flex-1 min-w-0">
          <Link
            to={`/clientes/${client.id}`}
            className="block text-[13px] font-medium text-slate-900 hover:text-indigo-700 truncate"
          >
            {client.full_name}
          </Link>
          {client.company && (
            <p className="text-[10px] text-slate-500 truncate">{client.company}</p>
          )}
          <StatusPill status={client.status} />
        </div>
        <Link
          to={`/clientes/${client.id}`}
          className="text-slate-400 hover:text-indigo-600 shrink-0"
          title="Abrir cliente"
        >
          <ExternalLink className="size-3.5" />
        </Link>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <select
          className="text-[11px] border border-slate-200 rounded px-1.5 py-1 flex-1 bg-white hover:border-slate-300"
          value={client.journey_stage_id ?? ""}
          onChange={(e) => onMove(client.id, e.target.value || null)}
          title="Mover para outro estágio"
        >
          <option value="">— sem estágio —</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {nextStageId && (
          <button
            type="button"
            onClick={() => onMove(client.id, nextStageId)}
            className="inline-flex items-center gap-0.5 px-1.5 h-[26px] rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-semibold border border-emerald-200 shrink-0"
            title={`Avançar para "${nextName}"`}
          >
            <ChevronRight className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  ativo: "bg-blue-50 text-blue-700 border-blue-200",
  prospecto: "bg-amber-50 text-amber-700 border-amber-200",
  novo_cliente: "bg-sky-50 text-sky-700 border-sky-200",
  pagamento_pendente: "bg-orange-50 text-orange-700 border-orange-200",
  pagamento_confirmado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  em_andamento: "bg-indigo-50 text-indigo-700 border-indigo-200",
  finalizado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inativo: "bg-slate-100 text-slate-600 border-slate-200",
  cancelado: "bg-red-50 text-red-700 border-red-200",
};

function statusLabel(status?: string | null) {
  return status ? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Sem status";
}

function StatusPill({ status }: { status?: string | null }) {
  return (
    <span className={cn("mt-1 inline-flex w-fit rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider", STATUS_TONE[status || ""] || "bg-slate-50 text-slate-600 border-slate-200")}>
      {statusLabel(status)}
    </span>
  );
}
