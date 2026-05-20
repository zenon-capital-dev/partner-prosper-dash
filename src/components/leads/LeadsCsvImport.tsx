import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { onlyDigits } from "@/lib/masks";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}

const TEMPLATE = `full_name,email,phone,whatsapp,company,source,notes
João Silva,joao@ex.com,(11) 99999-0000,(11) 99999-0000,Acme Ltda,Indicação,"Lead vindo do parceiro X"`;

// CSV parser que respeita aspas duplas e vírgulas dentro de campos
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => { cur.push(field); field = ""; };
  const pushRow = () => { rows.push(cur); cur = []; };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") pushField();
      else if (c === "\n") { pushField(); pushRow(); }
      else if (c === "\r") { /* ignora */ }
      else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { pushField(); pushRow(); }

  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1)
    .filter((cols) => cols.some((c) => c.trim() !== ""))
    .map((cols) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => (obj[h] = (cols[i] ?? "").trim()));
      return obj;
    });
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export function LeadsCsvImport({ open, onOpenChange, onImported }: Props) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string>("");

  const validRows = rows.filter((r) => (r.full_name || "").trim().length > 1);
  const invalidCount = rows.length - validRows.length;

  const handleFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("Arquivo muito grande (máx 5MB)"); return; }
    setFileName(file.name);
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) { toast.error("CSV vazio ou inválido"); setRows([]); return; }
    setRows(parsed);
  };

  const handleImport = async () => {
    if (validRows.length === 0) { toast.error("Nenhuma linha válida (full_name é obrigatório)"); return; }
    setImporting(true);
    try {
      const payload = validRows.map((r) => {
        const email = (r.email || "").trim().toLowerCase();
        return {
          full_name: r.full_name.trim().slice(0, 150),
          email: email && isEmail(email) ? email : null,
          phone: r.phone ? onlyDigits(r.phone) : null,
          whatsapp: r.whatsapp ? onlyDigits(r.whatsapp) : null,
          company: r.company?.trim() || null,
          source: r.source?.trim() || "CSV",
          notes: r.notes?.trim() || null,
          status: "Novo",
        };
      });
      const { error } = await supabase.from("leads").insert(payload);
      if (error) throw error;
      toast.success(`${payload.length} lead${payload.length !== 1 ? "s" : ""} importado${payload.length !== 1 ? "s" : ""}!`);
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
      <DialogContent className="max-w-lg bg-white">
        <DialogHeader>
          <DialogTitle>Importar Leads via CSV</DialogTitle>
          <DialogDescription>
            Colunas aceitas: full_name, email, phone, whatsapp, company, source, notes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full">
            <FileText className="size-4 mr-2" /> Baixar modelo CSV
          </Button>

          <label className="block">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-slate-50 transition-colors">
              {fileName ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <CheckCircle2 className="size-5 text-emerald-500" />
                  <span className="font-bold">{fileName}</span>
                  <span className="text-slate-500">({rows.length} linhas)</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="size-8 mx-auto text-slate-400" />
                  <p className="text-sm font-bold">Clique para selecionar CSV</p>
                  <p className="text-[11px] text-slate-500">Máximo 5MB</p>
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
            <div className="space-y-2">
              <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span><b>{validRows.length}</b> linha{validRows.length !== 1 ? "s" : ""} válida{validRows.length !== 1 ? "s" : ""} pronta{validRows.length !== 1 ? "s" : ""} para importação</span>
                </div>
                {invalidCount > 0 && (
                  <div className="flex items-center gap-2 text-amber-700">
                    <AlertTriangle className="size-3.5" />
                    <span><b>{invalidCount}</b> linha{invalidCount !== 1 ? "s" : ""} sem nome ser{invalidCount !== 1 ? "ão" : "á"} ignorada{invalidCount !== 1 ? "s" : ""}</span>
                  </div>
                )}
                {validRows[0] && (
                  <div className="text-slate-500 pt-1">
                    Preview: <span className="font-bold text-slate-900">{validRows[0].full_name}</span>
                    {validRows.length > 1 && ` + ${validRows.length - 1} outros`}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleImport} disabled={validRows.length === 0 || importing} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            {importing ? "Importando..." : `Importar ${validRows.length} lead${validRows.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
