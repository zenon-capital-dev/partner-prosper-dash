/**
 * WhatsApp helpers — abre wa.me com texto pré-preenchido.
 * Sanitiza telefone e aplica template com variáveis simples {{nome}}.
 */

export function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  // Adiciona DDI 55 se não tiver
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function applyTemplate(body: string, vars: Record<string, string | null | undefined>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

export interface OpenWhatsAppOptions {
  phone: string | null | undefined;
  message?: string;
}

export function buildWhatsAppUrl({ phone, message }: OpenWhatsAppOptions): string | null {
  const p = normalizePhone(phone);
  if (!p) return null;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${p}${text}`;
}

export function openWhatsApp(opts: OpenWhatsAppOptions): boolean {
  const url = buildWhatsAppUrl(opts);
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
