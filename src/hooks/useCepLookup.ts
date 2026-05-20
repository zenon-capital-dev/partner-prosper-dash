import { useCallback, useState } from "react";
import { lookupCEP, type ViaCepResult } from "@/lib/validators";

export interface CepData {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

export function useCepLookup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (cep: string): Promise<CepData | null> => {
    setError(null);
    setLoading(true);
    try {
      const res: ViaCepResult | null = await lookupCEP(cep);
      if (!res) {
        setError("CEP não encontrado");
        return null;
      }
      return {
        cep: res.cep,
        street: res.logradouro ?? "",
        neighborhood: res.bairro ?? "",
        city: res.localidade ?? "",
        state: res.uf ?? "",
      };
    } catch {
      setError("Falha ao buscar CEP");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { lookup, loading, error };
}
