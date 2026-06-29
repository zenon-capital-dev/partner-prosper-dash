import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link2, Package, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  providerId: string;
  providerName?: string;
  onSuccess?: () => void;
}

export function ProviderAssignDialog({ open, onOpenChange, providerId, providerName, onSuccess }: Props) {
  const [clientId, setClientId] = useState<string>("");
  const [clientProductId, setClientProductId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["assign-clients"],
    enabled: open,
    queryFn: async () => (await supabase.from("clients").select("id, full_name").order("full_name").limit(300)).data ?? [],
  });

  const { data: clientProducts = [] } = useQuery({
    queryKey: ["assign-client-products", clientId],
    enabled: open && !!clientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_products")
        .select("id, custom_product_name, status, service_provider_id, products(name), service_providers(name)")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const submit = async () => {
    if (!clientProductId) { toast.error("Selecione a demanda"); return; }
    setSubmitting(true);
    const { error } = await supabase
      .from("client_products")
      .update({ service_provider_id: providerId })
      .eq("id", clientProductId);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Prestador vinculado à demanda. Ele já pode visualizar e solicitar documentos.");
    onSuccess?.();
    onOpenChange(false);
    setClientId("");
    setClientProductId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg">
              <Link2 className="size-5" />
            </div>
            <div>
              <DialogTitle className="font-display text-xl">Delegar demanda</DialogTitle>
              <DialogDescription className="text-xs">
                Vincule <strong>{providerName ?? "este prestador"}</strong> a uma demanda de cliente. Ele passará a ver os dados e poderá solicitar documentos.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><User className="size-3" /> Cliente</Label>
            <Select value={clientId} onValueChange={(v) => { setClientId(v); setClientProductId(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
              <SelectContent>
                {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {clientId && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Package className="size-3" /> Demanda / Produto</Label>
              {clientProducts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Este cliente ainda não tem demandas. Crie um produto na ficha do cliente primeiro.
                </div>
              ) : (
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {clientProducts.map((cp: any) => (
                    <button
                      key={cp.id}
                      type="button"
                      onClick={() => setClientProductId(cp.id)}
                      className={`w-full text-left rounded-xl border p-3 transition-all ${
                        clientProductId === cp.id
                          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                          : "border-border hover:border-primary/40 hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{cp.products?.name ?? cp.custom_product_name ?? "Produto"}</p>
                        <Badge variant="outline" className="text-[10px]">{cp.status}</Badge>
                      </div>
                      {cp.service_providers?.name && cp.service_provider_id !== providerId && (
                        <p className="text-[10.5px] text-amber-600 mt-1">
                          Atualmente com: {cp.service_providers.name} — será substituído.
                        </p>
                      )}
                      {cp.service_provider_id === providerId && (
                        <p className="text-[10.5px] text-emerald-600 mt-1">Já vinculado a este prestador.</p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting || !clientProductId} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg">
            {submitting ? "Vinculando..." : "Delegar demanda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
