import { ClipboardList, Search, Plus, Filter, Calendar, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function Tasks() {
  return (
    <div className="page-shell space-y-7">
      <header className="flex items-end justify-between gap-4 flex-wrap pb-2">
        <div className="min-w-0 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <ClipboardList className="size-3 text-warning" />
            Fluxo de Trabalho
          </div>
          <h1 className="font-display text-[34px] sm:text-[40px] font-bold tracking-[-0.03em] leading-[1.02] text-foreground">
            Tarefas / Pendências
          </h1>
          <p className="text-sm text-muted-foreground">Monitore prazos, atribuições e o progresso da operação.</p>
        </div>

        <Button className="h-9 text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/20">
          <Plus className="size-3.5 mr-2" />
          Nova Tarefa
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Pendentes', count: 12, tone: 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20' },
          { label: 'Em Andamento', count: 5, tone: 'text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20' },
          { label: 'Concluídas', count: 48, tone: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20' },
          { label: 'Atrasadas', count: 3, tone: 'text-destructive bg-destructive/5' },
        ].map((stat, i) => (
          <div key={i} className={cn("vx-card p-4 flex flex-col items-center justify-center text-center", stat.tone)}>
            <p className="text-[10px] uppercase font-bold opacity-80">{stat.label}</p>
            <p className="text-3xl font-black mt-1">{stat.count}</p>
          </div>
        ))}
      </div>

      <div className="vx-card p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-10 h-10 text-sm" placeholder="Filtrar tarefas..." />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="h-10 text-xs font-bold px-4">
              <Calendar className="size-3.5 mr-2 text-muted-foreground" />
              Hoje
            </Button>
            <Button variant="outline" className="h-10 text-xs font-bold px-4">
              <Filter className="size-3.5 mr-2" />
              Prioridade
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {[
          { title: 'Revisão de contrato financeiro', client: 'Banco Itaú', due: 'Hoje, 14:00', priority: 'alta', status: 'pendente' },
          { title: 'Coleta de documentos para regularização', client: 'Ana Paula Silva', due: 'Amanhã', priority: 'media', status: 'em_andamento' },
          { title: 'Relatório mensal de consultoria', client: 'Empresa XPTO', due: '15/05', priority: 'critica', status: 'pendente' },
        ].map((task, i) => (
          <div key={i} className="vx-card p-4 hover:border-primary/20 transition-all cursor-pointer group flex items-center gap-4">
            <div className={cn(
              "size-10 rounded-xl flex items-center justify-center shrink-0",
              task.priority === 'critica' ? 'bg-destructive/10 text-destructive' : 
              task.priority === 'alta' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
            )}>
              <AlertCircle className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold group-hover:text-primary transition-colors">{task.title}</h4>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-medium">
                <span className="flex items-center gap-1"><Clock className="size-3" /> {task.due}</span>
                <span>•</span>
                <span className="text-foreground">{task.client}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
               <span className={cn(
                 "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-widest border",
                 task.status === 'pendente' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-amber-50 text-amber-600 border-amber-100'
               )}>
                 {task.status === 'pendente' ? 'Pendente' : 'Fazendo'}
               </span>
               <Button variant="ghost" size="icon" className="size-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                 <Plus className="size-4 rotate-45" />
               </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
