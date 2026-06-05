import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Star, Trash2, Handshake, UserPlus, Users, Wrench, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type LinkKind = "partner" | "referrer" | "collaborator" | "provider";

interface Cfg {
  table: string;
  fkField: string;            // FK column inside junction table (partner_id, referrer_id, ...)
  sourceTable: string;        // table to list options from
  sourceFields: string;       // select for option list
  joinSelect: string;         // join in main select query
  labelKey: (row: any) => string;
  subKey?: (row: any) => string | undefined;
  title: string;
  icon: React.ReactNode;
  color: string;              // tailwind color class for the accent
  emptyText: string;
  addLabel: string;
}

const CONFIG: Record<LinkKind, Cfg> = {
  partner: {
    table: "client_partners",
    fkField: "partner_id",
    sourceTable: "partners",
    sourceFields: "id, full_name, company, email, active",
    joinSelect: "partners(id, full_name, company, email)",
    labelKey: (r) => r.partners?.full_name ?? "Parceiro",
    subKey: (r) => r.partners?.company || r.partners?.email,
    title: "Parceiros",
    icon: <Handshake className="size-4" />,
    color: "indigo",
    emptyText: "Nenhum parceiro vinculado",
    addLabel: "parceiro",
  },
  referrer: {
    table: "client_referrers",
    fkField: "referrer_id",
    sourceTable: "referrers",
    sourceFields: "id, full_name, email, active",
    joinSelect: "referrers(id, full_name, email)",
    labelKey: (r) => r.referrers?.full_name ?? "Indicador",
    subKey: (r) => r.referrers?.email,
    title: "Indicadores",
    icon: <UserPlus className="size-4" />,
    color: "emerald",
    emptyText: "Nenhum indicador vinculado",
    addLabel: "indicador",
  },
  collaborator: {
    table: "client_collaborators",
    fkField: "collaborator_id",
    sourceTable: "profiles",
    sourceFields: "id, full_name, email, active",
    joinSelect: "",
    labelKey: (r) => r._profile?.full_name ?? "Colaborador",
    subKey: (r) => r._profile?.email,
    title: "Colaboradores",
    icon: <Users className="size-4" />,
    color: "violet",
    emptyText: "Nenhum colaborador vinculado",
    addLabel: "colaborador",
  },
  provider: {
    table: "client_providers",
    fkField: "service_provider_id",
    sourceTable: "service_providers",
    sourceFields: "id, name, specialty, email, active",
    joinSelect: "service_providers(id, name, specialty, email)",
    labelKey: (r) => r.service_providers?.name ?? "Prestador",
    subKey: (r) => r.service_providers?.specialty,
    title: "Prestadores",
    icon: <Wrench className="size-4" />,
    color: "amber",
    emptyText: "Nenhum prestador vinculado",
    addLabel: "prestador",
  },
};

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; ring: string }> = {
  indigo: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", ring: "ring-indigo-200" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", ring: "ring-emerald-200" },
  violet: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", ring: "ring-violet-200" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", ring: "ring-amber-200" },
};

interface Props {
  clientId: string;
  kind: LinkKind;
}

export function ClientLinksManager({ clientId, kind }: Props) {
  const cfg = CONFIG[kind];
  const color = COLOR_MAP[cfg.color];
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState("");
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);

  const queryKey = ["client-links", kind, clientId];

  const { data: links = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(cfg.table as any)
        .select(`id, ${cfg.fkField}, is_primary, role, created_at, ${cfg.joinSelect}`)
        .eq("client_id", clientId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: options = [] } = useQuery({
    queryKey: [`opts-${kind}`],
    enabled: adding,
    queryFn: async () => {
      let q = supabase.from(cfg.sourceTable as any).select(cfg.sourceFields);
      if (cfg.sourceTable !== "profiles") q = q.eq("active", true);
      const { data } = await q.order(kind === "provider" ? "name" : "full_name");
      return data ?? [];
    },
  });

  const linkedIds = new Set(links.map((l: any) => l[cfg.fkField]));
  const available = options.filter((o: any) => !linkedIds.has(o.id));

  async function handleAdd() {
    if (!selected) { toast.error(`Selecione um ${cfg.addLabel}`); return; }
    setSaving(true);
    const isFirst = links.length === 0;
    const payload: any = {
      client_id: clientId,
      [cfg.fkField]: selected,
      is_primary: isFirst,
      role: role || null,
    };
    const { error } = await supabase.from(cfg.table as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(`Erro ao vincular ${cfg.addLabel}`, { description: error.message }); return; }
    toast.success(`${cfg.addLabel.charAt(0).toUpperCase() + cfg.addLabel.slice(1)} vinculado`);
    setSelected(""); setRole(""); setAdding(false);
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: ["client", clientId] });
  }

  async function handleRemove(id: string) {
    const { error } = await supabase.from(cfg.table as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${cfg.addLabel.charAt(0).toUpperCase() + cfg.addLabel.slice(1)} removido`);
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: ["client", clientId] });
  }

  async function handleSetPrimary(id: string) {
    const { error } = await supabase.from(cfg.table as any).update({ is_primary: true }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Principal atualizado");
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: ["client", clientId] });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className={cn("flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200", color.bg)}>
        <div className={cn("flex items-center gap-2 font-semibold text-sm", color.text)}>
          {cfg.icon}
          <span>{cfg.title}</span>
          <Badge variant="outline" className={cn("ml-1 text-[10px] font-mono", color.border, color.text, "bg-white/70")}>
            {links.length}
          </Badge>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 bg-white"
          onClick={() => setAdding((v) => !v)}
        >
          <Plus className="size-4" />
          {adding ? "Cancelar" : "Adicionar"}
        </Button>
      </div>

      <div className="p-3 space-y-2">
        {adding && (
          <div className={cn("rounded-lg border-2 border-dashed p-3 space-y-2", color.border, color.bg, "bg-opacity-30")}>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2">
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger className="bg-white"><SelectValue placeholder={`Selecionar ${cfg.addLabel}...`} /></SelectTrigger>
                <SelectContent>
                  {available.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground">
                      Todos já estão vinculados ou nenhum {cfg.addLabel} ativo cadastrado.
                    </div>
                  ) : available.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>
                      {kind === "provider" ? o.name : o.full_name}
                      {o.specialty ? ` · ${o.specialty}` : ""}
                      {o.company ? ` · ${o.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Função (opcional)"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="bg-white"
              />
              <Button onClick={handleAdd} disabled={saving || !selected} size="sm" className="gap-1.5">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Vincular
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin inline mr-1" /> Carregando...
          </div>
        ) : links.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
            {cfg.emptyText}
          </div>
        ) : (
          links.map((l: any) => {
            const sub = cfg.subKey?.(l);
            return (
              <div
                key={l.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border bg-white px-3 py-2.5 transition-all",
                  l.is_primary ? cn(color.border, "ring-1", color.ring) : "border-slate-200 hover:border-slate-300"
                )}
              >
                <div className={cn("size-9 rounded-lg flex items-center justify-center shrink-0", color.bg, color.text)}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-slate-900 truncate">{cfg.labelKey(l)}</span>
                    {l.is_primary && (
                      <Badge className={cn("text-[10px] gap-1 px-1.5", color.bg, color.text, color.border, "border")}>
                        <Star className="size-2.5 fill-current" /> Principal
                      </Badge>
                    )}
                    {l.role && <Badge variant="outline" className="text-[10px]">{l.role}</Badge>}
                  </div>
                  {sub && <p className="text-[11px] text-slate-500 truncate">{sub}</p>}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {!l.is_primary && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => handleSetPrimary(l.id)}
                      title="Definir como principal"
                    >
                      <Star className="size-3.5" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-rose-600 hover:bg-rose-50"
                    onClick={() => handleRemove(l.id)}
                    title="Remover"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function ClientLinksPanel({ clientId }: { clientId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Vínculos do cliente</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Adicione quantos parceiros, indicadores, colaboradores e prestadores precisar. O marcado como
            <Star className="inline size-3 mx-1 -translate-y-0.5 fill-current text-amber-500" />
            <strong>principal</strong> aparece como padrão em telas e relatórios.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ClientLinksManager clientId={clientId} kind="partner" />
        <ClientLinksManager clientId={clientId} kind="referrer" />
        <ClientLinksManager clientId={clientId} kind="collaborator" />
        <ClientLinksManager clientId={clientId} kind="provider" />
      </div>
    </div>
  );
}
