import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, ChevronRight, Package, Calendar, User, Clock } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ClientProducts({ clientId }: { clientId: string }) {
  const { data: clientProducts, isLoading } = useQuery({
    queryKey: ["client-products", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_products")
        .select(`
          *,
          products(name, category, price)
        `)
        .eq("client_id", clientId);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-tight">Produtos Contratados</h3>
          <p className="text-xs text-muted-foreground">Serviços ativos e histórico de compras</p>
        </div>
        <button className="h-9 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors">
          Vincular Novo Produto
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="col-span-2 text-center py-12 text-muted-foreground">Carregando...</div>
        ) : clientProducts?.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-muted-foreground">Nenhum produto vinculado.</div>
        ) : clientProducts?.map((cp: any) => (
          <div key={cp.id} className="cp-panel p-6 group hover:border-indigo-500/50 transition-all">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                  <Package className="size-6 text-indigo-600" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground text-lg leading-none">{cp.products?.name}</h4>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500 mt-1.5">{cp.products?.category || "SERVIÇO"}</p>
                </div>
              </div>
              <StatusBadge status={cp.status} />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Valor</p>
                <p className="text-sm font-bold font-mono text-emerald-500">{formatBRL(cp.value || cp.products?.price || 0)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Data Contratação</p>
                <p className="text-sm font-medium">{formatDate(cp.created_at)}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <User className="size-3 text-muted-foreground" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground">Responsável: {cp.responsible_id || "Não definido"}</span>
              </div>
              <button className="size-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: any = {
    ativo: { label: "ATIVO", color: "text-emerald-600 bg-emerald-50" },
    em_andamento: { label: "EM ANDAMENTO", color: "text-amber-600 bg-amber-50" },
    aguardando: { label: "AGUARDANDO", color: "text-blue-600 bg-blue-50" },
    finalizado: { label: "FINALIZADO", color: "text-slate-600 bg-slate-50" },
  };
  const config = map[status] || { label: status, color: "text-slate-600 bg-slate-50" };
  return (
    <span className={cn("px-2.5 py-1 rounded-md text-[9px] font-bold tracking-[0.1em] border border-current opacity-80", config.color)}>
      {config.label.toUpperCase()}
    </span>
  );
}
