import { Target, Search, Plus, Filter, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Leads() {
  return (
    <div className="page-shell space-y-7">
      <header className="flex items-end justify-between gap-4 flex-wrap pb-2">
        <div className="min-w-0 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <Target className="size-3 text-primary" />
            Gestão de Prospecção
          </div>
          <h1 className="font-display text-[34px] sm:text-[40px] font-bold tracking-[-0.03em] leading-[1.02] text-foreground">
            Leads / Convidados
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie potenciais clientes e indicações em um só lugar.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9 text-xs font-bold uppercase tracking-wider">
            <Download className="size-3.5 mr-2" />
            Exportar
          </Button>
          <Button className="h-9 text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/20">
            <Plus className="size-3.5 mr-2" />
            Novo Lead
          </Button>
        </div>
      </header>

      <div className="vx-card p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-10 h-10 text-sm" placeholder="Buscar por nome, email ou telefone..." />
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
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Lead</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Origem</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Data</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map((i) => (
              <tr key={i} className="border-b last:border-0 border-border/40 hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs text-primary">
                      L{i}
                    </div>
                    <div>
                      <p className="text-sm font-bold">Lead Exemplo {i}</p>
                      <p className="text-xs text-muted-foreground">lead{i}@exemplo.com</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    Novo
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-medium">Instagram</td>
                <td className="px-6 py-4 text-xs text-muted-foreground">12/05/2026</td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="sm" className="h-8 text-[11px] font-bold uppercase">Detalhes</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-4 border-t border-border/40 bg-muted/5 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Mostrando 3 de 3 resultados</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled className="h-8 text-[11px]">Anterior</Button>
            <Button variant="outline" size="sm" disabled className="h-8 text-[11px]">Próximo</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
