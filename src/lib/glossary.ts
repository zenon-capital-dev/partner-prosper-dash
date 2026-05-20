// Glossário central — mapeia status/enums do backend para labels PT-BR.
// Use prettyStatus(domain, key) em vez de manter maps espalhados nas páginas.

type Domain = "lead" | "demanda" | "comissao" | "venda" | "regra" | "role";

const DICT: Record<Domain, Record<string, string>> = {
  lead: {
    "Novo": "Novo",
    "Em contato": "Em contato",
    "Interessado": "Interessado",
    "Proposta enviada": "Proposta enviada",
    "Aguardando resposta": "Aguardando resposta",
    "Convertido": "Convertido",
    "Perdido": "Perdido",
  },
  demanda: {
    aguardando_inicio: "Aguardando início",
    em_andamento: "Em andamento",
    aguardando_documentos: "Aguardando documentos",
    em_revisao: "Em revisão",
    concluido: "Concluído",
    pausado: "Pausado",
    cancelado: "Cancelado",
  },
  comissao: {
    pendente: "Pendente",
    aprovada: "Aprovada",
    aprovado: "Aprovada",
    pago: "Pago",
    paga: "Pago",
    cancelada: "Cancelada",
  },
  venda: {
    pendente: "Pendente",
    confirmada: "Confirmada",
    cancelada: "Cancelada",
    estornada: "Estornada",
  },
  regra: {
    percentage: "Percentual",
    percent: "Percentual",
    fixed: "Valor fixo",
  },
  role: {
    admin: "Administrador",
    admin_secondary: "Administrador Secundário",
    colaborador: "Colaborador",
    vendedor: "Vendedor",
    parceiro: "Parceiro",
    prestador: "Prestador",
    cliente: "Cliente",
    lead: "Lead",
    indicador: "Indicador",
  },
};

export function prettyStatus(domain: Domain, key?: string | null): string {
  if (!key) return "—";
  const d = DICT[domain];
  return d?.[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
