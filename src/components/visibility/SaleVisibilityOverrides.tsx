import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BENEFICIARY_LABEL, VISIBILITY_ITEMS, INHERIT_ALL, type BeneficiaryType, type Visibility, type VisibilityKey, type VisibilityOverride } from "@/lib/visibility";

export interface SaleParticipant {
  type: BeneficiaryType;
  id: string;
  name: string;
}

export const participantKey = (p: { type: BeneficiaryType; id: string }) => `${p.type}:${p.id}`;

interface Props {
  participants: SaleParticipant[];
  defaults: Record<string, Visibility | undefined>;
  value: Record<string, VisibilityOverride | undefined>;
  onChange: (next: Record<string, VisibilityOverride>) => void;
}

const SHORT: Record<VisibilityKey, string> = { see_gross: "Valor bruto", see_payments: "Pagamentos", see_deductions: "Deduções" };

/**
 * Ajuste de visibilidade só desta venda. "Padrão" segue o cadastro da pessoa.
 */
export function SaleVisibilityOverrides({ participants, defaults, value, onChange }: Props) {
  if (participants.length === 0) {
    return <p className="text-[11.5px] text-slate-500">Escolha parceiro, indicador ou prestador para ajustar o que cada um vê.</p>;
  }

  const set = (k: string, key: VisibilityKey, v: string) => {
    const cur = { ...INHERIT_ALL, ...(value[k] ?? {}) };
    cur[key] = v === "inherit" ? null : v === "yes";
    const next: Record<string, VisibilityOverride> = {};
    for (const [kk, vv] of Object.entries(value)) if (vv) next[kk] = vv;
    next[k] = cur;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {participants.map((p) => {
        const k = participantKey(p);
        const d = defaults[k];
        const o = value[k] ?? INHERIT_ALL;
        return (
          <div key={k} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
            <p className="text-[12.5px] font-semibold text-slate-900">
              {p.name} <span className="font-normal text-slate-500">· {BENEFICIARY_LABEL[p.type]}</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {VISIBILITY_ITEMS.map(({ key }) => {
                const cur = o[key];
                const sel = cur === true ? "yes" : cur === false ? "no" : "inherit";
                return (
                  <label key={key} className="space-y-1">
                    <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">{SHORT[key]}</span>
                    <Select value={sel} onValueChange={(v) => set(k, key, v)}>
                      <SelectTrigger className="h-9 text-[12px] bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inherit">Padrão ({d?.[key] ? "vê" : "não vê"})</SelectItem>
                        <SelectItem value="yes">Libera nesta venda</SelectItem>
                        <SelectItem value="no">Bloqueia nesta venda</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
