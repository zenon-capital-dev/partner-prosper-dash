import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileText } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  clientProductId?: string;
  context?: string; // ex: nome da demanda
}

export function RequestDocumentDialog({ open, onOpenChange, clientId, clientProductId, context }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return toast.error("Informe o título do documento");
    setSaving(true);
    const { error } = await supabase.from("client_document_requests").insert({
      client_id: clientId,
      client_product_id: clientProductId || null,
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      status: "pendente",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Documento solicitado ao cliente");
    setTitle(""); setDescription(""); setDueDate("");
    qc.invalidateQueries({ queryKey: ["provider-documents"] });
    qc.invalidateQueries({ queryKey: ["client-document-requests"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-primary" /> Solicitar documento ao cliente
          </DialogTitle>
          <DialogDescription>
            {context ? `Para a demanda: ${context}` : "O cliente receberá esta solicitação no painel dele."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="doc-title">Título *</Label>
            <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: RG e CPF, Comprovante de endereço" />
          </div>
          <div>
            <Label htmlFor="doc-desc">Descrição / Instruções</Label>
            <Textarea id="doc-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Explique o que o cliente precisa enviar" />
          </div>
          <div>
            <Label htmlFor="doc-due">Prazo (opcional)</Label>
            <Input id="doc-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Enviando..." : "Solicitar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
