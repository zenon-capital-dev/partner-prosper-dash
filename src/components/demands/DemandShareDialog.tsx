import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Share2, Trash2, Eye, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProvidersRef } from "@/hooks/useReferenceData";


interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientProductId: string;
}

export function DemandShareDialog({ open, onOpenChange, clientProductId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [canDownload, setCanDownload] = useState(true);

  const { data: providers = [] } = useProvidersRef(open);


  const { data: shares = [] } = useQuery({
    queryKey: ["demand_shares", clientProductId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("demand_shares")
        .select("id, provider_id, status, can_download, viewed_at, created_at, service_providers(name, company_name)")
        .eq("client_product_id", clientProductId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const filtered = providers.filter((p: any) => {
    const s = search.toLowerCase();
    return !s || p.name?.toLowerCase().includes(s) || p.company_name?.toLowerCase().includes(s) || p.specialty?.toLowerCase().includes(s);
  });
  const sharedIds = new Set(shares.map((s: any) => s.provider_id));

  async function share() {
    const list = Array.from(selected).filter((id) => !sharedIds.has(id));
    if (list.length === 0) { toast.error("Selecione ao menos um prestador novo"); return; }
    const rows = list.map((provider_id) => ({
      client_product_id: clientProductId,
      provider_id,
      invited_by: user?.id ?? null,
      can_download: canDownload,
      message: message || null,
    }));
    const { error } = await (supabase as any).from("demand_shares").insert(rows);
    if (error) { toast.error(error.message); return; }
    toast.success(`${list.length} prestador(es) convidado(s)`);
    setSelected(new Set()); setMessage("");
    qc.invalidateQueries({ queryKey: ["demand_shares", clientProductId] });
  }

  async function revoke(id: string) {
    const { error } = await (supabase as any).from("demand_shares").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Compartilhamento removido");
    qc.invalidateQueries({ queryKey: ["demand_shares", clientProductId] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Share2 className="size-5" />Compartilhar demanda com prestadores</DialogTitle>
          <DialogDescription className="flex items-start gap-2 pt-1 text-xs text-amber-700">
            <ShieldAlert className="size-3.5 shrink-0 mt-0.5" />
            Cada prestador convidado verá os documentos e dados desta demanda, <b>sem saber quem mais foi convidado</b>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {shares.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">Já compartilhado ({shares.length})</div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {shares.map((s: any) => (
                  <div key={s.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{s.service_providers?.name ?? s.service_providers?.company_name ?? s.provider_id}</span>
                    <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                    {s.viewed_at && <Eye className="size-3 text-emerald-600" />}
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => revoke(s.id)}>
                      <Trash2 className="size-3.5 text-rose-600" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Selecionar prestadores</Label>
            <Input placeholder="Buscar por nome, empresa ou especialidade…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">Nenhum prestador.</div>
              ) : filtered.map((p: any) => {
                const already = sharedIds.has(p.id);
                const checked = selected.has(p.id);
                return (
                  <label key={p.id} className={`flex items-center gap-3 p-2.5 cursor-pointer ${already ? "opacity-50" : "hover:bg-slate-50"}`}>
                    <Checkbox checked={checked} disabled={already} onCheckedChange={(c) => {
                      setSelected((prev) => { const next = new Set(prev); c ? next.add(p.id) : next.delete(p.id); return next; });
                    }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{p.name}</div>
                      <div className="text-xs text-slate-500 truncate">{p.company_name ?? ""} {p.specialty ? `· ${p.specialty}` : ""}</div>
                    </div>
                    {already && <Badge variant="outline" className="text-[10px]">já compartilhado</Badge>}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Mensagem opcional</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Ex: cliente busca crédito para capital de giro…" />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={canDownload} onCheckedChange={(c) => setCanDownload(!!c)} />
            Permitir download dos documentos
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={share} disabled={selected.size === 0}>Compartilhar com {selected.size}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
