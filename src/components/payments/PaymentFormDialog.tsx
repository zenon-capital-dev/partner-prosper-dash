import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Wallet, Calendar, Repeat } from "lucide-react";
import { formatBRL } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Quando informado, o dialog fica travado a esse cliente. Quando omitido, o usuário escolhe. */
  clientId?: string;
  onCreated?: () => void;
}

function addMonths(iso: string, months: number) {
  const d = new Date(iso + "T00:00:00");
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function PaymentFormDialog({ open, onOpenChange, clientId: lockedClientId, onCreated }: Props) {
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [installments, setInstallments] = useState(1);
  const [firstDueDate, setFirstDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [productId, setProductId] = useState<string>("none");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const clientId = lockedClientId ?? selectedClientId;

  useEffect(() => {
    if (open) {
      setAmount("");
      setInstallments(1);
      setFirstDueDate(new Date().toISOString().slice(0, 10));
      setProductId("none");
      setDescription("");
      setSelectedClientId("");
    }
  }, [open]);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-payment-picker"],
    enabled: open && !lockedClientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, full_name, email")
        .order("full_name", { ascending: true })
        .limit(500);
      return data ?? [];
    },
  });

  const { data: clientProducts = [] } = useQuery({
    queryKey: ["client-products-for-payment", clientId],
    enabled: open && !!clientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_products")
        .select("id, custom_product_name, product_id, products(name)")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });


  const totalNum = Number(amount.replace(",", ".")) || 0;
  const perInstallment = installments > 0 ? totalNum / installments : 0;

  const submit = async () => {
    if (!clientId) return toast.error("Selecione um cliente");
    if (totalNum <= 0) return toast.error("Informe um valor válido");
    if (!firstDueDate) return toast.error("Informe a data de vencimento");
    if (installments < 1 || installments > 60) return toast.error("Parcelas entre 1 e 60");

    setSaving(true);
    try {
      const totalCents = Math.round(totalNum * 100);
      const baseCents = Math.floor(totalCents / installments);
      const cp = productId !== "none" ? clientProducts.find((p: any) => p.id === productId) : null;

      const rows = Array.from({ length: installments }).map((_, i) => {
        const cents = i === installments - 1 ? totalCents - baseCents * (installments - 1) : baseCents;
        return {
          client_id: clientId,
          amount: cents / 100,
          due_date: addMonths(firstDueDate, i),
          status: "pendente" as const,
          installment_number: i + 1,
          installments_count: installments,
          description: description || (cp ? `Pagamento ${cp.products?.name || cp.custom_product_name || ""}`.trim() : "Pendência avulsa"),
          client_product_id: cp?.id ?? null,
          product_id: cp?.product_id ?? null,
        };
      });

      const { error } = await supabase.from("payments").insert(rows);
      if (error) throw error;
      toast.success(installments > 1 ? `${installments} parcelas lançadas` : "Pendência lançada");
      onCreated?.();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao lançar pendência");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <Wallet className="size-4" />
            </div>
            Lançar Pendência de Pagamento
          </DialogTitle>
          <DialogDescription>
            Crie uma cobrança avulsa ou parcele em várias mensalidades. Não precisa estar vinculada a uma venda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!lockedClientId && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Cliente</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}{c.email ? ` · ${c.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Valor total (R$)</Label>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Repeat className="size-3.5" /> Parcelas
              </Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={installments}
                onChange={(e) => setInstallments(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Calendar className="size-3.5" /> 1º Vencimento
            </Label>
            <Input type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} />
            {installments > 1 && totalNum > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {installments}x de <span className="font-bold tabular-nums">{formatBRL(perInstallment)}</span> a partir desta data.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Vincular ao serviço (opcional)</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Pendência avulsa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Pendência avulsa —</SelectItem>
                {clientProducts.map((cp: any) => (
                  <SelectItem key={cp.id} value={cp.id}>
                    {cp.products?.name || cp.custom_product_name || "Serviço"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Descrição (opcional)</Label>
            <Textarea
              rows={2}
              placeholder="Ex: Entrada do projeto, taxa de cadastro, mensalidade…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? "Lançando..." : "Lançar pendência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
