CREATE INDEX IF NOT EXISTS idx_partner_support_tickets_partner_id ON public.partner_support_tickets(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_support_tickets_status_created ON public.partner_support_tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demand_shares_provider_id ON public.demand_shares(provider_id);
CREATE INDEX IF NOT EXISTS idx_demand_shares_client_product_id ON public.demand_shares(client_product_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_desc ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created ON public.activity_logs(user_id, created_at DESC);