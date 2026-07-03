import { useState } from "react";
import { nowBR, toBR, isTodayBR } from "@/lib/datetime";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Plus, Trash2, ChevronDown, ChevronUp, Loader2, CheckCircle2, Clock,
  AlertOctagon, XCircle, PlayCircle, Eye, EyeOff, UserCog, Calendar
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

type StepStatus = "pendente" | "em_andamento" | "bloqueado" | "concluido" | "cancelado";

const STATUS_META: Record<StepStatus, { label: string; icon: any; cls: string }> = {
  pendente: { label: "Pendente", icon: Clock, cls: "bg-slate-100 text-slate-600 border-slate-200" },
  em_andamento: { label: "Em Andamento", icon: PlayCircle, cls: "bg-blue-50 text-blue-600 border-blue-200" },
  bloqueado: { label: "Bloqueado", icon: AlertOctagon, cls: "bg-amber-50 text-amber-600 border-amber-200" },
  concluido: { label: "Concluído", icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  cancelado: { label: "Cancelado", icon: XCircle, cls: "bg-rose-50 text-rose-600 border-rose-200" },
};

const RESPONSIBLE_LABEL: Record<string, string> = {
  admin: "Admin",
  provider: "Prestador",
  client: "Cliente",
};

interface Props {
  clientProductId: string;
  /** Role of viewer: admin can edit everything, provider can edit, client read-only */
  canEdit?: boolean;
  canManage?: boolean; // admin only: add/remove
}

export function OperationalChecklist({ clientProductId, canEdit = true, canManage = true }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: steps = [], isLoading } = useQuery({
    queryKey: ["op-checklist", clientProductId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_product_steps")
        .select("*")
        .eq("client_product_id", clientProductId)
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStep = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      // Auto-fill completed_at
      if (patch.status === "concluido" && !patch.completed_at) {
        patch.completed = true;
        patch.completed_at = nowBR().toISOString();
      } else if (patch.status && patch.status !== "concluido") {
        patch.completed = false;
        patch.completed_at = null;
      }
      const { error } = await supabase.from("client_product_steps").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["op-checklist", clientProductId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const addStep = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("client_product_steps").insert({
        client_product_id: clientProductId,
        label: "",
        position: steps.length,
        status: "pendente",
        is_visible_to_client: true,
        default_responsible: "provider",
      }).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["op-checklist", clientProductId] });
      if (data?.id) setExpanded((p) => ({ ...p, [data.id]: true }));
      toast.success("Etapa adicionada — digite o nome da etapa");
    },
    onError: (e: any) => toast.error(e.message),
  });


  const removeStep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_product_steps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["op-checklist", clientProductId] });
      toast.success("Etapa removida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const seedFromTemplate = useMutation({
    mutationFn: async () => {
      const { data: cp, error: cpErr } = await supabase
        .from("client_products")
        .select("product_id")
        .eq("id", clientProductId)
        .maybeSingle();
      if (cpErr) throw cpErr;
      if (!cp?.product_id) throw new Error("Demanda sem produto vinculado.");
      const { data: prod, error: prodErr } = await supabase
        .from("products")
        .select("standard_steps")
        .eq("id", cp.product_id)
        .maybeSingle();
      if (prodErr) throw prodErr;
      const template = (prod?.standard_steps ?? []) as any[];
      if (!template.length) {
        throw new Error("Este produto não tem checklist padrão. Cadastre em Produtos → Editar → Operacional.");
      }
      const rows = template.map((s: any, i: number) => ({
        client_product_id: clientProductId,
        label: typeof s === "string" ? s : (s.label || s.name || "Etapa"),
        position: steps.length + i,
        status: "pendente" as const,
        is_visible_to_client: true,
        default_responsible: "provider",
      }));
      const { error } = await supabase.from("client_product_steps").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["op-checklist", clientProductId] });
      toast.success(`${n} etapa(s) importada(s) do template do produto`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  }

  const completed = steps.filter((s: any) => s.status === "concluido").length;
  const progress = steps.length ? Math.round((completed / steps.length) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Header / Progress */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              Progresso da Operação
            </p>
            <span className="text-xs font-bold text-primary tabular-nums">{completed}/{steps.length} · {progress}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Steps */}
      {steps.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-2xl p-10 text-center space-y-4">
          <p className="text-sm text-muted-foreground">Nenhuma etapa do checklist configurada.</p>
          {canManage && (
            <Button onClick={() => addStep.mutate()} disabled={addStep.isPending} size="sm" className="gap-2">
              <Plus className="size-4" /> Adicionar primeira etapa
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {steps.map((step: any, idx: number) => {
            const status = (step.status || "pendente") as StepStatus;
            const meta = STATUS_META[status];
            const StatusIcon = meta.icon;
            const isExpanded = !!expanded[step.id];

            return (
              <div
                key={step.id}
                className={cn(
                  "vx-card bg-card border transition-all overflow-hidden",
                  status === "concluido" && "bg-emerald-500/[0.02] border-emerald-500/20",
                  status === "bloqueado" && "bg-amber-500/[0.02] border-amber-500/20",
                )}
              >
                <div className="p-4 flex items-start gap-3">
                  <span className={cn(
                    "size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                    status === "concluido" ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"
                  )}>
                    {status === "concluido" ? <CheckCircle2 className="size-4" /> : idx + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {canManage ? (
                          <Input
                            defaultValue={step.label || ""}
                            placeholder="Nome da etapa (ex: Coletar documentos)"
                            className={cn(
                              "h-8 text-sm font-bold border-transparent hover:border-border focus-visible:border-primary bg-transparent px-2 -ml-2",
                              status === "concluido" && "line-through text-muted-foreground"
                            )}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v !== (step.label || "")) {
                                updateStep.mutate({ id: step.id, patch: { label: v || "Sem nome" } });
                              }
                            }}
                            onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
                          />
                        ) : (
                          <h4 className={cn(
                            "text-sm font-bold leading-tight",
                            status === "concluido" && "line-through text-muted-foreground"
                          )}>
                            {step.label || "Sem nome"}
                          </h4>
                        )}
                        {step.description && !isExpanded && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{step.description}</p>
                        )}
                      </div>


                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={cn("h-6 text-[10px] font-bold uppercase gap-1 border", meta.cls)}>
                          <StatusIcon className="size-3" /> {meta.label}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => setExpanded((p) => ({ ...p, [step.id]: !p[step.id] }))}
                        >
                          {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Quick meta */}
                    <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">
                      {step.default_responsible && (
                        <span className="flex items-center gap-1">
                          <UserCog className="size-3" /> {RESPONSIBLE_LABEL[step.default_responsible] || step.default_responsible}
                        </span>
                      )}
                      {step.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" /> {formatDate(step.due_date)}
                        </span>
                      )}
                      <span className="flex items-center gap-1 ml-auto">
                        {step.is_visible_to_client ? (
                          <><Eye className="size-3 text-primary/70" /> Visível ao cliente</>
                        ) : (
                          <><EyeOff className="size-3" /> Interno</>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 ml-11 space-y-3 border-t border-border/40 mt-1">
                    {step.description && (
                      <p className="text-xs text-foreground/80 leading-relaxed pt-3">{step.description}</p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">Status</label>
                        <Select
                          value={status}
                          onValueChange={(v) => canEdit && updateStep.mutate({ id: step.id, patch: { status: v } })}
                          disabled={!canEdit}
                        >
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(STATUS_META) as StepStatus[]).map((k) => (
                              <SelectItem key={k} value={k}>{STATUS_META[k].label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">Data Prevista</label>
                        <Input
                          type="date"
                          className="h-9 text-xs"
                          disabled={!canEdit}
                          defaultValue={step.due_date ? new Date(step.due_date).toISOString().slice(0, 10) : ""}
                          onBlur={(e) => {
                            const v = e.target.value ? new Date(e.target.value).toISOString() : null;
                            if (v !== step.due_date) updateStep.mutate({ id: step.id, patch: { due_date: v } });
                          }}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">Conclusão</label>
                        <Input
                          className="h-9 text-xs bg-muted/30"
                          readOnly
                          value={step.completed_at ? formatDate(step.completed_at) : "—"}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">Observações</label>
                      <Textarea
                        rows={2}
                        defaultValue={step.notes ?? ""}
                        disabled={!canEdit}
                        className="text-xs resize-none"
                        placeholder="Anotações sobre o andamento desta etapa..."
                        onBlur={(e) => {
                          if ((step.notes ?? "") !== e.target.value) {
                            updateStep.mutate({ id: step.id, patch: { notes: e.target.value } });
                          }
                        }}
                      />
                    </div>

                    {canManage && (
                      <div className="flex items-center justify-between pt-2 border-t border-border/30">
                        <div className="flex items-center gap-3">
                          <Select
                            value={step.default_responsible || "provider"}
                            onValueChange={(v) => updateStep.mutate({ id: step.id, patch: { default_responsible: v } })}
                          >
                            <SelectTrigger className="h-8 text-[11px] w-[140px]">
                              <UserCog className="size-3 mr-1" />
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="provider">Prestador</SelectItem>
                              <SelectItem value="client">Cliente</SelectItem>
                            </SelectContent>
                          </Select>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-[11px] gap-1.5"
                            onClick={() => updateStep.mutate({ id: step.id, patch: { is_visible_to_client: !step.is_visible_to_client } })}
                          >
                            {step.is_visible_to_client ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                            {step.is_visible_to_client ? "Visível ao cliente" : "Interno"}
                          </Button>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 gap-1.5"
                          onClick={() => removeStep.mutate(step.id)}
                        >
                          <Trash2 className="size-3" /> Remover
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canManage && (
        <Button
          variant="outline"
          className="w-full gap-2 border-dashed h-11"
          onClick={() => addStep.mutate()}
          disabled={addStep.isPending}
        >
          <Plus className="size-4" /> Adicionar Etapa
        </Button>
      )}
    </div>
  );
}
