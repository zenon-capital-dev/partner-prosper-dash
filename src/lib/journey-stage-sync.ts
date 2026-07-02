import type { QueryClient } from "@tanstack/react-query";

export function normalizeJourneyStageName(name?: string | null) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function deriveClientStatusFromStageName(name?: string | null) {
  const stage = normalizeJourneyStageName(name);

  if (/(finaliz|conclu|pos-venda|pos venda|entrega)/.test(stage)) return "finalizado";
  if (/(pagamento pendente|pendente.*pagamento|cobranca)/.test(stage)) return "pagamento_pendente";
  if (/(pagamento confirm|quitad|pago)/.test(stage)) return "pagamento_confirmado";
  if (/(venda realizada|venda fechada|fechad|contrato assinado)/.test(stage)) return "ativo";
  if (/(em atendimento|andamento|execu|operac)/.test(stage)) return "em_andamento";
  if (/(prospecc|prospec|captac|capta|lead|proposta|diagnostico|agenda)/.test(stage)) return "prospecto";
  if (/(inativ|sem resposta|recusad|perdid)/.test(stage)) return "inativo";
  if (/(cancel)/.test(stage)) return "cancelado";

  return null;
}

export function invalidateJourneyStageCaches(queryClient: QueryClient, clientId?: string | null) {
  const keys = [
    ["journey-clients"],
    ["client-stage-map"],
    ["clients-admin-list"],
    ["clients-admin-products-summary"],
    ["clients-admin-payments-summary"],
    ["clients"],
    ["journey-mini-stages"],
    ["journey-stages-mini"],
    ["journey-stages"],
    ["journey-stages-shared"],
    ["partner-panel"],
    ["referrer-panel"],
    ["dashboard"],
    ["dashboard-admin"],
    ["finance"],
    ["finance-center"],
    ["sales"],
    ["sales-goals"],
  ];

  keys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  if (clientId) queryClient.invalidateQueries({ queryKey: ["client", clientId] });
}