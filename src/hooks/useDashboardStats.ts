import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, startOfWeek, startOfMonth, subDays } from "date-fns";

export function useDashboardStats() {
  const now = new Date();
  const today = startOfDay(now).toISOString();
  const weekStart = startOfWeek(now).toISOString();
  const monthStart = startOfMonth(now).toISOString();

  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [
        clientsCount,
        clientsToday,
        clientsWeek,
        clientsMonth,
        leadsCount,
        leadsConverted,
        contractsCount,
        docsCount,
        paymentsSummary,
        commissionsSummary,
        tasksSummary,
      ] = await Promise.all([
        // Total Clients
        supabase.from("clients").select("id", { count: "exact", head: true }),
        // New Clients Today
        supabase.from("clients").select("id", { count: "exact", head: true }).gte("created_at", today),
        // New Clients Week
        supabase.from("clients").select("id", { count: "exact", head: true }).gte("created_at", weekStart),
        // New Clients Month
        supabase.from("clients").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
        // Leads
        supabase.from("leads").select("id, status"),
        // Converted Leads (using converted_to_client_id)
        supabase.from("leads").select("id", { count: "exact", head: true }).not("converted_to_client_id", "is", null),
        // Contracts by Status
        supabase.from("contracts").select("status"),
        // Documents by Status
        supabase.from("document_requests").select("status"),
        // Payments (Revenue)
        supabase.from("payments").select("amount, amount_paid, status"),
        // Commissions
        supabase.from("commissions").select("amount, status"),
        // Tasks
        supabase.from("tasks").select("id, status, due_date"),
        // Recent Activities
        supabase.from("activity_logs").select("*, profiles(full_name)").order("created_at", { ascending: false }).limit(5),
      ] as any);

      const contracts = contractsCount.data || [];
      const docs = docsCount.data || [];
      const leads = leadsCount.data || [];
      const payments = paymentsSummary.data || [];
      const commissions = commissionsSummary.data || [];
      const tasks = tasksSummary.data || [];
      const recentActivities = recentActivitiesSummary?.data || [];

      const revenueReceived = payments
        .filter((p) => p.status === "pago")
        .reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);
      const revenuePending = payments
        .filter((p) => p.status === "pendente" || p.status === "atrasado" || p.status === "parcialmente_pago")
        .reduce((sum, p) => sum + Number(p.amount || 0) - Number(p.amount_paid || 0), 0);
      const revenueTotal = revenueReceived + revenuePending;

      const commsPaid = commissions
        .filter((c) => c.status === "paga" || c.status === "paid")
        .reduce((sum, c) => sum + Number(c.amount || 0), 0);
      const commsPending = commissions
        .filter((c) => c.status === "gerada" || c.status === "em_analise" || c.status === "aprovada" || c.status === "pending")
        .reduce((sum, c) => sum + Number(c.amount || 0), 0);

      const overdueTasks = tasks.filter(
        (t) => t.status !== "concluida" && t.status !== "completed" && t.due_date && new Date(t.due_date) < now
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
          open: contracts.filter((c) => c.status === "criado" || c.status === "enviado").length,
          pending: contracts.filter((c) => c.status === "aguardando_assinatura").length,
          signed: contracts.filter((c) => c.status === "assinado").length,
          cancelled: contracts.filter((c) => c.status === "cancelado").length,
        },
        documents: {
          pending: docs.filter((d) => d.status === "solicitado" || d.status === "pendente_correcao").length,
          analysis: docs.filter((d) => d.status === "enviado" || d.status === "em_analise").length,
          approved: docs.filter((d) => d.status === "aprovado").length,
          rejected: docs.filter((d) => d.status === "reprovado").length,
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
          open: tasks.filter((t) => t.status !== "concluida" && t.status !== "completed").length,
          overdue: overdueTasks,
        },
      };
    },
  });
}
