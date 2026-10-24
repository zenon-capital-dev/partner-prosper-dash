import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Share2, Search, FileText, Users, Eye, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProvidersRef } from "@/hooks/useReferenceData";
import { cn } from "@/lib/utils";

export interface ShareableDoc {
  id: string;
  name: string;
  file_path?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  documents: ShareableDoc[];
  title?: string;
}

interface ShareRow {
  id: string;
  document_id: string;
  provider_id: string;
  viewed_at: string | null;
}

/**
 * Compartilha N documentos com N prestadores numa única ação.
 * Cada prestador só enxerga os próprios compartilhamentos (RLS).
 */
export function BulkShareDocumentsDialog({ open, onOpenChange, documents, title }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const docs = useMemo(() => documents.filter((d) => !!d.file_path), [documents]);
  const [docSel, setDocSel] = useState<Set<string>>(new Set());
  const [provSel, setProvSel] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [canDownload, setCanDownload] = useState(true);
  const [expires, setExpires] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: providers = [] } = useProvidersRef(open);
  const docIds = docs.map((d) => d.id);

  const sharesKey = ["document_shares", docIds.join(",")];
  const { data: shares = [] } = useQuery({
    queryKey: sharesKey,
    enabled: open && docIds.length > 0,
    queryFn: async (): Promise<ShareRow[]> => {
      const { data, error } = await (supabase as any)
        .from("document_shares")
        .select("id, document_id, provider_id, viewed_at")
        .in("document_id", docIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredProviders = (providers as any[]).filter((p) => {
    const s = search.trim().toLowerCase();
    return !s || [p.name, p.company_name, p.specialty].some((v: string | null) => v?.toLowerCase().includes(s));
  });

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setter(next);
  };

  const providerName = (id: string) => {
    const p = (providers as any[]).find((x) => x.id === id);
    return p?.name ?? p?.company_name ?? "Prestador";
  };
  const docName = (id: string) => docs.find((d) => d.id === id)?.name ?? "Documento";

  async function share() {
    if (docSel.size === 0 || provSel.size === 0) {
      toast.error("Selecione ao menos 1 documento e 1 prestador");
      return;
    }
    setSaving(true);
    const rows = [...docSel].flatMap((document_id) =>
      [...provSel].map((provider_id) => ({
        document_id,
        provider_id,
        shared_by: user?.id ?? null,
        can_download: canDownload,
        message: message.trim() || null,
        expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
      })),
    );
    const { error } = await (supabase as any)
      .from("document_shares")
      .upsert(rows, { onConflict: "document_id,provider_id", ignoreDuplicates: true });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${docSel.size} documento(s) compartilhado(s) com ${provSel.size} prestador(es)`);
    setDocSel(new Set()); setProvSel(new Set()); setMessage("");
    qc.invalidateQueries({ queryKey: sharesKey });
  }

  async function revoke(id: string) {
    const { error } = await (supabase as any).from("document_shares").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Acesso removido");
    qc.invalidateQueries({ queryKey: sharesKey });
  }

  const allDocs = docSel.size === docs.length && docs.length > 0;
  const allProv = filteredProviders.length > 0 && filteredProviders.every((p) => provSel.has(p.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="size-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center"><Share2 className="size-4" /></span>
            {title ?? "Compartilhar documentos com prestadores"}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-xs">
            <ShieldCheck className="size-3.5 text-emerald-600" />
            Envie vários documentos para vários prestadores de uma vez. Cada um vê só o que recebeu.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-slate-200 overflow-hidden">
            <header className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"><FileText className="size-3.5" /> Documentos ({docSel.size}/{docs.length})</span>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDocSel(allDocs ? new Set() : new Set(docIds))}>
                {allDocs ? "Limpar" : "Selecionar todos"}
              </Button>
            </header>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {docs.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500">Nenhum arquivo enviado nesta pasta.</p>
              ) : docs.map((d) => {
                const count = shares.filter((s) => s.document_id === d.id).length;
                return (
                  <label key={d.id} className={cn("flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50", docSel.has(d.id) && "bg-indigo-50/60")}>
                    <Checkbox checked={docSel.has(d.id)} onCheckedChange={() => toggle(docSel, d.id, setDocSel)} />
                    <span className="flex-1 min-w-0 text-sm truncate">{d.name}</span>
                    {count > 0 && <Badge variant="outline" className="text-[10px]">{count} prest.</Badge>}
                  </label>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 overflow-hidden">
            <header className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"><Users className="size-3.5" /> Prestadores ({provSel.size})</span>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
                const next = new Set(provSel);
                filteredProviders.forEach((p) => (allProv ? next.delete(p.id) : next.add(p.id)));
                setProvSel(next);
              }}>
                {allProv ? "Limpar" : "Selecionar todos"}
              </Button>
            </header>
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input className="h-8 pl-8 text-sm" placeholder="Nome, empresa ou especialidade" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
              {filteredProviders.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500">Nenhum prestador encontrado.</p>
              ) : filteredProviders.map((p: any) => (
                <label key={p.id} className={cn("flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50", provSel.has(p.id) && "bg-indigo-50/60")}>
                  <Checkbox checked={provSel.has(p.id)} onCheckedChange={() => toggle(provSel, p.id, setProvSel)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.name}</div>
                    <div className="text-xs text-slate-500 truncate">{[p.company_name, p.specialty].filter(Boolean).join(" · ")}</div>
                  </div>
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_200px]">
          <div className="space-y-1.5">
            <Label className="text-xs">Mensagem (opcional)</Label>
            <Textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ex.: documentos para análise de crédito" maxLength={1000} />
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Acesso até (opcional)</Label>
              <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={canDownload} onCheckedChange={(c) => setCanDownload(!!c)} /> Permitir baixar
            </label>
          </div>
        </div>

        {shares.length > 0 && (
          <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Já compartilhado ({shares.length})</p>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {shares.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-sm bg-white rounded-md border border-slate-100 px-2 py-1.5">
                  <span className="flex-1 truncate"><b className="font-medium">{providerName(s.provider_id)}</b> <span className="text-slate-500">· {docName(s.document_id)}</span></span>
                  {s.viewed_at ? <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]" variant="outline"><Eye className="size-3 mr-1" />Visualizou</Badge> : <Badge variant="outline" className="text-[10px]">Enviado</Badge>}
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => revoke(s.id)} aria-label="Remover acesso">
                    <Trash2 className="size-3.5 text-rose-600" />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={share} disabled={saving || docSel.size === 0 || provSel.size === 0}>
            {saving ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Share2 className="size-4 mr-1.5" />}
            Compartilhar {docSel.size > 0 && provSel.size > 0 ? `(${docSel.size * provSel.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
