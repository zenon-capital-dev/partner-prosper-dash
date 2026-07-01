
ALTER TABLE public.clients
  ADD CONSTRAINT clients_collaborator_id_fkey FOREIGN KEY (collaborator_id) REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD CONSTRAINT clients_indicator_id_fkey    FOREIGN KEY (indicator_id)    REFERENCES public.referrers(id) ON DELETE SET NULL,
  ADD CONSTRAINT clients_provider_id_fkey     FOREIGN KEY (provider_id)     REFERENCES public.service_providers(id) ON DELETE SET NULL;

ALTER TABLE public.sales
  ADD CONSTRAINT sales_collaborator_id_fkey FOREIGN KEY (collaborator_id) REFERENCES public.employees(id) ON DELETE SET NULL;

ALTER TABLE public.commissions
  ADD CONSTRAINT commissions_client_product_id_fkey FOREIGN KEY (client_product_id) REFERENCES public.client_products(id) ON DELETE SET NULL;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_client_product_id_fkey FOREIGN KEY (client_product_id) REFERENCES public.client_products(id) ON DELETE SET NULL;
ALTER TABLE public.notes
  ADD CONSTRAINT notes_client_product_id_fkey FOREIGN KEY (client_product_id) REFERENCES public.client_products(id) ON DELETE CASCADE;
ALTER TABLE public.client_document_requests
  ADD CONSTRAINT cdr_client_product_id_fkey FOREIGN KEY (client_product_id) REFERENCES public.client_products(id) ON DELETE SET NULL;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_client_id_fkey  FOREIGN KEY (client_id)  REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD CONSTRAINT projects_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE SET NULL,
  ADD CONSTRAINT projects_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.daily_actions
  ADD CONSTRAINT daily_actions_client_id_fkey         FOREIGN KEY (client_id)         REFERENCES public.clients(id) ON DELETE CASCADE,
  ADD CONSTRAINT daily_actions_client_product_id_fkey FOREIGN KEY (client_product_id) REFERENCES public.client_products(id) ON DELETE CASCADE;

ALTER TABLE public.nps_responses
  ADD CONSTRAINT nps_responses_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_converted_sale_id_fkey FOREIGN KEY (converted_sale_id) REFERENCES public.sales(id) ON DELETE SET NULL;

ALTER TABLE public.products
  ADD CONSTRAINT products_recommended_contract_model_id_fkey
    FOREIGN KEY (recommended_contract_model_id) REFERENCES public.contract_templates(id) ON DELETE SET NULL;

ALTER TABLE public.client_collaborators
  ADD CONSTRAINT client_collaborators_collaborator_id_fkey
    FOREIGN KEY (collaborator_id) REFERENCES public.employees(id) ON DELETE CASCADE;
