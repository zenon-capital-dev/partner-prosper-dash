import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  TrendingUp, CircleDollarSign, Users, Package, 
  Activity, Wallet, Clock, CheckCircle2, 
  AlertCircle, FileWarning, UserPlus, CreditCard,
  FileSignature, MessageSquare, ArrowRight,
  BarChart3, Target, PieChart, Info
} from "lucide-react";
import { formatBRL, formatPercent } from "@/lib/format";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart as RePieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';

export default function DashboardAdmin() {
  // --- Data Fetching ---
  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ["admin-dashboard-clients"],
    queryFn: async () => (await supabase.from("clients").select("id, status, source, origin, created_at")).data ?? []
  });

  const { data: clientProducts = [], isLoading: loadingDemands } = useQuery({
    queryKey: ["admin-dashboard-client-products"],
    queryFn: async () => (await supabase.from("client_products").select("id, status, deadline, service_provider_id, product_id, value, created_at")).data ?? []
  });

  const { data: products = [] } = useQuery({
    queryKey: ["admin-dashboard-products"],
    queryFn: async () => (await supabase.from("products").select("id, name")).data ?? []
  });

  const { data: sales = [] } = useQuery({
    queryKey: ["admin-dashboard-sales"],
    queryFn: async () => (await supabase.from("sales").select("amount, sale_date, status, product_id, partner_id")).data ?? []
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["admin-dashboard-payments"],
    queryFn: async () => (await supabase.from("payments").select("amount, status, due_date")).data ?? []
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ["admin-dashboard-commissions"],
    queryFn: async () => (await supabase.from("commissions").select("amount, status, partner_id, partner:partners(full_name)")).data ?? []
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["admin-dashboard-providers"],
    queryFn: async () => (await supabase.from("service_providers").select("id, active")).data ?? []
  });

  const { data: partners = [] } = useQuery({
    queryKey: ["admin-dashboard-partners"],
    queryFn: async () => (await supabase.from("partners").select("id, active, full_name")).data ?? []
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["admin-dashboard-documents"],
    queryFn: async () => (await supabase.from("documents").select("id, status, client_id")).data ?? []
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["admin-dashboard-contracts"],
    queryFn: async () => (await supabase.from("contracts").select("id, client_id, status")).data ?? []
  });

  // --- Statistics Calculation ---
  const stats = useMemo(() => {
    const now = new Date();
    
    // KPI Data
    const totalClients = clients.length;
    const activeClients = clients.filter((c: any) => c.status === 'ativo').length;
    const pendingClients = clients.filter((c: any) => c.status === 'prospecto').length;
    
    const inProgressProducts = clientProducts.filter(p => p.status === 'em_andamento').length;
    const completedProducts = clientProducts.filter(p => p.status === 'concluido').length;
    const delayedProducts = clientProducts.filter(p => 
      (p.status === 'atrasado') || 
      (p.deadline && new Date(p.deadline) < now && p.status !== 'concluido' && p.status !== 'cancelado')
    ).length;

    const totalSold = sales.reduce((acc, s) => acc + Number(s.amount || 0), 0);
    const totalReceived = payments.filter(p => p.status === 'pago').reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const totalPending = totalSold - totalReceived;
    
    const commissionsToPay = commissions.filter(c => c.status === 'pendente').reduce((acc, c) => acc + Number(c.amount || 0), 0);
    
    const activeProvidersCount = providers.filter(p => p.active).length;
    const activePartnersCount = partners.filter(p => p.active).length;

    // Chart Data: Monthly Revenue
    const monthlyRevenue: Record<string, number> = {};
    sales.forEach(s => {
      if (!s.sale_date) return;
      const date = new Date(s.sale_date);
      const month = date.toLocaleString('pt-BR', { month: 'short' });
      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + Number(s.amount || 0);
    });
    const revenueChartData = Object.entries(monthlyRevenue).map(([name, value]) => ({ name, value }));

    // Chart Data: Best Selling Products
    const productSales: Record<string, number> = {};
    clientProducts.forEach(cp => {
      const p = products.find(x => x.id === cp.product_id)?.name || "Outros";
      productSales[p] = (productSales[p] || 0) + 1;
    });
    const bestSellingChartData = Object.entries(productSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));

    // Chart Data: Status of Demands
    const statusCounts: Record<string, number> = {};
    clientProducts.forEach(cp => {
      const s = cp.status || "Indefinido";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    const statusChartData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

    // Chart Data: Commissions by Partner
    const partnerCommissions: Record<string, number> = {};
    commissions.forEach(c => {
      const p = (c.partner as any)?.full_name || "Direto";
      partnerCommissions[p] = (partnerCommissions[p] || 0) + Number(c.amount || 0);
    });
    const commissionsPartnerChartData = Object.entries(partnerCommissions)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));

    // Chart Data: Clients by Origin
    const originCounts: Record<string, number> = {};
    clients.forEach((c: any) => {
      const o = c.source || c.origin || "Outros";
      originCounts[o] = (originCounts[o] || 0) + 1;
    });
    const originChartData = Object.entries(originCounts).map(([name, value]) => ({ name, value }));

    // Urgent Tasks
    const urgentTasks = [
      {
        id: 'docs',
        label: 'Documentos Pendentes',
        count: documents.filter(d => d.status === 'solicitado' || d.status === 'enviado').length,
        icon: FileWarning,
        link: '/documentos',
        color: 'text-amber-500'
      },
      {
        id: 'late',
        label: 'Produtos Atrasados',
        count: delayedProducts,
        icon: Clock,
        link: '/vendas',
        color: 'text-rose-500'
      },
      {
        id: 'no-provider',
        label: 'Sem Prestador Delegado',
        count: clientProducts.filter(p => !p.service_provider_id && p.status !== 'concluido' && p.status !== 'cancelado').length,
        icon: UserPlus,
        link: '/vendas',
        color: 'text-indigo-500'
      },
      {
        id: 'payments',
        label: 'Pagamentos Pendentes',
        count: payments.filter(p => p.status === 'pendente').length,
        icon: CreditCard,
        link: '/financeiro',
        color: 'text-emerald-500'
      },
      {
        id: 'contracts',
        label: 'Contratos não Anexados',
        count: clients.filter(c => !contracts.some(con => con.client_id === c.id)).length,
        icon: FileSignature,
        link: '/contratos',
        color: 'text-blue-500'
      },
      {
        id: 'contracts-sign',
        label: 'Contratos Aguardando Assinatura',
        count: contracts.filter(c => c.status === 'aguardando_assinatura' || c.status === 'enviado').length,
        icon: FileSignature,
        link: '/contratos',
        color: 'text-orange-500'
      },
      {
        id: 'awaiting',
        label: 'Aguardando Resposta',
        count: clientProducts.filter(p => p.status === 'em_revisao').length,
        icon: MessageSquare,
        link: '/vendas',
        color: 'text-violet-500'
      }
    ].filter(t => t.count > 0);

    return {
      kpis: [
        { label: "Total de Clientes", value: String(totalClients), icon: Users, tone: "info" },
        { label: "Clientes Ativos", value: String(activeClients), icon: CheckCircle2, tone: "success" },
        { label: "Clientes Pendentes", value: String(pendingClients), icon: Clock, tone: "warning" },
        { label: "Produtos em Andamento", value: String(inProgressProducts), icon: Activity, tone: "primary" },
        { label: "Produtos Concluídos", value: String(completedProducts), icon: CheckCircle2, tone: "success" },
        { label: "Produtos Atrasados", value: String(delayedProducts), icon: AlertCircle, tone: "danger" },
        { label: "Total Vendido", value: formatBRL(totalSold), raw: totalSold, icon: TrendingUp, tone: "primary" },
        { label: "Total Recebido", value: formatBRL(totalReceived), raw: totalReceived, icon: CircleDollarSign, tone: "success" },
        { label: "Total Pendente", value: formatBRL(totalPending), raw: totalPending, icon: Wallet, tone: "warning" },
        { label: "Comissões a Pagar", value: formatBRL(commissionsToPay), raw: commissionsToPay, icon: CreditCard, tone: "danger" },
        { label: "Prestadores Ativos", value: String(activeProvidersCount), icon: Users, tone: "info" },
        { label: "Parceiros Ativos", value: String(activePartnersCount), icon: Users, tone: "info" },
      ],
      revenueChartData,
      bestSellingChartData,
      statusChartData,
      commissionsPartnerChartData,
      originChartData,
      urgentTasks,
      totalSold,
      totalReceived,
      totalPending
    };
  }, [clients, clientProducts, products, sales, payments, commissions, providers, partners, documents, contracts]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  return (
    <div className="page-shell space-y-12 animate-fade-up bg-premium min-h-screen">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-px w-8 bg-primary/40" />
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Executive Cockpit</p>
          </div>
          <h1 className="font-editorial text-5xl lg:text-7xl font-bold tracking-tighter text-slate-900 dark:text-white leading-[0.9]">
            Dashboard <span className="text-primary italic font-medium">Admin</span>.
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/vendas" className="btn-premium px-6 py-3 rounded-2xl flex items-center gap-2 text-sm font-bold transition-all">
            <CircleDollarSign className="size-4" /> Nova Venda
          </Link>
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {stats.kpis.map((kpi, i) => (
          <MetricTile key={i} {...kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* REVENUE CHART */}
        <div className="lg:col-span-2 vx-card p-8 space-y-6 bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-white/5 rounded-[32px]">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-editorial text-2xl font-bold text-slate-900 dark:text-white">Receita Mensal</h3>
              <p className="text-xs text-muted-foreground">Evolução financeira dos últimos meses</p>
            </div>
            <TrendingUp className="size-6 text-primary/30" />
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.revenueChartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => formatBRL(Number(value))}
                />
                <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* URGENT TASKS */}
        <div className="vx-card p-8 bg-slate-900 dark:bg-slate-950 text-white rounded-[32px] border-none flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <AlertCircle className="size-6 text-amber-400" />
              <h3 className="font-editorial text-2xl font-bold">Tarefas Urgentes</h3>
            </div>
            <Badge variant="outline" className="text-white border-white/20 bg-white/5">
              {stats.urgentTasks.reduce((acc, t) => acc + t.count, 0)} total
            </Badge>
          </div>
          
          <div className="flex-1 space-y-4 overflow-y-auto pr-2 max-h-[400px]">
            {stats.urgentTasks.length > 0 ? (
              stats.urgentTasks.map((task) => (
                <Link 
                  key={task.id}
                  to={task.link}
                  className="group flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2 rounded-xl bg-white/5", task.color)}>
                      <task.icon className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white group-hover:text-primary transition-colors">{task.label}</p>
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{task.count} pendências</p>
                    </div>
                  </div>
                  <ArrowRight className="size-4 text-white/20 group-hover:text-white transition-all group-hover:translate-x-1" />
                </Link>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full space-y-3 opacity-40 py-12">
                <CheckCircle2 className="size-10" />
                <p className="text-sm font-medium">Tudo em dia por aqui!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* BEST SELLING PRODUCTS */}
        <ChartCard title="Produtos mais Vendidos" subtitle="Volume por categoria de serviço" icon={Package}>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.bestSellingChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} />
              <Tooltip 
                cursor={{fill: 'transparent'}}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="value" fill="#6366f1" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* STATUS DISTRIBUTION */}
        <ChartCard title="Status das Demandas" subtitle="Distribuição operacional atual" icon={Activity}>
          <ResponsiveContainer width="100%" height={250}>
            <RePieChart>
              <Pie
                data={stats.statusChartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {stats.statusChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
            </RePieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-4">
            {stats.statusChartData.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="size-2 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{entry.name}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* COMMISSIONS BY PARTNER */}
        <ChartCard title="Comissões por Parceiro" subtitle="Repasses acumulados por canal" icon={Users}>
          <div className="space-y-4">
            {stats.commissionsPartnerChartData.length > 0 ? (
              stats.commissionsPartnerChartData.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                      {item.name.charAt(0)}
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{item.name}</span>
                  </div>
                  <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">{formatBRL(item.value)}</span>
                </div>
              ))
            ) : (
              <p className="text-center py-12 text-sm text-muted-foreground">Sem dados de comissões.</p>
            )}
          </div>
        </ChartCard>

        {/* CLIENTS BY ORIGIN */}
        <ChartCard title="Clientes por Origem" subtitle="Canais de aquisição de leads" icon={BarChart3}>
          <ResponsiveContainer width="100%" height={250}>
            <RePieChart>
              <Pie
                data={stats.originChartData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {stats.originChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
            </RePieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* CUSTOM KPI SECTION: Financial Overview */}
        <div className="md:col-span-2 vx-card p-8 space-y-8 bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-white/5 rounded-[32px]">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-editorial text-2xl font-bold text-slate-900 dark:text-white">Panorama Financeiro</h3>
              <p className="text-xs text-muted-foreground">Comparativo entre faturamento e recebíveis</p>
            </div>
            <Wallet className="size-6 text-primary/30" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FinancialStat 
              label="Total Vendido" 
              value={formatBRL(stats.totalSold)} 
              sub="Faturamento Bruto"
              color="text-primary"
            />
            <FinancialStat 
              label="Total Recebido" 
              value={formatBRL(stats.totalReceived)} 
              sub="Dinheiro em Caixa"
              color="text-emerald-500"
            />
            <FinancialStat 
              label="Total Pendente" 
              value={formatBRL(stats.totalPending)} 
              sub="A Receber"
              color="text-amber-500"
            />
          </div>

          <div className="h-4 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden flex">
            <div 
              className="h-full bg-emerald-500 transition-all duration-1000" 
              style={{ width: `${(stats.totalReceived / (stats.totalSold || 1)) * 100}%` }} 
            />
            <div className="h-full bg-amber-500/20" style={{flex: 1}} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricTile({ label, value, icon: Icon, tone }: any) {
  const tones: any = {
    primary: "bg-primary/5 text-primary border-primary/10",
    success: "bg-emerald-500/5 text-emerald-500 border-emerald-500/10",
    warning: "bg-amber-500/5 text-amber-500 border-amber-500/10",
    info: "bg-blue-500/5 text-blue-500 border-blue-500/10",
    danger: "bg-rose-500/5 text-rose-500 border-rose-500/10",
  };

  return (
    <div className="vx-card p-5 bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-white/5 rounded-3xl space-y-3 hover:border-primary/20 transition-all group shadow-none">
      <div className={cn("size-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", tones[tone])}>
        <Icon className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 leading-none">{label}</p>
        <p className="text-xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums leading-none truncate">{value}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, icon: Icon, children }: any) {
  return (
    <div className="vx-card p-8 space-y-6 bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-white/5 rounded-[32px]">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="font-editorial text-2xl font-bold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Icon className="size-6 text-primary/30" />
      </div>
      <div className="pt-2">
        {children}
      </div>
    </div>
  );
}

function FinancialStat({ label, value, sub, color }: any) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</p>
      <p className={cn("text-2xl font-bold tabular-nums", color)}>{value}</p>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{sub}</p>
    </div>
  );
}
