import { useState, useEffect, useRef } from "react";
import { Search, X, Users, Handshake, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Result {
  type: "client" | "partner" | "product";
  id: string;
  label: string;
  sub?: string;
}

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const term = `%${q}%`;
      const [c, p, pr] = await Promise.all([
        supabase.from("clients").select("id, full_name, company, email").or(`full_name.ilike.${term},company.ilike.${term},email.ilike.${term}`).limit(5),
        supabase.from("partners").select("id, full_name, email").or(`full_name.ilike.${term},email.ilike.${term}`).limit(5),
        supabase.from("products").select("id, name, description").or(`name.ilike.${term},description.ilike.${term}`).limit(5),
      ]);
      const out: Result[] = [
        ...(c.data ?? []).map((x: any) => ({ type: "client" as const, id: x.id, label: x.full_name, sub: x.company || x.email })),
        ...(p.data ?? []).map((x: any) => ({ type: "partner" as const, id: x.id, label: x.full_name, sub: x.email })),
        ...(pr.data ?? []).map((x: any) => ({ type: "product" as const, id: x.id, label: x.name, sub: x.description })),
      ];
      setResults(out);
      setLoading(false);
      setOpen(true);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const goTo = (r: Result) => {
    setOpen(false);
    setQ("");
    if (r.type === "client") navigate(`/clientes/${r.id}`);
    else if (r.type === "partner") navigate(`/parceiros`);
    else navigate(`/produtos`);
  };

  const iconFor = (t: Result["type"]) =>
    t === "client" ? Users : t === "partner" ? Handshake : Package;

  return (
    <div ref={ref} className="flex-1 max-w-md relative">
      <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => q && setOpen(true)}
        placeholder="Buscar clientes, parceiros, produtos..."
        className="w-full pl-9 pr-9 h-9 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring transition-all"
      />
      {q && (
        <button onClick={() => { setQ(""); setResults([]); }} className="absolute right-2 top-1/2 -translate-y-1/2 size-6 rounded hover:bg-muted flex items-center justify-center">
          <X className="size-3.5 text-muted-foreground" />
        </button>
      )}
      {open && (
        <div className="absolute top-11 left-0 right-0 bg-popover border border-border rounded-lg shadow-vx-lg z-50 overflow-hidden">
          {loading ? (
            <div className="p-4 text-xs text-muted-foreground text-center">Buscando...</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground text-center">Nenhum resultado para "{q}"</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {results.map((r) => {
                const I = iconFor(r.type);
                return (
                  <button
                    key={`${r.type}-${r.id}`}
                    onClick={() => goTo(r)}
                    className="w-full text-left p-3 flex items-center gap-3 hover:bg-muted/40 border-b border-border last:border-0"
                  >
                    <div className="size-8 rounded-md bg-primary-muted text-primary flex items-center justify-center shrink-0">
                      <I className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.label}</p>
                      {r.sub && <p className="text-[11px] text-muted-foreground truncate">{r.sub}</p>}
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {r.type === "client" ? "Cliente" : r.type === "partner" ? "Parceiro" : "Produto"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
