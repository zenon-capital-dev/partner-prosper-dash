import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileSignature, Upload, Download, FileCheck2, Inbox } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

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
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-partner-contracts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("partner_contracts")
        .select("*, partners(id, full_name, email)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, admin_notes }: any) => {
      const { error } = await (supabase as any).from("partner_contracts").update({ status, admin_notes }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status atualizado"); qc.invalidateQueries({ queryKey: ["admin-partner-contracts"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadSigned = async (row: any, kind: "contract" | "nda", file: File) => {
    try {
      const path = `${row.partner_id}/${kind}-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("partner-contracts").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const patch: any = kind === "contract"
        ? { contract_signed_path: path, contract_uploaded_at: new Date().toISOString() }
        : { nda_signed_path: path, nda_uploaded_at: new Date().toISOString() };
      const { error } = await (supabase as any).from("partner_contracts").update(patch).eq("id", row.id);
      if (error) throw error;
      toast.success("Arquivo enviado");
      qc.invalidateQueries({ queryKey: ["admin-partner-contracts"] });
    } catch (e: any) {
      toast.error(e.message || "Erro no upload");
    }
  };

  const downloadFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("partner-contracts").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) { toast.error("Não foi possível abrir"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <FileSignature className="size-6 text-indigo-700" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Contratos de Parceiros</h1>
            <p className="text-sm text-slate-500">Receba dados, devolva contrato e NDA assinados.</p>
          </div>
        </div>

        <Card className="bg-white border-slate-200/70 shadow-sm">
          <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-700">Submissões</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-slate-500">Carregando...</div>
            ) : rows.length === 0 ? (
              <div className="p-12 text-center">
                <Inbox className="size-10 mx-auto text-slate-300 mb-2" />
                <p className="text-slate-500 text-sm">Nenhum parceiro enviou dados ainda.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Parceiro</th>
                      <th className="text-left px-4 py-3 font-semibold">Tipo</th>
                      <th className="text-left px-4 py-3 font-semibold">Status</th>
                      <th className="text-left px-4 py-3 font-semibold">Enviado em</th>
                      <th className="text-left px-4 py-3 font-semibold">Arquivos</th>
                      <th className="text-right px-4 py-3 font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r: any) => (
                      <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/40">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{r.partners?.full_name || r.full_name || "—"}</p>
                          <p className="text-[11.5px] text-slate-500">{r.partners?.email || r.email}</p>
                        </td>
                        <td className="px-4 py-3 capitalize">{r.person_type === "pj" ? "PJ" : "PF"}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status] || r.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{r.form_submitted_at ? formatDate(r.form_submitted_at) : "—"}</td>
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
                          <Button size="sm" variant="outline" onClick={() => setSelected(r)}>Abrir</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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

                <div className="border-t pt-4 grid sm:grid-cols-2 gap-4">
                  <UploadSlot label="Contrato de Parceria assinado" path={selected.contract_signed_path} onPick={(f) => uploadSigned(selected, "contract", f)} onDownload={downloadFile} />
                  <UploadSlot label="NDA assinado" path={selected.nda_signed_path} onPick={(f) => uploadSigned(selected, "nda", f)} onDownload={downloadFile} />
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
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
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
          <Upload className="size-3.5" /> Enviar PDF assinado
          <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
        </label>
      )}
    </div>
  );
}
