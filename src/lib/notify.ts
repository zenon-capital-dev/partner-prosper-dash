// Wrapper sobre sonner com dedupe por id (evita toast duplicado em mutations rápidas).
import { toast as sonner } from "sonner";

const recent = new Map<string, number>();
const TTL = 1500;

function shouldEmit(key: string) {
  const now = Date.now();
  // Limpeza preguiçosa
  if (recent.size > 50) {
    for (const [k, t] of recent) if (now - t > TTL) recent.delete(k);
  }
  const last = recent.get(key) ?? 0;
  if (now - last < TTL) return false;
  recent.set(key, now);
  return true;
}

type NotifyOpts = { description?: string; id?: string };

export const notify = {
  success(message: string, opts: NotifyOpts = {}) {
    const key = opts.id ?? `success:${message}`;
    if (!shouldEmit(key)) return;
    sonner.success(message, { description: opts.description, id: opts.id });
  },
  error(message: string, opts: NotifyOpts = {}) {
    const key = opts.id ?? `error:${message}`;
    if (!shouldEmit(key)) return;
    sonner.error(message, { description: opts.description, id: opts.id });
  },
  info(message: string, opts: NotifyOpts = {}) {
    const key = opts.id ?? `info:${message}`;
    if (!shouldEmit(key)) return;
    sonner(message, { description: opts.description, id: opts.id });
  },
  warning(message: string, opts: NotifyOpts = {}) {
    const key = opts.id ?? `warn:${message}`;
    if (!shouldEmit(key)) return;
    sonner.warning(message, { description: opts.description, id: opts.id });
  },
};
