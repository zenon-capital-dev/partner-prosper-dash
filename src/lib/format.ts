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
  return new Date(date).toLocaleDateString("pt-BR");
};

export const formatDateTime = (date: string | Date | null | undefined) => {
  if (!date) return "—";
  return new Date(date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
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
  return new Date(date).toLocaleDateString("pt-BR");
};
