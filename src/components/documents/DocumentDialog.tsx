import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Upload } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
  clientId: string;
}

export function DocumentDialog({ open, onOpenChange, onCreated, clientId }: Props) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<any>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!form.name) { toast.error("Nome do documento é obrigatório"); return; }
    setSubmitting(true);

    let file_path: string | null = null;
    let file_size: number | null = null;
    let mime_type: string | null = null;
    let status: "solicitado" | "enviado" | "aprovado" | "rejeitado" = "solicitado";

    const file = fileRef.current?.files?.[0];
    if (file) {
      const path = `${clientId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
      if (upErr) { toast.error(upErr.message); setSubmitting(false); return; }
      file_path = path;
      file_size = file.size;
      mime_type = file.type;
      status = "enviado";
    }

    const { error } = await supabase.from("documents").insert({
      client_id: clientId,
      name: form.name,
      description: form.description || null,
      status,
      file_path,
      file_size,
      mime_type,
      requested_by: user?.id,
      uploaded_by: file ? user?.id : null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(file ? "Documento enviado" : "Documento solicitado ao cliente");
    onCreated?.();
    onOpenChange(false);
    setForm({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-xl">Solicitar / Enviar documento</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome do documento *</Label>
            <Input placeholder="Ex: RG, CPF, Comprovante de residência..." value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Anexar arquivo (opcional — se não anexar, fica como solicitação)</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer" onClick={() => fileRef.current?.click()}>
              <Upload className="size-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">Clique para selecionar um arquivo</p>
              <input ref={fileRef} type="file" className="hidden" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={submitting} className="bg-gradient-primary hover:opacity-90">{submitting ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
