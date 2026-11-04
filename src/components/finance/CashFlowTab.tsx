import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBRL } from "@/lib/format";
import { ymdBR, nowBR } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Download, History, Landmark, Plus, Search } from "lucide-react";
import { invalidateFinancialData } from "@/lib/invalidateFinancial";
import {
  CashLine, CashMonth, CashSettlement, SITUATION_LABEL, cashCanAccess, cashConfirmHistoric, cashCreateEntry, cashCsv,
  cashHistory, cashMonth, cashReverse, cashSetOpeningBalance, cashSettle, formatCashDate, isCashSchemaMissing, newIdempotencyKey,
} from "@/lib/cashFlow";

const monthOptions = () => {
  const now = new Date();
  const list: { value: string; label: string }[] = [];
  for (let i = -24; i <= 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    list.push({ value, label: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) });
  }
  return list.reverse();
};

const situationTone: Record<string, string> = {
  liquidado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  parcial: "bg-sky-50 text-sky-700 border-sky-200",
  parcial_atrasado: "bg-rose-50 text-rose-700 border-rose-200",
  atrasado: "bg-rose-50 text-rose-700 border-rose-200",
  pendente: "bg-amber-50 text-amber-700 border-amber-200",
};

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "in" | "out" | "warn" }) {
  return (
    <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn("mt-1 text-xl font-bold tabular-nums text-slate-900",
        tone === "in" && "text-emerald-700", tone === "out" && "text-rose-700", tone === "warn" && "text-amber-700")}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

export function CashFlowTab() {
  const qc = useQueryClient();
  const today = ymdBR(nowBR());
  const [ym, setYm] = useState(today.slice(0, 7));
  const [includeOverdue, setIncludeOverdue] = useState(false);
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("todas");
  const [situation, setSituation] = useState("todas");
  const [settling, setSettling] = useState<CashLine | null>(null);
  const [historyOf, setHistoryOf] = useState<CashLine | null>(null);
  const [newEntry, setNewEntry] = useState<"entrada" | "saida" | null>(null);
  const [openingOpen, setOpeningOpen] = useState(false);
  const months = useMemo(monthOptions, []);

  const access = useQuery({ queryKey: ["fin-cash-access"], queryFn: cashCanAccess, retry: false, staleTime: 5 * 60_000 });
  const query = useQuery({
    queryKey: ["fin-cash-month", ym, includeOverdue],
    queryFn: () => cashMonth(ym, includeOverdue),
    enabled: access.data === true,
    retry: false,
    staleTime: 15_000,
  });
  const data = query.data as CashMonth | undefined;

  const lines = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.lines ?? []).filter((l) => {
      if (direction !== "todas" && l.direction !== direction) return false;
      if (situation !== "todas" && l.situation !== situation) return false;
      if (q && !`${l.description} ${l.counterparty ?? ""} ${l.origin_label}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, direction, situation, search]);

  const hasFilter = direction !== "todas" || situation !== "todas" || !!search.trim();
  const refresh = () => invalidateFinancialData(qc);

  if (access.isLoading) return <Panel>Carregando…</Panel>;
  if (access.error && isCashSchemaMissing(access.error)) {
    return <Panel tone="warn">O banco ainda não recebeu a atualização do fluxo de caixa. Esta tela funciona depois que as migrations forem aplicadas.</Panel>;
  }
  if (access.error) return <Panel tone="warn">Não foi possível verificar seu acesso: {(access.error as any).message}</Panel>;
  if (!access.data) return <Panel tone="warn">Você não tem permissão para ver o caixa consolidado. Peça a liberação a um administrador.</Panel>;

  const exportCsv = () => {
    if (!data) return;
    const blob = new Blob([cashCsv({ ...data, lines })], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fluxo_de_caixa_${ym}${hasFilter ? "_filtrado" : ""}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const money = (v: number | null | undefined) => (v === null || v === undefined ? "Não configurado" : formatBRL(Number(v)));

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm p-4 flex flex-wrap items-center gap-3">
        <Select value={ym} onValueChange={setYm}>
          <SelectTrigger className="w-[210px] h-9 bg-white capitalize"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-72">
            {months.map((m) => <SelectItem key={m.value} value={m.value} className="capitalize">{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpeningOpen(true)}><Landmark className="size-4 mr-1" />Saldo inicial</Button>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!data}><Download className="size-4 mr-1" />Exportar</Button>
          <Button size="sm" variant="outline" onClick={() => setNewEntry("saida")}><Plus className="size-4 mr-1" />Nova saída</Button>
          <Button size="sm" onClick={() => setNewEntry("entrada")}><Plus className="size-4 mr-1" />Nova entrada</Button>
        </div>
      </div>

      {query.error && <Panel tone="warn">Não foi possível carregar o mês: {(query.error as any).message}</Panel>}
      {query.isLoading && <Panel>Carregando o mês…</Panel>}

      {data && (
        <>
          {!data.opening_configured && (
            <Notice>Saldo inicial não configurado. A tela mostra o resultado das movimentações, não o dinheiro disponível.</Notice>
          )}
          {Number(data.nao_confirmado) !== 0 && (
            <Notice>{formatBRL(Number(data.nao_confirmado))} em repasses marcados como pagos antes deste controle estão fora do saldo, porque não há confirmação de pagamento real. Confirme no histórico de cada repasse.</Notice>
          )}
          <p className="text-[12px] text-slate-500">
            {data.period === "atual" && <>Realizado até {formatCashDate(data.cutoff)}.</>}
            {data.period === "passado" && <>Fechamento realizado do mês.</>}
            {data.period === "futuro" && <>Mês futuro: o saldo inicial é projetado a partir do saldo de hoje.</>}
            {" "}Realizado usa a data efetiva. Pendente usa o vencimento.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label={data.opening_projected ? "Saldo inicial projetado" : "Saldo inicial"} value={money(data.opening)} hint={data.opening_reference_date ? `Base: saldo informado em ${formatCashDate(data.opening_reference_date)}` : undefined} />
            <Stat label="Entradas realizadas" value={formatBRL(Number(data.entradas_realizadas))} tone="in" />
            <Stat label="Saídas realizadas" value={formatBRL(Number(data.saidas_realizadas))} tone="out" />
            <Stat label="Saldo realizado" value={money(data.saldo_realizado)} hint={`Resultado do mês: ${formatBRL(Number(data.resultado_realizado))}`} />
            <Stat label="Entradas pendentes" value={formatBRL(Number(data.entradas_pendentes))} hint="Vencem neste mês" />
            <Stat label="Saídas pendentes" value={formatBRL(Number(data.saidas_pendentes))} hint="Vencem neste mês" />
            <Stat label="Saldo projetado" value={money(data.saldo_projetado)} hint={includeOverdue ? "Inclui atrasados de meses anteriores" : "Não inclui atrasados de meses anteriores"} />
            <Stat label="Atrasados" value={`${formatBRL(Number(data.atrasados_receber))} a receber`} hint={`${formatBRL(Number(data.atrasados_pagar))} a pagar`} tone="warn" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-slate-600">
            <span>Vendido no mês (concluídas, pela data da venda; não é caixa): <strong className="text-slate-900 tabular-nums">{formatBRL(Number(data.vendido_mes))}</strong></span>
            <label className="flex items-center gap-2">
              <Switch checked={includeOverdue} onCheckedChange={setIncludeOverdue} />
              Incluir atrasados na projeção
            </label>
          </div>

          <div className="bg-white border border-slate-200/70 rounded-lg shadow-sm">
            <div className="p-4 flex flex-wrap items-center gap-3 border-b border-slate-100">
              <div className="relative">
                <Search className="size-4 absolute left-2.5 top-2.5 text-slate-400" />
                <Input className="pl-8 h-9 w-[240px] bg-white" placeholder="Buscar descrição ou favorecido" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger className="w-[140px] h-9 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Entradas e saídas</SelectItem>
                  <SelectItem value="entrada">Entradas</SelectItem>
                  <SelectItem value="saida">Saídas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={situation} onValueChange={setSituation}>
                <SelectTrigger className="w-[160px] h-9 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as situações</SelectItem>
                  {Object.entries(SITUATION_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              {hasFilter && (
                <Button size="sm" variant="ghost" onClick={() => { setSearch(""); setDirection("todas"); setSituation("todas"); }}>
                  Limpar filtros ({lines.length} de {data.lines.length})
                </Button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">Descrição</th>
                    <th className="px-3 py-2 text-left">Origem</th>
                    <th className="px-3 py-2 text-left">Vencimento</th>
                    <th className="px-3 py-2 text-left">Efetiva</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                    <th className="px-3 py-2 text-right">Liquidado</th>
                    <th className="px-3 py-2 text-right">Saldo</th>
                    <th className="px-3 py-2 text-left">Situação</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-500">Nenhum lançamento {hasFilter ? "com estes filtros" : "neste mês"}.</td></tr>}
                  {lines.map((l) => (
                    <tr key={`${l.source_type}:${l.source_id}`} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {l.direction === "entrada" ? <ArrowDownCircle className="size-4 shrink-0 text-emerald-600" /> : <ArrowUpCircle className="size-4 shrink-0 text-rose-600" />}
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{l.description}</p>
                            <p className="text-[11px] text-slate-500 truncate">{l.counterparty ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {l.origin_label}
                        {!l.in_projection && <Badge variant="outline" className="ml-1 text-[10px]">Venda em negociação</Badge>}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatCashDate(l.due_date)}{l.from_previous_month && <span className="ml-1 text-[10px] text-rose-600">mês anterior</span>}</td>
                      <td className="px-3 py-2 tabular-nums">{formatCashDate(l.last_effective)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatBRL(Number(l.amount))}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatBRL(Number(l.settled))}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{formatBRL(Number(l.balance))}</td>
                      <td className="px-3 py-2"><Badge variant="outline" className={cn("text-[10px]", situationTone[l.situation])}>{SITUATION_LABEL[l.situation]}</Badge></td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          {Number(l.balance) > 0 && (
                            <Button size="sm" className="h-7" onClick={() => setSettling(l)}>{l.direction === "entrada" ? "Receber" : "Pagar"}</Button>
                          )}
                          <Button size="sm" variant="outline" className="h-7" onClick={() => setHistoryOf(l)}><History className="size-3.5 mr-1" />Histórico</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {settling && <SettleDialog line={settling} onClose={() => setSettling(null)} onDone={refresh} />}
      {historyOf && <HistoryDialog line={historyOf} onClose={() => setHistoryOf(null)} onDone={refresh} />}
      {newEntry && <EntryDialog direction={newEntry} onClose={() => setNewEntry(null)} onDone={refresh} />}
      {openingOpen && <OpeningDialog onClose={() => setOpeningOpen(false)} onDone={refresh} />}
    </div>
  );
}

function Panel({ children, tone }: { children: React.ReactNode; tone?: "warn" }) {
  return <div className={cn("bg-white border rounded-lg p-6 text-sm", tone === "warn" ? "border-amber-200 text-amber-800" : "border-slate-200/70 text-slate-500")}>{children}</div>;
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
      <AlertTriangle className="size-4 mt-0.5 shrink-0" /><span>{children}</span>
    </div>
  );
}

const METHODS = ["pix", "boleto", "transferencia", "cartao", "dinheiro", "outro"];

function SettleDialog({ line, onClose, onDone }: { line: CashLine; onClose: () => void; onDone: () => void }) {
  const isIn = line.direction === "entrada";
  const [amount, setAmount] = useState(String(Number(line.balance).toFixed(2)));
  const [date, setDate] = useState(ymdBR(nowBR()));
  const [method, setMethod] = useState("pix");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  // A mesma chave acompanha todas as tentativas deste formulário: reenvio não duplica.
  const [key] = useState(newIdempotencyKey);

  const submit = async () => {
    setSaving(true);
    try {
      await cashSettle({ sourceType: line.source_type, sourceId: line.source_id, amount: Number(amount), date, method, notes: notes || null, key });
      toast.success(isIn ? "Recebimento registrado" : "Pagamento registrado");
      await onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Não foi possível registrar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-white max-w-md">
        <DialogHeader>
          <DialogTitle>{isIn ? "Registrar recebimento" : "Registrar pagamento"}</DialogTitle>
          <DialogDescription>{line.description} · {line.counterparty ?? "—"}. Saldo em aberto: {formatBRL(Number(line.balance))}.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Valor</Label><Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div><Label>Data efetiva</Label><Input type="date" max={ymdBR(nowBR())} value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="col-span-2">
            <Label>Forma</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Observação</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Salvando…" : isIn ? "Registrar recebimento" : "Registrar pagamento"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const KIND_LABEL = { liquidacao: "Pagamento", estorno: "Estorno", devolucao: "Devolução" } as const;
const ORIGIN_LABEL = { acao: "Fluxo de caixa", captura: "Outra tela", historico: "Histórico" } as const;

function HistoryDialog({ line, onClose, onDone }: { line: CashLine; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const queryKey = ["fin-cash-history", line.source_type, line.source_id];
  const { data = [], isLoading, error } = useQuery({ queryKey, queryFn: () => cashHistory(line.source_type, line.source_id) });
  const [reversing, setReversing] = useState<CashSettlement | null>(null);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState(newIdempotencyKey);

  const openAmount = (s: CashSettlement) =>
    Number(s.amount) - data.filter((x) => x.reverses_id === s.id).reduce((t, x) => t + Number(x.amount), 0);

  const start = (s: CashSettlement) => { setReversing(s); setAmount(openAmount(s).toFixed(2)); setReason(""); setKey(newIdempotencyKey()); };
  const refresh = async () => { await qc.invalidateQueries({ queryKey }); await onDone(); };

  const confirmReverse = async () => {
    if (!reversing) return;
    setSaving(true);
    try {
      await cashReverse({ settlementId: reversing.id, amount: Number(amount), reason, key });
      toast.success("Estorno registrado");
      setReversing(null);
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Não foi possível estornar");
    } finally {
      setSaving(false);
    }
  };

  const confirmHistoric = async (s: CashSettlement) => {
    try {
      await cashConfirmHistoric(s.id);
      toast.success("Pagamento confirmado");
      await refresh();
    } catch (e: any) {
      toast.error(e.message || "Não foi possível confirmar");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico</DialogTitle>
          <DialogDescription>{line.description} · {line.counterparty ?? "—"} · {line.origin_label}</DialogDescription>
        </DialogHeader>
        {isLoading && <p className="text-sm text-slate-500">Carregando…</p>}
        {error && <p className="text-sm text-rose-700">{(error as any).message}</p>}
        {!isLoading && data.length === 0 && <p className="text-sm text-slate-500">Nenhum pagamento lançado.</p>}
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {data.map((s) => (
            <div key={s.id} className="border border-slate-200 rounded-md px-3 py-2 text-[13px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{KIND_LABEL[s.kind]} · {formatCashDate(s.effective_date)} · {formatBRL(Number(s.amount))}</span>
                <span className="flex gap-1">
                  {!s.verified && s.kind === "liquidacao" && <Button size="sm" variant="outline" className="h-7" onClick={() => confirmHistoric(s)}>Confirmar</Button>}
                  {s.kind === "liquidacao" && openAmount(s) > 0 && <Button size="sm" variant="outline" className="h-7" onClick={() => start(s)}>Estornar</Button>}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Registrado por {ORIGIN_LABEL[s.origin]}{s.payment_method ? ` · ${s.payment_method}` : ""}{!s.verified ? " · sem confirmação" : ""}
                {s.reason ? ` · Motivo: ${s.reason}` : ""}{s.notes ? ` · ${s.notes}` : ""}
              </p>
            </div>
          ))}
        </div>
        {reversing && (
          <div className="border-t border-slate-100 pt-3 grid grid-cols-3 gap-3">
            <div><Label>Valor do estorno</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="col-span-2"><Label>Motivo</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
            <div className="col-span-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReversing(null)}>Voltar</Button>
              <Button onClick={confirmReverse} disabled={saving || !reason.trim()}>{saving ? "Salvando…" : "Confirmar estorno"}</Button>
            </div>
          </div>
        )}
        <DialogFooter>
          {line.sale_id && <Button variant="outline" onClick={() => navigate("/vendas")}>Abrir Vendas</Button>}
          {line.client_id && <Button variant="outline" onClick={() => navigate(`/clientes/${line.client_id}`)}>Abrir cliente</Button>}
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EntryDialog({ direction, onClose, onDone }: { direction: "entrada" | "saida"; onClose: () => void; onDone: () => void }) {
  const isIn = direction === "entrada";
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(ymdBR(nowBR()));
  const [realized, setRealized] = useState(false);
  const [category, setCategory] = useState(isIn ? "outras_receitas" : "");
  const [counterparty, setCounterparty] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [key] = useState(newIdempotencyKey);

  const submit = async () => {
    setSaving(true);
    try {
      await cashCreateEntry({
        direction, description, amount: Number(amount), date, realized,
        category: category || null, counterparty: counterparty || null, notes: notes || null, key,
      });
      toast.success(isIn ? "Entrada registrada" : "Saída registrada");
      await onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Não foi possível registrar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-white max-w-md">
        <DialogHeader>
          <DialogTitle>{isIn ? "Nova entrada" : "Nova saída"}</DialogTitle>
          <DialogDescription>
            {isIn ? "Use para o que não vem de venda. Recebimento de parcela é registrado na própria parcela, pelo botão Receber." : "Fica registrada também em Despesas."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Descrição</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><Label>Valor</Label><Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div>
            <Label>{realized ? "Data efetiva" : "Vencimento"}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="col-span-2 flex items-center gap-2 text-sm">
            <Switch checked={realized} onCheckedChange={setRealized} />
            {realized ? "Já aconteceu" : "Ainda vai acontecer"}
          </div>
          {isIn ? (
            <div className="col-span-2">
              <Label>Natureza</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outras_receitas">Outras receitas</SelectItem>
                  <SelectItem value="aporte">Aporte (não é receita)</SelectItem>
                  <SelectItem value="reembolso_recebido">Reembolso recebido</SelectItem>
                  <SelectItem value="transferencia_externa">Transferência externa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="col-span-2"><Label>Categoria</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Outros" /></div>
          )}
          <div className="col-span-2"><Label>{isIn ? "Cliente ou origem" : "Favorecido"}</Label><Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} /></div>
          <div className="col-span-2"><Label>Observação</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Salvando…" : "Registrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OpeningDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(ymdBR(nowBR()));
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await cashSetOpeningBalance(date, Number(amount), reason);
      toast.success("Saldo registrado");
      await onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Não foi possível registrar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-white max-w-md">
        <DialogHeader>
          <DialogTitle>Saldo inicial</DialogTitle>
          <DialogDescription>Informe o saldo real no fim do dia escolhido. Os meses seguintes são calculados a partir dele, sem redigitar. Um novo saldo substitui o anterior, e o anterior fica registrado.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Data do saldo</Label><Input type="date" max={ymdBR(nowBR())} value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>Valor</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="col-span-2"><Label>Motivo ou origem</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: saldo do extrato bancário" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || !reason.trim() || amount === ""}>{saving ? "Salvando…" : "Registrar saldo"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
