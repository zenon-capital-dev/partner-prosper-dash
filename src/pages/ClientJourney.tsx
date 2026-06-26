import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { Plus, GripVertical, Settings, ArrowRight } from "lucide-react";
import { initials } from "@/lib/format";

interface Stage { id: string; name: string; position: number; color: string; description?: string | null; }
interface Client { id: string; full_name: string; status: string; journey_stage_id: string | null; }

export default function ClientJourney() {
  const qc = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [newStage, setNewStage] = useState({ name: "", color: "#6366f1", description: "" });

  const { data: stages = [] } = useQuery<Stage[]>({
    queryKey: ["journey-stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_journey_stages")
        .select("id, name, position, color, description")
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
        .select("id, full_name, status, journey_stage_id")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  const byStage = useMemo(() => {
    const map = new Map<string, Client[]>();
    stages.forEach((s) => map.set(s.id, []));
    const unassigned: Client[] = [];
    clients.forEach((c) => {
      if (c.journey_stage_id && map.has(c.journey_stage_id)) map.get(c.journey_stage_id)!.push(c);
      else unassigned.push(c);
    });
    return { map, unassigned };
  }, [stages, clients]);

  const moveClient = async (clientId: string, stageId: string) => {
    const { error } = await supabase.from("clients").update({ journey_stage_id: stageId } as any).eq("id", clientId);
    if (error) toast.error(error.message);
    else {
      toast.success("Cliente movido");
      qc.invalidateQueries({ queryKey: ["journey-clients"] });
    }
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

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Esteira de atendimento"
        description="Acompanhe em qual estágio cada cliente está, do primeiro contato à entrega."
        actions={
          <Button variant="outline" size="sm" onClick={() => setEditorOpen(true)}>
            <Settings className="size-4 mr-1" /> Configurar estágios
          </Button>
        }
      />

      <div className="flex gap-3 overflow-x-auto pb-4 mt-4">
        {byStage.unassigned.length > 0 && (
          <div className="min-w-[260px] w-[260px] bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Sem estágio · {byStage.unassigned.length}</p>
            <div className="space-y-2">
              {byStage.unassigned.slice(0, 50).map((c) => (
                <ClientCard key={c.id} client={c} stages={stages} onMove={moveClient} />
              ))}
            </div>
          </div>
        )}
        {stages.map((stage) => {
          const list = byStage.map.get(stage.id) ?? [];
          return (
            <div key={stage.id} className="min-w-[280px] w-[280px] bg-white border border-slate-200 rounded-lg shadow-sm">
              <div className="p-3 border-b border-slate-200 flex items-center gap-2" style={{ borderTopColor: stage.color, borderTopWidth: 3 }}>
                <span className="size-2.5 rounded-full" style={{ background: stage.color }} />
                <p className="text-sm font-semibold text-slate-900 flex-1">{stage.name}</p>
                <Badge variant="outline" className="bg-slate-50 text-slate-700 text-[10px]">{list.length}</Badge>
              </div>
              <div className="p-2 space-y-2 max-h-[70vh] overflow-y-auto">
                {list.length === 0 ? (
                  <p className="text-[11px] text-slate-400 text-center py-4">Nenhum cliente</p>
                ) : (
                  list.map((c) => <ClientCard key={c.id} client={c} stages={stages} onMove={moveClient} />)
                )}
              </div>
            </div>
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
                  <span className="size-3 rounded-full" style={{ background: s.color }} />
                  <span className="flex-1 text-sm">{s.name}</span>
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

function ClientCard({ client, stages, onMove }: { client: Client; stages: Stage[]; onMove: (cid: string, sid: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-2.5 bg-white border border-slate-200 rounded-md hover:shadow-md transition group">
      <div className="flex items-center gap-2">
        <div className="size-7 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-[10px] font-semibold">
          {initials(client.full_name)}
        </div>
        <Link to={`/clientes/${client.id}`} className="text-[13px] font-medium text-slate-900 hover:text-indigo-700 truncate flex-1">
          {client.full_name}
        </Link>
      </div>
      <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        <select
          className="text-[11px] border border-slate-200 rounded px-1.5 py-1 flex-1 bg-white"
          value={client.journey_stage_id ?? ""}
          onChange={(e) => e.target.value && onMove(client.id, e.target.value)}
        >
          <option value="">Mover para...</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id} disabled={s.id === client.journey_stage_id}>{s.name}</option>
          ))}
        </select>
        <ArrowRight className="size-3 text-slate-400" />
      </div>
    </div>
  );
}
