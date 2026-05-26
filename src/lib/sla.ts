import { differenceInBusinessDays, differenceInCalendarDays, parseISO } from "date-fns";
import { isTodayBR, toBR, nowBR } from "./datetime";

export type SLAStatus = 'no_prazo' | 'atencao' | 'vence_hoje' | 'atrasado' | 'pausado' | 'concluido';

export interface SLAMetrics {
  startDate: Date;
  dueDate: Date | null;
  daysRemaining: number | null;
  status: SLAStatus;
  isOverdue: boolean;
  isExpiringSoon: boolean;
}

export function calculateSLA(
  startDateStr: string | null,
  dueDateStr: string | null,
  currentStatus: string,
  dayType: 'calendar' | 'working' = 'working'
): SLAMetrics | null {
  if (!startDateStr) return null;

  const start = toBR(startDateStr);
  const due = dueDateStr ? toBR(dueDateStr) : null;
  const now = nowBR();

  if (currentStatus === 'concluido') {
    return {
      startDate: start,
      dueDate: due,
      daysRemaining: 0,
      status: 'concluido',
      isOverdue: false,
      isExpiringSoon: false
    };
  }

  if (currentStatus === 'pausado') {
    return {
      startDate: start,
      dueDate: due,
      daysRemaining: due ? (dayType === 'working' ? differenceInBusinessDays(due, now) : differenceInCalendarDays(due, now)) : null,
      status: 'pausado',
      isOverdue: false,
      isExpiringSoon: false
    };
  }

  let daysRemaining = null;
  let isOverdue = false;
  let isExpiringSoon = false;
  let status: SLAStatus = 'no_prazo';

  if (due) {
    daysRemaining = dayType === 'working' 
      ? differenceInBusinessDays(due, now) 
      : differenceInCalendarDays(due, now);
    
    // Use zoned dates for comparison
    isOverdue = due < now && !isTodayBR(due);
    
    if (isOverdue) {
      status = 'atrasado';
    } else if (isTodayBR(due)) {
      status = 'vence_hoje';
      isExpiringSoon = true;
    } else if (daysRemaining <= 2) {
      status = 'atencao';
      isExpiringSoon = true;
    }
  }

  return {
    startDate: start,
    dueDate: due,
    daysRemaining,
    status,
    isOverdue,
    isExpiringSoon
  };
}

export function getSLAStatusLabel(status: SLAStatus): string {
  const labels: Record<SLAStatus, string> = {
    no_prazo: "No Prazo",
    atencao: "Atenção",
    vence_hoje: "Vence Hoje",
    atrasado: "Atrasado",
    pausado: "Pausado",
    concluido: "Concluído"
  };
  return labels[status];
}
