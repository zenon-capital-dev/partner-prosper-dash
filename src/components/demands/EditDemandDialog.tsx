import { useEffect, useState } from "react";
import { nowBR, toBR } from "@/lib/datetime";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  demand: any;
};

const PRIORITIES = ["baixa", "normal", "alta", "urgente"] as const;

export function EditDemandDialog({ open, onOpenChange, demand }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    priority: "normal",
    deadline: "",
    sla_due_date: "",
    value: "",
    custom_product_name: "",
    internal_notes: "",
    notes: "",
  });

  useEffect(() => {
    if (!demand) return;
    setForm({
      priority: demand.priority ?? "normal",
      deadline: demand.deadline ? String(demand.deadline).slice(0, 10) : "",
      sla_due_date: demand.sla_due_date ? String(demand.sla_due_date).slice(0, 10) : "",
      value: demand.value != null ? String(demand.value) : "",
      custom_product_name: demand.custom_product_name ?? "",
      internal_notes: demand.internal_notes ?? "",
      notes: demand.notes ?? "",
    });
  }, [demand, open]);

  const save = useMutation({
    mutationFn: async () => {
      const patch: any = {
        priority: form.priority,
        deadline: form.deadline || null,
        sla_due_date: form.sla_due_date ? toBR(form.sla_due_date).toISOString() : null,
        value: form.value ? Number(form.value) : null,
        custom_product_name: form.custom_product_name || null,
        internal_notes: form.internal_notes || null,
        notes: form.notes || null,
      };
      const { error } = await supabase
        .from("client_products")
        .update(patch)
        .eq("id", demand.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demanda atualizada");
      qc.invalidateQueries({ queryKey: ["demand-detail", demand.id] });
      qc.invalidateQueries({ queryKey: ["admin-demands"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Editar demanda</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>Nome do serviço (opcional)</Label>
            <Input
              value={form.custom_product_name}
              onChange={(e) => setForm({ ...form, custom_product_name: e.target.value })}
              placeholder="Sobrescrever nome do produto"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Prioridade</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <Input
              type="number" step="0.01" min="0"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Prazo final</Label>
            <Input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>SLA (data limite)</Label>
            <Input
              type="date"
              value={form.sla_due_date}
              onChange={(e) => setForm({ ...form, sla_due_date: e.target.value })}
            />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Observações (visível ao cliente)</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Observações internas</Label>
            <Textarea
              rows={3}
              value={form.internal_notes}
              onChange={(e) => setForm({ ...form, internal_notes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
