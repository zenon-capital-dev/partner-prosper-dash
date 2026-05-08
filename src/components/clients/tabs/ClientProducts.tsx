import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, Package, User, UserCog, ClipboardCheck, Plus, Layers } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DelegateProviderDialog } from "@/components/clients/DelegateProviderDialog";
import { AddProductDialog } from "@/components/clients/AddProductDialog";
import { ClientProductSteps } from "./ClientProductSteps";

export function ClientProducts({ clientId }: { clientId: string }) {
  const [delegateTarget, setDelegateTarget] = useState<{ id: string; providerId?: string | null; productName?: string } | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: clientProducts, isLoading } = useQuery({
    queryKey: ["client-products", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_products")
        .select(`
          *,
          products(name),
          service_providers(id, name, specialty)
        `)
        .eq("client_id", clientId);
      return data ?? [];
    },
  });

  const cpIds = (clientProducts ?? []).map((c: any) => c.id);

  const { data: latestReports = {} } = useQuery({
    queryKey: ["latest-status-reports", cpIds.join(",")],
    enabled: cpIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_product_status_reports")
        .select("client_product_id, status, notes, created_at")
        .in("client_product_id", cpIds)
        .order("created_at", { ascending: false });
      const map: Record<string, any> = {};
      (data ?? []).forEach((r: any) => {
        if (!map[r.client_product_id]) map[r.client_product_id] = r;
      });
      return map;
    },
  });

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-tight">Produtos Contratados</h3>
          <p className="text-xs text-muted-foreground">Serviços ativos, prestadores delegados e splits de comissão</p>
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm" className="gap-2">
          <Plus className="size-4" /> Adicionar Produto
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="col-span-2 text-center py-12 text-muted-foreground">Carregando...</div>
        ) : clientProducts?.length === 0 ? (
          <div className="col-span-2 vx-card p-16 text-center border-dashed border-2">
            <Package className="size-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">Nenhum produto vinculado a este cliente.</p>
            <Button onClick={() => setAddOpen(true)} size="sm" variant="outline" className="gap-2">
              <Plus className="size-4" /> Adicionar Primeiro Produto
            </Button>
          </div>
        ) : clientProducts?.map((cp: any) => {
          const lastReport = (latestReports as any)[cp.id];
          return (
            <div key={cp.id} className="vx-card p-6 group hover:border-primary/40 transition-all">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Package className="size-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground leading-none">{cp.products?.name || cp.custom_product_name}</h4>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1.5">SERVIÇO</p>
                  </div>
                </div>
                <StatusBadge status={cp.status} />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <Field label="Valor" value={formatBRL(cp.value || cp.custom_value || 0)} />
                <Field label="Iniciado" value={formatDate(cp.created_at)} />
              </div>

              {/* Provider */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="size-8 rounded-md bg-background flex items-center justify-center shrink-0">
                    <User className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Prestador delegado</p>
                    <p className="text-sm font-medium truncate">
                      {cp.service_providers?.name || <span className="text-muted-foreground italic">Não delegado</span>}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDelegateTarget({ id: cp.id, providerId: cp.service_provider_id, productName: cp.products?.name })}
                >
                  <UserCog className="size-3.5 mr-1.5" />
                  {cp.service_provider_id ? "Trocar" : "Delegar"}
                </Button>
              </div>

              {/* Last report */}
              {lastReport && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-2.5">
                  <ClipboardCheck className="size-4 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Último reporte</p>
                      <StatusBadge status={lastReport.status} />
                    </div>
                    {lastReport.notes && <p className="text-xs text-foreground mt-1 line-clamp-2">{lastReport.notes}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{formatDate(lastReport.created_at)}</p>
                  </div>
                </div>
              )}

              <ClientProductSteps clientProductId={cp.id} />
            </div>
          );
        })}
      </div>

      {delegateTarget && (
        <DelegateProviderDialog
          open={!!delegateTarget}
          onOpenChange={(v) => !v && setDelegateTarget(null)}
          clientProductId={delegateTarget.id}
          currentProviderId={delegateTarget.providerId}
          productName={delegateTarget.productName}
        />
      )}

      <AddProductDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        clientId={clientId}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: any = {
    aguardando_documentos: { label: "AGUARDANDO DOCS", className: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
    em_analise: { label: "EM ANÁLISE", className: "bg-blue-500/10 text-blue-700 border-blue-500/30" },
    aguardando_cliente: { label: "AGUARDANDO CLIENTE", className: "bg-orange-500/10 text-orange-700 border-orange-500/30" },
    em_andamento: { label: "EM ANDAMENTO", className: "bg-indigo-500/10 text-indigo-700 border-indigo-500/30" },
    pendente_correcao: { label: "PEND. CORREÇÃO", className: "bg-rose-500/10 text-rose-700 border-rose-500/30" },
    concluido: { label: "CONCLUÍDO", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
    aguardando_inicio: { label: "AGUARDANDO", className: "bg-muted text-muted-foreground border-border" },
    ativo: { label: "ATIVO", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" },
    finalizado: { label: "FINALIZADO", className: "bg-muted text-muted-foreground border-border" },
  };
  const cfg = map[status] || { label: (status || "—").toUpperCase(), className: "bg-muted text-muted-foreground border-border" };
  return (
    <span className={cn("px-2 py-0.5 rounded-md text-[9px] font-bold tracking-widest border", cfg.className)}>
      {cfg.label}
    </span>
  );
}
