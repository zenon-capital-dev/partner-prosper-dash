import React, { useState } from "react";
import { nowBR } from "@/lib/datetime";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PauseCircle, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PauseDemandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  demandId: string;
  isPaused: boolean;
}

const PAUSE_REASONS = [
  { value: "cliente_nao_enviou_documentos", label: "Cliente não enviou documentos" },
  { value: "aguardando_assinatura", label: "Aguardando assinatura" },
  { value: "aguardando_pagamento", label: "Aguardando pagamento" },
  { value: "aguardando_retorno_terceiro", label: "Aguardando retorno de terceiro" },
  { value: "aguardando_decisao_interna", label: "Aguardando decisão interna" },
  { value: "outro", label: "Outro motivo" },
];

export function PauseDemandDialog({ open, onOpenChange, demandId, isPaused }: PauseDemandDialogProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [freezeSla, setFreezeSla] = useState(true);

  const pauseMutation = useMutation({
    mutationFn: async () => {
      const { getCurrentUser } = await import("@/lib/current-user");
      const user = await getCurrentUser();
      if (!user) throw new Error("Sua sessão expirou. Faça login novamente.");

      if (isPaused) {
        // Retomar
        const { error } = await supabase
          .from("client_product_pauses")
          .update({ resumed_at: nowBR().toISOString() })
          .eq("client_product_id", demandId)
          .is("resumed_at", null);
        if (error) throw error;
      } else {
        // Pausar
        const { error } = await supabase
          .from("client_product_pauses")
          .insert({
            client_product_id: demandId,
            reason: reason as any,
            notes,
            freeze_sla: freezeSla,
            paused_by: user.id
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand-detail", demandId] });
      queryClient.invalidateQueries({ queryKey: ["admin-demands"] });
      toast.success(isPaused ? "Demanda retomada com sucesso" : "Demanda pausada com sucesso");
      onOpenChange(false);
      setReason("");
      setNotes("");
    },
    onError: (error: any) => {
      toast.error("Erro na operação: " + error.message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPaused ? <PlayCircle className="size-5 text-emerald-500" /> : <PauseCircle className="size-5 text-amber-500" />}
            {isPaused ? "Retomar Demanda" : "Pausar Demanda"}
          </DialogTitle>
          <DialogDescription>
            {isPaused 
              ? "Confirme a retomada desta demanda para reiniciar a contagem do SLA e o fluxo de trabalho."
              : "Selecione o motivo da pausa. O status será atualizado e o SLA poderá ser congelado."}
          </DialogDescription>
        </DialogHeader>

        {!isPaused && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Motivo da Pausa</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {PAUSE_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações Adicionais</Label>
              <Textarea 
                placeholder="Detalhes sobre a pausa..." 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[100px]"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-xs uppercase font-bold tracking-widest opacity-60">Congelar SLA</Label>
                <p className="text-[10px] text-muted-foreground">O tempo de execução deixará de contar.</p>
              </div>
              <Switch checked={freezeSla} onCheckedChange={setFreezeSla} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
          <Button 
            onClick={() => pauseMutation.mutate()} 
            disabled={!isPaused && !reason}
            className={cn("rounded-xl", isPaused ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700")}
          >
            {isPaused ? "Retomar Agora" : "Confirmar Pausa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
