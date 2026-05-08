import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}

const TEMPLATE = "full_name,email,phone,whatsapp,source,notes\nJoão Silva,joao@ex.com,11999990000,11999990000,Indicação,Lead vindo do parceiro X";

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = cols[i] || ""));
    return obj;
  });
}

export function LeadsCsvImport({ open, onOpenChange, onImported }: Props) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string>("");

  const handleFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 5MB)");
      return;
    }
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      toast.error("CSV vazio ou inválido");
      return;
    }
    setRows(parsed);
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const payload = rows
        .filter((r) => r.full_name)
        .map((r) => ({
          full_name: r.full_name,
          email: r.email || null,
          phone: r.phone || null,
          whatsapp: r.whatsapp || null,
          source: r.source || "CSV",
          notes: r.notes || null,
          status: "Novo",
        }));
      if (payload.length === 0) {
        toast.error("Nenhuma linha válida (full_name é obrigatório)");
        setImporting(false);
        return;
      }
      const { error } = await supabase.from("leads").insert(payload);
      if (error) throw error;
      toast.success(`${payload.length} leads importados!`);
      onImported();
      onOpenChange(false);
      setRows([]);
      setFileName("");
    } catch (err: any) {
      toast.error(err.message || "Erro na importação");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Leads via CSV</DialogTitle>
          <DialogDescription>
            Envie um arquivo CSV com colunas: full_name, email, phone, whatsapp, source, notes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full">
            <FileText className="size-4 mr-2" /> Baixar modelo CSV
          </Button>

          <label className="block">
            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/60 hover:bg-muted/30 transition-colors">
              {fileName ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <CheckCircle2 className="size-5 text-emerald-500" />
                  <span className="font-bold">{fileName}</span>
                  <span className="text-muted-foreground">({rows.length} linhas)</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="size-8 mx-auto text-muted-foreground" />
                  <p className="text-sm font-bold">Clique para selecionar CSV</p>
                  <p className="text-[11px] text-muted-foreground">Máximo 5MB</p>
                </div>
              )}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          </label>

          {rows.length > 0 && (
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
              Preview: <span className="font-bold text-foreground">{rows[0].full_name}</span>
              {rows.length > 1 && ` + ${rows.length - 1} outros`}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleImport} disabled={rows.length === 0 || importing}>
            {importing ? "Importando..." : `Importar ${rows.length} leads`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
