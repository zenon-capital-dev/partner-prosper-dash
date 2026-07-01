import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { Plus, MessageSquare, FileQuestion, CheckCircle2, Clock, X, Send, ChevronDown, ChevronUp } from "lucide-react";

type Role = "admin" | "parceiro" | "prestador" | "cliente" | "colaborador";

interface Props {
  clientProductId: string;
  currentRole: Role;
  /** Roles available as target. Defaults vary by currentRole. */
  allowedTargets?: Role[];
}

const KIND_LABEL: Record<string, string> = {
  documento: "Documento",
  informacao: "Informação",
  duvida: "Dúvida",
  outro: "Outro",
};

const STATUS_META: Record<string, { label: string; tone: string; icon: any }> = {
  aberta: { label: "Aberta", tone: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  respondida: { label: "Respondida", tone: "bg-blue-50 text-blue-700 border-blue-200", icon: MessageSquare },
  resolvida: { label: "Resolvida", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  cancelada: { label: "Cancelada", tone: "bg-slate-100 text-slate-600 border-slate-200", icon: X },
};

const DEFAULT_TARGETS: Record<Role, Role[]> = {
  admin: ["cliente", "prestador", "parceiro", "colaborador"],
  parceiro: ["cliente", "admin", "prestador"],
  prestador: ["cliente", "admin", "parceiro"],
  cliente: ["admin", "prestador", "parceiro"],
  colaborador: ["cliente", "admin", "prestador", "parceiro"],
};

export function DemandRequestsPanel({ clientProductId, currentRole, allowedTargets }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [openThreads, setOpenThreads] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    target_role: (allowedTargets ?? DEFAULT_TARGETS[currentRole])[0] as Role,
    kind: "informacao" as "documento" | "informacao" | "duvida" | "outro",
    title: "",
    description: "",
  });

  const targets = allowedTargets ?? DEFAULT_TARGETS[currentRole];

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["demand-requests", clientProductId],
    enabled: !!clientProductId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_requests")
        .select("*")
        .eq("client_product_id", clientProductId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const reset = () => {
    setForm({ target_role: targets[0], kind: "informacao", title: "", description: "" });
  };

  const submit = async () => {
    if (!form.title.trim()) {
      toast.error("Informe um título");
      return;
    }
    const { error } = await supabase.from("demand_requests").insert({
      client_product_id: clientProductId,
      requested_by: user?.id,
      requested_role: currentRole,
      target_role: form.target_role,
      kind: form.kind,
      title: form.title.trim(),
      description: form.description.trim() || null,
    } as any);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Solicitação enviada");
    setOpen(false);
    reset();
    qc.invalidateQueries({ queryKey: ["demand-requests", clientProductId] });
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("demand_requests").update({ status } as any).eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["demand-requests", clientProductId] });
  };

  const toggleThread = (id: string) => setOpenThreads((s) => ({ ...s, [id]: !s[id] }));

  const sendMessage = async (requestId: string) => {
    const text = (drafts[requestId] || "").trim();
    if (!text) return;
    const { error } = await supabase.from("demand_request_messages" as any).insert({
      request_id: requestId,
      author_id: user?.id,
      author_role: currentRole,
      message: text,
    });
    if (error) { toast.error(error.message); return; }
    setDrafts((s) => ({ ...s, [requestId]: "" }));
    // bump status to respondida if currently aberta and author is target
    const item = items.find((x: any) => x.id === requestId);
    if (item?.status === "aberta") {
      await supabase.from("demand_requests").update({ status: "respondida", responded_by: user?.id, responded_at: new Date().toISOString() } as any).eq("id", requestId);
    }
    qc.invalidateQueries({ queryKey: ["demand-requests", clientProductId] });
    qc.invalidateQueries({ queryKey: ["demand-request-messages", requestId] });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Solicitações da demanda</h3>
          <p className="text-xs text-slate-500">Chamados, perguntas e pedidos de documentos entre os envolvidos.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4 mr-1" /> Nova solicitação
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-slate-500">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-lg p-6 text-center">
          <FileQuestion className="size-6 text-slate-400 mx-auto mb-2" />
          <p className="text-sm text-slate-600">Nenhuma solicitação registrada</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it: any) => {
            const meta = STATUS_META[it.status] || STATUS_META.aberta;
            const Icon = meta.icon;
            const canRespond = it.status === "aberta" && it.target_role === currentRole;
            return (
              <li key={it.id} className="border border-slate-200 rounded-lg p-3 bg-white">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className={`${meta.tone} text-[10px] gap-1`}>
                    <Icon className="size-3" /> {meta.label}
                  </Badge>
                  <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-[10px]">
                    {KIND_LABEL[it.kind] || it.kind}
                  </Badge>
                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] capitalize">
                    p/ {it.target_role}
                  </Badge>
                  <span className="ml-auto text-[11px] text-slate-500">{formatDate(it.created_at)}</span>
                </div>
                <p className="font-medium text-sm text-slate-900 mt-2">{it.title}</p>
                {it.description && <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{it.description}</p>}
                {it.response && (
                  <div className="mt-2 pl-3 border-l-2 border-blue-200 bg-blue-50/40 p-2 rounded">
                    <p className="text-[11px] font-semibold text-blue-900">Resposta · {formatDate(it.responded_at)}</p>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{it.response}</p>
                  </div>
                )}
                <div className="flex gap-2 mt-2">
                  {canRespond && (
                    <Button size="sm" variant="outline" onClick={() => { setRespondId(it.id); setResponseText(""); }}>
                      Responder
                    </Button>
                  )}
                  {it.status !== "resolvida" && it.status !== "cancelada" && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setStatus(it.id, "resolvida")}>
                        Marcar resolvida
                      </Button>
                      {it.requested_by === user?.id && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(it.id, "cancelada")}>
                          Cancelar
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova solicitação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Para quem</Label>
              <Select value={form.target_role} onValueChange={(v) => setForm({ ...form, target_role: v as Role })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {targets.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="documento">Documento</SelectItem>
                  <SelectItem value="informacao">Informação</SelectItem>
                  <SelectItem value="duvida">Dúvida</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Enviar CNH atualizada" />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalhe o que precisa..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit}>Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!respondId} onOpenChange={(v) => { if (!v) { setRespondId(null); setResponseText(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Responder solicitação</DialogTitle></DialogHeader>
          <Textarea rows={5} value={responseText} onChange={(e) => setResponseText(e.target.value)} placeholder="Escreva a resposta..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondId(null)}>Cancelar</Button>
            <Button onClick={respond}>Enviar resposta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
