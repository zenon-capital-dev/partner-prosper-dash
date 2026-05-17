import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, PackageCheck, History, Send, Upload, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  clientProductId: string;
}

export function ProductInteractionPanel({ clientProductId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<"client" | "provider">("client");
  const [sending, setSending] = useState(false);
  const [delivTitle, setDelivTitle] = useState("");
  const [delivDesc, setDelivDesc] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: comments = [] } = useQuery({
    queryKey: ["demand-comments", clientProductId],
    queryFn: async () => {
      const { data } = await supabase
        .from("demand_comments")
        .select("id, content, visibility, created_at, author_id")
        .eq("client_product_id", clientProductId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ["demand-deliveries", clientProductId],
    queryFn: async () => {
      const { data } = await supabase
        .from("demand_deliveries")
        .select("id, title, description, file_url, status, created_at")
        .eq("client_product_id", clientProductId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["product-reports", clientProductId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_product_status_reports")
        .select("id, status, notes, pending, next_steps, created_at")
        .eq("client_product_id", clientProductId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function sendComment() {
    if (!content.trim()) return;
    setSending(true);
    const { error } = await supabase.from("demand_comments").insert({
      client_product_id: clientProductId,
      author_id: user!.id,
      content: content.trim(),
      visibility,
    } as any);
    setSending(false);
    if (error) return toast.error("Erro ao enviar", { description: error.message });
    setContent("");
    toast.success(visibility === "client" ? "Mensagem enviada ao cliente" : "Anotação interna salva");
    qc.invalidateQueries({ queryKey: ["demand-comments", clientProductId] });
  }

  async function uploadDelivery(file: File) {
    setUploading(true);
    const path = `${clientProductId}/${Date.now()}_${file.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { upsert: false });
    if (upErr) {
      setUploading(false);
      return toast.error("Falha no upload", { description: upErr.message });
    }
    const { error } = await supabase.from("demand_deliveries").insert({
      client_product_id: clientProductId,
      title: delivTitle || file.name,
      description: delivDesc || null,
      file_url: path,
      status: "delivered",
    } as any);
    setUploading(false);
    if (error) return toast.error("Erro ao registrar entregável", { description: error.message });
    setDelivTitle("");
    setDelivDesc("");
    toast.success("Entregável publicado");
    qc.invalidateQueries({ queryKey: ["demand-deliveries", clientProductId] });
  }

  async function downloadDelivery(path: string) {
    const { data } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
    if (data) window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="vx-card p-6 lg:p-8 bg-white border border-slate-100 rounded-[32px]">
      <Tabs defaultValue="comments">
        <TabsList className="bg-slate-100/60 p-1 rounded-xl mb-6">
          <TabsTrigger value="comments" className="rounded-lg gap-2"><MessageSquare className="size-3.5" /> Comentários ({comments.length})</TabsTrigger>
          <TabsTrigger value="deliveries" className="rounded-lg gap-2"><PackageCheck className="size-3.5" /> Entregáveis ({deliveries.length})</TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg gap-2"><History className="size-3.5" /> Histórico ({reports.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="comments" className="space-y-4">
          <div className="space-y-2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={visibility === "client" ? "Mensagem visível para o cliente..." : "Anotação interna (cliente não vê)..."}
              rows={3}
              className="rounded-xl"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-1 text-xs">
                <button
                  onClick={() => setVisibility("client")}
                  className={cn("px-3 py-1.5 rounded-lg font-bold transition-colors", visibility === "client" ? "bg-primary text-white" : "bg-slate-100 text-muted-foreground hover:bg-slate-200")}
                >Para o cliente</button>
                <button
                  onClick={() => setVisibility("provider")}
                  className={cn("px-3 py-1.5 rounded-lg font-bold transition-colors", visibility === "provider" ? "bg-amber-500 text-white" : "bg-slate-100 text-muted-foreground hover:bg-slate-200")}
                >Interno (admin)</button>
              </div>
              <Button onClick={sendComment} disabled={sending || !content.trim()} className="rounded-xl">
                {sending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Send className="size-4 mr-2" />}
                Enviar
              </Button>
            </div>
          </div>
          <div className="space-y-3 pt-4 border-t border-slate-50 max-h-[400px] overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-6">Nenhum comentário ainda.</p>
            ) : comments.map((c: any) => (
              <div key={c.id} className={cn("p-4 rounded-xl border text-sm", c.visibility === "provider" ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100")}>
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-[9px] uppercase tracking-widest">
                    {c.visibility === "provider" ? "Interno" : c.visibility === "system" ? "Sistema" : "Cliente"}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{formatDate(c.created_at)}</span>
                </div>
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="deliveries" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input value={delivTitle} onChange={(e) => setDelivTitle(e.target.value)} placeholder="Título do entregável" className="rounded-xl" />
            <Input value={delivDesc} onChange={(e) => setDelivDesc(e.target.value)} placeholder="Descrição (opcional)" className="rounded-xl" />
          </div>
          <label className="flex items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-slate-200 hover:border-primary hover:bg-primary/5 cursor-pointer transition-all">
            <Upload className="size-5 text-primary" />
            <span className="text-sm font-bold">{uploading ? "Enviando..." : "Selecionar arquivo para enviar"}</span>
            <input type="file" hidden disabled={uploading} onChange={(e) => e.target.files?.[0] && uploadDelivery(e.target.files[0])} />
          </label>
          <div className="space-y-2 pt-2">
            {deliveries.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-6">Nenhum entregável publicado.</p>
            ) : deliveries.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm truncate">{d.title}</p>
                  {d.description && <p className="text-xs text-muted-foreground truncate">{d.description}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">{formatDate(d.created_at)}</p>
                </div>
                <Badge variant="outline" className="text-[9px] mr-2">{d.status}</Badge>
                {d.file_url && (
                  <Button size="icon" variant="ghost" onClick={() => downloadDelivery(d.file_url)} className="size-8">
                    <Download className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {reports.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-6">Sem reportes nesta demanda.</p>
          ) : reports.map((r: any) => (
            <div key={r.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[10px] uppercase tracking-widest font-bold">{r.status?.replace(/_/g, " ")}</Badge>
                <span className="text-[10px] text-muted-foreground">{formatDate(r.created_at)}</span>
              </div>
              {r.notes && <p className="text-sm leading-relaxed"><span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest block">Andamento</span>{r.notes}</p>}
              {r.pending && <p className="text-sm text-amber-700 leading-relaxed"><span className="text-[10px] font-bold uppercase tracking-widest block">Pendências</span>{r.pending}</p>}
              {r.next_steps && <p className="text-sm text-primary leading-relaxed"><span className="text-[10px] font-bold uppercase tracking-widest block">Próximos passos</span>{r.next_steps}</p>}
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
