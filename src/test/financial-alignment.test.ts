import { describe, expect, it } from "vitest";
import { expectedCommission, allocatePayment, canRevertToProjected, type FPayment } from "@/lib/financeEngine";
import { paymentReceivedYm } from "@/lib/financial";

describe('alinhamento com cascata e caixa', () => {
  const sale = { id:'s', status:'pendente', amount:1000, sale_date:'2025-01-01', zenon_cost:200, provider_cost:100, partner_id:'p',commission_percent:10,referrer_id:'r',referrer_percent:5,collaborator_id:'c',collaborator_percent:5 };
  it('todos os beneficiários usam 700 líquidos: 70 + 35 + 35', () => expect(expectedCommission(sale)).toBe(140));
  it('deduções acima do bruto não geram comissão negativa', () => expect(expectedCommission({...sale,zenon_cost:2000})).toBe(0));
  it('mantém regra explícita dos contratos legados ainda não convertidos', () => expect(expectedCommission({...sale,deduction_model:'legado'})).toBe(180));
  it('sem beneficiário não há comissão', () => expect(expectedCommission({...sale,partner_id:null,referrer_id:null,collaborator_id:null})).toBe(0));
  it('entrada perto da virada do mês usa Brasília', () => expect(paymentReceivedYm({paid_at:'2025-02-01T02:59:00Z'})).toBe('2025-01'));
  it('sem data não inventa mês de caixa', () => expect(paymentReceivedYm({paid_at:null})).toBeNull());
  const p: FPayment = {id:'a',sale_id:'s',amount:100,amount_paid:0,status:'pendente',due_date:'2025-02-01',paid_at:null};
  it('excedente nunca vai a outra venda ou vencimento anterior', () => {
    expect(allocatePayment(p,150,[p,{...p,id:'b',sale_id:'other'},{...p,id:'c',due_date:'2025-01-01'},{...p,id:'d',due_date:'2025-03-01'}])).toEqual([{id:'a',add:100},{id:'d',add:50}]);
  });
  it('retorno bloqueado mesmo se pagamento registrado tiver data futura', () => expect(canRevertToProjected('s',[{...p,amount_paid:1,paid_at:'2999-01-01'}],'2025-01-01')).toBe(false));
});
