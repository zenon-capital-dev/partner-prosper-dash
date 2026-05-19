import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Briefcase, FileText, FileSignature, Banknote, Truck,
  ClipboardList, Building2, ArrowUpRight, Search, Command,
} from "lucide-react";

interface NavItem { title: string; url: string; icon: any; group?: string }

interface Props {
  /** Optional controlled open/onOpenChange. If omitted, the component manages itself
   *  and renders its own trigger button. */
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  navItems?: NavItem[];
  /** When true and uncontrolled, render a trigger button. Default true. */
  showTrigger?: boolean;
}

interface Hit {
  id: string;
  label: string;
  sub?: string;
  url: string;
  icon: any;
  group: string;
}

export function GlobalSearch({ open, onOpenChange, navItems = [], showTrigger = true }: Props) {
  const navigate = useNavigate();
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = isControlled ? open! : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) onOpenChange?.(v);
    else setInternalOpen(v);
  };

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  // Cmd+K shortcut (only when uncontrolled, otherwise the parent owns it)
  useEffect(() => {
    if (isControlled) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setInternalOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isControlled]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setHits([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const term = query.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const like = `%${term}%`;
      const results: Hit[] = [];

      const [
        clients, partners, providers, demands, documents, contracts, payments,
      ] = await Promise.all([
        supabase.from("clients")
          .select("id, full_name, company, email")
          .or(`full_name.ilike.${like},company.ilike.${like},email.ilike.${like},document.ilike.${like}`)
          .limit(6),
        supabase.from("partners")
          .select("id, full_name, email")
          .or(`full_name.ilike.${like},email.ilike.${like}`)
          .limit(5),
        supabase.from("service_providers")
          .select("id, name, specialty, email")
          .or(`name.ilike.${like},email.ilike.${like},specialty.ilike.${like}`)
          .limit(5),
        supabase.from("client_products")
          .select("id, status, custom_product_name, clients(full_name), products(name)")
          .or(`custom_product_name.ilike.${like},status.ilike.${like}`)
          .limit(5),
        supabase.from("documents")
          .select("id, name, status, client_id")
          .ilike("name", like)
          .limit(5),
        supabase.from("contracts")
          .select("id, name, status, client_id")
          .ilike("name", like)
          .limit(5),
        supabase.from("payments" as any)
          .select("id, description, amount, client_id, status")
          .ilike("description", like)
          .limit(5),
      ]);

      if (cancelled) return;

      (clients.data || []).forEach((c: any) => {
        const isCompany = c.company && c.company.toLowerCase().includes(term.toLowerCase());
        results.push({
          id: c.id, label: c.full_name, sub: c.company || c.email,
          url: `/clientes/${c.id}`, icon: isCompany ? Building2 : Users,
          group: isCompany ? "Empresas" : "Clientes",
        });
      });
      (partners.data || []).forEach((p: any) => {
        results.push({ id: p.id, label: p.full_name, sub: p.email, url: `/parceiros/${p.id}`, icon: Briefcase, group: "Parceiros" });
      });
      (providers.data || []).forEach((p: any) => {
        results.push({ id: p.id, label: p.name, sub: p.specialty || p.email, url: `/prestadores/${p.id}`, icon: Truck, group: "Prestadores" });
      });
      (demands.data || []).forEach((d: any) => {
        const name = d.products?.name || d.custom_product_name || "Demanda";
        results.push({ id: d.id, label: name, sub: `${d.clients?.full_name || ""} · ${d.status}`, url: `/demandas/${d.id}`, icon: ClipboardList, group: "Demandas" });
      });
      (documents.data || []).forEach((d: any) => {
        results.push({ id: d.id, label: d.name, sub: d.status, url: `/documentos`, icon: FileText, group: "Documentos" });
      });
      (contracts.data || []).forEach((c: any) => {
        results.push({ id: c.id, label: c.name, sub: c.status, url: `/contratos`, icon: FileSignature, group: "Contratos" });
      });
      ((payments.data as any[]) || []).forEach((p: any) => {
        results.push({ id: p.id, label: p.description || `Pagamento`, sub: `R$ ${Number(p.amount || 0).toFixed(2)} · ${p.status || ""}`, url: `/financeiro`, icon: Banknote, group: "Pagamentos" });
      });

      setHits(results);
      setLoading(false);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, isOpen]);

  const filteredNav = navItems.filter((n) =>
    !query || n.title.toLowerCase().includes(query.toLowerCase())
  );

  const grouped: Record<string, Hit[]> = {};
  hits.forEach((h) => {
    grouped[h.group] = grouped[h.group] || [];
    grouped[h.group].push(h);
  });

  return (
    <>
      {!isControlled && showTrigger && (
        <button
          onClick={() => setOpen(true)}
          className="w-full h-9 pl-9 pr-2 bg-muted/50 hover:bg-muted/80 border border-border hover:border-foreground/20 rounded-md text-[13px] text-muted-foreground flex items-center justify-between transition-colors relative group overflow-hidden"
        >
          <Search className="absolute left-3 size-3.5 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
          <span className="font-medium truncate text-muted-foreground/80 pr-2">
            <span className="sm:hidden">Buscar...</span>
            <span className="hidden sm:inline">Buscar clientes, demandas, documentos...</span>
          </span>
          <kbd className="hidden md:flex text-[10px] font-mono font-semibold bg-background border border-border rounded px-1.5 py-0.5 items-center gap-1 text-muted-foreground/70 shrink-0">
            <Command className="size-2.5" /> K
          </kbd>
        </button>
      )}

      <CommandDialog open={isOpen} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar clientes, demandas, documentos, parceiros..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {loading ? "Buscando..." : query.length < 2 ? "Digite ao menos 2 caracteres" : "Nenhum resultado."}
          </CommandEmpty>

          {Object.entries(grouped).map(([group, items]) => (
            <CommandGroup key={group} heading={group}>
              {items.map((it) => (
                <CommandItem
                  key={`${group}-${it.id}`}
                  value={`${group}-${it.id}-${it.label}`}
                  onSelect={() => {
                    navigate(it.url);
                    setOpen(false);
                  }}
                  className="gap-3"
                >
                  <it.icon className="size-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{it.label}</p>
                    {it.sub && (
                      <p className="text-xs text-muted-foreground truncate">{it.sub}</p>
                    )}
                  </div>
                  <ArrowUpRight className="size-3 text-muted-foreground" />
                </CommandItem>
              ))}
            </CommandGroup>
          ))}

          {filteredNav.length > 0 && (
            <CommandGroup heading="Navegação">
              {filteredNav.map((item) => (
                <CommandItem
                  key={item.url}
                  onSelect={() => {
                    navigate(item.url);
                    setOpen(false);
                  }}
                  className="gap-3"
                >
                  <item.icon className="size-4 text-muted-foreground" />
                  <span className="flex-1">{item.title}</span>
                  {item.group && (
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
                      {item.group}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
