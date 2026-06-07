import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, FileText, Link as LinkIcon, Upload, BookOpen } from "lucide-react";
import { formatDate } from "@/lib/format";

const CATEGORIES = [
  { value: "institucional", label: "Institucional" },
  { value: "vendas", label: "Argumentos de venda" },
  { value: "treinamento", label: "Treinamentos" },
  { value: "gatilhos", label: "Gatilhos mentais" },
  { value: "produtos", label: "Produtos" },
  { value: "outros", label: "Outros" },
];

type Material = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_path: string | null;
  external_url: string | null;
  active: boolean;
  created_at: string;
};

export default function PartnerMaterialsAdmin() {
  const { user } = useAuth() as any;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", category: "institucional", external_url: "", active: true,
  });

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["partner-materials-admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("partner_materials").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Material[];
    },
  });

  const reset = () => {
    setForm({ title: "", description: "", category: "institucional", external_url: "", active: true });
    setFile(null);
    setEditing(null);
  };

  const openCreate = () => { reset(); setOpen(true); };
  const openEdit = (m: Material) => {
    setEditing(m);
    setForm({
      title: m.title,
      description: m.description || "",
      category: m.category,
      external_url: m.external_url || "",
      active: m.active,
    });
    setFile(null);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Título obrigatório");
      let file_path = editing?.file_path || null;

      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("partner-materials").upload(path, file);
        if (upErr) throw upErr;
        file_path = path;
      }

      const payload: any = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        external_url: form.external_url.trim() || null,
        active: form.active,
        file_path,
      };

      if (editing) {
        const { error } = await supabase.from("partner_materials").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from("partner_materials").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Material atualizado" : "Material adicionado");
      qc.invalidateQueries({ queryKey: ["partner-materials-admin"] });
      setOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const del = useMutation({
    mutationFn: async (m: Material) => {
      if (m.file_path) await supabase.storage.from("partner-materials").remove([m.file_path]);
      const { error } = await supabase.from("partner_materials").delete().eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material removido");
      qc.invalidateQueries({ queryKey: ["partner-materials-admin"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="size-6 text-indigo-600" /> Materiais para parceiros
          </h1>
          <p className="text-sm text-slate-500 mt-1">Disponibilize institucional, treinamentos, argumentos de vendas e gatilhos para os seus parceiros.</p>
        </div>
        <Button onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
          <Plus className="size-4" /> Novo material
        </Button>
      </div>

      <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Carregando...</div>
        ) : materials.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="size-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">Nenhum material cadastrado ainda.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60 border-b border-slate-200/70">
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Criado</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{m.title}</p>
                    {m.description && <p className="text-[12px] text-slate-500 line-clamp-1">{m.description}</p>}
                  </td>
                  <td className="px-4 py-3"><Badge variant="outline" className="capitalize">{m.category}</Badge></td>
                  <td className="px-4 py-3 text-slate-600">
                    {m.file_path ? <span className="inline-flex items-center gap-1"><FileText className="size-3.5" /> Arquivo</span> : null}
                    {m.external_url ? <span className="inline-flex items-center gap-1"><LinkIcon className="size-3.5" /> Link</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={m.active ? "default" : "outline"} className={m.active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}>
                      {m.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(m.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(m)}><Pencil className="size-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { if (confirm("Remover este material?")) del.mutate(m); }}>
                      <Trash2 className="size-3.5 text-red-600" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar material" : "Novo material"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Apresentação institucional 2026" maxLength={150} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} maxLength={500} />
            </div>
            <div>
              <Label className="flex items-center gap-2"><Upload className="size-3.5" /> Arquivo (opcional)</Label>
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              {editing?.file_path && !file && <p className="text-[11px] text-slate-500 mt-1">Arquivo atual: {editing.file_path.split("-").slice(2).join("-") || editing.file_path}</p>}
            </div>
            <div>
              <Label className="flex items-center gap-2"><LinkIcon className="size-3.5" /> Link externo (opcional)</Label>
              <Input value={form.external_url} onChange={(e) => setForm({ ...form, external_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativo (visível para parceiros)</Label>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-indigo-600 hover:bg-indigo-700">
              {save.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
