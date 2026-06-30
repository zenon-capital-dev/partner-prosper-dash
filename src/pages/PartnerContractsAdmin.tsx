import { useMemo, useState } from "react";
import { openDownloadUrl } from "@/lib/download";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileSignature, Upload, Download, FileCheck2, Search, Inbox } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { assertUploadFile, sanitizeStorageFileName, uploadErrorMessage } from "@/lib/uploads";
import { PaginationControl } from "@/components/ui/PaginationControl";

const PAGE_SIZE = 12;

const STATUS_TONE: Record<string, string> = {
  pendente: "bg-slate-100 text-slate-600 border-slate-200",
  enviado: "bg-amber-50 text-amber-700 border-amber-200",
  em_analise: "bg-blue-50 text-blue-700 border-blue-200",
  assinado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rascunho: "bg-slate-100 text-slate-700 border-slate-200",
};
const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente", rascunho: "Rascunho", enviado: "Enviado", em_analise: "Em análise", assinado: "Assinado",
};

type Row = {
  partner_id: string;
  full_name: string;
  email: string | null;
  partner_type: string | null;
  contract: any | null;
};

export default function PartnerContractsAdmin() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Row | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending_send" | "awaiting_signed" | "signed">("all");

  const { data: partners = [], isLoading: loadingPartners } = useQuery({
    queryKey: ["admin-partners-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("id, full_name, email, partner_type, active")
        .order("full_name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  const { data: contracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ["admin-partner-contracts-min"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("partner_contracts")
        .select("*")
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const rows: Row[] = useMemo(() => {
    const byPartner = new Map<string, any>();
    for (const c of contracts as any[]) byPartner.set(c.partner_id, c);
    return (partners as any[]).map((p) => ({
      partner_id: p.id,
      full_name: p.full_name,
      email: p.email,
      partner_type: p.partner_type,
      contract: byPartner.get(p.id) || null,
    }));
  }, [partners, contracts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.full_name || ""} ${r.email || ""}`.toLowerCase().includes(q)) return false;
      const c = r.contract;
      if (filter === "pending_send") return !c?.contract_template_path && !c?.nda_template_path;
      if (filter === "awaiting_signed") return (c?.contract_template_path || c?.nda_template_path) && !(c?.contract_signed_path && c?.nda_signed_path);
      if (filter === "signed") return c?.contract_signed_path || c?.nda_signed_path;
      return true;
    });
  }, [rows, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginatedRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const ensureContract = async (row: Row): Promise<any> => {
    if (row.contract) return row.contract;
    const { data, error } = await (supabase as any)
      .from("partner_contracts")
      .insert({ partner_id: row.partner_id, status: "rascunho", person_type: "pf", full_name: row.full_name, email: row.email })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  };

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, admin_notes }: any) => {
      const { error } = await (supabase as any).from("partner_contracts").update({ status, admin_notes }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status atualizado"); qc.invalidateQueries({ queryKey: ["admin-partner-contracts-min"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadFile = async (row: Row, slot: "contract_template" | "nda_template" | "contract_signed" | "nda_signed", file: File) => {
    try {
      assertUploadFile(file);
      const contract = await ensureContract(row);
      const path = `${row.partner_id}/${slot}-${Date.now()}-${sanitizeStorageFileName(file.name)}`;
      const { error: upErr } = await supabase.storage.from("partner-contracts").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const now = new Date().toISOString();
      const patch: any = {
        contract_template: { contract_template_path: path, contract_template_uploaded_at: now },
        nda_template: { nda_template_path: path, nda_template_uploaded_at: now },
        contract_signed: { contract_signed_path: path, contract_uploaded_at: now },
        nda_signed: { nda_signed_path: path, nda_uploaded_at: now },
      }[slot];
      const { error } = await (supabase as any).from("partner_contracts").update(patch).eq("id", contract.id);
      if (error) throw error;
      toast.success("Arquivo enviado");
      qc.invalidateQueries({ queryKey: ["admin-partner-contracts-min"] });
      setSelected((s) => s ? { ...s, contract: { ...contract, ...patch } } : s);
    } catch (e: any) {
      toast.error(uploadErrorMessage(e) || "Erro no upload");
    }
  };

  const downloadFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("partner-contracts").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) { toast.error("Não foi possível abrir"); return; }
    openDownloadUrl(data.signedUrl);
  };

  const isLoading = loadingPartners || loadingContracts;

  const statusOf = (r: Row): string => {
    const c = r.contract;
    if (!c) return "pendente";
    if (c.status && c.status !== "rascunho") return c.status;
    if (c.contract_signed_path || c.nda_signed_path) return "em_analise";
    if (c.contract_template_path || c.nda_template_path) return "enviado";
    return "pendente";
  };

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <FileSignature className="size-6 text-indigo-700" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Contratos de Parceiros</h1>
            <p className="text-sm text-slate-500">Envie o contrato/NDA, acompanhe quem já devolveu assinado.</p>
          </div>
        </div>

        <Card className="bg-white border-slate-200/70 shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">Parceiros</CardTitle>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="Buscar nome ou e-mail" className="h-8 pl-8 text-[13px] w-60" />
              </div>
              {(["all","pending_send","awaiting_signed","signed"] as const).map((f) => (
                <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} className="h-8 text-[12px]" onClick={() => { setFilter(f); setCurrentPage(1); }}>
                  {f === "all" ? "Todos" : f === "pending_send" ? "Sem envio" : f === "awaiting_signed" ? "Aguardando assinado" : "Assinados"}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-slate-500">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <Inbox className="size-10 mx-auto text-slate-300 mb-2" />
                <p className="text-slate-500 text-sm">Nenhum parceiro encontrado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Parceiro</th>
                      <th className="text-left px-4 py-3 font-semibold">Status</th>
                      <th className="text-left px-4 py-3 font-semibold">Enviado p/ parceiro</th>
                      <th className="text-left px-4 py-3 font-semibold">Devolvido assinado</th>
                      <th className="text-right px-4 py-3 font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((r) => {
                      const c = r.contract;
                      const st = statusOf(r);
                      return (
                        <tr key={r.partner_id} className="border-t border-slate-100 hover:bg-slate-50/40">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">{r.full_name || "—"}</p>
                            <p className="text-[11.5px] text-slate-500">{r.email || "—"}{r.partner_type ? ` · ${r.partner_type}` : ""}</p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={STATUS_TONE[st]}>{STATUS_LABEL[st] || st}</Badge>
                          </td>
                          <td className="px-4 py-3 text-[12px] text-slate-600">
                            <div className="flex flex-col">
                              <span className={c?.contract_template_path ? "text-emerald-700" : "text-slate-400"}>{c?.contract_template_path ? `Contrato · ${formatDate(c.contract_template_uploaded_at)}` : "Contrato —"}</span>
                              <span className={c?.nda_template_path ? "text-emerald-700" : "text-slate-400"}>{c?.nda_template_path ? `NDA · ${formatDate(c.nda_template_uploaded_at)}` : "NDA —"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[12px]">
                            <div className="flex flex-col gap-1">
                              {c?.contract_signed_path ? (
                                <button onClick={() => downloadFile(c.contract_signed_path)} className="inline-flex items-center gap-1 text-emerald-700 hover:underline text-left">
                                  <FileCheck2 className="size-3.5" /> Contrato assinado
                                </button>
                              ) : <span className="text-slate-400">Contrato pendente</span>}
                              {c?.nda_signed_path ? (
                                <button onClick={() => downloadFile(c.nda_signed_path)} className="inline-flex items-center gap-1 text-emerald-700 hover:underline text-left">
                                  <FileCheck2 className="size-3.5" /> NDA assinado
                                </button>
                              ) : <span className="text-slate-400">NDA pendente</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button size="sm" variant="outline" onClick={() => setSelected(r)}>Abrir</Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <PaginationControl currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={filtered.length} itemsPerPage={PAGE_SIZE} />
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.full_name}</DialogTitle>
                <p className="text-[12px] text-slate-500">{selected.email}</p>
              </DialogHeader>
              <div className="space-y-5">
                {selected.contract && (
                  <div className="grid grid-cols-2 gap-3 text-[12.5px]">
                    <Field label="Tipo" value={selected.contract.person_type === "pj" ? "Pessoa Jurídica" : "Pessoa Física"} />
                    <Field label="Telefone" value={selected.contract.phone} />
                    {selected.contract.person_type === "pf" ? (
                      <>
                        <Field label="CPF" value={selected.contract.cpf} />
                        <Field label="RG" value={selected.contract.rg ? `${selected.contract.rg} ${selected.contract.rg_issuer || ""}` : ""} />
                      </>
                    ) : (
                      <>
                        <Field label="Razão social" value={selected.contract.company_name} />
                        <Field label="CNPJ" value={selected.contract.company_cnpj} />
                      </>
                    )}
                    <Field label="Cidade/UF" value={[selected.contract.address_city, selected.contract.address_state].filter(Boolean).join(" / ")} />
                    <Field label="PIX" value={selected.contract.pix_key} />
                  </div>
                )}

                {selected.contract?.notes && (
                  <div>
                    <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Observações do parceiro</Label>
                    <p className="text-[13px] text-slate-700 whitespace-pre-wrap mt-1 p-3 bg-slate-50 rounded">{selected.contract.notes}</p>
                  </div>
                )}

                <div className="border-t pt-4 space-y-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-bold text-slate-600 mb-2">📤 Enviar originais para o parceiro assinar</p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <UploadSlot label="Contrato (original p/ assinar)" path={selected.contract?.contract_template_path} onPick={(f) => uploadFile(selected, "contract_template", f)} onDownload={downloadFile} />
                      <UploadSlot label="NDA (original p/ assinar)" path={selected.contract?.nda_template_path} onPick={(f) => uploadFile(selected, "nda_template", f)} onDownload={downloadFile} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-bold text-slate-600 mb-2">📥 Arquivos assinados pelo parceiro</p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <UploadSlot label="Contrato assinado" path={selected.contract?.contract_signed_path} onPick={(f) => uploadFile(selected, "contract_signed", f)} onDownload={downloadFile} />
                      <UploadSlot label="NDA assinado" path={selected.contract?.nda_signed_path} onPick={(f) => uploadFile(selected, "nda_signed", f)} onDownload={downloadFile} />
                    </div>
                  </div>
                </div>

                {selected.contract && (
                  <div className="border-t pt-4 space-y-3">
                    <div>
                      <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Anotações internas</Label>
                      <Textarea defaultValue={selected.contract.admin_notes || ""} id="admin-notes-ta" rows={3} />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {["enviado", "em_analise", "assinado"].map((s) => (
                        <Button key={s} variant={selected.contract.status === s ? "default" : "outline"} size="sm"
                          onClick={() => updateStatus.mutate({ id: selected.contract.id, status: s, admin_notes: (document.getElementById("admin-notes-ta") as HTMLTextAreaElement)?.value })}>
                          Marcar como {STATUS_LABEL[s]}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, value }: { label: string; value?: any }) {
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-wider font-semibold text-slate-500">{label}</p>
      <p className="text-slate-900 mt-0.5">{value || "—"}</p>
    </div>
  );
}

function UploadSlot({ label, path, onPick, onDownload }: { label: string; path?: string | null; onPick: (f: File) => void; onDownload: (p: string) => void }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/40">
      <p className="text-[12px] font-bold text-slate-800 mb-2">{label}</p>
      {path ? (
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => onDownload(path)} className="inline-flex items-center gap-1.5 text-emerald-700 text-[12.5px] hover:underline">
            <Download className="size-3.5" /> Baixar atual
          </button>
          <label className="cursor-pointer text-[11.5px] text-indigo-700 hover:underline">
            Substituir
            <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
          </label>
        </div>
      ) : (
        <label className="cursor-pointer inline-flex items-center gap-2 text-[12.5px] text-indigo-700 hover:underline">
          <Upload className="size-3.5" /> Enviar arquivo
          <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
        </label>
      )}
    </div>
  );
}
