import { UserCircle, Search, Plus, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Collaborators() {
  return (
    <div className="page-shell space-y-7">
      <header className="flex items-end justify-between gap-4 flex-wrap pb-2">
        <div className="min-w-0 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <UserCircle className="size-3 text-primary" />
            Equipe Interna
          </div>
          <h1 className="font-display text-[34px] sm:text-[40px] font-bold tracking-[-0.03em] leading-[1.02] text-foreground">
            Colaboradores
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie sua equipe, permissões e acessos internos.</p>
        </div>

        <Button className="h-9 text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/20">
          <Plus className="size-3.5 mr-2" />
          Novo Colaborador
        </Button>
      </header>

      <div className="vx-card p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-10 h-10 text-sm" placeholder="Buscar por nome, cargo ou departamento..." />
          </div>
          <Button variant="outline" className="h-10 text-xs font-bold px-4">
            <Filter className="size-3.5 mr-2" />
            Filtros
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="vx-card p-6 flex flex-col items-center text-center group hover:border-primary/30 transition-all cursor-pointer">
            <div className="relative mb-4">
              <div className="size-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xl text-slate-500 group-hover:bg-primary group-hover:text-white transition-colors">
                C{i}
              </div>
              <span className="absolute -bottom-1 -right-1 size-5 rounded-full bg-success border-4 border-card" />
            </div>
            <h3 className="text-lg font-bold">Colaborador {i}</h3>
            <p className="text-sm text-primary font-medium mb-4">Gestor de Contas</p>
            <div className="w-full pt-4 border-t border-border/50 grid grid-cols-2 gap-2">
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Projetos</p>
                <p className="text-sm font-bold">12</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Status</p>
                <p className="text-sm font-bold text-success">Ativo</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
