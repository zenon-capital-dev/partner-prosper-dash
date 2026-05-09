import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface QualityApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  demandId: string;
}

export function QualityApprovalDialog({ open, onOpenChange, demandId }: QualityApprovalDialogProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"approve" | "adjust" | null>(null);
  const [feedback, setFeedback] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [adjustmentDeadline, setAdjustmentDeadline] = useState("");

  const approvalMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const status = mode === 'approve' ? 'aprovado' : 'ajuste_solicitado';
      const demandStatus = mode === 'approve' ? 'concluido' : 'ajuste_solicitado';

      // 1. Registrar no histórico de qualidade
      const { error: histError } = await supabase
        .from("client_product_quality_checks")
        .insert({
          client_product_id: demandId,
          reviewer_id: user.id,
          status,
          feedback,
          adjustment_deadline: adjustmentDeadline ? new Date(adjustmentDeadline).toISOString() : null,
          internal_notes: internalNotes
        });
      if (histError) throw histError;

      // 2. Atualizar a demanda principal
      const updateData: any = { status: demandStatus };
      if (mode === 'adjust') {
        updateData.adjustment_description = feedback;
        updateData.adjustment_due_date = adjustmentDeadline ? new Date(adjustmentDeadline).toISOString() : null;
        updateData.adjustment_notes = internalNotes;
      } else {
        updateData.completed_at = new Date().toISOString();
      }

      const { error: demandError } = await supabase
        .from("client_products")
        .update(updateData)
        .eq("id", demandId);
      if (demandError) throw demandError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand-detail", demandId] });
      queryClient.invalidateQueries({ queryKey: ["admin-demands"] });
      toast.success(mode === 'approve' ? "Demanda aprovada e concluída!" : "Ajuste solicitado com sucesso.");
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Erro na operação: " + error.message);
    }
  });

  const resetForm = () => {
    setMode(null);
    setFeedback("");
    setInternalNotes("");
    setAdjustmentDeadline("");
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) resetForm();
      onOpenChange(val);
    }}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck className="size-5 text-primary" />
            Controle de Qualidade
          </DialogTitle>
          <DialogDescription>
            Revise o trabalho executado e decida se a demanda está pronta para ser concluída ou se precisa de ajustes.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {!mode ? (
            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="h-24 flex flex-col gap-2 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 text-emerald-600 border-dashed"
                onClick={() => setMode('approve')}
              >
                <CheckCircle2 className="size-6" />
                Aprovar Trabalho
              </Button>
              <Button 
                variant="outline" 
                className="h-24 flex flex-col gap-2 rounded-2xl hover:border-amber-500 hover:bg-amber-50 text-amber-600 border-dashed"
                onClick={() => setMode('adjust')}
              >
                <AlertTriangle className="size-6" />
                Solicitar Ajuste
              </Button>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-2">
                <Label>{mode === 'approve' ? 'Comentário Final (Opcional)' : 'O que precisa ser corrigido?'}</Label>
                <Textarea 
                  placeholder={mode === 'approve' ? "Parabéns pelo trabalho..." : "Descreva detalhadamente os pontos de ajuste..."}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="min-h-[100px]"
                />
              </div>

              {mode === 'adjust' && (
                <div className="space-y-2">
                  <Label>Prazo para Correção</Label>
                  <Input 
                    type="date" 
                    value={adjustmentDeadline}
                    onChange={(e) => setAdjustmentDeadline(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Observações Internas (Somente Admin)</Label>
                <Textarea 
                  placeholder="Notas que não serão visíveis para o prestador..."
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  className="min-h-[80px] bg-muted/20"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {mode && (
            <Button variant="ghost" onClick={() => setMode(null)} className="rounded-xl">Voltar</Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancelar</Button>
          {mode && (
            <Button 
              onClick={() => approvalMutation.mutate()} 
              disabled={mode === 'adjust' && !feedback}
              className={cn("rounded-xl px-8", mode === 'approve' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700")}
            >
              {mode === 'approve' ? "Confirmar Aprovação" : "Enviar Solicitação"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
