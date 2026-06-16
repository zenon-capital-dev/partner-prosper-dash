import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, startOfWeek, startOfMonth } from "date-fns";

export function useDashboardStats() {
  const now = new Date();
  const today = startOfDay(now).toISOString();
  const weekStart = startOfWeek(now).toISOString();
  const monthStart = startOfMonth(now).toISOString();

  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const results = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("clients").select("id", { count: "exact", head: true }).gte("created_at", today),
        supabase.from("clients").select("id", { count: "exact", head: true }).gte("created_at", weekStart),
        supabase.from("clients").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
        supabase.from("leads").select("id, status"),
        supabase.from("leads").select("id", { count: "exact", head: true }).not("converted_to_client_id", "is", null),
        supabase.from("contracts").select("status"),
        supabase.from("document_requests").select("status"),
        supabase.from("payments").select("amount, amount_paid, status"),
        supabase.from("commissions").select("amount, status"),
        supabase.from("tasks").select("id, status, status_new, due_date"),
        supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(5),
        supabase.from("sales").select("amount, status, sale_date, paid_at, zenon_cost, provider_cost"),
      ]);

      const [
        clientsCount,
        clientsToday,
        clientsWeek,
        clientsMonth,
        leadsData,
        leadsConverted,
        contractsData,
        docsData,
        paymentsData,
        commissionsData,
        tasksData,
        recentActivitiesData,
      ] = results as any[];

      const contracts = contractsData.data || [];
      const docs = docsData.data || [];
      const leads = leadsData.data || [];
      const payments = paymentsData.data || [];
      const commissions = commissionsData.data || [];
      const tasks = tasksData.data || [];
      const recentActivities = recentActivitiesData.data || [];

      const revenueReceived = payments
        .filter((p: any) => p.status === "pago")
        .reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0);
      const revenuePending = payments
        .filter((p: any) => p.status === "pendente" || p.status === "atrasado" || p.status === "parcialmente_pago")
        .reduce((sum: number, p: any) => sum + Number(p.amount || 0) - Number(p.amount_paid || 0), 0);
      const revenueTotal = revenueReceived + revenuePending;

      const commsPaid = commissions
        .filter((c: any) => c.status === "paga" || c.status === "paid")
        .reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
      const commsPending = commissions
        .filter((c: any) => c.status === "gerada" || c.status === "em_analise" || c.status === "aprovada" || c.status === "pending")
        .reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);

      const taskStatus = (t: any) => t.status_new || t.status;
      const isTaskOpen = (t: any) => !["concluida", "cancelada", "completed", "done", "cancelled"].includes(taskStatus(t));
      const overdueTasks = tasks.filter(
        (t: any) => isTaskOpen(t) && t.due_date && new Date(t.due_date) < now
      ).length;

      return {
        clients: {
          total: clientsCount.count || 0,
          today: clientsToday.count || 0,
          week: clientsWeek.count || 0,
          month: clientsMonth.count || 0,
        },
        leads: {
          total: leads.length,
          converted: leadsConverted.count || 0,
          conversionRate: leads.length > 0 ? (leadsConverted.count || 0) / leads.length : 0,
        },
        contracts: {
          total: contracts.length,
          open: contracts.filter((c: any) => c.status === "criado" || c.status === "enviado").length,
          pending: contracts.filter((c: any) => c.status === "aguardando_assinatura").length,
          signed: contracts.filter((c: any) => c.status === "assinado").length,
          cancelled: contracts.filter((c: any) => c.status === "cancelado").length,
        },
        documents: {
          pending: docs.filter((d: any) => d.status === "solicitado" || d.status === "pendente_correcao").length,
          analysis: docs.filter((d: any) => d.status === "enviado" || d.status === "em_analise").length,
          approved: docs.filter((d: any) => d.status === "aprovado").length,
          rejected: docs.filter((d: any) => d.status === "reprovado").length,
        },
        financial: {
          total: revenueTotal,
          received: revenueReceived,
          pending: revenuePending,
        },
        commissions: {
          pending: commsPending,
          paid: commsPaid,
        },
        tasks: {
          open: tasks.filter(isTaskOpen).length,
          overdue: overdueTasks,
        },
        recentActivities: recentActivities.map((a: any) => ({
          id: a.id,
          title: a.action,
          desc: `Ação em ${a.entity_type}`,
          time: new Date(a.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
          date: new Date(a.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        })),
      };
    },
  });
}
