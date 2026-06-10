import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, UserRound, Loader2 } from "lucide-react";
import { SaleFormDialog } from "@/components/sales/SaleFormDialog";
import { useQueryClient } from "@tanstack/react-query";


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function NewDemandDialog({ open, onOpenChange }: Props) {
  const [q, setQ] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["new-demand-clients"],
    enabled: open && !selectedClientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, company")
        .order("full_name", { ascending: true })
        .limit(500);
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return clients;
    return clients.filter(
      (c: any) =>
        c.full_name?.toLowerCase().includes(s) ||
        c.company?.toLowerCase().includes(s),
    );
  }, [clients, q]);

  const handleClose = (v: boolean) => {
    if (!v) {
      setSelectedClientId(null);
      setQ("");
    }
    onOpenChange(v);
  };

  if (selectedClientId) {
    return (
      <SaleFormDialog
        open={open}
        onOpenChange={handleClose}
        clientId={selectedClientId}
      />
    );
  }


  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Nova demanda</DialogTitle>
          <DialogDescription>
            Selecione o cliente para abrir a demanda. Em seguida você escolhe o produto, prestador e valores.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              autoFocus
              placeholder="Buscar cliente por nome ou empresa..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-10 h-11 rounded-xl"
            />
          </div>

          <div className="max-h-[360px] overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
            {isLoading ? (
              <div className="p-6 text-center text-sm text-slate-500 flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Carregando clientes...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Nenhum cliente encontrado.
              </div>
            ) : (
              filtered.slice(0, 100).map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedClientId(c.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-indigo-50/50 transition text-left"
                >
                  <div className="size-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <UserRound className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{c.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">{c.company || "Pessoa física"}</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Selecionar</span>
                </button>
              ))
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
