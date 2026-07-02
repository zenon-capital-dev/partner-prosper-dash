import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Filtro compartilhado de "Estágio da Jornada" — fonte única para
 * Clientes, Esteira, Vendas, Metas, Central Financeira, Dashboard e Painel do Parceiro.
 *
 * Persiste em localStorage sob a chave `shared-stage-filter:v1` e transmite
 * as mudanças entre componentes montados via CustomEvent para sincronização
 * em tempo real.
 */

const STORAGE_KEY = "shared-stage-filter:v1";
const EVENT_NAME = "shared-stage-filter-change";

type State = { stageIds: string[] };

function load(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { stageIds: [] };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.stageIds)) return { stageIds: parsed.stageIds };
    return { stageIds: [] };
  } catch {
    return { stageIds: [] };
  }
}

function save(state: State) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function useSharedStageFilter() {
  const [state, setState] = useState<State>(() => load());

  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<State>).detail;
      if (detail) setState(detail);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setState(load());
    };
    window.addEventListener(EVENT_NAME, onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT_NAME, onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setStageIds = useCallback((ids: string[]) => {
    const next = { stageIds: ids };
    setState(next);
    save(next);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
  }, []);

  const toggle = useCallback((id: string) => {
    setState((prev) => {
      const has = prev.stageIds.includes(id);
      const stageIds = has ? prev.stageIds.filter((x) => x !== id) : [...prev.stageIds, id];
      const next = { stageIds };
      save(next);
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
      return next;
    });
  }, []);

  const clear = useCallback(() => setStageIds([]), [setStageIds]);

  return { stageIds: state.stageIds, setStageIds, toggle, clear, isActive: state.stageIds.length > 0 };
}

export function useJourneyStages() {
  return useQuery({
    queryKey: ["journey-stages-shared"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("client_journey_stages")
        .select("id, name, color, position")
        .eq("active", true)
        .order("position");
      return (data ?? []) as Array<{ id: string; name: string; color: string; position: number }>;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Retorna Map<clientId, stageId> para filtragem cruzada. */
export function useClientStageMap() {
  return useQuery({
    queryKey: ["client-stage-map"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("clients")
        .select("id, journey_stage_id");
      const map = new Map<string, string | null>();
      (data ?? []).forEach((c: any) => map.set(c.id, c.journey_stage_id ?? null));
      return map;
    },
    staleTime: 60 * 1000,
  });
}

/** Helper hook que devolve um filtro pronto: matchesClientId(id) → boolean. */
export function useStageMatcher() {
  const { stageIds, isActive } = useSharedStageFilter();
  const { data: stageMap } = useClientStageMap();
  const matchesClientId = useMemo(() => {
    if (!isActive) return () => true;
    const set = new Set(stageIds);
    return (clientId?: string | null) => {
      if (!clientId) return false;
      const stage = stageMap?.get(clientId) ?? null;
      return stage ? set.has(stage) : false;
    };
  }, [isActive, stageIds, stageMap]);
  return { matchesClientId, isActive, stageIds };
}
