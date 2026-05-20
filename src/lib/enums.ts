// Enums espelhados do banco — única fonte de verdade no frontend.
export const COMMISSION_STATUS = ["pendente", "aprovada", "pago", "cancelada"] as const;
export type CommissionStatus = (typeof COMMISSION_STATUS)[number];

export const SALE_STATUS = ["pendente", "confirmada", "cancelada", "estornada"] as const;
export type SaleStatus = (typeof SALE_STATUS)[number];

export const LEAD_STATUS = [
  "Novo",
  "Em contato",
  "Interessado",
  "Proposta enviada",
  "Aguardando resposta",
  "Convertido",
  "Perdido",
] as const;
export type LeadStatus = (typeof LEAD_STATUS)[number];

export const DEMAND_STATUS = [
  "aguardando_inicio",
  "em_andamento",
  "aguardando_documentos",
  "em_revisao",
  "concluido",
  "pausado",
  "cancelado",
] as const;
export type DemandStatus = (typeof DEMAND_STATUS)[number];

export const COMMISSION_RULE_TYPE = ["percentage", "fixed"] as const;
export type CommissionRuleType = (typeof COMMISSION_RULE_TYPE)[number];
