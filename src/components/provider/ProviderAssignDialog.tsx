import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useClientsRef } from "@/hooks/useReferenceData";
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
  const qc = useQueryClient();
  const [clientId, setClientId] = useState<string>("");
  const [clientProductId, setClientProductId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const { data: clients = [] } = useClientsRef(open);

  const { data: clientProducts = [], isLoading: loadingProducts, error: productsError } = useQuery({
    queryKey: ["assign-client-products", clientId],
    enabled: open && !!clientId,
    queryFn: async () => {
      const { data: cps, error } = await supabase
        .from("client_products")
        .select("id, custom_product_name, status, service_provider_id, responsible_provider_id, product_id")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const list = cps ?? [];
      const productIds = Array.from(new Set(list.map((c: any) => c.product_id).filter(Boolean)));
      const providerIds = Array.from(new Set(
        list.flatMap((c: any) => [c.service_provider_id, c.responsible_provider_id]).filter(Boolean)
      ));

      const [{ data: prods, error: prodsError }, { data: provs, error: provsError }] = await Promise.all([
        productIds.length
          ? supabase.from("products").select("id, name").in("id", productIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        providerIds.length
          ? supabase.from("service_providers").select("id, name").in("id", providerIds)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      if (prodsError) {
        console.error("Erro ao carregar nomes dos produtos para delegação:", prodsError);
        toast.error("Não foi possível carregar os nomes dos produtos", { description: prodsError.message });
      }
      if (provsError) {
        console.error("Erro ao carregar prestadores atuais para delegação:", provsError);
        toast.error("Não foi possível carregar os prestadores atuais", { description: provsError.message });
      }

      const pMap = new Map((prods ?? []).map((p: any) => [p.id, p.name]));
      const sMap = new Map((provs ?? []).map((p: any) => [p.id, p.name]));
      return list.map((c: any) => ({
        ...c,
        products: c.product_id ? { name: pMap.get(c.product_id) } : null,
        service_providers: c.service_provider_id ? { name: sMap.get(c.service_provider_id) } : null,
        responsible_providers: c.responsible_provider_id ? { name: sMap.get(c.responsible_provider_id) } : null,
      }));
    },
    retry: 1,
  });

  const submit = async () => {
    if (!clientProductId) { toast.error("Selecione a demanda"); return; }
    setSubmitting(true);
    try {
      const { data: links, error: linksError } = await supabase
        .from("client_product_providers")
        .select("id, service_provider_id")
        .eq("client_product_id", clientProductId);
      if (linksError) throw linksError;

      const existingLink = (links ?? []).find((link: any) => link.service_provider_id === providerId);
      const otherLinkIds = (links ?? [])
        .filter((link: any) => link.service_provider_id !== providerId)
        .map((link: any) => link.id);

      if (otherLinkIds.length > 0) {
        const { error: clearPrimaryError } = await supabase
          .from("client_product_providers")
          .update({ is_primary: false })
          .in("id", otherLinkIds);
        if (clearPrimaryError) throw clearPrimaryError;
      }

      if (existingLink) {
        const { error: markPrimaryError } = await supabase
          .from("client_product_providers")
          .update({ is_primary: true })
          .eq("id", existingLink.id);
        if (markPrimaryError) throw markPrimaryError;
      } else {
        const { error: insertLinkError } = await supabase
          .from("client_product_providers")
          .insert({
            client_product_id: clientProductId,
            service_provider_id: providerId,
            is_primary: true,
          });
        if (insertLinkError) throw insertLinkError;
      }

      const { error: updateDemandError } = await supabase
        .from("client_products")
        .update({ service_provider_id: providerId })
        .eq("id", clientProductId);
      if (updateDemandError) throw updateDemandError;

      toast.success("Prestador vinculado à demanda. Ele já pode visualizar e solicitar documentos.");
      qc.invalidateQueries({ queryKey: ["providers-demand-summary"] });
      qc.invalidateQueries({ queryKey: ["provider-cp"] });
      qc.invalidateQueries({ queryKey: ["client-products"] });
      onSuccess?.();
      setClientId("");
      setClientProductId("");
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao delegar demanda:", err);
      toast.error("Erro ao delegar demanda", { description: err?.message ?? "Tente novamente." });
    } finally {
      setSubmitting(false);
    }
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
              {loadingProducts ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Carregando demandas deste cliente...
                </div>
              ) : productsError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center text-xs text-destructive">
                  Não foi possível carregar as demandas. Atualize a página e tente novamente.
                </div>
              ) : clientProducts.length === 0 ? (
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
                      {(cp.service_providers?.name || cp.responsible_providers?.name) && cp.service_provider_id !== providerId && cp.responsible_provider_id !== providerId && (
                        <p className="text-[10.5px] text-amber-600 mt-1">
                          Atualmente com: {cp.service_providers?.name ?? cp.responsible_providers?.name} — será substituído como principal.
                        </p>
                      )}
                      {(cp.service_provider_id === providerId || cp.responsible_provider_id === providerId) && (
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
