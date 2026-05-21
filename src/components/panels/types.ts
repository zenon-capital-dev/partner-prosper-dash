import type { LucideIcon } from "lucide-react";

export type PanelRole = "colaborador" | "prestador" | "parceiro" | "indicador" | "cliente";

export interface PanelNavItem {
  key: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  badge?: number;
}

export const ROLE_THEME: Record<PanelRole, {
  accent: string;       // tailwind text-/border- base (e.g. indigo-600)
  accentBg: string;     // bg-* base
  accentSoft: string;   // bg-*-50
  accentText: string;   // text-*-700
  accentBorder: string; // border-*-200
  gradient: string;     // hero gradient
  ring: string;
  label: string;
}> = {
  colaborador: {
    accent: "indigo-600", accentBg: "bg-indigo-600", accentSoft: "bg-indigo-50",
    accentText: "text-indigo-700", accentBorder: "border-indigo-200",
    gradient: "from-indigo-600 via-indigo-500 to-violet-500", ring: "ring-indigo-100",
    label: "Operação",
  },
  prestador: {
    accent: "teal-600", accentBg: "bg-teal-600", accentSoft: "bg-teal-50",
    accentText: "text-teal-700", accentBorder: "border-teal-200",
    gradient: "from-teal-600 via-emerald-500 to-cyan-500", ring: "ring-teal-100",
    label: "Prestador",
  },
  parceiro: {
    accent: "violet-600", accentBg: "bg-violet-600", accentSoft: "bg-violet-50",
    accentText: "text-violet-700", accentBorder: "border-violet-200",
    gradient: "from-violet-600 via-purple-500 to-fuchsia-500", ring: "ring-violet-100",
    label: "Parceria",
  },
  indicador: {
    accent: "amber-600", accentBg: "bg-amber-600", accentSoft: "bg-amber-50",
    accentText: "text-amber-700", accentBorder: "border-amber-200",
    gradient: "from-amber-500 via-orange-500 to-rose-500", ring: "ring-amber-100",
    label: "Indicador",
  },
  cliente: {
    accent: "sky-600", accentBg: "bg-sky-600", accentSoft: "bg-sky-50",
    accentText: "text-sky-700", accentBorder: "border-sky-200",
    gradient: "from-sky-600 via-blue-500 to-indigo-500", ring: "ring-sky-100",
    label: "Portal do Cliente",
  },
};
