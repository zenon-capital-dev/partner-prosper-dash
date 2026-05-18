import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Mail, Star, User } from "lucide-react";
import { toast } from "sonner";

const PERMISSIONS = [
  { id: "documentos", label: "Documentos" },
  { id: "financeiro", label: "Financeiro" },
  { id: "contratos", label: "Contratos" },
  { id: "demandas", label: "Demandas" },
];

interface Props {
  companyId: string;
}

export function CompanyContactsManager({ companyId }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const { data: contacts = [] } = useQuery({
    queryKey: ["company-contacts", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_contacts")
        .select("*")
        .eq("company_id", companyId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ permissions: [], is_primary: contacts.length === 0 });
    setOpen(true);
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setForm({ ...c, permissions: c.permissions ?? [] });
    setOpen(true);
  };

  const togglePerm = (perm: string) => {
    const cur: string[] = form.permissions ?? [];
    setForm({
      ...form,
      permissions: cur.includes(perm) ? cur.filter((p) => p !== perm) : [...cur, perm],
    });
  };

  const submit = async () => {
    if (!form.name?.trim() || !form.email?.trim()) {
      toast.error("Nome e e-mail são obrigatórios");
      return;
    }
    setSaving(true);
    const payload = {
      company_id: companyId,
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      role: form.role || null,
      is_primary: !!form.is_primary,
      permissions: form.permissions ?? [],
    };
    const q = editing?.id
      ? supabase.from("company_contacts").update(payload).eq("id", editing.id)
      : supabase.from("company_contacts").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(editing?.id ? "Contato atualizado" : "Contato adicionado");
    qc.invalidateQueries({ queryKey: ["company-contacts", companyId] });
    setOpen(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Remover este contato?")) return;
    const { error } = await supabase.from("company_contacts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Contato removido");
    qc.invalidateQueries({ queryKey: ["company-contacts", companyId] });
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Contatos ({contacts.length})
        </p>
        <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={openCreate}>
          <Plus className="size-3" /> Adicionar
        </Button>
      </div>
      {contacts.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">Nenhum contato cadastrado.</p>
      ) : (
        <div className="space-y-1.5">
          {contacts.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background/60 border border-border/30 text-xs">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <User className="size-3 text-muted-foreground shrink-0" />
                  <span className="font-semibold truncate">{c.name}</span>
                  {c.is_primary && <Star className="size-3 text-amber-500 fill-amber-500" />}
                  {c.role && <span className="text-[10px] text-muted-foreground">· {c.role}</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Mail className="size-3 text-muted-foreground shrink-0" />
                  <span className="text-[10px] text-muted-foreground truncate">{c.email}</span>
                </div>
                {Array.isArray(c.permissions) && c.permissions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {c.permissions.map((p: string) => (
                      <Badge key={p} variant="secondary" className="text-[9px] h-4 px-1">{p}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-0.5">
                <Button size="icon" variant="ghost" className="size-6" onClick={() => openEdit(c)}>
                  <Pencil className="size-3" />
                </Button>
                <Button size="icon" variant="ghost" className="size-6 text-destructive" onClick={() => remove(c.id)}>
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar contato" : "Novo contato"}</DialogTitle>
            <DialogDescription>Pessoa responsável por esta empresa e suas permissões de acesso.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome *</Label>
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">E-mail *</Label>
              <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cargo / Função</Label>
              <Input value={form.role ?? ""} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Ex: Diretor Financeiro" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="primary" checked={!!form.is_primary} onCheckedChange={(v) => setForm({ ...form, is_primary: !!v })} />
              <Label htmlFor="primary" className="text-xs cursor-pointer">Contato principal</Label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Permissões de acesso</Label>
              <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/40 border border-border/40">
                {PERMISSIONS.map((p) => {
                  const checked = (form.permissions ?? []).includes(p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-2">
                      <Checkbox id={`perm-${p.id}`} checked={checked} onCheckedChange={() => togglePerm(p.id)} />
                      <Label htmlFor={`perm-${p.id}`} className="text-xs cursor-pointer">{p.label}</Label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Salvando..." : (editing?.id ? "Atualizar" : "Adicionar")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
