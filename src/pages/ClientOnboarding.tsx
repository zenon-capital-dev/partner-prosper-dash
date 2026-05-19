import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck, ArrowRight, Building2, Package,
  FileSignature, CheckCircle2, Headphones, Sparkles,
  AlertCircle, Loader2, Check, LogOut,
  CreditCard, FileText, BadgeCheck, Clock, ListChecks
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

const STEPS = [
  { id: 1, label: "Boas-vindas", icon: Sparkles, title: "Bem-vindo ao seu portal.", subtitle: "Configuramos um ambiente exclusivo para acompanhar suas soluções, contratos e pagamentos." },
  { id: 2, label: "Dados & Contratos", icon: Building2, title: "Confirme seus dados.", subtitle: "Valide as informações cadastrais e revise os contratos vinculados às suas soluções." },
  { id: 3, label: "Documentação", icon: FileText, title: "Envie a documentação.", subtitle: "Precisamos de alguns documentos obrigatórios para garantir segurança e conformidade." },
  { id: 4, label: "Financeiro", icon: CreditCard, title: "Resumo financeiro.", subtitle: "Veja o detalhamento das suas parcelas e formas de pagamento." },
  { id: 5, label: "Ativação", icon: ShieldCheck, title: "Estamos validando seus dados.", subtitle: "Nossa equipe está revisando tudo. Em breve você receberá o acesso completo." },
];

export default function ClientOnboarding() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-data-v3", user?.id],
    queryFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      const { data: client } = await supabase.from("clients").select(`*, companies(id, name, trade_name)`).eq("user_id", user!.id).maybeSingle();
      if (!client) return { profile, client: null, prods: [], docs: [], payments: [], contracts: [] };
      const [prods, docs, payments, contracts] = await Promise.all([
        supabase.from("client_products").select("*, products(name)").eq("client_id", client.id),
        supabase.from("onboarding_documents").select("*").eq("client_id", user!.id).order("created_at", { ascending: true }),
        supabase.from("payments").select("*").eq("client_id", client.id).order("due_date", { ascending: true }),
        supabase.from("contracts").select("*").eq("client_id", client.id).order("created_at", { ascending: true }),
      ]);
      return { profile, client, prods: prods.data || [], docs: docs.data || [], payments: payments.data || [], contracts: contracts.data || [] };
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (data?.profile?.onboarding_completed) navigate("/portal-cliente", { replace: true });
  }, [data?.profile?.onboarding_completed, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="size-10 animate-spin mx-auto text-indigo-600" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Preparando sua experiência...</p>
        </div>
      </div>
    );
  }

  if (!data?.profile) return null;

  const { profile, client, docs } = data;
  const currentStep = Math.max(1, Math.min(profile.onboarding_step || 1, 5));
  const totalSteps = STEPS.length;
  const progress = (currentStep / totalSteps) * 100;
  
  const pendingDocs = docs.filter((d: any) => !d.file_url).length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* NAVBAR */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 backdrop-blur-md bg-white/80">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="size-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Package className="size-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 leading-none">Portal do Cliente</p>
              <h2 className="text-lg font-bold text-slate-900 mt-1">{(client as any)?.companies?.trade_name || (client as any)?.companies?.name || "Empresa"}</h2>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:block text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Logado como</p>
              <p className="text-sm font-semibold text-slate-700">{profile.full_name || profile.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl h-10 px-4 gap-2 text-xs font-bold"
            >
              <LogOut className="size-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 grid lg:grid-cols-[1fr_380px] gap-10 items-start">
        <div className="space-y-10">
          {/* HEADER SECTION */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100">
              <Sparkles className="size-3.5 text-indigo-600" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Primeiro Acesso</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Olá, {profile.full_name?.split(" ")[0] || "Cliente"}. <br />
              <span className="text-slate-400">Vamos finalizar seu cadastro.</span>
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl leading-relaxed">
              Seu acesso completo ao dashboard premium está temporariamente bloqueado até que as etapas de ativação sejam concluídas.
            </p>
          </div>

          {/* ONBOARDING BLOCKER CARD */}
          <div className="bg-white border border-slate-200 rounded-[32px] shadow-xl shadow-slate-200/50 overflow-hidden">
            <div className="p-8 sm:p-12">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 mb-12">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-900">Progresso do Onboarding</h3>
                  <p className="text-sm text-slate-500">Complete as etapas para liberar todas as funcionalidades.</p>
                </div>
                <div className="text-right">
                  <span className="text-4xl font-black text-indigo-600 tabular-nums">{Math.round(progress)}%</span>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Concluído</p>
                </div>
              </div>

              <div className="relative mb-16">
                <Progress value={progress} className="h-3 bg-slate-100" />
                <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between px-0">
                  {STEPS.map((s) => (
                    <div key={s.id} className="relative flex flex-col items-center">
                      <div className={cn(
                        "size-10 rounded-full flex items-center justify-center border-4 border-white shadow-md transition-all duration-500",
                        s.id < currentStep ? "bg-emerald-500 text-white" : 
                        s.id === currentStep ? "bg-indigo-600 text-white scale-110" : "bg-slate-200 text-slate-400"
                      )}>
                        {s.id < currentStep ? <Check className="size-5 stroke-[3]" /> : <s.icon className="size-5" />}
                      </div>
                      <span className={cn(
                        "absolute -bottom-8 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider transition-colors",
                        s.id === currentStep ? "text-indigo-600" : "text-slate-400"
                      )}>
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 flex flex-col sm:flex-row items-center gap-8">
                <div className="size-20 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                  <Clock className="size-10 text-indigo-600" />
                </div>
                <div className="flex-1 text-center sm:text-left space-y-2">
                  <h4 className="text-lg font-bold text-slate-900">Acesso Restrito</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Atualmente você está na etapa <strong>{STEPS[currentStep - 1].label}</strong>. 
                    Precisamos validar seus dados e documentos para liberar o menu completo de serviços, financeiro e relatórios.
                  </p>
                </div>
                <Button 
                  onClick={() => navigate("/cliente/onboarding")}
                  className="h-14 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-lg shadow-indigo-200 gap-3 w-full sm:w-auto shrink-0"
                >
                  Continuar onboarding <ArrowRight className="size-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* SIDEBAR INFO */}
        <aside className="space-y-6 lg:sticky lg:top-32">
          <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
              <div className="size-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                <ListChecks className="size-5" />
              </div>
              <h3 className="font-bold text-slate-900">O que falta concluir</h3>
            </div>
            
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className={cn("size-5 rounded-full mt-0.5 flex items-center justify-center shrink-0", currentStep > 2 ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400")}>
                  {currentStep > 2 ? <Check className="size-3 stroke-[3]" /> : <div className="size-1.5 rounded-full bg-slate-400" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Validação de Contratos</p>
                  <p className="text-xs text-slate-500 mt-0.5">Assine os termos de serviço pendentes.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className={cn("size-5 rounded-full mt-0.5 flex items-center justify-center shrink-0", pendingDocs === 0 ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400")}>
                  {pendingDocs === 0 ? <Check className="size-3 stroke-[3]" /> : <div className="size-1.5 rounded-full bg-slate-400" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Documentação ({pendingDocs} pendentes)</p>
                  <p className="text-xs text-slate-500 mt-0.5">Envie RG/CNH e comprovante de endereço.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className={cn("size-5 rounded-full mt-0.5 flex items-center justify-center shrink-0", currentStep > 4 ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400")}>
                  {currentStep > 4 ? <Check className="size-3 stroke-[3]" /> : <div className="size-1.5 rounded-full bg-slate-400" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Configuração Financeira</p>
                  <p className="text-xs text-slate-500 mt-0.5">Valide seu método de pagamento principal.</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="bg-indigo-600 rounded-[24px] p-6 text-white shadow-lg shadow-indigo-100 space-y-4">
            <h4 className="font-bold">Precisa de ajuda?</h4>
            <p className="text-sm text-indigo-100 leading-relaxed">
              Nossa equipe de suporte está disponível para auxiliar com qualquer dúvida durante seu cadastro.
            </p>
            <Button 
              variant="secondary"
              onClick={() => window.open("https://wa.me/your-support-number", "_blank")}
              className="w-full h-11 rounded-xl bg-white text-indigo-600 hover:bg-indigo-50 font-bold gap-2"
            >
              <Headphones className="size-4" /> Falar com suporte
            </Button>
          </div>
        </aside>
      </main>
    </div>
  );
}
