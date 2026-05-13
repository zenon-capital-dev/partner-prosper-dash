import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Briefcase, User, Mail, Phone, IdCard, Star, Lock, Building2, Wallet } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  provider?: any;
  onSuccess?: () => void;
}

const SPECIALTIES = [
  "Contabilidade", "Tributário", "Jurídico", "Trabalhista", "Societário",
  "Marketing Digital", "Tecnologia / TI", "RH e Departamento Pessoal",
  "Consultoria Financeira", "Auditoria", "Compliance", "Outro",
];

export function ProviderFormDialog({ open, onOpenChange, provider, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [createAccess, setCreateAccess] = useState(false);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (open) {
      if (provider) {
        setForm({ ...provider });
        setCreateAccess(false);
      } else {
        setForm({ active: true, internal_rating: 5 });
        setCreateAccess(false);
      }
    }
  }, [open, provider]);

  const submit = async () => {
    if (!form.name?.trim()) { toast.error("Nome é obrigatório"); return; }
    setSubmitting(true);

    const payload = {
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      document_number: form.document_number || null,
      specialty: form.specialty === "Outro" ? form.specialty_other : form.specialty || null,
      internal_notes: form.internal_notes || null,
      internal_rating: form.internal_rating ?? null,
      active: form.active ?? true,
    };

    let providerId = provider?.id;
    let error: any = null;
    if (provider) {
      const r = await supabase.from("service_providers").update(payload).eq("id", provider.id);
      error = r.error;
    } else {
      const r = await supabase.from("service_providers").insert(payload).select("id").single();
      error = r.error;
      providerId = r.data?.id;
    }

    if (error) { toast.error(error.message); setSubmitting(false); return; }

    // Optionally create login for provider
    if (createAccess && form.email && form.access_password && providerId) {
      const { error: fnErr } = await supabase.functions.invoke("invite-user", {
        body: {
          email: form.email,
          password: form.access_password,
          full_name: form.name,
          role: "prestador",
          link_type: "service_provider",
          link_id: providerId,
        },
      });
      if (fnErr) toast.warning("Prestador salvo, mas erro ao criar login: " + fnErr.message);
      else toast.success("Login do prestador criado");
    }

    setSubmitting(false);
    toast.success(provider ? "Prestador atualizado" : "Prestador cadastrado");
    onSuccess?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-lg">
              <Briefcase className="size-5" />
            </div>
            <div>
              <DialogTitle className="font-display text-xl">{provider ? "Editar Prestador" : "Novo Prestador de Serviço"}</DialogTitle>
              <DialogDescription className="text-xs">
                Cadastre fornecedores externos que executam demandas dos seus clientes.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <Section icon={<User className="size-3.5" />} title="Identificação">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome / Razão Social *" className="col-span-2">
                <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Alpha Contabilidade ME" />
              </Field>
              <Field label="CPF / CNPJ">
                <Input value={form.document_number ?? ""} onChange={(e) => setForm({ ...form, document_number: e.target.value })} placeholder="00.000.000/0001-00" />
              </Field>
              <Field label="Especialidade / Área">
                <Select value={form.specialty ?? ""} onValueChange={(v) => setForm({ ...form, specialty: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione a área" /></SelectTrigger>
                  <SelectContent>
                    {SPECIALTIES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              {form.specialty === "Outro" && (
                <Field label="Outra especialidade" className="col-span-2">
                  <Input value={form.specialty_other ?? ""} onChange={(e) => setForm({ ...form, specialty_other: e.target.value })} placeholder="Descreva a área de atuação" />
                </Field>
              )}
            </div>
          </Section>

          <Section icon={<Mail className="size-3.5" />} title="Contato">
            <div className="grid grid-cols-2 gap-3">
              <Field label="E-mail principal">
                <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contato@empresa.com" />
              </Field>
              <Field label="Telefone / WhatsApp">
                <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
              </Field>
            </div>
          </Section>

          <Section icon={<Star className="size-3.5" />} title="Avaliação interna">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nota interna (0–5)">
                <Input type="number" step="0.1" min={0} max={5} value={form.internal_rating ?? ""} onChange={(e) => setForm({ ...form, internal_rating: e.target.value === "" ? null : Number(e.target.value) })} />
              </Field>
              <div className="flex items-end justify-between rounded-xl border border-border bg-muted/20 px-4 py-2.5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-foreground">Status</p>
                  <p className="text-[11px] text-muted-foreground">{form.active ? "Disponível para receber demandas" : "Inativo / pausado"}</p>
                </div>
                <Switch checked={!!form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              </div>
            </div>
            <Field label="Notas internas (apenas admin vê)" className="mt-3">
              <Textarea
                value={form.internal_notes ?? ""}
                onChange={(e) => setForm({ ...form, internal_notes: e.target.value })}
                placeholder="Forma de pagamento, prazo médio, observações..."
                rows={3}
              />
            </Field>
          </Section>

          {!provider && (
            <Section icon={<Lock className="size-3.5" />} title="Acesso ao painel (opcional)">
              <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider">Criar login para o prestador</p>
                    <p className="text-[11px] text-muted-foreground">Ele poderá acessar apenas as demandas e documentos delegados.</p>
                  </div>
                  <Switch checked={createAccess} onCheckedChange={setCreateAccess} disabled={!form.email} />
                </div>
                {createAccess && (
                  <Field label="Senha provisória (mín. 6 caracteres)">
                    <Input type="text" value={form.access_password ?? ""} onChange={(e) => setForm({ ...form, access_password: e.target.value })} placeholder="Mínimo 6 caracteres" />
                  </Field>
                )}
              </div>
            </Section>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting} className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg">
            {submitting ? "Salvando..." : provider ? "Salvar Alterações" : "Cadastrar Prestador"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        <span className="size-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
