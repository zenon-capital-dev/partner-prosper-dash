export type InteractionKind =
  | "abordado"
  | "retorno"
  | "agenda_marcada"
  | "atendido"
  | "fechado"
  | "contrato_assinado"
  | "outro";

export const INTERACTION_KINDS: {
  value: InteractionKind;
  label: string;
  color: string;
  dot: string;
}[] = [
  { value: "abordado",          label: "Abordado",           color: "bg-sky-50 text-sky-700 border-sky-200",             dot: "bg-sky-500" },
  { value: "retorno",           label: "Retorno",            color: "bg-violet-50 text-violet-700 border-violet-200",     dot: "bg-violet-500" },
  { value: "agenda_marcada",    label: "Agenda marcada",     color: "bg-amber-50 text-amber-700 border-amber-200",        dot: "bg-amber-500" },
  { value: "atendido",          label: "Atendido",           color: "bg-blue-50 text-blue-700 border-blue-200",           dot: "bg-blue-500" },
  { value: "fechado",           label: "Fechado",            color: "bg-emerald-50 text-emerald-700 border-emerald-200",  dot: "bg-emerald-500" },
  { value: "contrato_assinado", label: "Contrato assinado",  color: "bg-indigo-50 text-indigo-700 border-indigo-200",     dot: "bg-indigo-500" },
  { value: "outro",             label: "Outro",              color: "bg-slate-50 text-slate-700 border-slate-200",        dot: "bg-slate-400" },
];

export const kindMeta = (k?: string | null) =>
  INTERACTION_KINDS.find((x) => x.value === k) ?? INTERACTION_KINDS[INTERACTION_KINDS.length - 1];

// Kinds tracked as "activity goals" (excludes "outro")
export const GOAL_KINDS: InteractionKind[] = [
  "abordado", "retorno", "agenda_marcada", "atendido", "fechado", "contrato_assinado",
];
