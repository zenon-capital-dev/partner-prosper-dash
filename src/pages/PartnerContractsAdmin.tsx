import { useState } from "react";
import { openDownloadUrl, downloadStorageFile } from "@/lib/download";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileSignature, Upload, Download, FileCheck2, Inbox, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { assertUploadFile, sanitizeStorageFileName, uploadErrorMessage } from "@/lib/uploads";
import { PaginationControl } from "@/components/ui/PaginationControl";
import { usePageSize } from "@/hooks/usePageSize";

const STATUS_TONE: Record<string, string> = {
  rascunho: "bg-slate-100 text-slate-700 border-slate-200",
  enviado: "bg-amber-50 text-amber-700 border-amber-200",
  em_analise: "bg-blue-50 text-blue-700 border-blue-200",
  assinado: "bg-emerald-50 text-emerald-700 border-emerald-200",
};
const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho", enviado: "Enviado", em_analise: "Em análise", assinado: "Assinado",
};

export default function PartnerContractsAdmin() {
  const { pageSize: __ps, setPageSize } = usePageSize();
  const PAGE_SIZE = __ps === -1 ? Number.MAX_SAFE_INTEGER : __ps;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-partner-contract-submissions"],
    queryFn: async () => {
      // Only contracts that partners actually submitted / returned something on
      const { data, error } = await (supabase as any)
        .from("partner_contracts")
        .select("*, partners(id, full_name, email)")
        .or("form_submitted_at.not.is.null,contract_signed_path.not.is.null,nda_signed_path.not.is.null")
        .order("updated_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  const totalPages = Math.max(1, Math.ceil((rows as any[]).length / PAGE_SIZE));
  const paginatedRows = (rows as any[]).slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, admin_notes }: any) => {
      const { error } = await (supabase as any).from("partner_contracts").update({ status, admin_notes }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status atualizado"); qc.invalidateQueries({ queryKey: ["admin-partner-contract-submissions"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadSigned = async (row: any, kind: "contract_signed" | "nda_signed", file: File) => {
    try {
      assertUploadFile(file);
      const path = `${row.partner_id}/${kind}-${Date.now()}-${sanitizeStorageFileName(file.name)}`;
      const { error: upErr } = await supabase.storage.from("partner-contracts").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const now = new Date().toISOString();
      const patch: any = kind === "contract_signed"
        ? { contract_signed_path: path, contract_uploaded_at: now }
        : { nda_signed_path: path, nda_uploaded_at: now };
      const { error } = await (supabase as any).from("partner_contracts").update(patch).eq("id", row.id);
      if (error) throw error;
      toast.success("Arquivo enviado");
      qc.invalidateQueries({ queryKey: ["admin-partner-contract-submissions"] });
      setSelected((s: any) => s ? { ...s, ...patch } : s);
    } catch (e: any) {
      toast.error(uploadErrorMessage(e) || "Erro no upload");
    }
  };

  const downloadFile = async (path: string) => {
    try {
      await downloadStorageFile("partner-contracts", path);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível abrir");
    }
  };

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <FileSignature className="size-6 text-indigo-700" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Contratos recebidos de parceiros</h1>
              <p className="text-sm text-slate-500">Aparecem aqui apenas os contratos/NDAs devolvidos pelos parceiros. Para enviar um novo, abra o perfil do parceiro.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/parceiros")} className="gap-2">
            <ExternalLink className="size-3.5" /> Ir para parceiros
          </Button>
        </div>

        <Card className="bg-white border-slate-200/70 shadow-sm">
          <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">Submissões</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-slate-500">Carregando...</div>
            ) : rows.length === 0 ? (
              <div className="p-12 text-center">
                <Inbox className="size-10 mx-auto text-slate-300 mb-2" />
                <p className="text-slate-500 text-sm">Nenhum parceiro devolveu contrato ainda.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Parceiro</th>
                      <th className="text-left px-4 py-3 font-semibold">Tipo</th>
                      <th className="text-left px-4 py-3 font-semibold">Status</th>
                      <th className="text-left px-4 py-3 font-semibold">Recebido em</th>
                      <th className="text-left px-4 py-3 font-semibold">Arquivos</th>
                      <th className="text-right px-4 py-3 font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((r: any) => (
                      <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/40">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{r.partners?.full_name || r.full_name || "—"}</p>
                          <p className="text-[11.5px] text-slate-500">{r.partners?.email || r.email}</p>
                        </td>
                        <td className="px-4 py-3 capitalize">{r.person_type === "pj" ? "PJ" : "PF"}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status] || r.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{r.contract_uploaded_at || r.nda_uploaded_at || r.form_submitted_at ? formatDate(r.contract_uploaded_at || r.nda_uploaded_at || r.form_submitted_at) : "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {r.contract_signed_path ? (
                              <button onClick={() => downloadFile(r.contract_signed_path)} className="inline-flex items-center gap-1 text-emerald-700 hover:underline text-[12px]">
                                <FileCheck2 className="size-3.5" /> Contrato
                              </button>
                            ) : <span className="text-slate-400 text-[11.5px]">Contrato pendente</span>}
                            {r.nda_signed_path ? (
                              <button onClick={() => downloadFile(r.nda_signed_path)} className="inline-flex items-center gap-1 text-emerald-700 hover:underline text-[12px]">
                                <FileCheck2 className="size-3.5" /> NDA
                              </button>
                            ) : <span className="text-slate-400 text-[11.5px]">NDA pendente</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-1.5 justify-end">
                            <Button size="sm" variant="outline" onClick={() => setSelected(r)}>Abrir</Button>
                            {r.partner_id && (
                              <Button size="sm" variant="ghost" onClick={() => navigate(`/parceiros/${r.partner_id}`)} className="gap-1">
                                <ExternalLink className="size-3.5" /> Perfil
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <PaginationControl currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={(rows as any[]).length} itemsPerPage={PAGE_SIZE} pageSize={__ps} onPageSizeChange={setPageSize} />
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.partners?.full_name || selected.full_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3 text-[12.5px]">
                  <Field label="Tipo" value={selected.person_type === "pj" ? "Pessoa Jurídica" : "Pessoa Física"} />
                  <Field label="E-mail" value={selected.email} />
                  <Field label="Telefone" value={selected.phone} />
                  <Field label="WhatsApp" value={selected.whatsapp} />
                  {selected.person_type === "pf" ? (
                    <>
                      <Field label="CPF" value={selected.cpf} />
                      <Field label="RG" value={selected.rg ? `${selected.rg} ${selected.rg_issuer || ""}` : ""} />
                      <Field label="Nascimento" value={selected.birth_date} />
                      <Field label="Estado civil" value={selected.marital_status} />
                      <Field label="Nacionalidade" value={selected.nationality} />
                      <Field label="Profissão" value={selected.profession} />
                    </>
                  ) : (
                    <>
                      <Field label="Razão social" value={selected.company_name} />
                      <Field label="CNPJ" value={selected.company_cnpj} />
                      <Field label="Representante" value={selected.legal_representative_name} />
                      <Field label="CPF do representante" value={selected.legal_representative_cpf} />
                      <Field label="Cargo do representante" value={selected.legal_representative_role} />
                    </>
                  )}
                  <Field label="CEP" value={selected.address_zip} />
                  <Field label="Endereço" value={[selected.address_street, selected.address_number, selected.address_complement].filter(Boolean).join(", ")} />
                  <Field label="Bairro" value={selected.address_neighborhood} />
                  <Field label="Cidade/UF" value={[selected.address_city, selected.address_state].filter(Boolean).join(" / ")} />
                  <Field label="Banco" value={[selected.bank_name, selected.bank_agency, selected.bank_account].filter(Boolean).join(" ")} />
                  <Field label="PIX" value={selected.pix_key} />
                </div>

                {selected.notes && (
                  <div>
                    <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Observações do parceiro</Label>
                    <p className="text-[13px] text-slate-700 whitespace-pre-wrap mt-1 p-3 bg-slate-50 rounded">{selected.notes}</p>
                  </div>
                )}

                <div className="border-t pt-4">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-slate-600 mb-2">📥 Arquivos devolvidos pelo parceiro</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <UploadSlot label="Contrato assinado" path={selected.contract_signed_path} onDownload={downloadFile} />
                    <UploadSlot label="NDA assinado" path={selected.nda_signed_path} onDownload={downloadFile} />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">Somente o parceiro envia esses arquivos. Para enviar o contrato original ao parceiro, abra o perfil dele (botão "Perfil").</p>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div>
                    <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">Anotações internas</Label>
                    <Textarea defaultValue={selected.admin_notes || ""} id="admin-notes-ta" rows={3} />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {["enviado", "em_analise", "assinado"].map((s) => (
                      <Button key={s} variant={selected.status === s ? "default" : "outline"} size="sm"
                        onClick={() => updateStatus.mutate({ id: selected.id, status: s, admin_notes: (document.getElementById("admin-notes-ta") as HTMLTextAreaElement)?.value })}>
                        Marcar como {STATUS_LABEL[s]}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button>
                {selected.partner_id && (
                  <Button onClick={() => { const pid = selected.partner_id; setSelected(null); navigate(`/parceiros/${pid}`); }} className="gap-2">
                    <ExternalLink className="size-3.5" /> Abrir perfil completo
                  </Button>
                )}
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

function UploadSlot({ label, path, onPick, onDownload }: { label: string; path?: string | null; onPick?: (f: File) => void; onDownload: (p: string) => void }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/40">
      <p className="text-[12px] font-bold text-slate-800 mb-2">{label}</p>
      {path ? (
        <div className="flex items-center justify-between gap-2">
          <button onClick={() => onDownload(path)} className="inline-flex items-center gap-1.5 text-emerald-700 text-[12.5px] hover:underline">
            <Download className="size-3.5" /> Baixar atual
          </button>
          {onPick && (
            <label className="cursor-pointer text-[11.5px] text-indigo-700 hover:underline">
              Substituir
              <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
            </label>
          )}
        </div>
      ) : onPick ? (
        <label className="cursor-pointer inline-flex items-center gap-2 text-[12.5px] text-indigo-700 hover:underline">
          <Upload className="size-3.5" /> Enviar PDF
          <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
        </label>
      ) : (
        <p className="text-[11.5px] text-slate-400 italic">Aguardando envio do parceiro</p>
      )}
    </div>
  );
}
