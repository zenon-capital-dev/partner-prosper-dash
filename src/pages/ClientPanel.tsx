import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Package, FileText, Download, Upload, CheckCircle2, Clock, AlertCircle,
  Calendar, Receipt, ShoppingBag, Inbox, Mail, Phone, ClipboardList, History, ArrowRight,
} from "lucide-react";
import { formatBRL, formatDate, initials } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const cycleLabel: Record<string, string> = {
  mensal: "/mês", trimestral: "/trim.", semestral: "/sem.", anual: "/ano", unico: "único",
};

export default function ClientPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["client-panel", user?.id],
    queryFn: async () => {
      const { data: client } = await supabase
        .from("clients")
        .select("id, full_name, email, phone, company, status, created_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!client) return null;

      const [subs, sales, docs, catalog, requests, contracts, timeline, payments] = await Promise.all([
        supabase.from("client_subscriptions").select("*, products(name, description, product_categories(name, color))").eq("client_id", client.id).order("created_at", { ascending: false }),
        supabase.from("sales").select("id, amount, sale_date, status, products(name)").eq("client_id", client.id).order("sale_date", { ascending: false }),
        supabase.from("documents").select("*").eq("client_id", client.id).order("created_at", { ascending: false }),
        supabase.from("products").select("id, name, description, base_price, recurring, product_categories(name, color)").eq("active", true),
        supabase.from("document_requests").select("*").eq("client_id", client.id).order("requested_at", { ascending: false }),
        supabase.from("contracts").select("id, name, status, amount, signed_at, sent_at, file_path, created_at, products(name)").eq("client_id", client.id).order("created_at", { ascending: false }),
        supabase.from("client_timeline").select("*").eq("client_id", client.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("payments").select("id, amount, due_date, status, paid_at, payment_method, installment_number, installments_count").eq("client_id", client.id).order("due_date", { ascending: false }),
      ]);

      return {
        client,
        subscriptions: subs.data ?? [],
        sales: sales.data ?? [],
        docs: docs.data ?? [],
        catalog: catalog.data ?? [],
        requests: requests.data ?? [],
        contracts: contracts.data ?? [],
        timeline: timeline.data ?? [],
        payments: payments.data ?? [],
      };
    },
    enabled: !!user,
  });

  if (isLoading) return <div className="p-12 text-center text-sm font-editorial italic text-muted-foreground">Coletando suas informações...</div>;
  
  if (!data) return (
    <div className="min-h-[70vh] flex items-center justify-center p-8 bg-premium">
      <div className="vx-card p-12 max-w-lg text-center shadow-2xl bg-white/40 backdrop-blur-xl border-white/20">
        <Inbox className="size-12 text-primary/30 mx-auto mb-6" />
        <h2 className="font-editorial text-3xl font-bold tracking-tight mb-3">Sua experiência está sendo preparada</h2>
        <p className="text-muted-foreground leading-relaxed">
          Nossa equipe está configurando seu acesso personalizado. <br/>Em breve você terá acesso a todo o seu ecossistema.
        </p>
      </div>
    </div>
  );

  const { client, subscriptions, sales, docs, catalog, requests, contracts, timeline, payments } = data;
  const activeSubs = subscriptions.filter((s: any) => s.status === "ativa");
  const monthlyTotal = activeSubs.filter((s: any) => s.billing_cycle === "mensal").reduce((sum: number, s: any) => sum + Number(s.amount), 0);
  const pendingDocs = requests.filter((r: any) => r.status === "solicitado" || r.status === "reprovado").length;
  const availableCatalog = catalog.filter((p: any) => !subscriptions.find((s: any) => s.product_id === p.id));

  return (
    <div className="bg-premium min-h-screen">
      <div className="page-shell space-y-12 py-12">
        {/* Header Section */}
        <section className="relative overflow-hidden rounded-[32px] bg-white p-8 lg:p-14 border border-slate-100 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.05)] group">
          <div className="absolute top-0 right-0 size-96 bg-primary/5 blur-[120px] -mr-48 -mt-48 rounded-full transition-all group-hover:bg-primary/10" />
          
          <div className="flex flex-col lg:flex-row lg:items-center gap-10 relative">
             <div className="size-24 lg:size-28 rounded-[28px] bg-slate-900 text-white flex items-center justify-center font-editorial text-4xl shadow-2xl ring-8 ring-slate-50">
               {initials(client.full_name)}
             </div>
             <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="h-px w-8 bg-primary/30" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary/60">Private Client Portal</span>
                </div>
                <h1 className="font-editorial text-4xl lg:text-6xl font-bold tracking-tight text-slate-900 leading-[1.1]">
                  Bem-vindo, <br/><span className="text-primary italic">{client.full_name.split(' ')[0]}</span>.
                </h1>
                <div className="flex flex-wrap items-center gap-6 text-[13px] text-muted-foreground font-medium pt-3">
                   <span className="flex items-center gap-2"><Mail className="size-4 text-primary/40" /> {client.email}</span>
                   {client.phone && <span className="flex items-center gap-2"><Phone className="size-4 text-primary/40" /> {client.phone}</span>}
                </div>
             </div>

             <div className="grid grid-cols-2 sm:grid-cols-3 gap-10 lg:pl-16 lg:border-l border-slate-100">
                <PremiumStat label="Serviços" value={String(activeSubs.length)} />
                <PremiumStat label="Investimento" value={formatBRL(monthlyTotal)} sub="recorrência" />
                <PremiumStat label="Documentos" value={String(pendingDocs)} tone={pendingDocs > 0 ? "warning" : "success"} />
             </div>
          </div>
        </section>

        {/* Navigation Tabs */}
        <Tabs defaultValue="meus-produtos" className="space-y-10">
          <TabsList className="bg-transparent h-auto p-0 flex-wrap gap-x-12 gap-y-4 justify-start border-b border-slate-200 w-full rounded-none pb-px">
            <PremiumTabTrigger value="meus-produtos" label="Meus Serviços" icon={Package} />
            <PremiumTabTrigger value="catalogo" label="Descobrir" icon={ShoppingBag} />
            <PremiumTabTrigger value="docs" label="Biblioteca" icon={FileText} />
            <PremiumTabTrigger value="financeiro" label="Financeiro" icon={Receipt} />
            <PremiumTabTrigger value="timeline" label="Jornada" icon={History} />
          </TabsList>

          <TabsContent value="meus-produtos" className="animate-fade-up">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {activeSubs.map((s: any) => (
                <div key={s.id} className="vx-card p-8 bg-white border-slate-100 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 rounded-[24px]">
                  <div className="flex justify-between items-start mb-6">
                    <div className="size-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                       <Package className="size-6" />
                    </div>
                    <span className="vx-pill vx-pill-success uppercase tracking-widest text-[9px]">Ativo</span>
                  </div>
                  <h3 className="font-editorial text-2xl font-bold text-slate-900 leading-tight">
                    {s.products?.name ?? "Assinatura"}
                  </h3>
                  <p className="text-[13px] text-muted-foreground mt-2 line-clamp-2 min-h-[40px]">
                    {s.products?.description || "Acompanhamento premium e suporte dedicado."}
                  </p>
                  <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between">
                     <div>
                        <p className="text-[20px] font-bold tabular-nums text-slate-900">{formatBRL(s.amount)}</p>
                        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mt-1">{s.billing_cycle}</p>
                     </div>
                     <Button variant="ghost" size="sm" className="group text-primary hover:text-primary hover:bg-primary/5">
                        Detalhes <ArrowRight className="size-4 ml-2 group-hover:translate-x-1 transition-transform" />
                     </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="catalogo" className="animate-fade-up">
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {availableCatalog.map((p: any) => (
                  <div key={p.id} className="vx-card p-8 bg-white/60 backdrop-blur-md border-white/50 hover:bg-white transition-all rounded-[24px] border-dashed border-2">
                    <h3 className="font-editorial text-2xl font-bold text-slate-800">{p.name}</h3>
                    <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{p.description}</p>
                    <div className="mt-8 flex items-center justify-between">
                       <p className="text-xl font-bold text-slate-900">{formatBRL(p.base_price)}</p>
                       <Button className="rounded-full bg-slate-900 hover:bg-slate-800">Saber mais</Button>
                    </div>
                  </div>
                ))}
             </div>
          </TabsContent>

          <TabsContent value="docs" className="animate-fade-up">
             <div className="vx-card bg-white rounded-[24px] overflow-hidden border-slate-100 shadow-xl shadow-slate-200/20">
                <div className="p-6 border-b border-slate-50 bg-slate-50/30">
                   <h3 className="font-editorial text-xl font-bold text-slate-900">Documentação Compartilhada</h3>
                </div>
                <div className="divide-y divide-slate-50">
                   {docs.map((d: any) => (
                     <div key={d.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center gap-5">
                           <div className="size-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                              <FileText className="size-6" />
                           </div>
                           <div>
                              <p className="font-bold text-slate-900">{d.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">Enviado em {formatDate(d.created_at)}</p>
                           </div>
                        </div>
                        <Button variant="outline" size="sm" className="rounded-xl gap-2 h-10 border-slate-200 hover:bg-slate-900 hover:text-white transition-all">
                           <Download className="size-4" /> Download
                        </Button>
                     </div>
                   ))}
                   {docs.length === 0 && <p className="p-12 text-center font-editorial italic text-muted-foreground">Nenhum arquivo disponível no momento.</p>}
                </div>
             </div>
          </TabsContent>

          <TabsContent value="financeiro" className="animate-fade-up">
             <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 vx-card bg-white rounded-[24px] overflow-hidden border-slate-100">
                   <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                      <h3 className="font-editorial text-xl font-bold text-slate-900">Extrato de Pagamentos</h3>
                   </div>
                   <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                         <thead>
                            <tr className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground bg-slate-50/50">
                               <th className="px-6 py-4 text-left">Vencimento</th>
                               <th className="px-6 py-4 text-left">Status</th>
                               <th className="px-6 py-4 text-right">Valor</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50">
                            {payments.map((p: any) => (
                              <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                 <td className="px-6 py-4 font-medium text-slate-700">{formatDate(p.due_date)}</td>
                                 <td className="px-6 py-4">
                                    <span className={cn(
                                      "vx-pill uppercase tracking-widest text-[9px]",
                                      p.status === 'pago' ? "vx-pill-success" : "vx-pill-warning"
                                    )}>{p.status}</span>
                                 </td>
                                 <td className="px-6 py-4 text-right font-bold tabular-nums text-slate-900">{formatBRL(p.amount)}</td>
                              </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>
                <div className="vx-card p-8 bg-slate-900 text-white rounded-[24px] space-y-6">
                   <Receipt className="size-10 text-primary mb-4" />
                   <h3 className="font-editorial text-2xl font-bold leading-tight">Deseja alterar <br/>seu faturamento?</h3>
                   <p className="text-sm text-white/60 leading-relaxed">Fale com seu gestor de conta para ajustar métodos de pagamento ou ciclos de renovação.</p>
                   <Button className="w-full rounded-2xl bg-white text-slate-900 hover:bg-primary hover:text-white transition-all h-12 font-bold">Solicitar Alteração</Button>
                </div>
             </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function PremiumStat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "success" | "warning" | "default" }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-2">
         <span className={cn(
           "font-editorial text-3xl font-bold tracking-tight",
           tone === "success" ? "text-emerald-500" : tone === "warning" ? "text-amber-500" : "text-slate-900"
         )}>{value}</span>
         {sub && <span className="text-[11px] text-muted-foreground lowercase italic">{sub}</span>}
      </div>
    </div>
  );
}

function PremiumTabTrigger({ value, label, icon: Icon }: { value: string; label: string; icon: any }) {
  return (
    <TabsTrigger 
      value={value} 
      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-none rounded-none p-0 pb-4 text-[13px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 transition-all relative group h-auto"
    >
      <div className="flex items-center gap-3">
        <Icon className="size-4 opacity-40 group-data-[state=active]:opacity-100" />
        {label}
      </div>
      <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary scale-x-0 data-[state=active]:scale-x-100 transition-transform origin-left" />
    </TabsTrigger>
  );
}
