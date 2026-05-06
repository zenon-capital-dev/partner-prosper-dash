import { History, Search, Filter, ShieldCheck, User, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AuditLog() {
  return (
    <div className="page-shell space-y-7">
      <header className="flex items-end justify-between gap-4 flex-wrap pb-2">
        <div className="min-w-0 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <ShieldCheck className="size-3 text-primary" />
            Segurança e Conformidade
          </div>
          <h1 className="font-display text-[34px] sm:text-[40px] font-bold tracking-[-0.03em] leading-[1.02] text-foreground">
            Histórico / Auditoria
          </h1>
          <p className="text-sm text-muted-foreground">Rastreie todas as ações, alterações e acessos realizados no sistema.</p>
        </div>

        <div className="flex items-center gap-2 bg-card border border-border p-1 rounded-xl">
           <Button variant="ghost" size="sm" className="h-8 text-xs font-bold px-3 bg-slate-100">Geral</Button>
           <Button variant="ghost" size="sm" className="h-8 text-xs font-bold px-3">Acessos</Button>
           <Button variant="ghost" size="sm" className="h-8 text-xs font-bold px-3">Alterações</Button>
        </div>
      </header>

      <div className="vx-card p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-10 h-10 text-sm" placeholder="Buscar por usuário, ação ou entidade..." />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" className="h-10 text-xs font-bold px-4">
              <User className="size-3.5 mr-2 text-muted-foreground" />
              Usuário
            </Button>
            <Button variant="outline" className="h-10 text-xs font-bold px-4">
              <Calendar className="size-3.5 mr-2 text-muted-foreground" />
              Período
            </Button>
          </div>
        </div>
      </div>

      <div className="vx-card overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-muted/20">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Linha do Tempo de Atividades</h3>
        </div>
        <div className="p-0">
          {[
            { user: 'Admin Principal', action: 'Alterou status de contrato', entity: 'Contrato #842', time: 'Há 5 minutos', detail: 'De "Pendente" para "Ativo"' },
            { user: 'Ricardo Melo', action: 'Criou novo lead', entity: 'Lead "Carlos Alberto"', time: 'Há 22 minutos', detail: 'Origem: Indicação Direta' },
            { user: 'Juliana Costa', action: 'Fez login no sistema', entity: 'Sessão Web', time: 'Há 1 hora', detail: 'IP: 187.54.21.10' },
            { user: 'Admin Principal', action: 'Excluiu documento', entity: 'Doc_Ref_99.pdf', time: 'Há 2 horas', detail: 'Motivo: Arquivo corrompido' },
          ].map((log, i) => (
            <div key={i} className="flex items-start gap-4 p-5 border-b last:border-0 border-border/40 hover:bg-muted/20 transition-colors group">
              <div className="mt-1 size-9 rounded-full bg-slate-50 dark:bg-slate-900 border border-border flex items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                <History className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">
                    <span className="text-primary">{log.user}</span> {log.action.toLowerCase()}
                  </p>
                  <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">{log.time}</span>
                </div>
                <p className="text-xs text-foreground font-semibold mt-1">{log.entity}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{log.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
