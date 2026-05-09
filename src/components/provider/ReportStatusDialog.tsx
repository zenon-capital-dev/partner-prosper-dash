import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "aguardando_documentos", label: "Aguardando Documentos" },
  { value: "em_analise", label: "Em Análise" },
  { value: "aguardando_cliente", label: "Aguardando Cliente" },
  { value: "em_andamento", label: "Em Andamento" },
  { value: "pendente_correcao", label: "Pendente de Correção" },
  { value: "concluido", label: "Concluído" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientProductId: string;
  productName?: string;
  clientName?: string;
}

export function ReportStatusDialog({
  open, onOpenChange, clientProductId, productName, clientName,
}: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: provider } = useQuery({
    queryKey: ["provider-self", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("service_providers")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  async function handleSubmit() {
    if (!status) {
      toast.error("Selecione um status");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("client_product_status_reports").insert({
      client_product_id: clientProductId,
      reported_by: user!.id,
      service_provider_id: provider?.id,
      status,
      notes: notes || null,
      pending: pending || null,
      next_steps: nextSteps || null,
    } as any);
    setSaving(false);
    if (error) {
      toast.error("Erro ao reportar status", { description: error.message });
      return;
    }
    
    // Update the main client_product status too
    await supabase.from("client_products").update({ status }).eq("id", clientProductId);

    toast.success("Status reportado ao admin");
    qc.invalidateQueries({ queryKey: ["provider-client-products"] });
    qc.invalidateQueries({ queryKey: ["status-reports"] });
    qc.invalidateQueries({ queryKey: ["client-products"] });
    setStatus("");
    setNotes("");
    setPending("");
    setNextSteps("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="size-5 text-primary" />
            Reportar Status
          </DialogTitle>
          <DialogDescription>
            {clientName ? <><strong>{clientName}</strong> · </> : null}
            {productName ?? "Produto"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Status atual</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status..." />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descrição do andamento</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhe o que foi feito desde o último reporte..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Pendências</Label>
            <Textarea
              value={pending}
              onChange={(e) => setPending(e.target.value)}
              placeholder="O que está pendente do cliente ou da equipe?"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Próximos passos</Label>
            <Textarea
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
              placeholder="O que será feito a seguir..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Enviando..." : "Reportar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
