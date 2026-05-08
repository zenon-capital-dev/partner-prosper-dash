import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Plus, Pencil, Wallet, MessageSquare,
  Activity as ActivityIcon, CheckCircle2, Clock3,
  FileText, ShoppingBag, FileSignature, ClipboardList,
  History, Info, CreditCard
} from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
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

  const stats = useMemo(() => {
    const totalRevenue = clientProducts.reduce((s: number, x: any) => s + Number(x.value || 0), 0);
    return { totalRevenue, salesCount: clientProducts.length };
  }, [clientProducts]);

  if (isLoading) return <div className="p-12 text-center text-white/20 font-mono">Loading account details...</div>;
  if (!client) return <div className="p-12 text-center text-rose-400 font-mono">Account not found.</div>;

  return (
    <div className="px-6 py-6 space-y-6 max-w-[1600px] admin-shell">
      {/* Header with back button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/clientes")} className="size-8 rounded-md bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-white/40 hover:text-white transition-colors">
            <ArrowLeft className="size-4" />
          </button>
          <div className="flex items-center gap-4">
            <div className="size-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xl font-bold text-indigo-400">
               {initials(client.full_name)}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                 <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400">● ficha ativa</span>
                 <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/30">CLIENT 360º VIEW</span>
              </div>
              <h1 className="text-[24px] font-semibold tracking-tight text-white leading-none">{client.full_name}</h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
           <button
             onClick={() => {
               const ok = openWhatsApp({
                 phone: client.whatsapp || client.phone,
                 message: `Olá ${client.full_name?.split(" ")[0] || ""}, tudo bem?`,
               });
               if (!ok) toast.error("Cliente sem telefone válido");
             }}
             className="h-8 px-4 rounded-md bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 font-mono font-bold uppercase tracking-wider text-[11.5px] flex items-center gap-1.5 transition-colors"
           >
            <MessageSquare className="size-3.5" /> WhatsApp
           </button>
           <button onClick={() => setEditOpen(true)} className="h-8 px-4 rounded-md bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] text-[11.5px] font-mono font-bold uppercase tracking-wider text-white flex items-center gap-1.5 transition-colors">
            <Pencil className="size-3" /> Editar Cadastro
           </button>
           <button className="h-8 px-4 rounded-md bg-indigo-500 hover:bg-indigo-400 text-white font-mono font-bold uppercase tracking-wider text-[11.5px] flex items-center gap-1.5 transition-colors">
            <Plus className="size-3.5" strokeWidth={3} /> Nova Ação
           </button>
        </div>
      </div>

      <Tabs defaultValue="visao-geral" className="w-full space-y-6">
        <TabsList className="bg-white/[0.03] border border-white/[0.06] p-1 h-auto flex-wrap justify-start">
          <TabsTrigger value="visao-geral" className="gap-2 text-[11px] font-bold uppercase tracking-widest py-2 px-4 data-[state=active]:bg-white/10 data-[state=active]:text-white">
            <Info className="size-3.5" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="produtos" className="gap-2 text-[11px] font-bold uppercase tracking-widest py-2 px-4 data-[state=active]:bg-white/10 data-[state=active]:text-white">
            <ShoppingBag className="size-3.5" /> Produtos
          </TabsTrigger>
          <TabsTrigger value="documentos" className="gap-2 text-[11px] font-bold uppercase tracking-widest py-2 px-4 data-[state=active]:bg-white/10 data-[state=active]:text-white">
            <FileText className="size-3.5" /> Documentos
          </TabsTrigger>
          <TabsTrigger value="contratos" className="gap-2 text-[11px] font-bold uppercase tracking-widest py-2 px-4 data-[state=active]:bg-white/10 data-[state=active]:text-white">
            <FileSignature className="size-3.5" /> Contratos
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="gap-2 text-[11px] font-bold uppercase tracking-widest py-2 px-4 data-[state=active]:bg-white/10 data-[state=active]:text-white">
            <CreditCard className="size-3.5" /> Financeiro
          </TabsTrigger>
          <TabsTrigger value="tarefas" className="gap-2 text-[11px] font-bold uppercase tracking-widest py-2 px-4 data-[state=active]:bg-white/10 data-[state=active]:text-white">
            <ClipboardList className="size-3.5" /> Tarefas
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2 text-[11px] font-bold uppercase tracking-widest py-2 px-4 data-[state=active]:bg-white/10 data-[state=active]:text-white">
            <History className="size-3.5" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral">
          <ClientOverview client={client} stats={stats} />
        </TabsContent>
        <TabsContent value="produtos">
          <ClientProducts clientId={id!} />
        </TabsContent>
        <TabsContent value="documentos">
          <ClientDocuments clientId={id!} />
        </TabsContent>
        <TabsContent value="contratos">
          <ClientContracts clientId={id!} />
        </TabsContent>
        <TabsContent value="financeiro">
          <ClientFinancial clientId={id!} />
        </TabsContent>
        <TabsContent value="tarefas">
          <ClientTasks clientId={id!} />
        </TabsContent>
        <TabsContent value="historico">
          <ClientHistory clientId={id!} />
        </TabsContent>
      </Tabs>

      <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["client", id] })} client={client} />
    </div>
  );
}
