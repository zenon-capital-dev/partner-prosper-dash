import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Eye, FolderOpen, Search, Share2, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

interface SharedDoc {
  id: string;
  can_download: boolean;
  message: string | null;
  expires_at: string | null;
  viewed_at: string | null;
  created_at: string;
  documents: { id: string; name: string; file_path: string | null; client_id: string | null; clients: { name: string | null } | null } | null;
}

/** Documentos que a equipe compartilhou com o prestador logado, agrupados por cliente. */
export function SharedWithMeDocuments() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["shared-with-me"],
    queryFn: async (): Promise<SharedDoc[]> => {
      const { data, error } = await (supabase as any)
        .from("document_shares")
        .select("id, can_download, message, expires_at, viewed_at, created_at, documents(id, name, file_path, client_id, clients(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const groups = useMemo(() => {
    const s = search.trim().toLowerCase();
    const now = Date.now();
    const map = new Map<string, SharedDoc[]>();
    data
      .filter((d) => d.documents && (!d.expires_at || new Date(d.expires_at).getTime() > now))
      .filter((d) => !s || d.documents!.name.toLowerCase().includes(s) || d.documents!.clients?.name?.toLowerCase().includes(s))
      .forEach((d) => {
        const k = d.documents!.clients?.name ?? "Sem cliente";
        map.set(k, [...(map.get(k) ?? []), d]);
      });
    return [...map.entries()];
  }, [data, search]);

  async function open(d: SharedDoc, download: boolean) {
    const path = d.documents?.file_path;
    if (!path) return;
    const { data: signed, error } = await supabase.storage.from("documents")
      .createSignedUrl(path, 300, download ? { download: d.documents!.name } : undefined);
    if (error || !signed) { toast.error("Não foi possível abrir o arquivo"); return; }
    window.open(signed.signedUrl, "_blank", "noopener");
    if (!d.viewed_at) {
      await (supabase as any).from("document_shares").update({ viewed_at: new Date().toISOString() }).eq("id", d.id);
      qc.invalidateQueries({ queryKey: ["shared-with-me"] });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2"><Share2 className="size-4 text-teal-600" /> Compartilhados comigo</h2>
          <p className="text-sm text-slate-500">Documentos que a equipe liberou para você.</p>
        </div>
        <div className="relative sm:w-72">
          <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-8" placeholder="Buscar documento ou cliente" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <FolderOpen className="size-8 mx-auto text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">Nenhum documento compartilhado</p>
          <p className="text-xs text-slate-500">Quando a equipe liberar arquivos, eles aparecem aqui.</p>
        </div>
      ) : groups.map(([client, docs]) => (
        <section key={client} className="rounded-xl border border-slate-200/70 bg-white shadow-sm overflow-hidden">
          <header className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">{client}</span>
            <Badge variant="outline" className="text-[10px]">{docs.length} arquivo(s)</Badge>
          </header>
          <ul className="divide-y divide-slate-100">
            {docs.map((d) => (
              <li key={d.id} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">{d.documents!.name}</span>
                    {!d.viewed_at && <Badge className="bg-teal-600 text-[9px] h-4 px-1.5">Novo</Badge>}
                  </div>
                  <div className="text-xs text-slate-500 flex flex-wrap gap-x-3">
                    <span>Recebido {formatDate(d.created_at)}</span>
                    {d.expires_at && <span className="text-amber-600 flex items-center gap-1"><Clock className="size-3" />até {formatDate(d.expires_at)}</span>}
                  </div>
                  {d.message && <p className="text-xs text-slate-600 mt-1 italic">“{d.message}”</p>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => open(d, false)} disabled={!d.can_download}><Eye className="size-3.5 mr-1" />Ver</Button>
                {d.can_download && <Button size="sm" variant="outline" onClick={() => open(d, true)}><Download className="size-3.5 mr-1" />Baixar</Button>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
