import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { formatBRL, formatPercent } from "@/lib/format";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Products() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ default_commission_percent: 10, base_price: 0, active: true });
  const qc = useQueryClient();

  const { data: products } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => (await supabase.from("products").select("*, product_categories(name, color)").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("product_categories").select("*").order("name")).data ?? [],
  });

  const submit = async () => {
    if (!form.name || !form.category_id) { toast.error("Nome e categoria obrigatórios"); return; }
    const { error } = await supabase.from("products").insert({
      name: form.name, description: form.description || null,
      category_id: form.category_id, base_price: Number(form.base_price ?? 0),
      default_commission_percent: Number(form.default_commission_percent ?? 10), active: true,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Produto cadastrado");
    setOpen(false); setForm({ default_commission_percent: 10, base_price: 0, active: true });
    qc.invalidateQueries({ queryKey: ["products-list"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir produto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Produto excluído"); qc.invalidateQueries({ queryKey: ["products-list"] }); }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in">
      <PageHeader title="Produtos" description="Catálogo de produtos vendidos pela empresa."
        actions={<Button onClick={() => setOpen(true)} className="gap-2 bg-gradient-primary hover:opacity-90"><Plus className="size-4" /> Novo Produto</Button>} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(products ?? []).length === 0 ? (
          <div className="col-span-full vx-card p-12 text-center text-muted-foreground text-sm">Nenhum produto cadastrado</div>
        ) : products?.map((p: any) => (
          <div key={p.id} className="vx-card p-5 hover:shadow-vx-md transition-shadow group">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase" style={{ background: `${p.product_categories?.color}20`, color: p.product_categories?.color }}>
                  {p.product_categories?.name}
                </span>
                <h3 className="font-display font-semibold text-lg mt-2 truncate">{p.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{p.description ?? "Sem descrição"}</p>
              </div>
              <button onClick={() => handleDelete(p.id)} className="size-8 rounded-md hover:bg-destructive-muted text-muted-foreground hover:text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Preço base</p>
                <p className="font-display font-bold vx-mono mt-1">{formatBRL(p.base_price)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Comissão padrão</p>
                <p className="font-display font-bold vx-mono mt-1 text-success">{formatPercent(p.default_commission_percent)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display text-xl">Novo produto</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Nome *</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar categoria" /></SelectTrigger>
                <SelectContent>{categories?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Preço base (R$)</Label><Input type="number" step="0.01" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} /></div>
              <div className="space-y-2"><Label>% Comissão padrão</Label><Input type="number" step="0.01" value={form.default_commission_percent} onChange={(e) => setForm({ ...form, default_commission_percent: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} className="bg-gradient-primary hover:opacity-90">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
