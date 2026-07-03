/**
 * Hooks compartilhados para tabelas de referência (clients, partners, products, etc.)
 *
 * Por que existe: antes cada página/diálogo declarava seu próprio `useQuery` com um
 * `queryKey` único (ex: "clients-min", "clients-select", "clients-filter-sales"...).
 * Resultado: a mesma tabela `clients` era buscada 6+ vezes em paralelo, sem
 * compartilhar cache. Estes hooks centralizam tudo em chaves estáveis tipo
 * `["ref:clients"]`, permitindo que o React Query reutilize o cache entre páginas.
 *
 * Cada hook retorna o SUPERSET dos campos usados pelos consumidores antigos.
 * Filtros tipo `active=true` agora ficam client-side via useMemo no caller.
 *
 * staleTime de 5 min evita refetch ao trocar de página; gcTime de 30 min mantém
 * o cache vivo entre navegações longas. Mutations explicitamente invalidam
 * `["ref:<tabela>"]` quando precisarem.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const REF_OPTS = { staleTime: 5 * 60_000, gcTime: 30 * 60_000 } as const;

export function useClientsRef(enabled = true) {
  return useQuery({
    queryKey: ["ref:clients"],
    enabled,
    ...REF_OPTS,
    queryFn: async () =>
      (
        await supabase
          .from("clients")
          .select(
            "id, full_name, email, company, document, status, partner_id, referrer_id, collaborator_id, journey_stage_id"
          )
          .order("full_name")
          .limit(500)
      ).data ?? [],

  });
}

export function usePartnersRef(enabled = true) {
  return useQuery({
    queryKey: ["ref:partners"],
    enabled,
    ...REF_OPTS,
    queryFn: async () =>
      (
        await supabase
          .from("partners")
          .select("id, full_name, email, commission_percent, active")
          .order("full_name")
          .limit(500)
      ).data ?? [],
  });
}

export function useProductsRef(enabled = true) {
  return useQuery({
    queryKey: ["ref:products"],
    enabled,
    ...REF_OPTS,
    queryFn: async () =>
      (
        await supabase
          .from("products")
          .select("id, name, base_price, default_commission_percent, active")
          .order("name")
          .limit(500)
      ).data ?? [],
  });
}

export function useProvidersRef(enabled = true) {
  return useQuery({
    queryKey: ["ref:providers"],
    enabled,
    ...REF_OPTS,
    queryFn: async () =>
      (
        await supabase
          .from("service_providers")
          .select("id, name, specialty, active")
          .order("name")
          .limit(500)
      ).data ?? [],


  });
}

export function useReferrersRef(enabled = true) {
  return useQuery({
    queryKey: ["ref:referrers"],
    enabled,
    ...REF_OPTS,
    queryFn: async () =>
      (
        await supabase
          .from("referrers")
          .select("id, full_name, commission_percent, active")
          .order("full_name")
          .limit(500)
      ).data ?? [],
  });
}

export function useCollaboratorsRef(enabled = true) {
  return useQuery({
    queryKey: ["ref:collaborators"],
    enabled,
    ...REF_OPTS,
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "colaborador");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids)
        .order("full_name");
      return data ?? [];
    },
  });
}

/**
 * Internal team: admin + admin_secondary + colaborador. Use for pickers like
 * "assignee", "responsável", "colaborador" that must not list clients/parceiros/prestadores.
 */
export function useInternalTeamRef(enabled = true) {
  return useQuery({
    queryKey: ["ref:internal-team"],
    enabled,
    ...REF_OPTS,
    queryFn: async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "admin_secondary", "colaborador", "super_admin"] as any);
      const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id).filter(Boolean)));
      if (!ids.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, active")
        .in("id", ids)
        .eq("active", true)
        .order("full_name");
      return data ?? [];
    },
  });
}


