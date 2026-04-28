import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2, MoreHorizontal } from "lucide-react";
import { formatBRL, formatPercent, initials } from "@/lib/format";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function Partners() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ active: true, commission_percent: 10 });
  const qc = useQueryClient();

  const { data: partners } = useQuery({
    queryKey: ["partners-list", search],
    queryFn: async () => {
      let q = supabase.from("partners").select("*, commissions(amount, status), clients(id)").order("created_at", { ascending: false });
      if (search) q = q.ilike("full_name", `%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const submit = async () => {
    if (!form.full_name) { toast.error("Nome obrigatório"); return; }
    const { error } = await supabase.from("partners").insert({
      full_name: form.full_name, email: form.email || null, phone: form.phone || null,
      document: form.document || null, pix_key: form.pix_key || null,
      commission_percent: Number(form.commission_percent ?? 10), notes: form.notes || null, active: true,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Parceiro cadastrado");
    setOpen(false); setForm({ active: true, commission_percent: 10 });
    qc.invalidateQueries({ queryKey: ["partners-list"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir parceiro?")) return;
    const { error } = await supabase.from("partners").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Parceiro excluído"); qc.invalidateQueries({ queryKey: ["partners-list"] }); }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in">
      <PageHeader title="Parceiros" description="Gerencie parceiros indicadores e suas comissões."
        actions={<Button onClick={() => setOpen(true)} className="gap-2 bg-gradient-primary hover:opacity-90"><Plus className="size-4" /> Novo Parceiro</Button>} />

      <div className="vx-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar parceiro..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <span className="text-xs text-muted-foreground">{partners?.length ?? 0} parceiros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 text-left font-semibold">Parceiro</th>
                <th className="px-6 py-3 text-left font-semibold">Contato</th>
                <th className="px-6 py-3 text-left font-semibold">% Comissão</th>
                <th className="px-6 py-3 text-left font-semibold">Indicações</th>
                <th className="px-6 py-3 text-left font-semibold">Total Comissões</th>
                <th className="px-6 py-3 text-left font-semibold">Status</th>
                <th className="px-6 py-3 text-right font-semibold w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(partners ?? []).length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-16 text-center text-muted-foreground text-sm">Nenhum parceiro cadastrado</td></tr>
              ) : partners?.map((p: any) => {
                const total = (p.commissions ?? []).reduce((s: number, c: any) => s + Number(c.amount), 0);
                return (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-warning-muted text-warning flex items-center justify-center text-xs font-semibold">{initials(p.full_name)}</div>
                        <div>
                          <p className="font-medium">{p.full_name}</p>
                          <p className="text-xs text-muted-foreground">{p.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">{p.phone ?? "—"}</td>
                    <td className="px-6 py-4 vx-mono">{formatPercent(p.commission_percent)}</td>
                    <td className="px-6 py-4 vx-mono">{p.clients?.length ?? 0}</td>
                    <td className="px-6 py-4 vx-mono font-semibold">{formatBRL(total)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${p.active ? "bg-success-muted text-success" : "bg-muted text-muted-foreground"}`}>
                        <span className="size-1.5 rounded-full bg-current" />{p.active ? "ativo" : "inativo"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><button className="size-8 rounded-md hover:bg-muted flex items-center justify-center"><MoreHorizontal className="size-4 text-muted-foreground" /></button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDelete(p.id)} className="text-destructive"><Trash2 className="size-4 mr-2" /> Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle className="font-display text-xl">Novo parceiro</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-2"><Label>Nome *</Label><Input value={form.full_name ?? ""} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>CPF/CNPJ</Label><Input value={form.document ?? ""} onChange={(e) => setForm({ ...form, document: e.target.value })} /></div>
            <div className="space-y-2"><Label>Chave PIX</Label><Input value={form.pix_key ?? ""} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} /></div>
            <div className="col-span-2 space-y-2"><Label>% Comissão padrão</Label><Input type="number" step="0.01" value={form.commission_percent} onChange={(e) => setForm({ ...form, commission_percent: e.target.value })} /></div>
            <div className="col-span-2 space-y-2"><Label>Observações</Label><Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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
