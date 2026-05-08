import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserCog } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientProductId: string;
  currentProviderId?: string | null;
  productName?: string;
}

export function DelegateProviderDialog({
  open, onOpenChange, clientProductId, currentProviderId, productName,
}: Props) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>(currentProviderId ?? "");
  const [saving, setSaving] = useState(false);

  const { data: providers = [] } = useQuery({
    queryKey: ["service-providers-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_providers")
        .select("id, name, specialty, email")
        .eq("active", true)
        .order("name");
      return data ?? [];
    },
  });

  async function handleSave() {
    if (!selected) {
      toast.error("Selecione um prestador");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("client_products")
      .update({ service_provider_id: selected })
      .eq("id", clientProductId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao delegar prestador", { description: error.message });
      return;
    }
    toast.success("Prestador delegado com sucesso");
    qc.invalidateQueries({ queryKey: ["client-products"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="size-5 text-primary" />
            Delegar Prestador
          </DialogTitle>
          <DialogDescription>
            Define o prestador responsável por <strong>{productName ?? "este produto"}</strong>.
            Ele terá acesso somente aos documentos vinculados a este atendimento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          <Label>Prestador de Serviço</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um prestador..." />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                  {p.specialty ? ` · ${p.specialty}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Delegar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
