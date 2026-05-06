import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { FileText, Download, Check, X, Clock, FilePlus } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export default function Documents() {
  const { data: docs, refetch } = useQuery({
    queryKey: ["docs-all"],
    queryFn: async () => (await supabase.from("documents").select("*, clients(full_name)").order("created_at", { ascending: false })).data ?? [],
  });

  const updateStatus = async (id: string, status: "aprovado" | "enviado" | "rejeitado" | "solicitado") => {
    const { error } = await supabase.from("documents").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Documento ${status}`);
    refetch();
  };

  const download = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("documents").download(path);
    if (error) { toast.error(error.message); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in">
      <PageHeader title="Documentos" description="Todos os documentos solicitados e enviados." />

      <div className="vx-card overflow-hidden">
        {(docs ?? []).length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Nenhum documento ainda</div>
        ) : (
          <div className="divide-y divide-border">
            {docs?.map((d: any) => (
              <div key={d.id} className="px-6 py-4 flex items-center justify-between hover:bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-primary-muted text-primary flex items-center justify-center"><FileText className="size-4" /></div>
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.clients?.full_name} · {formatDate(d.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase flex items-center gap-1 transition-opacity hover:opacity-80 ${
                        d.status === "aprovado" ? "bg-success-muted text-success" :
                        d.status === "enviado" ? "bg-info-muted text-info" :
                        d.status === "rejeitado" ? "bg-destructive-muted text-destructive" :
                        "bg-warning-muted text-warning"
                      }`}>
                        {d.status === "aprovado" && <Check className="size-2.5" />}
                        {d.status === "rejeitado" && <X className="size-2.5" />}
                        {d.status === "pendente" && <Clock className="size-2.5" />}
                        {d.status}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => updateStatus(d.id, "aprovado")} className="text-success"><Check className="size-3.5 mr-2" /> Aprovar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatus(d.id, "rejeitado")} className="text-destructive"><X className="size-3.5 mr-2" /> Reprovar</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => updateStatus(d.id, "pendente")} className="text-warning"><Clock className="size-3.5 mr-2" /> Marcar pendente</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {d.file_path && (
                    <button onClick={() => download(d.file_path, d.name)} className="size-8 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground" title="Download"><Download className="size-4" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
