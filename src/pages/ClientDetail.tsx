import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Plus, Pencil, MessageSquare,
  FileText, ShoppingBag, FileSignature, ClipboardList,
  History, Info, CreditCard, Sparkles, AlertCircle
} from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";
import { toast } from "sonner";
import { formatBRL, initials } from "@/lib/format";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { ClientOverview } from "@/components/clients/tabs/ClientOverview";
import { ClientProducts } from "@/components/clients/tabs/ClientProducts";
import { ClientDocuments } from "@/components/clients/tabs/ClientDocuments";
import { ClientContracts } from "@/components/clients/tabs/ClientContracts";
import { ClientFinancial } from "@/components/clients/tabs/ClientFinancial";
import { ClientTasks } from "@/components/clients/tabs/ClientTasks";
import { ClientHistory } from "@/components/clients/tabs/ClientHistory";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "visao-geral", label: "Visão Geral", icon: Info },
  { id: "produtos", label: "Produtos", icon: ShoppingBag },
  { id: "documentos", label: "Documentos", icon: FileText },
  { id: "contratos", label: "Contratos", icon: FileSignature },
  { id: "financeiro", label: "Financeiro", icon: CreditCard },
  { id: "tarefas", label: "Tarefas", icon: ClipboardList },
  { id: "historico", label: "Histórico", icon: History },
];

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [editOpen, setEditOpen] = useState(false);

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*, partners(id,full_name,email,commission_percent)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: clientProducts = [] } = useQuery({
    queryKey: ["client-products", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_products")
        .select("*")
        .eq("client_id", id!);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ["client-contracts", id],
    queryFn: async () => {
      const { data } = await supabase.from("contracts").select("status").eq("client_id", id!);
      return data ?? [];
    },
    enabled: !!id,
  });

  const stats = useMemo(() => {
    const totalRevenue = clientProducts.reduce((s: number, x: any) => s + Number(x.value || 0), 0);
    return { totalRevenue, salesCount: clientProducts.length };
  }, [clientProducts]);

  const suggestion = useMemo(() => {
    if (clientProducts.length === 0) return { title: "Adicionar Produto", desc: "Este cliente ainda não possui produtos vinculados.", action: () => setActiveTab("produtos"), icon: Sparkles };
    const hasUnsigned = contracts.some(c => c.status !== "assinado" && c.status !== "finalizado");
    if (hasUnsigned) return { title: "Cobrar Assinatura", desc: "Existem contratos pendentes de assinatura.", action: () => setActiveTab("contratos"), icon: AlertCircle };
    return null;
  }, [clientProducts, contracts]);

  if (isLoading) return <div className="p-12 text-center text-white/20 font-mono">Loading account details...</div>;
  if (!client) return <div className="p-12 text-center text-rose-400 font-mono">Account not found.</div>;

  return (
    <div className="page-shell space-y-8 animate-fade-up">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-5">
          <button onClick={() => navigate("/clientes")} className="size-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.08] transition-all">
            <ArrowLeft className="size-5" />
          </button>
          <div className="flex items-center gap-5">
            <div className="size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl font-bold text-primary shadow-[0_0_40px_rgba(var(--primary-rgb),0.1)]">
               {initials(client.full_name)}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                 <span className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-emerald-400 px-2 py-0.5 bg-emerald-400/10 rounded-full border border-emerald-400/20">Ficha Ativa</span>
                 <span className="editorial-label">Client Management Console</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white">{client.full_name}</h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
           <button
             onClick={() => {
               const ok = openWhatsApp({ phone: client.whatsapp || client.phone, message: `Olá ${client.full_name?.split(" ")[0] || ""}, tudo bem?` });
               if (!ok) toast.error("Cliente sem telefone válido");
             }}
             className="action-button btn-success"
           >
            <MessageSquare className="size-4" /> WhatsApp
           </button>
           <button onClick={() => setEditOpen(true)} className="action-button btn-outline">
            <Pencil className="size-3.5" /> Editar Cadastro
           </button>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="stats-strip">
        <div className="stats-item">
          <p className="editorial-label mb-1">Portfolio LTV</p>
          <p className="text-2xl font-bold font-mono tracking-tight">{formatBRL(stats.totalRevenue)}</p>
        </div>
        <div className="stats-item">
          <p className="editorial-label mb-1">Produtos Ativos</p>
          <p className="text-2xl font-bold font-mono tracking-tight text-primary">{stats.salesCount}</p>
        </div>
        <div className="stats-item">
          <p className="editorial-label mb-1">Status Principal</p>
          <p className="text-2xl font-bold tracking-tight capitalize">{client.status?.replace("_", " ") || "Prospecto"}</p>
        </div>
        <div className="stats-item">
          <p className="editorial-label mb-1">Parceiro</p>
          <p className="text-lg font-semibold truncate text-white/60">{client.partners?.full_name || "Direto"}</p>
        </div>
      </div>

      {/* Suggestion banner if any */}
      {suggestion && (
        <div className="suggested-card group">
          <div className="flex items-center gap-4">
            <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <suggestion.icon className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{suggestion.title}</p>
              <p className="text-xs text-white/40">{suggestion.desc}</p>
            </div>
          </div>
          <button onClick={suggestion.action} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity">
            Resolver Agora
          </button>
        </div>
      )}

      {/* Main Grid Content */}
      <div className="detail-shell">
        {/* Navigation Sidebar */}
        <aside className="nav-sidebar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn("nav-item w-full", activeTab === tab.id && "active")}
            >
              <tab.icon className="size-4" />
              {tab.label}
            </button>
          ))}
        </aside>

        {/* Dynamic Content Area */}
        <main className="min-h-[600px] animate-fade-up" key={activeTab}>
          {activeTab === "visao-geral" && <ClientOverview client={client} stats={stats} />}
          {activeTab === "produtos" && <ClientProducts clientId={id!} />}
          {activeTab === "documentos" && <ClientDocuments clientId={id!} user_id={client.user_id} />}
          {activeTab === "contratos" && <ClientContracts clientId={id!} />}
          {activeTab === "financeiro" && <ClientFinancial clientId={id!} />}
          {activeTab === "tarefas" && <ClientTasks clientId={id!} />}
          {activeTab === "historico" && <ClientHistory clientId={id!} />}
        </main>
      </div>

      <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["client", id] })} client={client} />
    </div>
  );
}
