import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Save } from "lucide-react";
import { useProductsRef } from "@/hooks/useReferenceData";
import { DEDUCTION_CATEGORIES, type DeductionCategory, type DeductionType } from "@/lib/deductions";

const db = supabase as any;

/**
 * Configurações › Deduções
 * 1) Catálogo: tipos de dedução (imposto, jurídico, sistema, prestador, PJ...).
 * 2) Padrão por produto: quais deduções entram automaticamente numa venda nova.
 * Tudo aqui é só do admin; parceiro e prestador nunca veem.
 */
export function DeductionsSettings() {
  const qc = useQueryClient();
  const { data: types = [], isLoading } = useQuery({
    queryKey: ["deduction-types"],
    queryFn: async () => {
      const { data, error } = await db.from("deduction_types").select("*").order("sort_order").order("name");
      if (error) throw error;
      return (data ?? []) as DeductionType[];
    },
  });

  const [drafts, setDrafts] = useState<Record<string, Partial<DeductionType>>>({});
  const [newType, setNewType] = useState<{ name: string; category: DeductionCategory; default_percent: string }>({ name: "", category: "outros", default_percent: "" });

  const refresh = () => qc.invalidateQueries({ queryKey: ["deduction-types"] });

  const saveType = async (t: DeductionType) => {
    const d = drafts[t.id];
    if (!d) return;
    const pct = d.default_percent === undefined ? t.default_percent : d.default_percent;
    if (pct != null && (pct < 0 || pct > 100)) { toast.error("Percentual deve ficar entre 0 e 100"); return; }
    const { error } = await db.from("deduction_types").update({ ...d, updated_at: new Date().toISOString() }).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    setDrafts((x) => { const n = { ...x }; delete n[t.id]; return n; });
    toast.success("Dedução atualizada");
    refresh();
  };

  const addType = async () => {
    const name = newType.name.trim();
    if (!name) { toast.error("Informe o nome da dedução"); return; }
    const pct = newType.default_percent === "" ? null : Number(newType.default_percent);
    if (pct != null && (!Number.isFinite(pct) || pct < 0 || pct > 100)) { toast.error("Percentual deve ficar entre 0 e 100"); return; }
    const sort = (types.reduce((m, t) => Math.max(m, t.sort_order), 0) || 0) + 10;
    const { error } = await db.from("deduction_types").insert({ name, category: newType.category, default_percent: pct, sort_order: sort });
    if (error) { toast.error(error.message.includes("duplicate") ? "Já existe uma dedução com esse nome" : error.message); return; }
    setNewType({ name: "", category: "outros", default_percent: "" });
    toast.success("Dedução criada");
    refresh();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Tipos de dedução</CardTitle>
          <CardDescription>
            Provisões descontadas do bruto antes da comissão do parceiro. O que sobra é a base de cálculo.
            O parceiro vê só a base e o percentual dele, nunca estes itens.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {types.map((t) => {
            const d = drafts[t.id] ?? {};
            const val = <K extends keyof DeductionType>(k: K) => (d[k] !== undefined ? d[k] : t[k]) as DeductionType[K];
            const set = (patch: Partial<DeductionType>) => setDrafts((x) => ({ ...x, [t.id]: { ...x[t.id], ...patch } }));
            return (
              <div key={t.id} className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-2">
                <Input className="h-9 flex-1 min-w-[160px]" value={val("name")} onChange={(e) => set({ name: e.target.value })} aria-label="Nome" />
                <Select value={val("category")} onValueChange={(v) => set({ category: v as DeductionCategory })}>
                  <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>{DEDUCTION_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
                <div className="relative w-28">
                  <Input
                    type="number" step="0.01" min="0" max="100" className="h-9 pr-7 text-right font-mono" aria-label="Percentual padrão"
                    value={val("default_percent") ?? ""}
                    onChange={(e) => set({ default_percent: e.target.value === "" ? null : Number(e.target.value) })}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={val("active")} onCheckedChange={(v) => set({ active: v })} /> Ativa
                </label>
                <Button size="sm" variant="outline" disabled={!drafts[t.id]} onClick={() => saveType(t)}><Save className="size-3.5 mr-1" />Salvar</Button>
              </div>
            );
          })}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Input className="h-9 flex-1 min-w-[160px]" placeholder="Nova dedução (ex.: Taxa bancária)" value={newType.name} onChange={(e) => setNewType({ ...newType, name: e.target.value })} />
            <Select value={newType.category} onValueChange={(v) => setNewType({ ...newType, category: v as DeductionCategory })}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{DEDUCTION_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
            <div className="relative w-28">
              <Input type="number" step="0.01" min="0" max="100" className="h-9 pr-7 text-right font-mono" placeholder="0" value={newType.default_percent} onChange={(e) => setNewType({ ...newType, default_percent: e.target.value })} aria-label="Percentual padrão" />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
            <Button size="sm" onClick={addType}><Plus className="size-3.5 mr-1" />Adicionar</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Categoria "Prestador de serviço" vira o repasse do prestador na venda. As outras somam no custo da operação.</p>
        </CardContent>
      </Card>

      <ProductTemplates types={types} />
    </div>
  );
}

function ProductTemplates({ types }: { types: DeductionType[] }) {
  const qc = useQueryClient();
  const { data: productsAll = [] } = useProductsRef(true);
  const products = useMemo(() => (productsAll as any[]).filter((p) => p.active !== false), [productsAll]);
  const [productId, setProductId] = useState<string>("");
  const [rows, setRows] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: template = [] } = useQuery({
    queryKey: ["product-deduction-template", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await db.from("product_deduction_templates").select("deduction_type_id, percent, fixed_amount").eq("product_id", productId);
      if (error) throw error;
      return (data ?? []) as { deduction_type_id: string; percent: number | null; fixed_amount: number | null }[];
    },
  });

  useEffect(() => {
    const m: Record<string, string> = {};
    for (const r of template) m[r.deduction_type_id] = r.percent != null ? String(r.percent) : "";
    setRows(m);
  }, [template]);

  const total = Object.values(rows).reduce((s, v) => s + (Number(v) || 0), 0);

  const save = async () => {
    if (!productId) return;
    for (const v of Object.values(rows)) {
      const n = Number(v);
      if (v !== "" && (!Number.isFinite(n) || n < 0 || n > 100)) { toast.error("Percentual deve ficar entre 0 e 100"); return; }
    }
    setSaving(true);
    try {
      const selected = Object.entries(rows).filter(([, v]) => v !== "");
      const { error: delErr } = await db.from("product_deduction_templates").delete().eq("product_id", productId);
      if (delErr) throw delErr;
      if (selected.length) {
        const { error } = await db.from("product_deduction_templates").insert(
          selected.map(([deduction_type_id, v]) => ({ product_id: productId, deduction_type_id, percent: Number(v) })),
        );
        if (error) throw error;
      }
      toast.success("Padrão do produto salvo");
      qc.invalidateQueries({ queryKey: ["product-deduction-template", productId] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Padrão por produto</CardTitle>
        <CardDescription>Deduções que entram sozinhas quando uma venda nova desse produto é cadastrada. Na venda dá para ajustar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={productId} onValueChange={setProductId}>
          <SelectTrigger className="h-9 max-w-md"><SelectValue placeholder="Escolha o produto" /></SelectTrigger>
          <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>

        {productId && (
          <>
            {types.filter((t) => t.active).map((t) => (
              <div key={t.id} className="flex items-center gap-3 border-b border-border/60 pb-2">
                <span className="flex-1 text-sm">{t.name}</span>
                <div className="relative w-28">
                  <Input
                    type="number" step="0.01" min="0" max="100" className="h-9 pr-7 text-right font-mono" placeholder="não usa"
                    aria-label={`${t.name} em %`}
                    value={rows[t.id] ?? ""}
                    onChange={(e) => setRows({ ...rows, [t.id]: e.target.value })}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-muted-foreground">
                Deduções: <strong className="font-mono">{total.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</strong> · Base do parceiro: <strong className="font-mono">{Math.max(0, 100 - total).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</strong> do bruto
              </span>
              <Button size="sm" onClick={save} disabled={saving}><Save className="size-3.5 mr-1" />Salvar padrão</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
