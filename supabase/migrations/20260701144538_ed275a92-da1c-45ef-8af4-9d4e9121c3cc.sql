REVOKE ALL ON TABLE public.audit_logs FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.demand_request_messages FROM PUBLIC, anon;

GRANT SELECT, INSERT ON TABLE public.audit_logs TO authenticated;
GRANT ALL ON TABLE public.audit_logs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.demand_request_messages TO authenticated;
GRANT ALL ON TABLE public.demand_request_messages TO service_role;