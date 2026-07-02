import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, PiggyBank, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import { confirmAction } from "@/lib/confirm";
import { EmptyState } from "@/components/EmptyState";

interface Props {
  /** Mês no formato "YYYY-MM" — as caixinhas listadas serão as de reference_month = YYYY-MM-01. */
  monthKey: string;
  /** Se o usuário atual pode criar/editar/excluir. */
  canManage?: boolean;
}

/**
 * Caixinhas — reservas de lucro que descontam do lucro líquido do mês.
 */
export function ProfitReservesPanel({ monthKey, canManage = true }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", amount: "", description: "", category: "" });

  const referenceMonth = `${monthKey}-01`;

  const { data: reserves = [], isLoading } = useQuery({
    queryKey: ["profit-reserves", referenceMonth],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profit_reserves")
        .select("*")
        .eq("reference_month", referenceMonth)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = (reserves as any[]).reduce((s, r) => s + Number(r.amount || 0), 0);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", amount: "", description: "", category: "" });
    setOpen(true);
  };
  const openEdit = (r: any) => {
    setEditing(r);
    setForm({
      name: r.name || "",
      amount: String(r.amount || ""),
      description: r.description || "",
      category: r.category || "",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount.replace(",", "."));
      if (!form.name.trim()) throw new Error("Informe o nome da caixinha");
      if (!(amount > 0)) throw new Error("Informe um valor válido");
      const payload = {
        name: form.name.trim(),
        amount,
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        reference_month: referenceMonth,
      };
      if (editing) {
        const { error } = await (supabase as any).from("profit_reserves").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: userRes } = await supabase.auth.getUser();
        const { error } = await (supabase as any).from("profit_reserves").insert({
          ...payload,
          created_by: userRes.user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Caixinha atualizada" : "Caixinha criada");
      qc.invalidateQueries({ queryKey: ["profit-reserves"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const del = async (r: any) => {
    const ok = await confirmAction({
      title: "Excluir caixinha?",
      description: `A caixinha "${r.name}" (${formatBRL(Number(r.amount || 0))}) será removida e voltará ao lucro do mês.`,
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!ok) return;
    const { error } = await (supabase as any).from("profit_reserves").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Caixinha excluída");
    qc.invalidateQueries({ queryKey: ["profit-reserves"] });
  };

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
            <PiggyBank className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Caixinhas do mês</h3>
            <p className="text-[11px] text-slate-500">Reservas destinadas — descontam do lucro líquido.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total reservado</p>
            <p className="font-mono text-lg font-bold text-amber-700 tabular-nums">{formatBRL(total)}</p>
          </div>
          {canManage && (
            <Button size="sm" onClick={openCreate} className="h-9 bg-amber-600 hover:bg-amber-700 text-white">
              <Plus className="size-4 mr-1" /> Nova caixinha
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-xs text-slate-500 py-6 text-center">Carregando…</div>
      ) : (reserves as any[]).length === 0 ? (
        <EmptyState icon={PiggyBank} title="Nenhuma caixinha neste mês" description="Crie uma reserva para debitar do lucro." />
      ) : (
        <ul className="divide-y divide-slate-100">
          {(reserves as any[]).map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 truncate">{r.name}</p>
                <p className="text-[11px] text-slate-500 truncate">
                  {r.category ? <span className="font-medium text-slate-600">{r.category} · </span> : null}
                  {r.description || "sem descrição"}
                </p>
              </div>
              <p className="font-mono text-sm font-bold text-amber-700 tabular-nums shrink-0">
                −{formatBRL(Number(r.amount || 0))}
              </p>
              {canManage && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(r)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="size-8 text-rose-600 hover:text-rose-700" onClick={() => del(r)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar caixinha" : "Nova caixinha"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input placeholder="Ex.: Escritório, Reserva emergência" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input inputMode="decimal" placeholder="1500,00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input placeholder="Estrutura, Impostos…" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={3} placeholder="Detalhe o objetivo desta reserva" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <p className="text-[11px] text-slate-500">
              Esta caixinha será debitada do lucro líquido do mês <span className="font-semibold text-slate-700">{monthKey}</span>.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
              {save.isPending ? "Salvando…" : editing ? "Salvar alterações" : "Criar caixinha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
