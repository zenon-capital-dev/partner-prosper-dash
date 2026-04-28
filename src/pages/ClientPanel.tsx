import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { FileText, Download } from "lucide-react";
import { formatBRL, formatDate } from "@/lib/format";
import { toast } from "sonner";

export default function ClientPanel() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["client-panel", user?.id],
    queryFn: async () => {
      const { data: client } = await supabase.from("clients").select("id, full_name, status").eq("user_id", user!.id).maybeSingle();
      if (!client) return null;
      const { data: sales } = await supabase.from("sales").select("*, products(name, product_categories(name, color))").eq("client_id", client.id);
      const { data: docs } = await supabase.from("documents").select("*").eq("client_id", client.id).order("created_at", { ascending: false });
      return { client, sales: sales ?? [], docs: docs ?? [] };
    },
    enabled: !!user,
  });

  const download = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("documents").download(path);
    if (error) { toast.error(error.message); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };

  if (!data) {
    return <div className="p-12 text-center"><p className="font-display text-2xl font-bold">Bem-vindo!</p><p className="text-muted-foreground mt-2">Seu cadastro ainda está em processamento.</p></div>;
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
      <PageHeader title={`Olá, ${data.client.full_name.split(" ")[0]}!`} description="Acompanhe seus serviços e documentos." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="vx-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border"><p className="text-sm font-semibold">Meus serviços</p></div>
          {data.sales.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Nenhum serviço contratado</div>
          ) : (
            <div className="divide-y divide-border">
              {data.sales.map((s: any) => (
                <div key={s.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{s.products?.name}</p>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase mt-1 inline-block" style={{ background: `${s.products?.product_categories?.color}20`, color: s.products?.product_categories?.color }}>
                        {s.products?.product_categories?.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-bold vx-mono">{formatBRL(s.amount)}</p>
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground mt-1">{s.status.replace("_", " ")}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="vx-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border"><p className="text-sm font-semibold">Meus documentos</p></div>
          {data.docs.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">Nenhum documento</div>
          ) : (
            <div className="divide-y divide-border">
              {data.docs.map((d: any) => (
                <div key={d.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-lg bg-primary-muted text-primary flex items-center justify-center"><FileText className="size-4" /></div>
                    <div>
                      <p className="text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(d.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${d.status === "aprovado" ? "bg-success-muted text-success" : d.status === "enviado" ? "bg-info-muted text-info" : "bg-warning-muted text-warning"}`}>{d.status}</span>
                    {d.file_path && <button onClick={() => download(d.file_path, d.name)} className="size-8 rounded-md hover:bg-muted flex items-center justify-center"><Download className="size-4 text-muted-foreground" /></button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
