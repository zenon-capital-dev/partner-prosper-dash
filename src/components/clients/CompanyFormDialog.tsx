import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MaskedInput } from "@/components/ui/masked-input";
import { onlyDigits } from "@/lib/masks";
import { isValidCPFOrCNPJ, isValidPhoneBR, lookupCEP } from "@/lib/validators";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  company?: any;
  onSaved?: () => void;
}

export function CompanyFormDialog({ open, onOpenChange, clientId, company, onSaved }: Props) {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(company ?? {});
  }, [company, open]);

  const submit = async () => {
    if (!form.name?.trim()) {
      toast.error("Razão social obrigatória");
      return;
    }
    if (form.document && !isValidCPFOrCNPJ(form.document)) { toast.error("CPF/CNPJ inválido"); return; }
    if (form.phone && !isValidPhoneBR(form.phone)) { toast.error("Telefone inválido"); return; }
    setSaving(true);
    const payload = {
      client_id: clientId,
      name: form.name.trim(),
      trade_name: form.trade_name || null,
      document: form.document ? onlyDigits(form.document) : null,
      email: form.email || null,
      phone: form.phone ? onlyDigits(form.phone) : null,
      address_street: form.address_street || null,
      address_number: form.address_number || null,
      address_complement: form.address_complement || null,
      address_neighborhood: form.address_neighborhood || null,
      address_city: form.address_city || null,
      address_state: form.address_state || null,
      address_zip_code: form.address_zip_code ? onlyDigits(form.address_zip_code) : null,
    };
    const q = company?.id
      ? supabase.from("companies").update(payload).eq("id", company.id)
      : supabase.from("companies").insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(company?.id ? "Empresa atualizada" : "Empresa cadastrada");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{company?.id ? "Editar empresa" : "Nova empresa vinculada"}</DialogTitle>
          <DialogDescription>Vincule uma pessoa jurídica a este cliente.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
          <Field label="Razão social *" full>
            <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Nome fantasia">
            <Input value={form.trade_name ?? ""} onChange={(e) => setForm({ ...form, trade_name: e.target.value })} />
          </Field>
          <Field label="CNPJ / CPF">
            <MaskedInput mask="cpfcnpj" value={form.document ?? ""} onChange={(v) => setForm({ ...form, document: v })} placeholder="00.000.000/0001-00" />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Telefone">
            <MaskedInput mask="phone" value={form.phone ?? ""} onChange={(v) => setForm({ ...form, phone: v })} placeholder="(11) 99999-9999" />
          </Field>
          <Field label="CEP">
            <MaskedInput
              mask="cep"
              value={form.address_zip_code ?? ""}
              onChange={(v) => setForm({ ...form, address_zip_code: v })}
              onBlur={async () => {
                const r = await lookupCEP(form.address_zip_code ?? "");
                if (r) {
                  setForm((p: any) => ({
                    ...p,
                    address_street: p.address_street || r.logradouro,
                    address_neighborhood: p.address_neighborhood || r.bairro,
                    address_city: p.address_city || r.localidade,
                    address_state: p.address_state || r.uf,
                  }));
                  toast.success("Endereço preenchido pelo CEP");
                }
              }}
              placeholder="00000-000"
            />
          </Field>
          <Field label="Rua" full>
            <Input value={form.address_street ?? ""} onChange={(e) => setForm({ ...form, address_street: e.target.value })} />
          </Field>
          <Field label="Número">
            <Input value={form.address_number ?? ""} onChange={(e) => setForm({ ...form, address_number: e.target.value })} />
          </Field>
          <Field label="Complemento">
            <Input value={form.address_complement ?? ""} onChange={(e) => setForm({ ...form, address_complement: e.target.value })} />
          </Field>
          <Field label="Bairro">
            <Input value={form.address_neighborhood ?? ""} onChange={(e) => setForm({ ...form, address_neighborhood: e.target.value })} />
          </Field>
          <Field label="Cidade">
            <Input value={form.address_city ?? ""} onChange={(e) => setForm({ ...form, address_city: e.target.value })} />
          </Field>
          <Field label="Estado (UF)">
            <Input maxLength={2} value={form.address_state ?? ""} onChange={(e) => setForm({ ...form, address_state: e.target.value.toUpperCase() })} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Salvando..." : (company?.id ? "Atualizar" : "Cadastrar")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? "md:col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
