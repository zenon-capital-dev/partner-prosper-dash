import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

interface RecordDelayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  demandId: string;
}

const DELAY_CATEGORIES = [
  { value: "cliente", label: "Cliente" },
  { value: "prestador", label: "Prestador" },
  { value: "admin", label: "Admin" },
  { value: "terceiro", label: "Terceiro" },
  { value: "pagamento", label: "Pagamento" },
  { value: "documento", label: "Documento" },
  { value: "contrato", label: "Contrato" },
];

export function RecordDelayDialog({ open, onOpenChange, demandId }: RecordDelayDialogProps) {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  const delayMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("client_product_delays")
        .insert({
          client_product_id: demandId,
          delay_reason_category: category as any,
          description,
          recorded_by: user.id
        });
      if (error) throw error;
      
      // Também atualiza o motivo de atraso na demanda principal para visualização rápida
      await supabase
        .from("client_products")
        .update({ delay_reason: description })
        .eq("id", demandId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand-detail", demandId] });
      queryClient.invalidateQueries({ queryKey: ["admin-demands"] });
      queryClient.invalidateQueries({ queryKey: ["cockpit-demands"] });
      queryClient.invalidateQueries({ queryKey: ["client-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard-snapshot"] });
      toast.success("Motivo de atraso registrado com sucesso");
      onOpenChange(false);
      setCategory("");
      setDescription("");
    },
    onError: (error: any) => {
      toast.error("Erro ao registrar: " + error.message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-rose-500" />
            Registrar Motivo de Atraso
          </DialogTitle>
          <DialogDescription>
            Identifique o responsável e o motivo pelo qual esta demanda está fora do prazo original.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Responsável pelo Atraso</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Quem está atrasando?" />
              </SelectTrigger>
              <SelectContent>
                {DELAY_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descrição do Motivo</Label>
            <Textarea 
              placeholder="Descreva detalhadamente o motivo do atraso..." 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[120px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
          <Button 
            onClick={() => delayMutation.mutate()} 
            disabled={!category || !description}
            className="rounded-xl bg-rose-600 hover:bg-rose-700"
          >
            Registrar Atraso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
