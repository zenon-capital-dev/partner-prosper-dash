import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileSignature, Plus, Download, Eye, Clock, CheckCircle2 } from "lucide-react";
import { formatDate, formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ClientContracts({ clientId }: { clientId: string }) {
  const { data: contracts, isLoading } = useQuery({
    queryKey: ["client-contracts", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("contracts")
        .select(`
          *,
          products(name)
        `)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-tight">Contratos</h3>
          <p className="text-xs text-muted-foreground">Formalização e assinaturas</p>
        </div>
        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="size-4 mr-2" /> Novo Contrato
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : contracts?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Nenhum contrato gerado.</div>
        ) : contracts?.map((contract: any) => (
          <div key={contract.id} className="cp-panel p-5 flex items-center justify-between group hover:border-indigo-500/30 transition-all">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-xl bg-slate-50 dark:bg-slate-900 border border-border/40 flex items-center justify-center">
                <FileSignature className="size-6 text-slate-500" />
              </div>
              <div>
                <h4 className="font-bold text-foreground">{contract.name || `Contrato - ${contract.products?.name || "Geral"}`}</h4>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-[11px] font-mono font-bold text-emerald-500 tracking-tight">{formatBRL(contract.amount || 0)}</p>
                  <span className="text-[10px] text-muted-foreground">•</span>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{formatDate(contract.created_at)}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <StatusPill status={contract.status} />
                <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-widest font-bold">Status do Documento</p>
              </div>
              <div className="flex items-center gap-2 border-l border-border/40 pl-6">
                <Button variant="ghost" size="icon" className="size-9 rounded-xl hover:bg-indigo-500/10 hover:text-indigo-600 transition-all">
                  <Download className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-9 rounded-xl hover:bg-indigo-500/10 hover:text-indigo-600 transition-all">
                  <Eye className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: any = {
    rascunho: { label: "RASCUNHO", color: "text-slate-500 bg-slate-50" },
    criado: { label: "CRIADO", color: "text-slate-500 bg-slate-50" },
    enviado: { label: "ENVIADO", color: "text-blue-500 bg-blue-50" },
    aguardando_assinatura: { label: "AGUARDANDO", color: "text-amber-500 bg-amber-50" },
    assinado: { label: "ASSINADO", color: "text-emerald-500 bg-emerald-50" },
    vencido: { label: "VENCIDO", color: "text-rose-500 bg-rose-50" },
    cancelado: { label: "CANCELADO", color: "text-rose-500 bg-rose-50" },
    finalizado: { label: "FINALIZADO", color: "text-emerald-500 bg-emerald-50" },
    pendente_correcao: { label: "PENDENTE CORREÇÃO", color: "text-orange-500 bg-orange-50" },
  };
  const config = map[status] || { label: status?.toUpperCase() || "INDEFINIDO", color: "text-slate-500 bg-slate-50" };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest border border-current", config.color)}>
      {config.label}
    </span>
  );
}
