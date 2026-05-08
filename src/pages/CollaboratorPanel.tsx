import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, Users, FileText, Clock, CheckCircle2, ArrowRight, Sparkles, LayoutDashboard } from "lucide-react";
import { formatDate, initials, formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function CollaboratorPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: tasks = [] } = useQuery({
    queryKey: ["collab-tasks", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").eq("assigned_to", user!.id).order("due_date", { ascending: true });
      return data ?? [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["collab-clients", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, full_name, status, sale_value").eq("responsible_id", user!.id).order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const { data: splits = [] } = useQuery({
    queryKey: ["collab-splits", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("commission_splits").select("*, sales(clients(full_name))").eq("beneficiary_type", "collaborator").eq("beneficiary_id", user!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const earnings = useMemo(() => {
    const pending = splits.filter((s: any) => s.status === 'pendente').reduce((a, b: any) => a + Number(b.amount), 0);
    const paid = splits.filter((s: any) => s.status === 'pago').reduce((a, b: any) => a + Number(b.amount), 0);
    return { pending, paid };
  }, [splits]);

  const openTasks = tasks.filter((t: any) => t.status !== "Concluída" && t.status !== "Cancelada");
  const doneTasks = tasks.filter((t: any) => t.status === "Concluída");

  return (
    <div className="bg-premium min-h-screen dark:bg-[#020617]">
      <div className="page-shell space-y-12 py-12">
        {/* Header */}
        <section className="relative overflow-hidden rounded-[48px] bg-white dark:bg-card p-12 lg:p-16 border border-slate-100 dark:border-white/5 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.04)] group">
           <div className="absolute top-0 left-0 size-[500px] bg-primary/5 blur-[120px] -ml-40 -mt-40 rounded-full" />
           <div className="absolute bottom-0 right-0 size-[300px] bg-blue-500/5 blur-[100px] -mr-32 -mb-32 rounded-full" />
           
           <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12 relative">
              <div className="flex items-center gap-10">
                 <div className="size-24 lg:size-28 rounded-[36px] bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center font-editorial text-4xl shadow-2xl ring-8 ring-slate-50 dark:ring-white/5 transition-all group-hover:scale-105">
                   {initials(user?.user_metadata?.full_name || "C")}
                 </div>
                 <div className="space-y-3">
                    <div className="flex items-center gap-3">
                       <Sparkles className="size-4 text-amber-400 animate-pulse" />
                       <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-muted-foreground/60">Operations Intelligence</span>
                    </div>
                    <h1 className="font-editorial text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 dark:text-white leading-[0.95]">
                       Workspace de <br/><span className="italic text-primary">{user?.user_metadata?.full_name?.split(' ')[0]}</span>.
                    </h1>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-12 lg:pl-16 lg:border-l border-slate-100 dark:border-white/5">
                 <CollabStat label="Agenda Ativa" value={String(openTasks.length)} sub="tarefas" />
                  <CollabStat label="Portfólio" value={String(clients.length)} sub="contas" />
                  <CollabStat label="Ganhos" value={formatBRL(earnings.pending)} sub="pendente" tone="primary" />
               </div>
           </div>
        </section>

        {/* Dashboard Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
           {/* Left column: Tasks */}
           <div className="lg:col-span-2 space-y-8">
              <div className="vx-card bg-white rounded-[32px] overflow-hidden border-slate-100 shadow-xl shadow-slate-200/10">
                 <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <ClipboardList className="size-5 text-primary" />
                       <h3 className="font-editorial text-2xl font-bold text-slate-900">Minha Agenda</h3>
                    </div>
                    <Button variant="ghost" onClick={() => navigate("/tarefas")} className="text-xs uppercase tracking-widest font-bold text-primary hover:bg-primary/5">
                       Ver Painel Completo <ArrowRight className="size-4 ml-2" />
                    </Button>
                 </div>
                 <div className="p-4 space-y-3">
                    {openTasks.length === 0 ? (
                      <p className="p-10 text-center font-editorial italic text-muted-foreground">Todas as tarefas foram concluídas. Excelente trabalho!</p>
                    ) : (
                      openTasks.slice(0, 6).map((t: any) => (
                        <div key={t.id} className="p-6 rounded-[24px] border border-slate-50 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-all flex items-center justify-between group">
                           <div className="flex items-center gap-6">
                              <div className="size-12 rounded-[18px] bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/10 flex items-center justify-center text-slate-300 group-hover:text-amber-400 group-hover:border-amber-100 transition-all shadow-sm">
                                 <Clock className="size-6" />
                              </div>
                              <div className="space-y-1">
                                 <p className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors text-base">{t.title}</p>
                                 <p className="text-xs text-muted-foreground font-medium">Data limite: <span className="text-slate-600 dark:text-slate-400">{formatDate(t.due_date)}</span></p>
                              </div>
                           </div>
                           <Badge className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 border-none px-5 py-1.5 text-[10px] uppercase tracking-[0.2em] font-bold">
                              {t.status}
                           </Badge>
                        </div>
                      ))
                    )}
                 </div>
              </div>
           </div>

           {/* Right column: Clients & Context */}
           <div className="space-y-8">
              <div className="vx-card p-8 bg-slate-900 text-white rounded-[32px] shadow-2xl shadow-slate-900/20">
                 <Users className="size-10 text-primary mb-6" />
                 <h3 className="font-editorial text-2xl font-bold leading-tight">Gestão de Carteira</h3>
                 <p className="text-sm text-white/50 mt-4 leading-relaxed">
                    Você é o ponto de contato principal para {clients.length} clientes. Mantenha os cronogramas atualizados.
                 </p>
                 <div className="mt-8 space-y-3">
                    {clients.slice(0, 5).map((c: any) => (
                      <button 
                        key={c.id} 
                        onClick={() => navigate(`/clientes/${c.id}`)}
                        className="w-full p-5 rounded-[20px] bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all text-left flex items-center justify-between group/client"
                      >
                         <div className="flex items-center gap-4 min-w-0">
                           <div className="size-8 rounded-lg bg-primary/20 flex items-center justify-center text-[10px] font-bold">{initials(c.full_name)}</div>
                           <span className="font-bold text-sm truncate">{c.full_name}</span>
                         </div>
                         <ArrowRight className="size-4 text-white/20 group-hover/client:text-primary transition-colors group-hover/client:translate-x-1" />
                      </button>
                    ))}
                 </div>
                 <Button className="w-full mt-6 rounded-2xl bg-primary hover:bg-primary/90 text-white h-12 font-bold" onClick={() => navigate("/clientes")}>
                    Ver Todos Clientes
                 </Button>
              </div>

              <div className="vx-card p-8 bg-white rounded-[32px] border-slate-100">
                 <LayoutDashboard className="size-8 text-primary/40 mb-4" />
                 <h4 className="font-editorial text-lg font-bold">Quick Shortcuts</h4>
                 <div className="mt-4 grid grid-cols-2 gap-3">
                    <Shortcut label="New Task" url="/tarefas" />
                    <Shortcut label="Docs" url="/documentos" />
                    <Shortcut label="Reports" url="/relatorios" />
                    <Shortcut label="Admin" url="/admin" />
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function CollabStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="space-y-1">
       <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">{label}</p>
       <div className="flex items-baseline gap-2">
          <span className="font-editorial text-4xl lg:text-6xl font-bold text-slate-900">{value}</span>
          <span className="text-xs text-muted-foreground italic">{sub}</span>
       </div>
    </div>
  );
}

function Shortcut({ label, url }: { label: string; url: string }) {
  return (
    <a href={url} className="p-3 rounded-xl border border-slate-50 bg-slate-50/50 hover:bg-primary/5 hover:border-primary/20 hover:text-primary transition-all text-[11px] font-bold uppercase tracking-widest text-center">
       {label}
    </a>
  );
}
