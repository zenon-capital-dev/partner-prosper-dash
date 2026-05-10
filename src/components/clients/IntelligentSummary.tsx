import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Activity, 
  CheckCircle2, 
  Clock, 
  FileText, 
  CreditCard, 
  FileSignature, 
  AlertTriangle,
  Heart,
  ShieldAlert,
  User,
  ArrowRight,
  TrendingUp,
  MessageSquare,
  Sparkles,
  ShoppingBag
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface IntelligentSummaryProps {
  clientId: string;
}

export function IntelligentSummary({ clientId }: IntelligentSummaryProps) {
  const { data: client } = useQuery({
    queryKey: ["client-summary", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("*, partners(full_name), responsible:profiles(full_name)")
        .eq("id", clientId)
        .single();
      return data;
    }
  });

  const { data: products = [] } = useQuery({
    queryKey: ["client-products-summary", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_products")
        .select("*")
        .eq("client_id", clientId);
      return data || [];
    }
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["client-documents-summary", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("documents")
        .select("*")
        .eq("client_id", clientId);
      return data || [];
    }
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["client-payments-summary", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("client_id", clientId);
      return data || [];
    }
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["client-contracts-summary", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("contracts")
        .select("*")
        .eq("client_id", clientId);
      return data || [];
    }
  });

  if (!client) return null;

  const activeProducts = products.filter(p => p.status !== "concluido" && p.status !== "cancelado");
  const completedProducts = products.filter(p => p.status === "concluido");
  const delayedProducts = products.filter(p => p.sla_status === "atrasado");
  
  const pendingDocs = documents.filter(d => d.status === "solicitado" || d.status === "reprovado");
  const pendingPayments = payments.filter(p => p.status === "pendente");
  const pendingContracts = contracts.filter(c => c.status === "criado" || c.status === "enviado" || c.status === "aguardando_assinatura");

  const lastUpdate = client.updated_at ? format(new Date(client.updated_at), "dd 'de' MMMM", { locale: ptBR }) : "Sem dados";

  // Logic for automatic text
  const generateSummaryText = () => {
    let parts = [];
    parts.push(`Cliente com ${activeProducts.length} ${activeProducts.length === 1 ? 'produto ativo' : 'produtos ativos'}.`);
    
    if (delayedProducts.length > 0) {
      const names = delayedProducts.map(p => p.custom_product_name || 'Produto').join(", ");
      parts.push(`${names} ${delayedProducts.length === 1 ? 'está atrasado' : 'estão atrasados'}${delayedProducts[0].delay_reason ? ` por ${delayedProducts[0].delay_reason}` : ''}.`);
    }

    const inProgress = activeProducts.filter(p => p.sla_status !== "atrasado");
    if (inProgress.length > 0) {
      parts.push(`${inProgress.length === 1 ? 'Um produto está' : `${inProgress.length} produtos estão`} em andamento dentro do prazo.`);
    }

    if (pendingPayments.length > 0 || pendingDocs.length > 0) {
      let financeParts = [];
      if (pendingPayments.length > 0) financeParts.push(`${pendingPayments.length} ${pendingPayments.length === 1 ? 'pagamento pendente' : 'pagamentos pendentes'}`);
      if (pendingDocs.length > 0) financeParts.push(`${pendingDocs.length} ${pendingDocs.length === 1 ? 'documento aguardando envio' : 'documentos aguardando envio'}`);
      parts.push(`Existe ${financeParts.join(" e ")}.`);
    }

    return parts.join(" ");
  };

  const getNextAction = () => {
    if (pendingDocs.length > 0) return "Cobrar documentos pendentes";
    if (pendingPayments.length > 0) return "Verificar pagamentos em aberto";
    if (pendingContracts.length > 0) return "Solicitar assinatura de contratos";
    if (delayedProducts.length > 0) return "Acompanhar demandas atrasadas";
    return "Nenhuma ação crítica pendente";
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 50) return "text-amber-500";
    return "text-rose-500";
  };

  const getRiskColor = (risk: string) => {
    switch (risk?.toLowerCase()) {
      case 'baixo': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'médio': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'alto': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default: return 'bg-white/5 text-white/40 border-white/10';
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main Smart Summary */}
        <div className="lg:col-span-3 cp-panel p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
            <Activity className="size-32" />
          </div>
          
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4">
              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Sparkles className="size-4" />
              </div>
              <h2 className="text-lg font-bold tracking-tight">Resumo Inteligente</h2>
              <span className={cn(
                "ml-auto text-[10px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                client.status === 'ativo' ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" : "bg-white/5 text-white/40 border-white/10"
              )}>
                {client.status || 'Prospecto'}
              </span>
            </div>

            <p className="text-white/70 leading-relaxed mb-6 italic text-sm">
              "{generateSummaryText()}"
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-auto">
              <div className="space-y-1">
                <p className="editorial-label text-[9px]">Responsável</p>
                <div className="flex items-center gap-2">
                  <User className="size-3 text-white/40" />
                  <p className="text-xs font-medium truncate">{client.responsible?.full_name || 'Não atribuído'}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="editorial-label text-[9px]">Parceiro</p>
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-3 text-white/40" />
                  <p className="text-xs font-medium truncate">{client.partners?.full_name || 'Direto'}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="editorial-label text-[9px]">Última Atualização</p>
                <div className="flex items-center gap-2">
                  <Clock className="size-3 text-white/40" />
                  <p className="text-xs font-medium">{lastUpdate}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="editorial-label text-[9px]">Próxima Ação</p>
                <div className="flex items-center gap-2">
                  <ArrowRight className="size-3 text-primary" />
                  <p className="text-xs font-bold text-primary truncate">{getNextAction()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Health & Risk Stats */}
        <div className="cp-panel p-6 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="editorial-label text-[9px] mb-1">Health Score</p>
                <div className="flex items-center gap-2">
                  <Heart className={cn("size-5", getHealthColor(client.health_score || 100))} />
                  <span className={cn("text-2xl font-bold font-mono", getHealthColor(client.health_score || 100))}>
                    {client.health_score || 100}%
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="editorial-label text-[9px] mb-1 text-right">Risco</p>
                <span className={cn("px-2 py-1 rounded-md text-[10px] font-bold border uppercase tracking-wider", getRiskColor(client.churn_risk))}>
                  {client.churn_risk || 'Baixo'}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <QuickStat 
                icon={ShoppingBag} 
                label="Produtos" 
                value={`${activeProducts.length} Ativos`} 
                subValue={`${completedProducts.length} Concluídos`} 
                color="text-primary"
              />
              <QuickStat 
                icon={FileText} 
                label="Documentos" 
                value={`${pendingDocs.length} Pendentes`} 
                color={pendingDocs.length > 0 ? "text-amber-500" : "text-white/40"}
              />
              <QuickStat 
                icon={CreditCard} 
                label="Financeiro" 
                value={`${pendingPayments.length} Pendentes`} 
                color={pendingPayments.length > 0 ? "text-rose-500" : "text-white/40"}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStat({ icon: Icon, label, value, subValue, color }: any) {
  return (
    <div className="flex items-center justify-between group cursor-default">
      <div className="flex items-center gap-3">
        <div className="size-7 rounded-lg bg-white/5 flex items-center justify-center text-white/40 group-hover:text-white transition-colors">
          <Icon className="size-3.5" />
        </div>
        <div>
          <p className="text-[10px] text-white/40 font-medium">{label}</p>
          <p className={cn("text-xs font-bold", color)}>{value}</p>
        </div>
      </div>
      {subValue && (
        <span className="text-[9px] text-white/20 font-mono italic">{subValue}</span>
      )}
    </div>
  );
}
