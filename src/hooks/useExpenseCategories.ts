import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ExpenseCategory = { value: string; label: string; color: string; builtin?: boolean };

const BUILTIN: ExpenseCategory[] = [
  { value: "folha",        label: "Folha / Salários",       color: "#6366f1", builtin: true },
  { value: "fornecedor",   label: "Fornecedor",             color: "#0ea5e9", builtin: true },
  { value: "ferramenta",   label: "Ferramenta / Software",  color: "#8b5cf6", builtin: true },
  { value: "imposto",      label: "Imposto / Tributo",      color: "#f43f5e", builtin: true },
  { value: "marketing",    label: "Marketing",              color: "#f59e0b", builtin: true },
  { value: "operacional",  label: "Operacional",            color: "#64748b", builtin: true },
  { value: "financeiro",   label: "Financeiro / Bancário",  color: "#10b981", builtin: true },
  { value: "outros",       label: "Outros",                 color: "#94a3b8", builtin: true },
];

const SETTING_KEY = "expense_categories";
const PALETTE = ["#6366f1","#10b981","#f59e0b","#ef4444","#0ea5e9","#8b5cf6","#14b8a6","#f97316","#ec4899","#a855f7","#06b6d4"];

type Settings = { custom: ExpenseCategory[]; hidden: string[] };

export function slugifyCategory(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || `cat_${Date.now().toString(36)}`;
}

export function useExpenseCategories() {
  const qc = useQueryClient();

  const settingsQ = useQuery({
    queryKey: ["expense-categories-setting"],
    queryFn: async (): Promise<Settings> => {
      const { data } = await supabase
        .from("system_settings").select("value").eq("key", SETTING_KEY).maybeSingle();
      const v = (data?.value as any) || {};
      return {
        custom: Array.isArray(v.custom) ? v.custom : [],
        hidden: Array.isArray(v.hidden) ? v.hidden : [],
      };
    },
    staleTime: 60_000,
  });

  const settings = settingsQ.data ?? { custom: [], hidden: [] };

  // All categories known to the system (for label/color lookup — includes hidden built-ins so
  // historic rows keep showing their label in details).
  const allKnown: ExpenseCategory[] = [
    ...BUILTIN,
    ...(settings.custom || []).map((c) => ({ ...c, builtin: false })),
  ];

  // Categories visible in pickers/filters (excludes ones the user hid).
  const visible: ExpenseCategory[] = allKnown.filter(
    (c) => !(c.builtin && settings.hidden.includes(c.value)),
  );

  const labelOf = (value?: string | null) =>
    allKnown.find((c) => c.value === value)?.label ?? (value || "—");
  const colorOf = (value?: string | null) =>
    allKnown.find((c) => c.value === value)?.color ?? "#94a3b8";

  const save = useMutation({
    mutationFn: async (next: Settings) => {
      const { error } = await supabase
        .from("system_settings")
        .upsert({ key: SETTING_KEY, value: next as any, updated_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expense-categories-setting"] });
    },
    onError: (e: any) => toast.error(e.message || "Falha ao salvar categorias"),
  });

  const addCustom = async (label: string, color?: string) => {
    const cleanLabel = label.trim();
    if (!cleanLabel) { toast.error("Informe um nome"); return; }
    let value = slugifyCategory(cleanLabel);
    if (allKnown.some((c) => c.value === value)) value = `${value}_${Date.now().toString(36).slice(-4)}`;
    const nextColor = color || PALETTE[(settings.custom.length + 3) % PALETTE.length];
    const custom = [...settings.custom, { value, label: cleanLabel, color: nextColor }];
    await save.mutateAsync({ ...settings, custom });
    toast.success(`Categoria "${cleanLabel}" adicionada`);
  };

  const renameCategory = async (value: string, newLabel: string) => {
    const cleanLabel = newLabel.trim();
    if (!cleanLabel) return;
    const target = allKnown.find((c) => c.value === value);
    if (!target) return;
    if (target.builtin) {
      // Override built-in via custom entry with same value
      const filtered = settings.custom.filter((c) => c.value !== value);
      await save.mutateAsync({
        ...settings,
        custom: [...filtered, { value, label: cleanLabel, color: target.color }],
      });
    } else {
      await save.mutateAsync({
        ...settings,
        custom: settings.custom.map((c) => (c.value === value ? { ...c, label: cleanLabel } : c)),
      });
    }
    toast.success("Categoria renomeada");
  };

  const removeCategory = async (value: string) => {
    const target = allKnown.find((c) => c.value === value);
    if (!target) return;
    if (target.builtin) {
      // Hide, keep in allKnown for label lookup on historic rows
      if (settings.hidden.includes(value)) return;
      await save.mutateAsync({ ...settings, hidden: [...settings.hidden, value] });
    } else {
      await save.mutateAsync({
        ...settings,
        custom: settings.custom.filter((c) => c.value !== value),
      });
    }
    toast.success("Categoria removida das opções");
  };

  const restoreBuiltin = async (value: string) => {
    if (!settings.hidden.includes(value)) return;
    await save.mutateAsync({ ...settings, hidden: settings.hidden.filter((v) => v !== value) });
    toast.success("Categoria restaurada");
  };

  return {
    isLoading: settingsQ.isLoading,
    visible, allKnown, hiddenBuiltins: settings.hidden,
    labelOf, colorOf,
    addCustom, renameCategory, removeCategory, restoreBuiltin,
  };
}
