export type SupportStatus = "aberto" | "em_andamento" | "resolvido" | "fechado";
export type RequesterRole = "colaborador" | "prestador";

export interface SupportTicket {
  id: string;
  requester_id: string;
  requester_role: RequesterRole;
  subject: string;
  category: string;
  priority: string;
  status: SupportStatus;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_user_id: string;
  sender_role: "admin" | "requester";
  body: string;
  created_at: string;
}

export const CATEGORIES: { value: string; label: string }[] = [
  { value: "geral", label: "Dúvida geral" },
  { value: "acesso", label: "Acesso / login" },
  { value: "demanda", label: "Demanda" },
  { value: "documentos", label: "Documentos" },
  { value: "financeiro", label: "Financeiro / comissão" },
  { value: "bug", label: "Erro no sistema" },
  { value: "outro", label: "Outro" },
];

export const PRIORITIES = [
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

export const STATUS_META: Record<SupportStatus, { label: string; cls: string }> = {
  aberto: { label: "Aberto", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  em_andamento: { label: "Em andamento", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  resolvido: { label: "Resolvido", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  fechado: { label: "Fechado", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

export const PRIORITY_CLS: Record<string, string> = {
  baixa: "text-slate-500",
  normal: "text-slate-700",
  alta: "text-orange-600",
  urgente: "text-rose-600 font-semibold",
};

export const categoryLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;
