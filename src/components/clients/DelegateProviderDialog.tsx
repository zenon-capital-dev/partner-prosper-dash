import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserCog, Star, Trash2, Plus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientProductId: string;
  currentProviderId?: string | null;
  productName?: string;
}

export function DelegateProviderDialog({
  open, onOpenChange, clientProductId, productName,
}: Props) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const { data: providers = [] } = useQuery({
    queryKey: ["service-providers-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_providers")
        .select("id, name, specialty")
        .eq("active", true)
        .order("name");
      return data ?? [];
    },
  });

  const { data: assigned = [], refetch } = useQuery({
    queryKey: ["client-product-providers", clientProductId],
    enabled: open && !!clientProductId,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_product_providers")
        .select("id, service_provider_id, role, is_primary, created_at, service_providers(name, specialty)")
        .eq("client_product_id", clientProductId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["client-product-providers", clientProductId] });
    qc.invalidateQueries({ queryKey: ["client-products"] });
    qc.invalidateQueries({ queryKey: ["demand-detail", clientProductId] });
    qc.invalidateQueries({ queryKey: ["provider-cp"] });
    refetch();
  };

  // Keep client_products.service_provider_id in sync with the primary delegate.
  async function syncPrimary() {
    const { data: rows, error: selErr } = await supabase
      .from("client_product_providers")
      .select("service_provider_id, is_primary, created_at")
      .eq("client_product_id", clientProductId)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true });
    if (selErr) { toast.error("Erro ao ler vínculos", { description: selErr.message }); return; }
    const primary = (rows ?? []).find((r: any) => r.is_primary) ?? rows?.[0];
    const { error: upErr } = await supabase
      .from("client_products")
      .update({ service_provider_id: primary?.service_provider_id ?? null })
      .eq("id", clientProductId);
    if (upErr) toast.error("Erro ao atualizar responsável", { description: upErr.message });
  }

  async function handleAdd() {
    if (!selected) { toast.error("Selecione um prestador"); return; }
    if (assigned.some((a: any) => a.service_provider_id === selected)) {
      toast.error("Este prestador já está vinculado");
      return;
    }
    setSaving(true);
    const isFirst = assigned.length === 0;
    const { error } = await supabase
      .from("client_product_providers")
      .insert({
        client_product_id: clientProductId,
        service_provider_id: selected,
        role: role || null,
        is_primary: isFirst,
      });
    if (error) { setSaving(false); toast.error("Erro ao vincular prestador", { description: error.message }); return; }
    await syncPrimary();
    setSaving(false);
    toast.success("Prestador vinculado");
    setSelected(""); setRole("");
    invalidateAll();
  }

  async function handleRemove(id: string) {
    const { error } = await supabase.from("client_product_providers").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    await syncPrimary();
    toast.success("Prestador removido");
    invalidateAll();
  }

  async function handleSetPrimary(id: string) {
    // Clear any other primary first
    await supabase
      .from("client_product_providers")
      .update({ is_primary: false })
      .eq("client_product_id", clientProductId);
    const { error } = await supabase
      .from("client_product_providers")
      .update({ is_primary: true })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    await syncPrimary();
    toast.success("Prestador principal atualizado");
    invalidateAll();
  }


  const available = providers.filter((p: any) => !assigned.some((a: any) => a.service_provider_id === p.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="size-5 text-primary" />
            Prestadores da demanda
          </DialogTitle>
          <DialogDescription>
            Vincule um ou mais prestadores a <strong>{productName ?? "esta demanda"}</strong>.
            O prestador marcado como principal aparece como responsável padrão.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Lista atual */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Vinculados</Label>
            {assigned.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                Nenhum prestador vinculado ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {assigned.map((a: any) => (
                  <div key={a.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{a.service_providers?.name ?? "Prestador"}</span>
                        {a.is_primary && (
                          <Badge variant="default" className="text-[10px] gap-1">
                            <Star className="size-2.5" /> Principal
                          </Badge>
                        )}
                        {a.role && <Badge variant="outline" className="text-[10px]">{a.role}</Badge>}
                      </div>
                      {a.service_providers?.specialty && (
                        <p className="text-[11px] text-muted-foreground">{a.service_providers.specialty}</p>
                      )}
                    </div>
                    {!a.is_primary && (
                      <Button size="sm" variant="ghost" onClick={() => handleSetPrimary(a.id)} title="Definir como principal">
                        <Star className="size-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleRemove(a.id)} title="Remover">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Adicionar novo */}
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Adicionar prestador</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um prestador..." />
              </SelectTrigger>
              <SelectContent>
                {available.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Todos os prestadores ativos já estão vinculados.</div>
                ) : available.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{p.specialty ? ` · ${p.specialty}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Função / especialidade nesta demanda (opcional)"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
            <Button onClick={handleAdd} disabled={saving || !selected} className="w-full" size="sm">
              <Plus className="size-4 mr-1" /> {saving ? "Vinculando..." : "Vincular prestador"}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
