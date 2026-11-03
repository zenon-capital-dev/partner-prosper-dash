import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Eye, Save } from "lucide-react";
import { NO_VISIBILITY, VISIBILITY_ITEMS, BENEFICIARY_LABEL, type BeneficiaryType, type Visibility } from "@/lib/visibility";

const db = supabase as any;

/**
 * Admin: o que esta pessoa pode ver em TODAS as vendas dela.
 * Padrão bloqueado. Em cada venda dá para ajustar no formulário da venda.
 */
export function FinancialVisibilityControl({ beneficiaryType, beneficiaryId, compact = false }: { beneficiaryType: BeneficiaryType; beneficiaryId: string; compact?: boolean }) {
  const qc = useQueryClient();
  const key = ["financial-visibility", beneficiaryType, beneficiaryId];
  const { data: saved, isLoading } = useQuery({
    queryKey: key,
    enabled: !!beneficiaryId,
    queryFn: async () => {
      const { data, error } = await db
        .from("financial_visibility")
        .select("see_gross, see_payments, see_deductions")
        .eq("beneficiary_type", beneficiaryType)
        .eq("beneficiary_id", beneficiaryId)
        .maybeSingle();
      if (error) throw error;
      return (data as Visibility | null) ?? NO_VISIBILITY;
    },
  });

  const [draft, setDraft] = useState<Visibility>(NO_VISIBILITY);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (saved) setDraft(saved); }, [saved]);
  const dirty = !!saved && VISIBILITY_ITEMS.some(({ key: k }) => saved[k] !== draft[k]);

  const save = async () => {
    setSaving(true);
    const { error } = await db.from("financial_visibility").upsert(
      { beneficiary_type: beneficiaryType, beneficiary_id: beneficiaryId, ...draft, updated_at: new Date().toISOString() },
      { onConflict: "beneficiary_type,beneficiary_id" },
    );
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Visibilidade salva");
    qc.invalidateQueries({ queryKey: key });
  };

  const body = (
    <div className="space-y-3">
      {VISIBILITY_ITEMS.map(({ key: k, label, hint }) => (
        <label key={k} className="flex items-start justify-between gap-4 cursor-pointer">
          <span>
            <span className="block text-sm font-medium">{label}</span>
            <span className="block text-xs text-muted-foreground">{hint}</span>
          </span>
          <Switch checked={draft[k]} disabled={isLoading} onCheckedChange={(v) => setDraft({ ...draft, [k]: v })} />
        </label>
      ))}
      <p className="text-xs text-muted-foreground">
        Sem nada marcado, o {BENEFICIARY_LABEL[beneficiaryType].toLowerCase()} vê só o que tem a receber
        {beneficiaryType === "partner" ? ": base de cálculo, percentual e comissão." : "."}
      </p>
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={!dirty || saving}><Save className="size-3.5 mr-1" />Salvar</Button>
      </div>
    </div>
  );

  if (compact) return body;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Eye className="size-4" /> Visibilidade financeira</CardTitle>
        <CardDescription>O que este {BENEFICIARY_LABEL[beneficiaryType].toLowerCase()} enxerga em todas as vendas dele. Em cada venda dá para ajustar.</CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
