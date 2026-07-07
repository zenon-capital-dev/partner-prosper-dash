import { useMemo, useState } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/current-user";
import {
  ArrowLeft, Plus, Pencil, MessageSquare,
  FileText, ShoppingBag, FileSignature, ClipboardList,
  History, Info, CreditCard, Sparkles, AlertCircle,
  Building2, UserCheck, TrendingUp, Activity,
  Clock, CheckCircle2, MoreVertical, ShieldAlert,
  ChevronRight, Phone, Mail, Globe, MapPin, Trash2,
  Wallet, PieChart, Star, Users, CalendarClock, Calendar, KeyRound
} from "lucide-react";
import { CredentialsManager } from "@/components/CredentialsManager";
import { ClientLinksPanel } from "@/components/clients/ClientLinksManager";
import { openWhatsApp } from "@/lib/whatsapp";
import { toast } from "sonner";
import { formatBRL, initials, formatDate, formatDoc, formatPhone } from "@/lib/format";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { CompanyFormDialog } from "@/components/clients/CompanyFormDialog";
import { CompanyContactsManager } from "@/components/clients/CompanyContactsManager";
import { confirmAction } from "@/lib/confirm";
import { ClientOverview } from "@/components/clients/tabs/ClientOverview";
import { ClientProducts } from "@/components/clients/tabs/ClientProducts";
import { ClientDocuments } from "@/components/clients/tabs/ClientDocuments";
import { ClientOnboardingTab } from "@/components/clients/tabs/ClientOnboardingTab";
import { ClientContracts } from "@/components/clients/tabs/ClientContracts";
import { ClientFinancial } from "@/components/clients/tabs/ClientFinancial";
import { ClientTasks } from "@/components/clients/tabs/ClientTasks";
import { ClientDeliveries } from "@/components/clients/tabs/ClientDeliveries";
import { ClientHistory } from "@/components/clients/tabs/ClientHistory";
import { ClientTimelineTab } from "@/components/clients/ClientTimelineTab";
import { IntelligentSummary } from "@/components/clients/IntelligentSummary";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INTERACTION_KINDS, kindMeta, type InteractionKind } from "@/lib/interaction-kinds";
import { PageHeader } from "@/components/PageHeader";
import { ClientJourneyBadge } from "@/components/clients/ClientJourneyBadge";

const TABS = [
  { id: "visao-geral", label: "Visão Geral", icon: Info },
  { id: "onboarding", label: "Onboarding", icon: Sparkles },
  { id: "empresas", label: "Empresas", icon: Building2 },
  { id: "vinculos", label: "Vínculos", icon: Users },
  { id: "produtos", label: "Produtos/Demandas", icon: ShoppingBag },
  { id: "documentos", label: "Documentos", icon: FileText },
  { id: "entregas", label: "Entregas", icon: ClipboardList },
  { id: "financeiro", label: "Financeiro", icon: CreditCard },
  { id: "contratos", label: "Contratos", icon: FileSignature },


  
  { id: "relacionamento", label: "Relacionamento", icon: MessageSquare },
  { id: "atividades", label: "Atividades", icon: Calendar },
  { id: "historico", label: "Histórico", icon: History },
  { id: "observacoes", label: "Observações", icon: AlertCircle },
  { id: "acesso", label: "Acesso", icon: KeyRound },
];

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "visao-geral";
  const setActiveTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "visao-geral") next.delete("tab"); else next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };
  const [editOpen, setEditOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [interactionKind, setInteractionKind] = useState<InteractionKind>("abordado");
  const [interactionChannel, setInteractionChannel] = useState<string>("whatsapp");
  const [interactionSummary, setInteractionSummary] = useState("");
  const [interactionNextDate, setInteractionNextDate] = useState("");
  const [interactionNextNote, setInteractionNextNote] = useState("");
  const [savingInteraction, setSavingInteraction] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);

  const openNotesEditor = () => {
    setNotesDraft((client as any)?.internal_notes ?? "");
    setNotesOpen(true);
  };
  const saveNotes = async () => {
    if (!id) return;
    setSavingNotes(true);
    const { error } = await supabase.from("clients").update({ internal_notes: notesDraft }).eq("id", id);
    setSavingNotes(false);
    if (error) return toast.error("Erro ao salvar observações");
    toast.success("Observações atualizadas");
    setNotesOpen(false);
    qc.invalidateQueries({ queryKey: ["client", id] });
  };
  const saveInteraction = async () => {
    if (!id || !interactionSummary.trim()) return toast.error("Descreva o que aconteceu");
    setSavingInteraction(true);
    const uid = await getCurrentUserId();
    const { error } = await (supabase as any).from("client_interactions").insert({
      client_id: id,
      kind: interactionKind,
      channel: interactionChannel,
      summary: interactionSummary.trim(),
      occurred_at: new Date().toISOString(),
      next_action_at: interactionNextDate || null,
      next_action_note: interactionNextNote.trim() || null,
      created_by: uid,
    });
    setSavingInteraction(false);
    if (error) return toast.error(error.message || "Erro ao salvar registro");
    toast.success("Interação registrada");
    setInteractionSummary("");
    setInteractionNextDate("");
    setInteractionNextNote("");
    setInteractionOpen(false);
    qc.invalidateQueries({ queryKey: ["client", id] });
    qc.invalidateQueries({ queryKey: ["client-history", id] });
    qc.invalidateQueries({ queryKey: ["client-interactions", id] });
    qc.invalidateQueries({ queryKey: ["client-timeline", id] });
    qc.invalidateQueries({ queryKey: ["activity-counts"] });
  };


  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(`*, partners!clients_partner_id_fkey(id, full_name, email, commission_percent), referrers!clients_referrer_id_fkey(id, full_name, email), responsible:profiles!clients_responsible_id_fkey(id, full_name, email)`)
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
  });

  const { data: clientProducts = [] } = useQuery({
    queryKey: ["client-products", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_products")
        .select("id, value, status, deadline, sla_due_date, end_date, client_id, product_id, products(id, name)")
        .eq("client_id", id!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
    retry: 1,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["client-payments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, amount_paid, status, due_date, client_id")
        .eq("client_id", id!)
        .order("due_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
    retry: 1,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["client-documents", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, status, client_id")
        .eq("client_id", id!)
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
    retry: 1,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
  });


  const { data: companies = [] } = useQuery({
    queryKey: ["client-companies", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("client_id", id!)
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
    enabled: !!id && activeTab === "empresas",
    staleTime: 60_000,
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ["client-interactions", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("client_interactions")
        .select("*")
        .eq("client_id", id!)
        .order("occurred_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!id && activeTab === "relacionamento",
    staleTime: 60_000,
  });

  const suspendClient = async () => {
    if (!id) return;
    const ok = await confirmAction({ title: "Suspender cliente?", description: "O cliente ficará marcado como inativo. Você pode reativar depois.", confirmText: "Suspender", destructive: true });
    if (!ok) return;
    const { error } = await supabase.from("clients").update({ status: "inativo" as any }).eq("id", id);
    if (error) return toast.error("Erro ao suspender cliente");
    toast.success("Cliente suspenso");
    qc.invalidateQueries({ queryKey: ["client", id] });
  };

  const isLoading = clientLoading;

  const stats = useMemo(() => {
    if (!client) return null;

    const totalRevenue = clientProducts.reduce((s, x) => s + Number(x.value || 0), 0);
    const activeProducts = clientProducts.filter(p => p.status === 'ativo').length;
    const pendingDocs = documents.filter(d => d.status === 'solicitado' || d.status === 'pendente_correcao').length;
    const pendingPayments = payments.filter(p => p.status === 'pendente').length;
    const overduePayments = payments.filter(p => p.status !== 'pago' && p.due_date && new Date(p.due_date) < new Date()).length;
    
    const delayedDemands = clientProducts.filter(p => 
      p.status !== "concluido" && ((p.sla_due_date && new Date(p.sla_due_date) < new Date()) || (p.deadline && new Date(p.deadline) < new Date()))
    ).length;

    const lastUpdate = client.updated_at ? formatDate(client.updated_at) : formatDate(client.created_at);

    // Next recommended action
    let nextAction = { title: "Nenhuma ação pendente", desc: "Tudo em dia com este cliente." };
    
    const delayedProduct = clientProducts.find(p =>
      p.status !== "concluido" && ((p.sla_due_date && new Date(p.sla_due_date) < new Date()) || (p.deadline && new Date(p.deadline) < new Date()))
    );

    if (delayedProduct) {
      nextAction = { 
        title: "Demanda com prazo vencido", 
        desc: `Pendente em: ${(delayedProduct as any).products?.name || "Demanda"}`
      };
    } else if (pendingDocs > 0) {
      nextAction = { title: "Solicitar Documentos", desc: "Existem documentos pendentes de envio ou assinatura." };
    } else if (overduePayments > 0) {
      nextAction = { title: "Cobrar Pagamento", desc: "Há pagamentos vencidos que precisam de atenção." };
    }

    return { 
      totalRevenue, 
      activeProducts, 
      pendingDocs, 
      pendingPayments, 
      overduePayments, 
      delayedDemands, 
      lastUpdate,
      nextAction
    };
  }, [client, clientProducts, payments, documents]);


  if (isLoading) return (
    <div className="p-12 flex flex-col items-center justify-center min-h-[400px] animate-pulse">
      <div className="size-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin mb-4" />
      <p className="text-muted-foreground font-medium">Carregando dossiê do cliente...</p>
    </div>
  );
  
  if (!client || !stats) return (
    <div className="p-12 text-center flex flex-col items-center gap-4">
      <AlertCircle className="size-12 text-destructive/50" />
      <h2 className="text-xl font-bold">Cliente não encontrado</h2>
      <Button variant="outline" onClick={() => navigate("/clientes")}>Voltar para lista</Button>
    </div>
  );

  return (
    <div className="page-shell space-y-5 sm:space-y-6 animate-fade-up">
      {/* Premium Header */}
      <header className="relative space-y-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            aria-label="Voltar para clientes"
            onClick={() => navigate("/clientes")}
            className="rounded-xl border border-border/40 hover:bg-muted size-9 shrink-0"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60 min-w-0">
            <Users className="size-3 shrink-0" />
            <span>CRM</span>
            <ChevronRight className="size-3 shrink-0" />
            <span className="truncate">Dossiê</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 sm:gap-8">
          <div className="flex items-start gap-4 sm:gap-6 min-w-0">
            <div className="size-16 sm:size-18 lg:size-20 rounded-2xl bg-indigo-600/10 border border-indigo-600/20 flex items-center justify-center text-2xl sm:text-3xl font-bold text-indigo-700 shadow-sm shrink-0">
               {initials(client.full_name)}
            </div>
            <div className="space-y-1.5 min-w-0 flex-1">
              <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-slate-900 leading-tight">
                {client.full_name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Building2 className="size-4 shrink-0 text-slate-400" />
                  <span className="font-medium text-slate-700 truncate">{client.company || "Pessoa Física"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="size-4 shrink-0 text-slate-400" />
                  <span className="font-mono text-xs text-slate-600">{formatDoc(client.document)}</span>
                </div>
                <ClientJourneyBadge clientId={client.id} stageId={(client as any).journey_stage_id} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap lg:justify-end">
             <Button
               variant="outline"
               size="sm"
               className="gap-2 bg-emerald-500/5 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10 flex-1 lg:flex-none h-9"
               onClick={() => {
                 const ok = openWhatsApp({ phone: client.whatsapp || client.phone, message: `Olá ${client.full_name?.split(" ")[0] || ""}, tudo bem?` });
                 if (!ok) toast.error("Cliente sem telefone válido");
               }}
             >
               <MessageSquare className="size-4" /> WhatsApp
             </Button>
             
             <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <Button variant="outline" size="sm" className="gap-2 flex-1 lg:flex-none h-9">
                   Ações <ChevronRight className="size-4 rotate-90" />
                 </Button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end" className="w-56">
                 <DropdownMenuLabel>Ações do Cliente</DropdownMenuLabel>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem onClick={() => setEditOpen(true)}>
                   <Pencil className="size-4 mr-2" /> Editar Cadastro
                 </DropdownMenuItem>
                 <DropdownMenuItem onClick={() => setActiveTab("financeiro")}>
                   <Wallet className="size-4 mr-2" /> Gerar Cobrança
                 </DropdownMenuItem>
                 <DropdownMenuItem onClick={() => setActiveTab("documentos")}>
                   <FileText className="size-4 mr-2" /> Solicitar Documento
                 </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/atuacoes?new=true" className="flex items-center">
                      <CalendarClock className="size-4 mr-2" /> Agendar Atuação
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                   <DropdownMenuItem onClick={suspendClient} className="text-destructive focus:text-destructive">
                     <AlertCircle className="size-4 mr-2" /> Suspender Cliente
                   </DropdownMenuItem>
               </DropdownMenuContent>
             </DropdownMenu>
          </div>
        </div>

        {/* Status Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 pt-2">
          <StatusCluster 
            label="Comercial" 
            value={client.status?.replace("_", " ") || "Indefinido"} 
            tone={client.status === 'ativo' ? 'success' : client.status === 'prospecto' ? 'warning' : 'danger'}
          />
          <StatusCluster 
            label="Operacional" 
            value={client.onboarding_status?.replace("_", " ") || "Pendente"} 
            tone={client.onboarding_status === 'concluido' ? 'success' : client.onboarding_status === 'em_andamento' ? 'warning' : 'info'}
          />
          <StatusCluster 
            label="Financeiro" 
            value={client.payment_status?.replace("_", " ") || "Pendente"} 
            tone={client.payment_status === 'pago' ? 'success' : client.payment_status === 'pendente' ? 'warning' : 'danger'}
          />
          <div className="flex flex-col gap-1.5 px-3 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500/70">Responsável</span>
            <div className="flex items-center gap-2 min-w-0">
              <UserCheck className="size-4 text-indigo-600 shrink-0" />
              <span className="text-[13px] font-semibold text-slate-700 truncate">{(client as any).responsible?.full_name || "Sem atribuição"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <MiniCard 
          label="Produtos Ativos" 
          value={stats.activeProducts} 
          icon={<ShoppingBag className="size-4.5 sm:size-5" />}
          tone="primary"
        />
        <MiniCard 
          label="Doc. Pendentes" 
          value={stats.pendingDocs} 
          icon={<FileText className="size-4.5 sm:size-5" />}
          tone={stats.pendingDocs > 0 ? "warning" : "success"}
        />
        <MiniCard 
          label="Pag. Pendentes" 
          value={stats.pendingPayments} 
          icon={<Wallet className="size-4.5 sm:size-5" />}
          tone={stats.pendingPayments > 0 ? "warning" : "success"}
        />
        <MiniCard 
          label="Demandas Atrasadas" 
          value={stats.delayedDemands} 
          icon={<Clock className="size-4.5 sm:size-5" />}
          tone={stats.delayedDemands > 0 ? "danger" : "success"}
        />
        <MiniCard 
          label="Última Atualização" 
          value={stats.lastUpdate} 
          icon={<Activity className="size-4.5 sm:size-5" />}
          tone="info"
        />
        <div className="col-span-2 sm:col-span-3 lg:col-span-1 rounded-2xl p-4 sm:p-5 bg-indigo-600 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_16px_-4px_rgba(79,70,229,0.3)] flex flex-col justify-between min-h-[100px] border border-indigo-700/50 group hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/70">Próxima Ação</span>
            <Sparkles className="size-4 text-white/90 animate-pulse" />
          </div>
          <div className="space-y-1">
            <p className="text-[13.5px] font-bold text-white truncate group-hover:underline underline-offset-4">{stats.nextAction.title}</p>
            <p className="text-[11px] text-indigo-100/80 leading-tight line-clamp-2 font-medium">{stats.nextAction.desc}</p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5 sm:space-y-6">
        <div className="-mx-3 sm:mx-0 overflow-x-auto pb-2 flex tabs-scrollbar">
          <TabsList className="bg-transparent border-b border-border/60 justify-start rounded-none h-11 sm:h-12 p-0 gap-5 sm:gap-8 px-3 sm:px-0 flex-nowrap w-max min-w-full">
            {TABS.map(tab => (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 pb-3 sm:pb-4 pt-2 gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-all whitespace-nowrap"
              >
                <tab.icon className="size-3.5 sm:size-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="min-h-[500px] animate-in fade-in slide-in-from-bottom-2 duration-300">
          <TabsContent value="onboarding" className="m-0">
            {activeTab === "onboarding" && <ClientOnboardingTab clientId={id!} />}
          </TabsContent>

          <TabsContent value="visao-geral" className="m-0 focus-visible:ring-0">
            {activeTab === "visao-geral" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <IntelligentSummary clientId={id!} />
                  <ClientOverview client={client} stats={{ totalRevenue: stats.totalRevenue }} />
                </div>
                <div className="space-y-6">
                  <RelationshipSummary client={client} />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="empresas" className="m-0">
            {activeTab === "empresas" && <div className="cp-panel p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Building2 className="size-4 text-primary" /> Empresas vinculadas
                </h3>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => { setEditingCompany(null); setCompanyOpen(true); }}>
                  <Plus className="size-4" /> Adicionar empresa
                </Button>
              </div>
              {companies.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground border border-dashed border-border/40 rounded-xl">
                  Nenhuma empresa vinculada. {client.company ? `Razão social principal: ${client.company}` : "Clique em \"Adicionar empresa\" para cadastrar."}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {companies.map((co: any) => (
                    <div key={co.id} className="group p-4 rounded-xl border border-border/40 bg-muted/20 space-y-1 hover:border-primary/40 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 className="size-4 text-primary shrink-0" />
                          <p className="font-bold text-sm truncate">{co.name}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" aria-label="Editar empresa" className="size-7" onClick={() => { setEditingCompany(co); setCompanyOpen(true); }}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" aria-label="Remover empresa" className="size-7 text-destructive" onClick={async () => {
                            if (!(await confirmAction("Remover esta empresa?"))) return;
                            const { error } = await supabase.from("companies").delete().eq("id", co.id);
                            if (error) toast.error(error.message);
                            else { toast.success("Empresa removida"); qc.invalidateQueries({ queryKey: ["client-companies", id] }); }
                          }}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                      {co.trade_name && <p className="text-xs text-muted-foreground truncate">{co.trade_name}</p>}
                      {co.document && <p className="text-[11px] font-mono text-muted-foreground">{formatDoc(co.document)}</p>}
                      {(co.address_city || co.address_state) && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1"><MapPin className="size-3" /> {co.address_city}{co.address_state ? ` / ${co.address_state}` : ""}</p>
                      )}
                      <CompanyContactsManager companyId={co.id} />
                    </div>
                  ))}
                </div>
              )}
            </div>}
          </TabsContent>

          <TabsContent value="vinculos" className="m-0">
            {activeTab === "vinculos" && <ClientLinksPanel clientId={id!} />}
          </TabsContent>

          <TabsContent value="produtos" className="m-0">
            {activeTab === "produtos" && <ClientProducts clientId={id!} />}
          </TabsContent>


          <TabsContent value="documentos" className="m-0">
            {activeTab === "documentos" && <ClientDocuments clientId={id!} user_id={client.user_id} />}
          </TabsContent>

          <TabsContent value="entregas" className="m-0">
            {activeTab === "entregas" && <ClientDeliveries clientId={id!} />}
          </TabsContent>

          <TabsContent value="financeiro" className="m-0">
            {activeTab === "financeiro" && <ClientFinancial clientId={id!} />}
          </TabsContent>

          <TabsContent value="contratos" className="m-0">
            {activeTab === "contratos" && <ClientContracts clientId={id!} />}
          </TabsContent>




          <TabsContent value="atividades" className="m-0">
            {activeTab === "atividades" && <ClientTimelineTab clientId={id!} />}
          </TabsContent>

          <TabsContent value="relacionamento" className="m-0">
            {activeTab === "relacionamento" && <div className="cp-panel p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <MessageSquare className="size-4 text-indigo-500" /> Registro de Interações
                </h3>
                <Button onClick={() => setInteractionOpen(true)} variant="ghost" size="sm" className="h-8 text-[11px] font-bold uppercase tracking-wider">
                  <Plus className="size-3.5 mr-1" /> Novo Registro
                </Button>
              </div>
              {/* Resumo do relacionamento */}
              <ClientRelationshipSummary interactions={interactions} />

              {interactions.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground border border-dashed border-border/40 rounded-xl">
                  Nenhuma interação registrada ainda. Clique em "Novo Registro" para começar o histórico de relacionamento.
                </div>
              ) : (
                <div className="space-y-3">
                  {interactions.map((it: any) => {
                    const km = kindMeta(it.kind);
                    return (
                      <div key={it.id} className="flex gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
                        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <MessageSquare className="size-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge variant="outline" className={cn("text-[10px]", km.color)}>{km.label}</Badge>
                            {it.channel && <Badge variant="outline" className="text-[10px] capitalize">{it.channel}</Badge>}
                            <span className="text-[10px] text-muted-foreground/70">{formatDate(it.occurred_at || it.created_at)}</span>
                          </div>
                          <p className="text-xs text-foreground/90 whitespace-pre-wrap">{it.summary || it.title}</p>
                          {it.next_action_at && (
                            <p className="text-[11px] text-indigo-700 mt-1.5">
                              → {it.next_action_note || "Próxima ação"} <b>({formatDate(it.next_action_at)})</b>
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>}
          </TabsContent>

          <TabsContent value="historico" className="m-0">
            {activeTab === "historico" && <ClientHistory clientId={id!} />}
          </TabsContent>

          <TabsContent value="observacoes" className="m-0">
            {activeTab === "observacoes" && <div className="cp-panel p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Observações Internas</h3>
                <Button onClick={openNotesEditor} variant="outline" size="sm">Editar Notas</Button>
              </div>
              <div className="p-4 rounded-xl bg-muted/20 border border-border/40 min-h-[200px] text-sm leading-relaxed text-muted-foreground">
                {client.internal_notes || "Nenhuma observação interna registrada para este cliente."}
              </div>
            </div>}
          </TabsContent>

          <TabsContent value="acesso" className="m-0">
            {activeTab === "acesso" && <CredentialsManager userId={client.user_id} currentEmail={client.email} entityLabel="cliente" entityType="cliente" entityId={client.id} entityName={client.full_name} onUpdated={() => qc.invalidateQueries({ queryKey: ["client", id] })} />}
          </TabsContent>
        </div>
      </Tabs>

      <ClientFormDialog 
        open={editOpen} 
        onOpenChange={setEditOpen} 
        onCreated={() => qc.invalidateQueries({ queryKey: ["client", id] })} 
        client={client} 
      />

      <CompanyFormDialog
        open={companyOpen}
        onOpenChange={(v) => { setCompanyOpen(v); if (!v) setEditingCompany(null); }}
        clientId={id!}
        company={editingCompany}
        onSaved={() => qc.invalidateQueries({ queryKey: ["client-companies", id] })}
      />

      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Observações Internas</DialogTitle>
          </DialogHeader>
          <Textarea rows={8} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} placeholder="Anotações internas..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesOpen(false)}>Cancelar</Button>
            <Button onClick={saveNotes} disabled={savingNotes}>{savingNotes ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={interactionOpen} onOpenChange={setInteractionOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Novo Registro de Interação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo</label>
                <Select value={interactionKind} onValueChange={(v) => setInteractionKind(v as InteractionKind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INTERACTION_KINDS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        <span className="inline-flex items-center gap-2">
                          <span className={cn("size-2 rounded-full", k.dot)} />{k.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Canal</label>
                <Select value={interactionChannel} onValueChange={setInteractionChannel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="ligacao">Ligação</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="reuniao">Reunião</SelectItem>
                    <SelectItem value="presencial">Presencial</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">O que aconteceu</label>
              <Textarea rows={5} placeholder="Resumo da conversa, próximos passos combinados..." value={interactionSummary} onChange={(e) => setInteractionSummary(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">📅 Próxima ação</label>
                <Input type="date" value={interactionNextDate} onChange={(e) => setInteractionNextDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">O que fazer</label>
                <Input placeholder="Ex: ligar para confirmar contrato" value={interactionNextNote} onChange={(e) => setInteractionNextNote(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInteractionOpen(false)}>Cancelar</Button>
            <Button onClick={saveInteraction} disabled={savingInteraction}>{savingInteraction ? "Salvando..." : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusCluster({ label, value, tone }: { label: string; value?: string; tone: 'success' | 'warning' | 'danger' | 'info' }) {
  const colors = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-[0_1px_2px_rgba(16,185,129,0.05)]',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 shadow-[0_1px_2px_rgba(245,158,11,0.05)]',
    danger: 'bg-rose-50 text-rose-700 border-rose-200 shadow-[0_1px_2px_rgba(244,63,94,0.05)]',
    info: 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-[0_1px_2px_rgba(79,70,229,0.05)]'
  };

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500/70">{label}</span>
      <Badge variant="outline" className={cn("w-fit h-[22px] px-2 text-[10px] font-black uppercase tracking-widest truncate", colors[tone])}>
        {value || "N/A"}
      </Badge>
    </div>
  );
}

function MiniCard({ label, value, icon, tone }: { label: string; value: string | number; icon: React.ReactNode; tone: 'primary' | 'success' | 'warning' | 'danger' | 'info' }) {
  const colors = {
    primary: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    success: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    warning: 'text-amber-600 bg-amber-50 border-amber-100',
    danger: 'text-rose-600 bg-rose-50 border-rose-100',
    info: 'text-slate-600 bg-slate-50 border-slate-100'
  };

  return (
    <div className="rounded-2xl p-4 sm:p-5 bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 min-h-[100px] flex flex-col justify-between group">
      <div className="flex items-center justify-between mb-3 gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500/70 leading-tight group-hover:text-slate-600 transition-colors">{label}</span>
        <div className={cn("size-8 sm:size-9 rounded-xl flex items-center justify-center shrink-0 border transition-transform group-hover:scale-110", colors[tone])}>
          {icon}
        </div>
      </div>
      <p className="text-xl sm:text-2xl font-display font-bold tracking-tight text-slate-900 tabular-nums truncate">{value}</p>
    </div>
  );
}

function RelationshipSummary({ client }: any) {
  return (
    <div className="cp-panel p-6 space-y-4">
      <h3 className="text-sm font-bold flex items-center gap-2">
        <UserCheck className="size-4 text-primary" /> Relacionamento
      </h3>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            {client.responsible?.avatar_url ? (
              <img src={client.responsible.avatar_url} alt="" className="size-full object-cover" />
            ) : (
              <UserCheck className="size-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60">Responsável</p>
            <p className="text-sm font-medium">{client.responsible?.full_name || "Sem atribuição"}</p>
          </div>
        </div>
        <div className="h-px bg-border/40" />
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <Mail className="size-3.5 text-muted-foreground" />
            <span className="truncate">{client.email}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Phone className="size-3.5 text-muted-foreground" />
            <span>{formatPhone(client.phone)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Globe className="size-3.5 text-muted-foreground" />
            <span>{client.city} / {client.state}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EngagementCard({ health, risk }: { health: number; risk: string }) {
  return (
    <div className="cp-panel p-6 space-y-4">
      <h3 className="text-sm font-bold flex items-center gap-2">
        <PieChart className="size-4 text-indigo-500" /> Engajamento
      </h3>
      <div className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Engajamento do Cliente</span>
            <span className="font-bold">{health}%</span>
          </div>
          <Progress value={health} className={cn("h-2", 
            health >= 80 ? "[&>div]:bg-emerald-500" : health >= 50 ? "[&>div]:bg-amber-500" : "[&>div]:bg-rose-500"
          )} />
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/40">
          <span className="text-xs text-muted-foreground font-medium">Risco de Churn</span>
          <Badge className={cn("text-[10px] font-black uppercase tracking-widest", 
            risk === 'Alto' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' : 
            risk === 'Médio' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 
            'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
          )}>
            {risk}
          </Badge>
        </div>
      </div>
    </div>
  );
}

