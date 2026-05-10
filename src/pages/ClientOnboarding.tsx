import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  ShieldCheck, ArrowRight, Building2, Package, 
  FileSignature, CheckCircle2, Headphones, Sparkles 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function ClientOnboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const totalSteps = 6;

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-data", user?.id],
    queryFn: async () => {
      const { data: client } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      
      const { data: prods } = await supabase
        .from("client_products")
        .select("*, products(name)")
        .eq("client_id", client.id);

      const { data: docs } = await supabase
        .from("documents")
        .select("*")
        .eq("client_id", client.id)
        .eq("status", "solicitado");

      return { client, prods: prods || [], docs: docs || [] };
    },
    enabled: !!user
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await supabase
        .from("clients")
        .update({ 
          onboarding_status: 'completo', 
          onboarding_progress: 100,
          onboarding_completed_at: new Date().toISOString()
        })
        .eq("user_id", user!.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-panel"] });
      toast.success("Onboarding finalizado com sucesso!");
      navigate("/cliente");
    }
  });

  if (isLoading) return <div className="p-20 text-center animate-pulse">Iniciando sua jornada...</div>;
  if (!data?.client) return null;

  const { client, prods, docs } = data;
  const progress = (step / totalSteps) * 100;

  const nextStep = () => {
    if (step < totalSteps) setStep(step + 1);
    else completeMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-primary/5 blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-2xl bg-white dark:bg-card rounded-[40px] shadow-2xl border border-white/10 relative z-10 flex flex-col min-h-[500px]">
        {/* Progress Top */}
        <div className="p-8 pb-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Ambiente Seguro</span>
            </div>
            <span className="text-[10px] font-black uppercase text-primary">Etapa {step} de {totalSteps}</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        <div className="flex-1 p-8 lg:p-12 flex flex-col justify-center animate-fade-up">
          {step === 1 && (
            <div className="space-y-6 text-center">
              <div className="size-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mx-auto">
                <Sparkles className="size-10" />
              </div>
              <h1 className="font-editorial text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                Seja bem-vindo à <br/><span className="text-primary italic">Prosper Operations</span>.
              </h1>
              <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto">
                Preparamos este ambiente exclusivo para gerenciar seu ecossistema empresarial com máxima transparência e segurança.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Building2 className="size-6 text-primary" />
                <h2 className="font-editorial text-3xl font-bold">Conferência de Dados</h2>
              </div>
              <div className="space-y-4 p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5">
                <div className="grid grid-cols-2 gap-4">
                   <div>
                     <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Razão Social / Nome</p>
                     <p className="text-sm font-bold">{client.full_name}</p>
                   </div>
                   <div>
                     <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Empresa</p>
                     <p className="text-sm font-bold">{client.company || "—"}</p>
                   </div>
                   <div>
                     <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Email</p>
                     <p className="text-sm font-bold">{client.email}</p>
                   </div>
                   <div>
                     <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Documento</p>
                     <p className="text-sm font-bold">{client.document || "—"}</p>
                   </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground italic text-center">Precisa corrigir algo? Pode fazer isso depois no seu perfil.</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center">
              <div className="flex items-center gap-3 justify-center">
                <Package className="size-6 text-primary" />
                <h2 className="font-editorial text-3xl font-bold">Sua Carteira de Soluções</h2>
              </div>
              <div className="grid gap-3">
                {prods.map((p: any) => (
                  <div key={p.id} className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">{p.products?.name}</span>
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">Cada serviço terá um fluxo operacional dedicado para você acompanhar.</p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-6 text-emerald-500" />
                <h2 className="font-editorial text-3xl font-bold">Checklist Inicial</h2>
              </div>
              <div className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-3xl">
                <p className="text-sm font-bold text-amber-600 mb-4">Para iniciar os trabalhos, identificamos {docs.length} pendências:</p>
                <div className="space-y-2">
                  {docs.slice(0, 4).map((d: any) => (
                    <div key={d.id} className="flex items-center gap-2 text-xs font-medium opacity-80">
                      <div className="h-1 w-1 rounded-full bg-amber-500" />
                      {d.name}
                    </div>
                  ))}
                  {docs.length > 4 && <p className="text-[10px] font-bold text-amber-600/60">+ {docs.length - 4} outros documentos</p>}
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">Você poderá enviar todos os arquivos direto pelo painel assim que terminarmos aqui.</p>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 text-center">
              <FileSignature className="size-16 text-primary mx-auto" />
              <h2 className="font-editorial text-3xl font-bold">Assinaturas Eletrônicas</h2>
              <p className="text-muted-foreground leading-relaxed">
                Utilizamos as melhores plataformas de assinatura digital. Fique atento ao seu email para formalizar os contratos pendentes.
              </p>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-8 text-center">
              <Headphones className="size-16 text-primary mx-auto" />
              <h2 className="font-editorial text-3xl font-bold">Suporte & Comunicação</h2>
              <p className="text-muted-foreground leading-relaxed">
                Toda a sua comunicação será centralizada. Você receberá atualizações em tempo real sobre cada etapa dos seus processos.
              </p>
              <div className="p-6 border border-dashed border-slate-200 rounded-3xl">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Canal Direto</p>
                <p className="text-lg font-bold text-primary">suporte@prosper.com.br</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-8 pt-4 border-t border-slate-50 dark:border-white/5 flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => setStep(step - 1)} 
            disabled={step === 1}
            className="rounded-2xl h-12 px-6 editorial-label"
          >
            Anterior
          </Button>
          <Button 
            onClick={nextStep}
            className="rounded-2xl h-14 px-8 bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-primary hover:text-white transition-all font-bold gap-3 shadow-xl"
          >
            {step === totalSteps ? "Concluir Onboarding" : "Continuar Jornada"}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
