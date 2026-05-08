import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHero } from "@/components/PageHero";
import { 
  TrendingUp, CircleDollarSign, Users, Package, 
  Activity, Wallet, Clock, CheckCircle2, 
  ArrowRight, FileText, LayoutDashboard, Target
} from "lucide-react";
import { formatBRL, formatPercent } from "@/lib/format";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

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
    <div className="page-shell space-y-12 animate-fade-up bg-premium min-h-screen">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-px w-8 bg-primary/40" />
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Executive Cockpit</p>
          </div>
          <h1 className="font-editorial text-5xl lg:text-7xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">
            Visão <span className="text-primary italic">Global</span>.
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/vendas" className="btn-premium px-6 py-3 rounded-2xl flex items-center gap-2 text-sm font-bold transition-all">
            <CircleDollarSign className="size-4" /> Nova Venda
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricTile label="Vendas Totais" value={formatBRL(stats.totalSales)} icon={TrendingUp} tone="primary" />
        <MetricTile label="Comissões Totais" value={formatBRL(stats.totalCommissions)} icon={Wallet} tone="warning" />
        <MetricTile label="Comissões Pagas" value={formatBRL(stats.paidCommissions)} icon={CheckCircle2} tone="success" />
        <MetricTile label="Conversão" value={String(stats.salesCount)} icon={Target} tone="info" sub="vendas concluídas" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 vx-card p-8 space-y-8 bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-white/5 rounded-[32px] hover:border-primary/20 transition-colors shadow-none">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-editorial text-2xl font-bold text-slate-900 dark:text-white">Performance por Produto</h3>
              <p className="text-xs text-muted-foreground">Distribuição de receita nos principais serviços</p>
            </div>
            <Package className="size-6 text-primary/30" />
          </div>
          
          <div className="space-y-6">
            {stats.byProduct.map(([name, value]) => (
              <div key={name} className="space-y-3 group">
                <div className="flex justify-between items-end">
                  <div className="space-y-0.5">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">{name}</span>
                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                      {formatPercent((value / (stats.totalSales || 1)) * 100)} do total
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{formatBRL(value)}</span>
                </div>
                <div className="h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-1000 ease-out" 
                    style={{ width: `${(value / (stats.totalSales || 1)) * 100}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="vx-card p-8 bg-slate-900 dark:bg-slate-950 text-white rounded-[32px] flex flex-col justify-between border-none">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <Activity className="size-6 text-primary" />
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                <div className="size-1 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">Live Analytics</span>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Margem Líquida Est.</p>
              <p className="font-editorial text-5xl font-bold text-white tracking-tight">
                {formatPercent(((stats.totalSales - stats.totalCommissions) / (stats.totalSales || 1)) * 100)}
              </p>
              <p className="text-xs text-white/30 leading-relaxed font-medium">Lucratividade operacional projetada após todos os repasses da rede.</p>
            </div>
          </div>
          
          <div className="pt-8 border-t border-white/5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Ticket Médio</span>
              <span className="font-mono text-sm font-bold text-white">{formatBRL(stats.totalSales / (stats.salesCount || 1))}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Pendências</span>
              <span className="font-mono text-sm font-bold text-amber-400">{formatBRL(stats.pendingCommissions)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="vx-card p-8 space-y-8 bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-white/5 rounded-[32px] shadow-none hover:border-primary/10 transition-colors">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-editorial text-2xl font-bold text-slate-900 dark:text-white">Top Parceiros & Canais</h3>
            <p className="text-xs text-muted-foreground">Origem das maiores conversões da rede</p>
          </div>
          <Users className="size-6 text-primary/30" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {stats.byPartner.map(([name, value]) => (
            <div key={name} className="p-6 rounded-[24px] bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 group hover:border-primary/20 transition-all">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">{name}</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white leading-none">{formatBRL(value)}</p>
              <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-bold text-primary/80 uppercase tracking-widest">{formatPercent((value / (stats.totalSales || 1)) * 100)}</span>
                <ArrowRight className="size-3 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricTile({ label, value, icon: Icon, tone, sub }: any) {
  const tones: any = {
    primary: "bg-primary/5 text-primary border-primary/10",
    success: "bg-emerald-500/5 text-emerald-500 border-emerald-500/10",
    warning: "bg-amber-500/5 text-amber-500 border-amber-500/10",
    info: "bg-blue-500/5 text-blue-500 border-blue-500/10",
  };

  return (
    <div className="vx-card p-6 bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-white/5 rounded-3xl space-y-4 hover:border-primary/20 transition-all group shadow-none">
      <div className={cn("size-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", tones[tone])}>
        <Icon className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">{label}</p>
        <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums leading-none">{value}</p>
        {sub && <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mt-1">{sub}</p>}
      </div>
    </div>
  );
}
