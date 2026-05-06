import { Truck, Search, Plus, Filter, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Providers() {
  return (
    <div className="page-shell space-y-7">
      <header className="flex items-end justify-between gap-4 flex-wrap pb-2">
        <div className="min-w-0 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <Truck className="size-3 text-primary" />
            Parceiros de Execução
          </div>
          <h1 className="font-display text-[34px] sm:text-[40px] font-bold tracking-[-0.03em] leading-[1.02] text-foreground">
            Prestadores de Serviço
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie fornecedores externos e prestadores de serviço terceirizados.</p>
        </div>

        <Button className="h-9 text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/20">
          <Plus className="size-3.5 mr-2" />
          Novo Prestador
        </Button>
      </header>

      <div className="vx-card p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-10 h-10 text-sm" placeholder="Buscar por serviço, empresa ou categoria..." />
          </div>
          <Button variant="outline" className="h-10 text-xs font-bold px-4">
            <Filter className="size-3.5 mr-2" />
            Filtros
          </Button>
        </div>
      </div>

      <div className="vx-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/50 bg-muted/20">
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Prestador</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Serviços</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Avaliação</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2].map((i) => (
              <tr key={i} className="border-b last:border-0 border-border/40 hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-500">
                      P{i}
                    </div>
                    <div>
                      <p className="text-sm font-bold">Prestador Alpha {i}</p>
                      <p className="text-xs text-muted-foreground">CNPJ: 00.000.000/0001-00</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-medium">Contábil</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-medium">Jurídico</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1 text-amber-500">
                    <Star className="size-3 fill-current" />
                    <span className="text-xs font-bold text-foreground">4.8</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    Homologado
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="sm" className="h-8 text-[11px] font-bold uppercase">Gerenciar</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
