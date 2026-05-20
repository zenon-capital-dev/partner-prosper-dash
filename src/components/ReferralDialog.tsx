import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MaskedInput } from "@/components/ui/masked-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

type ReferralMode = "partner" | "referrer";

interface ReferralDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ReferralMode;
  ownerId: string;
  queryKey: readonly unknown[];
}

const emptyForm = {
  full_name: "",
  email: "",
  phone: "",
  company: "",
  notes: "",
};

export function ReferralDialog({ open, onOpenChange, mode, ownerId, queryKey }: ReferralDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const reset = () => setForm(emptyForm);

  async function handleSubmit() {
    if (!form.full_name.trim()) {
      toast.error("Informe o nome da indicação");
      return;
    }

    setSaving(true);
    const payload = {
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      company: form.company.trim() || null,
      notes: form.notes.trim() || null,
      status: "prospecto" as const,
      source: "indicacao",
      partner_id: mode === "partner" ? ownerId : null,
      referrer_id: mode === "referrer" ? ownerId : null,
    };

    const { error } = await supabase.from("clients").insert(payload);
    setSaving(false);

    if (error) {
      toast.error("Não foi possível cadastrar a indicação", { description: error.message });
      return;
    }

    toast.success("Indicação cadastrada com sucesso");
    reset();
    onOpenChange(false);
    queryClient.invalidateQueries({ queryKey });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) reset(); }}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" /> Nova indicação
          </DialogTitle>
          <DialogDescription>
            Cadastre uma oportunidade para a equipe acompanhar no funil comercial.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Nome do cliente indicado" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@empresa.com" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="WhatsApp ou telefone" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Empresa ou organização" />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Contexto, interesse ou melhor horário de contato" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Salvando..." : "Cadastrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}