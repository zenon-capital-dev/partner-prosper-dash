import { formatBR as format } from "@/lib/datetime";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, User, Users, Wallet, FileSignature, Building2, History, KeyRound, LifeBuoy, Upload, Download, FileCheck2, Send } from "lucide-react";
import { CredentialsManager } from "@/components/CredentialsManager";
import { toast } from "sonner";
import { openDownloadUrl } from "@/lib/download";
import { assertUploadFile, sanitizeStorageFileName, uploadErrorMessage } from "@/lib/uploads";
import { formatBRL } from "@/lib/format";

export default function PartnerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "dados";
  const [partner, setPartner] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [partnerContract, setPartnerContract] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    if (!id) return;
    const [p, cl, comm, ct, pc, tk] = await Promise.all([
      supabase.from("partners").select("*").eq("id", id).maybeSingle(),
      supabase.from("clients").select("*").eq("partner_id", id),
      supabase.from("commission_splits").select("*, sales(clients(full_name), products(name))").eq("beneficiary_type", "partner").eq("beneficiary_id", id).order("created_at", { ascending: false }),
      supabase.from("contracts").select("*").eq("partner_id", id).order("created_at", { ascending: false }),
      (supabase as any).from("partner_contracts").select("*").eq("partner_id", id).maybeSingle(),
      (supabase as any).from("partner_support_tickets").select("*").eq("partner_id", id).order("created_at", { ascending: false }),
    ]);
    setPartner(p.data);
    setClients(cl.data || []);
    setCommissions((comm.data || []).map((c: any) => ({ ...c, clients: c.sales?.clients, products: c.sales?.products })));
    setContracts(ct.data || []);
    setPartnerContract(pc.data || null);
    setTickets(tk.data || []);
  };

  useEffect(() => {
    if (!id) return;
    (async () => { setLoading(true); await reload(); setLoading(false); })();
  }, [id]);

  if (loading) return <div className="p-12 text-center text-muted-foreground">Carregando...</div>;
  if (!partner) return <div className="p-12 text-center text-destructive">Parceiro não encontrado.</div>;

  const paid = commissions.filter((c) => c.status === "pago");
  const pending = commissions.filter((c) => c.status === "pendente");
  const totalPaid = paid.reduce((s, c) => s + Number(c.amount || 0), 0);
  const totalPending = pending.reduce((s, c) => s + Number(c.amount || 0), 0);

  const ensureContractRow = async () => {
    if (partnerContract) return partnerContract;
    const { data, error } = await (supabase as any)
      .from("partner_contracts")
      .insert({ partner_id: id, status: "rascunho", person_type: "pf", full_name: partner.full_name, email: partner.email })
      .select("*")
      .single();
    if (error) throw error;
    setPartnerContract(data);
    return data;
  };

  const uploadContractFile = async (slot: "contract_template" | "nda_template" | "contract_signed" | "nda_signed", file: File) => {
    try {
      assertUploadFile(file);
      const row = await ensureContractRow();
      const path = `${id}/${slot}-${Date.now()}-${sanitizeStorageFileName(file.name)}`;
      const { error: upErr } = await supabase.storage.from("partner-contracts").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const now = new Date().toISOString();
      const patch: any = {
        contract_template: { contract_template_path: path, contract_template_uploaded_at: now, status: row.status === "rascunho" ? "enviado" : row.status },
        nda_template: { nda_template_path: path, nda_template_uploaded_at: now, status: row.status === "rascunho" ? "enviado" : row.status },
        contract_signed: { contract_signed_path: path, contract_uploaded_at: now },
        nda_signed: { nda_signed_path: path, nda_uploaded_at: now },
      }[slot];
      const { error } = await (supabase as any).from("partner_contracts").update(patch).eq("id", row.id);
      if (error) throw error;
      toast.success("Arquivo enviado");
      await reload();
    } catch (e: any) {
      toast.error(uploadErrorMessage(e) || e.message || "Erro no upload");
    }
  };

  const downloadContractFile = async (path: string) => {
    const filename = path.split("/").pop() || "contrato";
    const { data, error } = await supabase.storage
      .from("partner-contracts")
      .createSignedUrl(path, 300, { download: filename });
    if (error || !data?.signedUrl) { toast.error(error?.message || "Não foi possível abrir"); return; }
    openDownloadUrl(data.signedUrl, filename);
  };

  const deleteContractFile = async (slot: "contract_template" | "nda_template" | "contract_signed" | "nda_signed") => {
    if (!partnerContract) return;
    if (!confirm("Excluir este arquivo? Essa ação não pode ser desfeita.")) return;
    try {
      const pathKey = slot === "contract_template" ? "contract_template_path"
        : slot === "nda_template" ? "nda_template_path"
        : slot === "contract_signed" ? "contract_signed_path" : "nda_signed_path";
      const dateKey = slot === "contract_template" ? "contract_template_uploaded_at"
        : slot === "nda_template" ? "nda_template_uploaded_at"
        : slot === "contract_signed" ? "contract_uploaded_at" : "nda_uploaded_at";
      const path = (partnerContract as any)[pathKey];
      if (path) {
        await supabase.storage.from("partner-contracts").remove([path]);
      }
      const { error } = await (supabase as any)
        .from("partner_contracts")
        .update({ [pathKey]: null, [dateKey]: null })
        .eq("id", partnerContract.id);
      if (error) throw error;
      toast.success("Arquivo removido");
      await reload();
    } catch (e: any) {
      toast.error(e.message || "Erro ao excluir");
    }
  };

  const replyTicket = async (ticket: any, status: string) => {
    const notes = (document.getElementById(`ticket-notes-${ticket.id}`) as HTMLTextAreaElement)?.value || ticket.admin_notes || "";
    const { error } = await (supabase as any).from("partner_support_tickets").update({ status, admin_notes: notes, admin_responded_at: new Date().toISOString() }).eq("id", ticket.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Chamado atualizado");
    reload();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" aria-label="Voltar para parceiros" onClick={() => navigate("/parceiros")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{partner.full_name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{partner.partner_category || partner.partner_type || "Parceiro"}</Badge>
            <Badge variant={partner.active ? "default" : "secondary"}>
              {partner.active ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Clientes indicados</p><p className="text-2xl font-bold">{clients.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Comissões pagas</p><p className="text-2xl font-bold">{formatBRL(totalPaid)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">A receber</p><p className="text-2xl font-bold">{formatBRL(totalPending)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">% Padrão</p><p className="text-2xl font-bold">{partner.commission_percent ?? 0}%</p></CardContent></Card>
      </div>

      <Tabs value={initialTab} onValueChange={(v) => { const next = new URLSearchParams(searchParams); next.set("tab", v); setSearchParams(next, { replace: true }); }}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="dados"><User className="h-3 w-3 mr-1" />Dados</TabsTrigger>
          <TabsTrigger value="clientes"><Users className="h-3 w-3 mr-1" />Clientes</TabsTrigger>
          <TabsTrigger value="comissoes"><Wallet className="h-3 w-3 mr-1" />Comissões</TabsTrigger>
          <TabsTrigger value="contrato"><FileSignature className="h-3 w-3 mr-1" />Contrato / NDA</TabsTrigger>
          <TabsTrigger value="suporte"><LifeBuoy className="h-3 w-3 mr-1" />Suporte {tickets.length > 0 && <Badge className="ml-1 h-4 px-1.5 text-[10px]">{tickets.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="bancarios"><Building2 className="h-3 w-3 mr-1" />Bancários</TabsTrigger>
          <TabsTrigger value="historico"><History className="h-3 w-3 mr-1" />Histórico</TabsTrigger>
          <TabsTrigger value="acesso"><KeyRound className="h-3 w-3 mr-1" />Acesso</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4">
          <Card><CardContent className="p-6 grid md:grid-cols-2 gap-4 text-sm">
            <Field label="Nome" value={partner.full_name} />
            <Field label="E-mail" value={partner.email} />
            <Field label="Telefone" value={partner.phone} />
            <Field label="WhatsApp" value={partner.whatsapp} />
            <Field label="Documento" value={partner.document} />
            <Field label="Tipo" value={partner.partner_type} />
            <Field label="Categoria" value={partner.partner_category} />
            <Field label="Comissão padrão" value={`${partner.commission_percent ?? 0}%`} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="clientes" className="mt-4">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Status</TableHead><TableHead>Cadastro</TableHead></TableRow></TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/clientes/${c.id}`)}>
                    <TableCell className="font-medium">{c.full_name}</TableCell>
                    <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                    <TableCell>{format(new Date(c.created_at), "dd/MM/yyyy")}</TableCell>
                  </TableRow>
                ))}
                {clients.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum cliente indicado</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="comissoes" className="mt-4">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Produto</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Data</TableHead></TableRow></TableHeader>
              <TableBody>
                {commissions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.clients?.full_name || "—"}</TableCell>
                    <TableCell>{c.products?.name || "—"}</TableCell>
                    <TableCell>{formatBRL(Number(c.amount || 0))}</TableCell>
                    <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                    <TableCell>{c.paid_at ? format(new Date(c.paid_at), "dd/MM/yyyy") : (c.created_at ? format(new Date(c.created_at), "dd/MM/yyyy") : "—")}</TableCell>
                  </TableRow>
                ))}
                {commissions.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma comissão</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="contrato" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Contrato / NDA do parceiro</p>
                  <p className="text-xs text-muted-foreground">Envie o original, acompanhe e baixe o assinado quando o parceiro devolver.</p>
                </div>
                {partnerContract && (
                  <Badge variant="outline" className="capitalize">{partnerContract.status?.replace("_"," ") || "rascunho"}</Badge>
                )}
              </div>

              <div className="border-t pt-4">
                <p className="text-[11px] uppercase tracking-wider font-bold text-slate-600 mb-2">📤 Enviar originais para o parceiro assinar</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <ContractSlot label="Contrato (original)" path={partnerContract?.contract_template_path} uploadedAt={partnerContract?.contract_template_uploaded_at} onPick={(f) => uploadContractFile("contract_template", f)} onDownload={downloadContractFile} onDelete={() => deleteContractFile("contract_template")} />
                  <ContractSlot label="NDA (original)" path={partnerContract?.nda_template_path} uploadedAt={partnerContract?.nda_template_uploaded_at} onPick={(f) => uploadContractFile("nda_template", f)} onDownload={downloadContractFile} onDelete={() => deleteContractFile("nda_template")} />
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-[11px] uppercase tracking-wider font-bold text-slate-600 mb-2">📥 Devolução assinada pelo parceiro</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <ContractSlot label="Contrato assinado" path={partnerContract?.contract_signed_path} uploadedAt={partnerContract?.contract_uploaded_at} onPick={(f) => uploadContractFile("contract_signed", f)} onDownload={downloadContractFile} onDelete={() => deleteContractFile("contract_signed")} signed />
                  <ContractSlot label="NDA assinado" path={partnerContract?.nda_signed_path} uploadedAt={partnerContract?.nda_uploaded_at} onPick={(f) => uploadContractFile("nda_signed", f)} onDownload={downloadContractFile} onDelete={() => deleteContractFile("nda_signed")} signed />
                </div>
              </div>

              {partnerContract?.notes && (
                <div className="border-t pt-4">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1">Observações do parceiro</p>
                  <p className="text-[13px] text-slate-700 whitespace-pre-wrap p-3 bg-slate-50 rounded">{partnerContract.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {contracts.length > 0 && (
            <Card><CardContent className="p-0">
              <div className="px-4 pt-4 text-xs text-muted-foreground">Outros contratos vinculados</div>
              <Table>
                <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Status</TableHead><TableHead>Validade</TableHead></TableRow></TableHeader>
                <TableBody>
                  {contracts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell><Badge variant="outline">{c.status}</Badge></TableCell>
                      <TableCell>{c.expires_at ? format(new Date(c.expires_at), "dd/MM/yyyy") : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="suporte" className="mt-4">
          <Card>
            <CardContent className="p-5 space-y-3">
              {tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum chamado deste parceiro.</p>
              ) : tickets.map((t) => (
                <div key={t.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-semibold text-slate-900">{t.subject || "Sem assunto"}</p>
                      <p className="text-[11.5px] text-slate-500">{format(new Date(t.created_at), "dd/MM/yyyy HH:mm")} {t.category ? `· ${t.category}` : ""}</p>
                    </div>
                    <Badge variant="outline" className={
                      t.status === "resolvido" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      t.status === "em_andamento" ? "bg-blue-50 text-blue-700 border-blue-200" :
                      "bg-amber-50 text-amber-700 border-amber-200"
                    }>{(t.status || "aberto").replace("_"," ")}</Badge>
                  </div>
                  {t.message && <p className="text-[13px] text-slate-700 whitespace-pre-wrap p-3 bg-slate-50 rounded">{t.message}</p>}
                  <textarea id={`ticket-notes-${t.id}`} defaultValue={t.admin_notes || ""} rows={2} placeholder="Resposta interna / notas..." className="w-full text-[13px] rounded border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => replyTicket(t, "em_andamento")} className="gap-1.5"><Send className="size-3.5" />Em andamento</Button>
                    <Button size="sm" onClick={() => replyTicket(t, "resolvido")} className="gap-1.5"><FileCheck2 className="size-3.5" />Resolver</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bancarios" className="mt-4">
          <Card><CardContent className="p-6 grid md:grid-cols-2 gap-4 text-sm">
            <Field label="Banco" value={partner.bank_name} />
            <Field label="Agência" value={partner.bank_agency} />
            <Field label="Conta" value={partner.bank_account} />
            <Field label="Chave PIX" value={partner.pix_key} />
            {partnerContract && (
              <>
                <Field label="Banco (contrato)" value={partnerContract.bank_name} />
                <Field label="Agência (contrato)" value={partnerContract.bank_agency} />
                <Field label="Conta (contrato)" value={partnerContract.bank_account} />
                <Field label="PIX (contrato)" value={partnerContract.pix_key} />
              </>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <Card><CardContent className="p-4 space-y-2">
            {paid.length === 0 && <p className="text-muted-foreground text-sm text-center">Nenhum pagamento ainda</p>}
            {paid.map((c) => (
              <div key={c.id} className="border rounded p-3 text-sm flex justify-between">
                <div>
                  <p className="font-medium">{formatBRL(Number(c.amount))}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.paid_at ? format(new Date(c.paid_at), "dd/MM/yyyy") : "—"} · {c.payment_method || "—"}
                  </p>
                </div>
                <Badge>Pago</Badge>
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="acesso" className="mt-4">
          <CredentialsManager userId={partner.user_id} currentEmail={partner.email} entityLabel="parceiro" entityType="parceiro" entityId={partner.id} entityName={partner.full_name} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}

function ContractSlot({ label, path, uploadedAt, onPick, onDownload, signed }: { label: string; path?: string | null; uploadedAt?: string | null; onPick: (f: File) => void; onDownload: (p: string) => void; signed?: boolean }) {
  return (
    <div className={`border rounded-lg p-3 ${path ? (signed ? "bg-emerald-50/40 border-emerald-200" : "bg-indigo-50/40 border-indigo-200") : "bg-slate-50/40 border-slate-200"}`}>
      <p className="text-[12px] font-bold text-slate-800 mb-2">{label}</p>
      {path ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => onDownload(path)} className="inline-flex items-center gap-1.5 text-emerald-700 text-[12.5px] hover:underline font-medium">
              <Download className="size-3.5" /> Baixar
            </button>
            <label className="cursor-pointer text-[11.5px] text-indigo-700 hover:underline">
              Substituir
              <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
            </label>
          </div>
          {uploadedAt && <p className="text-[10.5px] text-slate-500">Enviado em {format(new Date(uploadedAt), "dd/MM/yyyy HH:mm")}</p>}
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
