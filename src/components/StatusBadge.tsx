import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

interface Props {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}

/**
 * Premium status badge. Use semantic tone — never hardcoded colors.
 * Auto-mapping helper: statusTone("aprovado") → "success".
 */
export function StatusBadge({ children, tone = "neutral", className }: Props) {
  return (
    <span data-tone={tone} className={cn("status-badge", className)}>
      {children}
    </span>
  );
}

/** Map common backend status strings to a semantic tone. */
export function statusTone(status?: string | null): Tone {
  if (!status) return "neutral";
  const s = status.toLowerCase();
  if (/(conclu[ií]do|aprovado|pago|ativo|sucesso|finalizado|completo|liberado|enviado_aprovado)/.test(s)) return "success";
  if (/(andamento|analise|an[áa]lise|enviado|em_revisao|processando|aguardando)/.test(s)) return "info";
  if (/(pendente|aguardando_inicio|solicitado|rascunho|criado|aguardando_documentos)/.test(s)) return "warning";
  if (/(atrasado|reprovado|rejeitado|cancelado|inadimplente|expirado|vencido|falha|erro|bloqueado|pendente_correcao)/.test(s)) return "danger";
  if (/(prioridade_alta|destaque|premium)/.test(s)) return "primary";
  return "neutral";
}

/** Convenience: render a status string directly with auto tone + label prettifier. */
export function AutoStatusBadge({ status, className }: { status?: string | null; className?: string }) {
  if (!status) return null;
  const tone = statusTone(status);
  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <StatusBadge tone={tone} className={className}>
      {label}
    </StatusBadge>
  );
}
