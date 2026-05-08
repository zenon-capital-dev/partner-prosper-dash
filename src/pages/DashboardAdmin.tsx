import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/PageHero";
import { 
  TrendingUp, CircleDollarSign, Users, Package, 
  ArrowUpRight, ArrowDownRight, Activity, 
  CreditCard, Wallet, Receipt, Clock, CheckCircle2
} from "lucide-react";
import { formatBRL, formatPercent } from "@/lib/format";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

export default function DashboardAdmin() {
  const { data: sales = [] } = useQuery({
    queryKey: ["admin-sales-stats"],
    queryFn: async () => (await supabase.from("sales").select("amount, sale_date, status, product_id, partner_id")).data ?? []
  });

  const { data: products = [] } = useQuery({
    queryKey: ["admin-products-simple"],
    queryFn: async () => (await supabase.from("products").select("id, name")).data ?? []
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["admin-partners-simple"],
    queryFn: async () => (await supabase.from("partners").select("id, full_name")).data ?? []
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ["admin-commissions-stats"],
    queryFn: async () => (await supabase.from("commissions").select("amount, status")).data ?? []
  });

  const stats = useMemo(() => {
    const totalSales = sales.reduce((s, x) => s + Number(x.amount || 0), 0);
    const totalCommissions = commissions.reduce((s, x) => s + Number(x.amount || 0), 0);
    const paidCommissions = commissions.filter(c => c.status === 'paga').reduce((s, x) => s + Number(x.amount || 0), 0);
    const pendingCommissions = totalCommissions - paidCommissions;
    
    const byProduct: Record<string, number> = {};
    sales.forEach(s => {
      const p = products.find(x => x.id === s.product_id)?.name || "Outros";
      byProduct[p] = (byProduct[p] || 0) + Number(s.amount || 0);
    });

    const byPartner: Record<string, number> = {};
    sales.forEach(s => {
      const p = partners.find(x => x.id === s.partner_id)?.full_name || "Direto";
      byPartner[p] = (byPartner[p] || 0) + Number(s.amount || 0);
    });

    return {
      totalSales,
      totalCommissions,
      paidCommissions,
      pendingCommissions,
      byProduct: Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 5),
      byPartner: Object.entries(byPartner).sort((a, b) => b[1] - a[1]).slice(0, 5),
      salesCount: sales.length
    };
  }, [sales, products, partners, commissions]);

  return (
    <div className="page-shell space-y-10 animate-fade-up">
      <PageHero
        eyebrow="Visão Geral"
        category="Admin Dashboard"
        title="Painel Executivo"
        description="Monitoramento em tempo real de vendas, comissões e performance da rede."
        icon={<Activity className="size-6 text-primary" />}
        kpis={[
          { label: "Vendas Totais", value: formatBRL(stats.totalSales), tone: "primary", icon: <TrendingUp className="size-4" /> },
          { label: "Comissões Totais", value: formatBRL(stats.totalCommissions), tone: "warning", icon: <Wallet className="size-4" /> },
          { label: "Comissões Pagas", value: formatBRL(stats.paidCommissions), tone: "success", icon: <CheckCircle2 className="size-4" /> },
          { label: "Volume Vendas", value: stats.salesCount, tone: "primary", icon: <Package className="size-4" /> },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="vx-card p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="editorial-title text-xl flex items-center gap-3">
              <Package className="size-5 text-primary" /> Top Produtos
            </h3>
            <span className="editorial-label text-white/20">Receita Acumulada</span>
          </div>
          <div className="space-y-4">
            {stats.byProduct.map(([name, value]) => (
              <div key={name} className="space-y-2 group">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-white/60 group-hover:text-primary transition-colors">{name}</span>
                  <span className="font-mono text-sm font-bold">{formatBRL(value)}</span>
                </div>
                <div className="h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-1000" 
                    style={{ width: `${(value / (stats.totalSales || 1)) * 100}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="vx-card p-8 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="editorial-title text-xl flex items-center gap-3">
              <Users className="size-5 text-primary" /> Top Parceiros
            </h3>
            <span className="editorial-label text-white/20">Volume de Vendas</span>
          </div>
          <div className="space-y-4">
            {stats.byPartner.map(([name, value]) => (
              <div key={name} className="space-y-2 group">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-white/60 group-hover:text-primary transition-colors">{name}</span>
                  <span className="font-mono text-sm font-bold">{formatBRL(value)}</span>
                </div>
                <div className="h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-1000" 
                    style={{ width: `${(value / (stats.totalSales || 1)) * 100}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="vx-card p-6 border-white/[0.05] bg-gradient-to-br from-white/[0.02] to-transparent">
          <p className="editorial-label text-white/20 mb-1">Comissões Pendentes</p>
          <p className="text-2xl font-bold font-mono text-warning">{formatBRL(stats.pendingCommissions)}</p>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-warning/50 uppercase tracking-widest">
            <Clock className="size-3" /> Aguardando Fluxo Financeiro
          </div>
        </div>
        <div className="vx-card p-6 border-white/[0.05] bg-gradient-to-br from-white/[0.02] to-transparent">
          <p className="editorial-label text-white/20 mb-1">LTV Médio por Venda</p>
          <p className="text-2xl font-bold font-mono text-primary">{formatBRL(stats.totalSales / (stats.salesCount || 1))}</p>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-primary/50 uppercase tracking-widest">
            <TrendingUp className="size-3" /> Ticket Médio Saudável
          </div>
        </div>
        <div className="vx-card p-6 border-white/[0.05] bg-gradient-to-br from-white/[0.02] to-transparent">
          <p className="editorial-label text-white/20 mb-1">Margem Líquida Est.</p>
          <p className="text-2xl font-bold font-mono text-emerald-400">{formatPercent(((stats.totalSales - stats.totalCommissions) / (stats.totalSales || 1)) * 100)}</p>
          <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-400/50 uppercase tracking-widest">
            <CircleDollarSign className="size-3" /> Pós-Comissionamento
          </div>
        </div>
      </div>
    </div>
  );
}
