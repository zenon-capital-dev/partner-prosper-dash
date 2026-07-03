import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  PenLine, Plus, Upload, Download, Trash2, CheckCircle2, RotateCcw,
  Users, Building2, GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { downloadStorageFile } from "@/lib/download";
import { assertUploadFile, sanitizeStorageFileName, uploadStorageFileFast, uploadErrorMessage } from "@/lib/uploads";
import { formatDate } from "@/lib/format";

type ParentType = "document" | "contract";

interface Props {
  parentType: ParentType;
  parentId: string;
  className?: string;
}

const BUCKET = "signature-stages";

export function SignatureStagesPanel({ parentType, parentId, className }: Props) {
  const { user, isAdmin, isAdminSecondary, isColaborador } = useAuth();
  const canManage = !!(isAdmin || isAdminSecondary || isColaborador);
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newParty, setNewParty] = useState<"zenon" | "contraparte">("zenon");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: stages = [], isLoading } = useQuery({
    queryKey: ["signature-stages", parentType, parentId],
    enabled: !!parentId,
    queryFn: async () => {
      const col = parentType === "document" ? "document_id" : "contract_id";
      const { data, error } = await supabase
        .from("signature_stages")
        .select("*")
        .eq(col, parentId)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["signature-stages", parentType, parentId] });

  const addStage = async () => {
    const name = newName.trim();
    if (!name) return toast.error("Dê um nome à fase");
    const nextIdx = (stages[stages.length - 1]?.order_index ?? -1) + 1;
    const payload: any = { parent_type: parentType, name, party: newParty, order_index: nextIdx };
    if (parentType === "document") payload.document_id = parentId;
    else payload.contract_id = parentId;
    const { error } = await supabase.from("signature_stages").insert(payload);
    if (error) return toast.error(error.message);
    setNewName("");
    setNewParty("zenon");
    invalidate();
  };

  const deleteStage = async (s: any) => {
    if (!confirm(`Excluir a fase "${s.name}"?`)) return;
    if (s.file_path) {
      await supabase.storage.from(BUCKET).remove([s.file_path]);
    }
    const { error } = await supabase.from("signature_stages").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Fase removida");
    invalidate();
  };

  const move = async (s: any, dir: -1 | 1) => {
    const idx = stages.findIndex((x: any) => x.id === s.id);
    const swap = stages[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("signature_stages").update({ order_index: swap.order_index }).eq("id", s.id),
      supabase.from("signature_stages").update({ order_index: s.order_index }).eq("id", swap.id),
    ]);
    invalidate();
  };

  const upload = async (s: any, file: File) => {
    try {
      assertUploadFile(file);
      setUploadingId(s.id);
      const safe = sanitizeStorageFileName(file.name);
      const path = `${parentType}/${parentId}/${s.id}/${Date.now()}-${safe}`;
      if (s.file_path) await supabase.storage.from(BUCKET).remove([s.file_path]);
      await uploadStorageFileFast(BUCKET, path, file);
      const { error } = await supabase.from("signature_stages").update({
        file_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user?.id,
        uploaded_at: new Date().toISOString(),
        status: "concluida",
      }).eq("id", s.id);
      if (error) throw error;
      toast.success("Arquivo enviado");
      invalidate();
    } catch (e: any) {
      toast.error(uploadErrorMessage(e));
    } finally {
      setUploadingId(null);
    }
  };

  const download = async (s: any) => {
    if (!s.file_path) return;
    await downloadStorageFile(BUCKET, s.file_path, s.file_name || "arquivo");
  };



  const toggleStatus = async (s: any) => {
    const next = s.status === "concluida" ? "pendente" : "concluida";
    await supabase.from("signature_stages").update({ status: next }).eq("id", s.id);
    invalidate();
  };

  return (
    <div className={cn("rounded-lg border border-slate-200/70 bg-white", className)}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200/70">
        <PenLine className="size-4 text-indigo-600" />
        <p className="text-[13px] font-semibold text-slate-900">Fases de assinatura</p>
        <span className="text-[11px] text-slate-500 ml-auto">{stages.length} fase(s)</span>
      </div>

      <div className="p-3 space-y-2">
        {isLoading && <p className="text-[12px] text-slate-500">Carregando…</p>}
        {!isLoading && stages.length === 0 && (
          <p className="text-[12px] text-slate-500">Nenhuma fase criada ainda.</p>
        )}
        {stages.map((s: any, i: number) => {
          const done = s.status === "concluida";
          const isMine = s.uploaded_by === user?.id;
          return (
            <div key={s.id} className={cn(
              "rounded-md border p-2.5 flex flex-col sm:flex-row sm:items-center gap-2",
              done ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-slate-50/40"
            )}>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {canManage && (
                  <div className="flex flex-col">
                    <button className="text-slate-400 hover:text-slate-600 disabled:opacity-30" disabled={i === 0} onClick={() => move(s, -1)} title="Subir">
                      <GripVertical className="size-3 -mb-1" />
                    </button>
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono text-slate-400">#{i + 1}</span>
                    <p className="text-[13px] font-medium text-slate-900 truncate">{s.name}</p>
                    <Badge variant="outline" className={cn("text-[10px]", s.party === "zenon"
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                      : "bg-amber-50 text-amber-700 border-amber-200")}>
                      {s.party === "zenon" ? <><Building2 className="size-3 mr-1" />Zenon</> : <><Users className="size-3 mr-1" />Contraparte</>}
                    </Badge>
                    {done && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 className="size-3 mr-1" />Concluída</Badge>}
                  </div>
                  {s.file_name && (
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {s.file_name} · {s.uploaded_at ? formatDate(s.uploaded_at) : ""}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {s.file_path && (
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => download(s)}>
                    <Download className="size-3 mr-1" /> Baixar
                  </Button>
                )}
                <input
                  ref={(el) => (fileInputs.current[s.id] = el)}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(s, f);
                    e.target.value = "";
                  }}
                />
                <Button size="sm" variant={s.file_path ? "outline" : "default"} className={cn("h-7 text-[11px]", !s.file_path && "bg-indigo-600 hover:bg-indigo-700")} disabled={uploadingId === s.id} onClick={() => fileInputs.current[s.id]?.click()}>
                  <Upload className="size-3 mr-1" />
                  {uploadingId === s.id ? "Enviando…" : s.file_path ? "Substituir" : "Enviar"}
                </Button>
                {canManage && (
                  <>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0" title={done ? "Marcar como pendente" : "Marcar como concluída"} onClick={() => toggleStatus(s)}>
                      {done ? <RotateCcw className="size-3" /> : <CheckCircle2 className="size-3" />}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700" onClick={() => deleteStage(s)}>
                      <Trash2 className="size-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {canManage && (
          <div className="pt-2 border-t border-dashed border-slate-200 flex flex-col sm:flex-row gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome da fase (ex.: Original, Assinado cliente, Contra-assinado…)"
              className="h-8 text-[12px]"
              onKeyDown={(e) => { if (e.key === "Enter") addStage(); }}
            />
            <Select value={newParty} onValueChange={(v) => setNewParty(v as any)}>
              <SelectTrigger className="h-8 text-[12px] w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="zenon">Zenon envia</SelectItem>
                <SelectItem value="contraparte">Contraparte envia</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={addStage} className="h-8 bg-indigo-600 hover:bg-indigo-700 text-[12px]">
              <Plus className="size-3 mr-1" /> Adicionar fase
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
