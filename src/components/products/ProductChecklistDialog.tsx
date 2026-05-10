import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Plus, Trash2, GripVertical, ListChecks, Eye, EyeOff, UserCog, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string;
  productName: string;
}

type StepDraft = {
  id?: string;
  name: string;
  description: string;
  step_order: number;
  is_visible_to_client: boolean;
  default_responsible: string;
  default_due_offset_days?: number | null;
  _new?: boolean;
  _dirty?: boolean;
};

export function ProductChecklistDialog({ open, onOpenChange, productId, productName }: Props) {
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<StepDraft[]>([]);
  const [loaded, setLoaded] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ["product-steps-template", productId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_steps")
        .select("*")
        .eq("product_id", productId)
        .order("step_order", { ascending: true });
      if (error) throw error;
      setDrafts((data ?? []).map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description ?? "",
        step_order: s.step_order ?? 0,
        is_visible_to_client: s.is_visible_to_client ?? true,
        default_responsible: s.default_responsible ?? "provider",
        default_due_offset_days: s.default_due_offset_days,
      })));
      setLoaded(true);
      return data;
    },
  });

  const addStep = () => {
    setDrafts((prev) => [
      ...prev,
      {
        name: "",
        description: "",
        step_order: prev.length,
        is_visible_to_client: true,
        default_responsible: "provider",
        _new: true,
        _dirty: true,
      },
    ]);
  };

  const updateDraft = (idx: number, patch: Partial<StepDraft>) => {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch, _dirty: true } : d)));
  };

  const removeDraft = async (idx: number) => {
    const d = drafts[idx];
    if (d.id) {
      const { error } = await supabase.from("product_steps").delete().eq("id", d.id);
      if (error) {
        toast.error("Erro ao remover etapa: " + error.message);
        return;
      }
    }
    setDrafts((prev) => prev.filter((_, i) => i !== idx));
    toast.success("Etapa removida");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = drafts.filter((d) => d.id && d._dirty).map((d, i) => ({
        id: d.id!,
        name: d.name,
        description: d.description,
        step_order: drafts.indexOf(d),
        is_visible_to_client: d.is_visible_to_client,
        default_responsible: d.default_responsible,
        default_due_offset_days: d.default_due_offset_days ?? null,
      }));
      const inserts = drafts.filter((d) => d._new && d.name.trim()).map((d) => ({
        product_id: productId,
        name: d.name,
        description: d.description,
        step_order: drafts.indexOf(d),
        is_visible_to_client: d.is_visible_to_client,
        default_responsible: d.default_responsible,
        default_due_offset_days: d.default_due_offset_days ?? null,
      }));

      for (const u of updates) {
        const { id, ...rest } = u;
        const { error } = await supabase.from("product_steps").update(rest).eq("id", id);
        if (error) throw error;
      }
      if (inserts.length > 0) {
        const { error } = await supabase.from("product_steps").insert(inserts);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-steps-template", productId] });
      toast.success("Checklist atualizado!");
      onOpenChange(false);
      setLoaded(false);
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setLoaded(false); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ListChecks className="size-5 text-primary" /> Checklist Operacional
          </DialogTitle>
          <DialogDescription>
            Modelo de etapas aplicado automaticamente toda vez que <strong>{productName}</strong> for contratado por um cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6 py-4 space-y-3">
          {isLoading && !loaded ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : drafts.length === 0 ? (
            <div className="border-2 border-dashed border-border rounded-2xl p-12 text-center">
              <ListChecks className="size-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">Nenhuma etapa configurada para este produto.</p>
              <Button onClick={addStep} variant="outline" className="gap-2">
                <Plus className="size-4" /> Adicionar primeira etapa
              </Button>
            </div>
          ) : (
            <>
              {drafts.map((step, idx) => (
                <div key={idx} className={cn(
                  "vx-card p-4 border bg-card transition-all",
                  step._dirty && "border-primary/30 bg-primary/[0.02]"
                )}>
                  <div className="flex items-start gap-3">
                    <div className="size-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0 cursor-grab">
                      <GripVertical className="size-4" />
                    </div>
                    <span className="size-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1 space-y-3">
                      <Input
                        value={step.name}
                        placeholder="Nome da etapa (ex: Receber documentos)"
                        onChange={(e) => updateDraft(idx, { name: e.target.value })}
                        className="font-medium"
                      />
                      <Textarea
                        value={step.description}
                        placeholder="Descrição (opcional)"
                        rows={2}
                        onChange={(e) => updateDraft(idx, { description: e.target.value })}
                        className="text-sm resize-none"
                      />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
                            <UserCog className="size-3" /> Responsável padrão
                          </Label>
                          <Select
                            value={step.default_responsible}
                            onValueChange={(v) => updateDraft(idx, { default_responsible: v })}
                          >
                            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="provider">Prestador</SelectItem>
                              <SelectItem value="client">Cliente</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                            Prazo (dias)
                          </Label>
                          <Input
                            type="number"
                            value={step.default_due_offset_days ?? ""}
                            onChange={(e) => updateDraft(idx, { default_due_offset_days: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder="Ex: 5"
                            className="h-9 text-xs"
                          />
                        </div>
                        <div className="flex items-end gap-2 pb-1">
                          <Switch
                            checked={step.is_visible_to_client}
                            onCheckedChange={(v) => updateDraft(idx, { is_visible_to_client: v })}
                          />
                          <Label className="text-[11px] font-medium flex items-center gap-1">
                            {step.is_visible_to_client ? <Eye className="size-3 text-primary" /> : <EyeOff className="size-3 text-muted-foreground" />}
                            Visível ao cliente
                          </Label>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 shrink-0"
                      onClick={() => removeDraft(idx)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button onClick={addStep} variant="outline" className="w-full gap-2 border-dashed h-12">
                <Plus className="size-4" /> Adicionar etapa
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border -mx-6 px-6">
          <p className="text-xs text-muted-foreground">
            {drafts.length} {drafts.length === 1 ? "etapa configurada" : "etapas configuradas"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="rounded-xl px-8 gap-2"
            >
              {saveMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Salvar Checklist
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
