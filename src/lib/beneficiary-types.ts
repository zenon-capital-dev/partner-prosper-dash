/**
 * Valores canônicos de `commission_splits.beneficiary_type`.
 * SEMPRE em inglês — o enum PG e o DB armazenam nesses valores.
 * Nunca use strings soltas ("parceiro", "colaborador"...) no código.
 */
export const BENEFICIARY_TYPE = {
  partner: "partner",
  collaborator: "collaborator",
  referrer: "referrer",
  service_provider: "service_provider",
} as const;

export type BeneficiaryType = typeof BENEFICIARY_TYPE[keyof typeof BENEFICIARY_TYPE];

export const BENEFICIARY_TYPE_LABEL: Record<BeneficiaryType, string> = {
  partner: "Parceiro",
  collaborator: "Colaborador",
  referrer: "Indicador",
  service_provider: "Prestador",
};
