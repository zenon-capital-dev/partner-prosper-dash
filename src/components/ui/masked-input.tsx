import * as React from "react";
import { Input } from "@/components/ui/input";
import { applyMask, onlyDigits, type MaskKind } from "@/lib/masks";

export interface MaskedInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  mask: MaskKind;
  value?: string | null;
  /** Recebe o valor formatado (com máscara) */
  onChange?: (formatted: string) => void;
  /** Recebe apenas os dígitos (sem máscara) — útil para salvar no banco */
  onValueChange?: (rawDigits: string) => void;
}

/**
 * Input controlado com máscara progressiva BR (CPF, CNPJ, CEP, telefone, moeda).
 * Mantém compatibilidade com Input do shadcn.
 */
export const MaskedInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ mask, value, onChange, onValueChange, inputMode, ...rest }, ref) => {
    const formatted = applyMask(mask, String(value ?? ""));
    const defaultInputMode: React.HTMLAttributes<HTMLInputElement>["inputMode"] =
      mask === "currency" || mask === "cep" || mask === "phone" || mask === "cpf" || mask === "cnpj" || mask === "cpfcnpj"
        ? "numeric"
        : "text";

    return (
      <Input
        ref={ref}
        {...rest}
        inputMode={inputMode ?? defaultInputMode}
        value={formatted}
        onChange={(e) => {
          const next = applyMask(mask, e.target.value);
          onChange?.(next);
          onValueChange?.(onlyDigits(next));
        }}
      />
    );
  }
);
MaskedInput.displayName = "MaskedInput";
