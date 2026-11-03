import type { LucideIcon } from "lucide-react";

export type PanelRole = "colaborador" | "prestador" | "parceiro" | "indicador" | "cliente";

export interface PanelNavItem {
  key: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  badge?: number;
}

// Identidade Zenon: todos os perfis usam a mesma paleta (indigo = escala azul Zenon no Tailwind).
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
    accent: "indigo-600", accentBg: "bg-zenon-bronze", accentSoft: "bg-indigo-50",
    accentText: "text-indigo-700", accentBorder: "border-indigo-200",
    gradient: "from-indigo-600 via-indigo-600 to-indigo-500", ring: "ring-indigo-100",
    label: "Operação",
  },
  prestador: {
    accent: "indigo-600", accentBg: "bg-zenon-bronze", accentSoft: "bg-indigo-50",
    accentText: "text-indigo-700", accentBorder: "border-indigo-200",
    gradient: "from-indigo-600 via-indigo-600 to-indigo-500", ring: "ring-indigo-100",
    label: "Prestador",
  },
  parceiro: {
    accent: "indigo-600", accentBg: "bg-zenon-bronze", accentSoft: "bg-indigo-50",
    accentText: "text-indigo-700", accentBorder: "border-indigo-200",
    gradient: "from-indigo-600 via-indigo-600 to-indigo-500", ring: "ring-indigo-100",
    label: "Parceria",
  },
  indicador: {
    accent: "indigo-600", accentBg: "bg-zenon-bronze", accentSoft: "bg-indigo-50",
    accentText: "text-indigo-700", accentBorder: "border-indigo-200",
    gradient: "from-indigo-600 via-indigo-600 to-indigo-500", ring: "ring-indigo-100",
    label: "Indicador",
  },
  cliente: {
    accent: "indigo-600", accentBg: "bg-zenon-bronze", accentSoft: "bg-indigo-50",
    accentText: "text-indigo-700", accentBorder: "border-indigo-200",
    gradient: "from-indigo-600 via-indigo-600 to-indigo-500", ring: "ring-indigo-100",
    label: "Portal do Cliente",
  },
};
