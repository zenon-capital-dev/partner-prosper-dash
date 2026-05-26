export const formatBRL = (value: number | null | undefined) => {
  const v = Number(value ?? 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export const formatNumber = (value: number | null | undefined) => {
  return Number(value ?? 0).toLocaleString("pt-BR");
};

export const formatPercent = (value: number | null | undefined, decimals = 1) => {
  return `${Number(value ?? 0).toFixed(decimals)}%`;
};

export const formatDate = (date: string | Date | null | undefined) => {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
};

export const formatDateTime = (date: string | Date | null | undefined) => {
  if (!date) return "—";
  return new Date(date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
};

export const formatTime = (date: string | Date | null | undefined) => {
  if (!date) return "—";
  return new Date(date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
};

export const initials = (name?: string | null) => {
  if (!name) return "??";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
};

export const timeAgo = (date: string | Date) => {
  const d = new Date(date).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d atrás`;
  return new Date(date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
};

export const formatDoc = (doc?: string | null) => {
  if (!doc) return "—";
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
};

export const formatPhone = (phone?: string | null) => {
  if (!phone) return "—";
  const p = phone.replace(/\D/g, "");
  if (p.length === 11) return p.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (p.length === 10) return p.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return phone;
};
