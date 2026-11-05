# Políticas de acesso (RLS)

405 políticas escritas de forma explícita nas migrations. Políticas criadas por laços dinâmicos não entram aqui: ver [lacunas.md](lacunas.md).

| Tabela | Política | Comando | Papel | Migration |
|---|---|---|---|---|
| `public.activities` | Authenticated can insert activities | INSERT | authenticated | `20260428144839`:235 |
| `public.activities` | Users view own activities | SELECT |  | `20260428144839`:234 |
| `public.activity_goals` | Staff manage activity goals | ALL | authenticated | `20260707002902`:26 |
| `public.activity_logs` | Admins can view activity logs | SELECT |  | `20260507002128`:84 |
| `public.activity_logs` | Authorized users insert demand activity logs | INSERT | authenticated | `20260707014228`:7 |
| `public.activity_logs` | Users read own activity logs | SELECT | authenticated | `20260629101918`:6 |
| `public.audit_logs` | Users can insert own audit logs | INSERT | authenticated | `20260630231150`:4 |
| `public.automation_logs` | Admins insert automation logs | INSERT | authenticated | `20260511231808`:468 |
| `public.automation_logs` | Admins view automation logs | SELECT |  | `20260509215951`:31 |
| `public.automation_rules` | Admins manage automation rules | ALL |  | `20260509215951`:14 |
| `public.cash_accounts` | Cash viewers read | SELECT | authenticated | `20261104120000`:135 |
| `public.cash_opening_balances` | Cash viewers read | SELECT | authenticated | `20261104120000`:135 |
| `public.cash_other_income` | Cash viewers read | SELECT | authenticated | `20261104120000`:135 |
| `public.cash_permissions` | Cash viewers read | SELECT | authenticated | `20261104120000`:135 |
| `public.cash_sale_adjustments` | Cash viewers read | SELECT | authenticated | `20261104120000`:930 |
| `public.cash_settlements` | Cash viewers read | SELECT | authenticated | `20261104120000`:135 |
| `public.chat_messages` | Admins see all chat | SELECT |  | `20260508183232`:29 |
| `public.chat_messages` | Users see own chat | SELECT | authenticated | `20260511232444`:21 |
| `public.chat_messages` | Users send chat | INSERT |  | `20260508183232`:31 |
| `public.chat_messages` | Users update own chat | UPDATE |  | `20260508183232`:32 |
| `public.client_collaborators` | Admins manage client_collaborators | ALL |  | `20260605170316`:67 |
| `public.client_collaborators` | Collaborators view their client links | SELECT |  | `20260605170316`:69 |
| `public.client_document_folder_providers` | admins manage folder providers | ALL | authenticated | `20260701124414`:39 |
| `public.client_document_folder_providers` | provider sees own auth | SELECT | authenticated | `20260701124414`:43 |
| `public.client_document_folders` | admins manage folders | ALL | authenticated | `20260701124414`:17 |
| `public.client_document_folders` | authorized providers see folder | SELECT | authenticated | `20260701124414`:48 |
| `public.client_document_folders` | client sees own folders | SELECT | authenticated | `20260701124414`:21 |
| `public.client_document_requests` | Clients update own client document requests | UPDATE | authenticated | `20260511231808`:335 |
| `public.client_document_requests` | Clients view own client document requests | SELECT | authenticated | `20260511231808`:329 |
| `public.client_document_requests` | Internal team manages client document requests | ALL | authenticated | `20260511231808`:342 |
| `public.client_document_requests` | Partners update related client document requests | UPDATE | authenticated | `20260629190651`:85 |
| `public.client_document_requests` | Partners view related client document requests | SELECT | authenticated | `20260629190651`:77 |
| `public.client_document_requests` | Providers update delegated client document requests | UPDATE | authenticated | `20260511231808`:359 |
| `public.client_document_requests` | Providers view delegated client document requests | SELECT | authenticated | `20260511231808`:353 |
| `public.client_interactions` | Staff manage interactions | ALL | authenticated | `20260518212444`:24 |
| `public.client_journey_stages` | Admins gerenciam estágios | ALL | authenticated | `20260626052438`:159 |
| `public.client_journey_stages` | Internal roles read journey stages | SELECT | authenticated | `20260701014314`:3 |
| `public.client_partners` | Admins manage client_partners | ALL |  | `20260605170316`:21 |
| `public.client_partners` | Partners view their client links | SELECT | authenticated | `20260629190818`:4 |
| `public.client_product_delays` | Admins can manage delays | ALL |  | `20260509235323`:52 |
| `public.client_product_delays` | Participants view related demand delays | SELECT | authenticated | `20260511235413`:47 |
| `public.client_product_financials` | Somente admin acessa valores das demandas | ALL | authenticated | `20261103210000`:33 |
| `public.client_product_pauses` | Admins can manage pauses | ALL |  | `20260509235323`:49 |
| `public.client_product_pauses` | Participants view related demand pauses | SELECT | authenticated | `20260511235413`:69 |
| `public.client_product_providers` | Admins manage demand providers | ALL | authenticated | `20260630233925`:68 |
| `public.client_product_providers` | Collaborators view providers of their demands | SELECT | authenticated | `20260605172037`:49 |
| `public.client_product_providers` | Providers view their demand assignments | SELECT |  | `20260605165827`:29 |
| `public.client_product_quality_checks` | Admins can manage quality checks | ALL |  | `20260509235522`:27 |
| `public.client_product_quality_checks` | Users can view quality checks for their products | SELECT |  | `20260509235522`:30 |
| `public.client_product_status_reports` | Clients view own status reports | SELECT | authenticated | `20260607064433`:139 |
| `public.client_product_status_reports` | Collaborators view related status reports | SELECT | authenticated | `20260607064433`:204 |
| `public.client_product_status_reports` | Internal team manages status reports | ALL | authenticated | `20260607064433`:124 |
| `public.client_product_status_reports` | Partners view related status reports | SELECT | authenticated | `20260607064433`:178 |
| `public.client_product_status_reports` | Providers create own status reports | INSERT | authenticated | `20260607064433`:159 |
| `public.client_product_status_reports` | Providers delete own status reports | DELETE | authenticated | `20260607064433`:172 |
| `public.client_product_status_reports` | Providers update own status reports | UPDATE | authenticated | `20260607064433`:165 |
| `public.client_product_status_reports` | Providers view delegated status reports | SELECT | authenticated | `20260607064433`:153 |
| `public.client_product_status_reports` | Referrers view related status reports | SELECT | authenticated | `20260607064433`:191 |
| `public.client_product_steps` | Clients update visible own product steps | UPDATE | authenticated | `20260607064433`:54 |
| `public.client_product_steps` | Clients view visible own product steps | SELECT | authenticated | `20260607064433`:39 |
| `public.client_product_steps` | Internal team manages client product steps | ALL | authenticated | `20260607064433`:24 |
| `public.client_product_steps` | Partners view visible product steps | SELECT | authenticated | `20260607064433`:86 |
| `public.client_product_steps` | Providers manage delegated product steps | ALL | authenticated | `20260607064433`:79 |
| `public.client_product_steps` | Referrers view visible product steps | SELECT | authenticated | `20260607064433`:100 |
| `public.client_products` | Admins can manage client products | ALL | authenticated | `20260630233925`:60 |
| `public.client_products` | client_products provider via demand_share | SELECT | authenticated | `20260626051143`:139 |
| `public.client_products` | Clients access their own demands | SELECT |  | `20260511180921`:33 |
| `public.client_products` | Colaboradores update assigned demands | UPDATE | authenticated | `20260519105847`:81 |
| `public.client_products` | Colaboradores view assigned demands | SELECT | authenticated | `20260519105847`:71 |
| `public.client_products` | Partners access their referred client products | SELECT | authenticated | `20260519105209`:91 |
| `public.client_products` | Provider updates delegated products | UPDATE | authenticated | `20260519105209`:114 |
| `public.client_products` | Provider views delegated products | SELECT | authenticated | `20260519105209`:107 |
| `public.client_products` | Referrers view referred client products | SELECT | authenticated | `20260519105209`:99 |
| `public.client_products` | Secondary providers view assigned demands | SELECT | authenticated | `20260605172037`:42 |
| `public.client_providers` | Admins manage client_providers | ALL |  | `20260605170316`:90 |
| `public.client_providers` | Providers view their client links | SELECT |  | `20260605170316`:92 |
| `public.client_referrers` | Admins manage client_referrers | ALL |  | `20260605170316`:44 |
| `public.client_referrers` | Referrers view their client links | SELECT |  | `20260605170316`:46 |
| `public.client_stage_history` | Staff insert stage history | INSERT | authenticated | `20260702210914`:15 |
| `public.client_stage_history` | Staff read stage history | SELECT | authenticated | `20260702210914`:6 |
| `public.client_subscriptions` | Admin/vendedor manage subscriptions | ALL |  | `20260506154634`:146 |
| `public.client_subscriptions` | Client views own subscriptions | SELECT |  | `20260506154634`:150 |
| `public.client_support_ticket_messages` | cstm_insert | INSERT | authenticated | `20260701002113`:55 |
| `public.client_support_ticket_messages` | cstm_select | SELECT | authenticated | `20260701002113`:53 |
| `public.client_support_tickets` | cst_admin_delete | DELETE | authenticated | `20260701002113`:33 |
| `public.client_support_tickets` | cst_admin_update | UPDATE | authenticated | `20260701002113`:30 |
| `public.client_support_tickets` | cst_client_insert | INSERT | authenticated | `20260701002113`:28 |
| `public.client_support_tickets` | cst_client_select | SELECT | authenticated | `20260701002113`:26 |
| `public.client_timeline` | Clients view own timeline | SELECT | authenticated | `20260512001647`:33 |
| `public.client_timeline` | Internal team read timeline | SELECT | authenticated | `20260511235057`:40 |
| `public.client_timeline` | Internal team write timeline | INSERT | authenticated | `20260511235057`:52 |
| `public.clients` | Admins total access | ALL | authenticated | `20260512221748`:61 |
| `public.clients` | Admins/vendedores manage clients | ALL |  | `20260428144839`:203 |
| `public.clients` | Admins/vendedores view all clients | SELECT |  | `20260428144839`:198 |
| `public.clients` | Client updates own record | UPDATE | authenticated | `20260701153155`:3 |
| `public.clients` | Client views own record | SELECT |  | `20260428144839`:202 |
| `public.clients` | Colaboradores view assigned clients | SELECT | authenticated | `20260519105847`:61 |
| `public.clients` | Colaboradores view clients by responsible | SELECT | authenticated | `20260519111242`:99 |
| `public.clients` | Partners create referred clients | INSERT | authenticated | `20260513065002`:1 |
| `public.clients` | Partners view their clients | SELECT | authenticated | `20260519105209`:84 |
| `public.clients` | Providers view linked clients | SELECT |  | `20260607034703`:40 |
| `public.clients` | Referrers create referred clients | INSERT | authenticated | `20260513065002`:15 |
| `public.clients` | Referrers view their referred clients | SELECT | authenticated | `20260513064617`:19 |
| `public.clients` | Secondary collaborators view clients | SELECT |  | `20260605170316`:215 |
| `public.clients` | Secondary partners view clients | SELECT |  | `20260605170316`:201 |
| `public.clients` | Secondary providers view clients | SELECT |  | `20260605170316`:222 |
| `public.clients` | Secondary referrers view clients | SELECT |  | `20260605170316`:208 |
| `public.collaborator_products` | Admins manage collaborator products | ALL |  | `20260520153715`:99 |
| `public.collaborator_products` | Collaborators view own product links | SELECT | authenticated | `20260626071425`:55 |
| `public.commission_audit_log` | Admins read commission audit | SELECT | authenticated | `20260702212656`:49 |
| `public.commission_rules` | Admins can manage commission rules | ALL | authenticated | `20260702211125`:7 |
| `public.commission_rules` | Partners can view their own commission rules | SELECT |  | `20260509213341`:47 |
| `public.commission_splits` | Admin manage splits | ALL |  | `20260506154634`:64 |
| `public.commission_splits` | Admin/vendedor view splits | SELECT |  | `20260506154634`:67 |
| `public.commission_splits` | Collaborator view own splits | SELECT |  | `20260506154634`:80 |
| `public.commissions` | Admins manage commissions | ALL |  | `20260511052024`:41 |
| `public.commissions` | Collaborators view their own commissions | SELECT |  | `20260629103323`:30 |
| `public.commissions` | Only admins may write commissions | ALL | authenticated | `20260707014228`:120 |
| `public.companies` | Admins and vendors manage companies | ALL | authenticated | `20260519105847`:96 |
| `public.companies` | Clients can view their own companies | SELECT |  | `20260511180921`:4 |
| `public.companies` | Collaborators view related companies | SELECT | authenticated | `20260519105847`:104 |
| `public.company_contacts` | Clients can view their company contacts | SELECT |  | `20260511180921`:11 |
| `public.company_contacts` | Internal team manages company contacts | ALL | authenticated | `20260511231808`:377 |
| `public.contract_folders` | Admins manage contract folders | ALL | authenticated | `20260701125045`:17 |
| `public.contract_folders` | Clients view own contract folders | SELECT | authenticated | `20260701125045`:21 |
| `public.contract_history` | Admin/Vendedor manage contract history | ALL | authenticated | `20260519105847`:238 |
| `public.contract_history` | Client view own contract history | SELECT | authenticated | `20260508185417`:20 |
| `public.contract_history` | Collaborators view related contract history | SELECT | authenticated | `20260519105847`:246 |
| `public.contract_templates` | Admins manage contract templates | ALL |  | `20260520153715`:34 |
| `public.contract_templates` | Internal roles read contract templates | SELECT | authenticated | `20260526141912`:2 |
| `public.contracts` | Admins and vendors manage contracts | ALL | authenticated | `20260519105847`:215 |
| `public.contracts` | Clients can sign own contracts | UPDATE |  | `20260518231858`:2 |
| `public.contracts` | Clients view own contracts | SELECT |  | `20260511052024`:59 |
| `public.contracts` | Collaborators view related contracts | SELECT | authenticated | `20260519105847`:223 |
| `public.daily_actions` | Admins manage daily actions | ALL | authenticated | `20260514202739`:28 |
| `public.daily_actions` | Internal team views daily actions | SELECT | authenticated | `20260514202739`:36 |
| `public.deduction_types` | Somente admin: tipos de dedução | ALL | authenticated | `20261103220000`:82 |
| `public.demand_comments` | Admins can see all demand comments | ALL |  | `20260509212745`:27 |
| `public.demand_comments` | Authenticated can insert demand comments | INSERT | authenticated | `20260703203824`:52 |
| `public.demand_comments` | Clients can see allowed demand comments | SELECT |  | `20260509212745`:55 |
| `public.demand_comments` | Collaborators view assigned demand comments | SELECT | authenticated | `20260519105209`:340 |
| `public.demand_comments` | Delegated providers can view demand comments | SELECT | authenticated | `20260701124854`:28 |
| `public.demand_comments` | Partners view related demand comments | SELECT | authenticated | `20260519105209`:326 |
| `public.demand_comments` | Providers can see allowed demand comments | SELECT | authenticated | `20260701130804`:72 |
| `public.demand_comments` | Referrers view related demand comments | SELECT | authenticated | `20260519105209`:333 |
| `public.demand_comments` | Shared providers can view demand comments | SELECT | authenticated | `20260701124854`:12 |
| `public.demand_deliveries` | Clients view own demand deliveries | SELECT | authenticated | `20260511231808`:399 |
| `public.demand_deliveries` | Internal team manages demand deliveries | ALL | authenticated | `20260511231808`:388 |
| `public.demand_deliveries` | Partners view related demand deliveries | SELECT | authenticated | `20260519105209`:298 |
| `public.demand_deliveries` | Providers insert delegated demand deliveries | INSERT | authenticated | `20260511231808`:413 |
| `public.demand_deliveries` | Providers update delegated demand deliveries | UPDATE | authenticated | `20260511231808`:419 |
| `public.demand_deliveries` | Providers view delegated demand deliveries | SELECT | authenticated | `20260511231808`:407 |
| `public.demand_deliveries` | Referrers view related demand deliveries | SELECT | authenticated | `20260519105209`:305 |
| `public.demand_request_messages` | Demand message authors can update own messages | UPDATE | authenticated | `20260701144247`:40 |
| `public.demand_request_messages` | Demand message authors or admins can delete messages | DELETE | authenticated | `20260701144247`:69 |
| `public.demand_request_messages` | Demand participants can insert request messages | INSERT | authenticated | `20260701144247`:23 |
| `public.demand_request_messages` | Demand participants can read request messages | SELECT | authenticated | `20260701144247`:7 |
| `public.demand_requests` | Admins gerenciam todas as solicitações | ALL | authenticated | `20260626052438`:69 |
| `public.demand_requests` | Envolvidos criam solicitações | INSERT | authenticated | `20260629190818`:90 |
| `public.demand_requests` | Envolvidos respondem solicitações | UPDATE | authenticated | `20260629190818`:99 |
| `public.demand_requests` | Envolvidos veem solicitações da demanda | SELECT | authenticated | `20260629190818`:84 |
| `public.demand_shares` | demand_shares admin all | ALL | authenticated | `20260626051143`:118 |
| `public.demand_shares` | demand_shares provider self select | SELECT | authenticated | `20260626051143`:120 |
| `public.demand_shares` | demand_shares provider self update | UPDATE | authenticated | `20260626051143`:122 |
| `public.document_history` | Admin/Vendedor manage history | ALL | authenticated | `20260508184325`:16 |
| `public.document_history` | Client view own history | SELECT | authenticated | `20260508184325`:22 |
| `public.document_requests` | Admins can do everything with document requests | ALL |  | `20260506192802`:28 |
| `public.document_requests` | Client inserts own document requests | INSERT | authenticated | `20260701001549`:2 |
| `public.document_requests` | Client updates own document requests | UPDATE |  | `20260508183650`:10 |
| `public.document_requests` | Client views own document requests | SELECT |  | `20260508183650`:5 |
| `public.document_requests` | Partners update related document requests | UPDATE | authenticated | `20260629190651`:108 |
| `public.document_requests` | Partners view related document requests | SELECT | authenticated | `20260629190651`:99 |
| `public.document_requests` | Provider updates delegated requests | UPDATE |  | `20260508192322`:119 |
| `public.document_requests` | Provider views delegated requests | SELECT |  | `20260508192322`:110 |
| `public.document_shares` | admin manage document_shares | ALL | authenticated | `drizzle 0000`:26 |
| `public.document_shares` | provider marks viewed | UPDATE | authenticated | `drizzle 0000`:30 |
| `public.document_shares` | provider reads own shares | SELECT | authenticated | `drizzle 0000`:28 |
| `public.document_shares` | zenon admin gerencia shares | ALL | authenticated | `20261024160000`:57 |
| `public.document_shares` | zenon prestador marca visualizado | UPDATE | authenticated | `20261024160000`:68 |
| `public.document_shares` | zenon prestador ve seus shares | SELECT | authenticated | `20261024160000`:63 |
| `public.document_versions` | Admins and vendors manage document versions | ALL | authenticated | `20260519105847`:129 |
| `public.document_versions` | Clients view their document versions | SELECT | authenticated | `20260518094800`:22 |
| `public.document_versions` | Collaborators view related document versions | SELECT | authenticated | `20260519105847`:137 |
| `public.document_versions` | Partners insert own document versions | INSERT |  | `20260630234559`:15 |
| `public.document_versions` | Partners view own document versions | SELECT |  | `20260630234559`:3 |
| `public.document_versions` | Providers view delegated document versions | SELECT | authenticated | `20260518094800`:30 |
| `public.documents` | Admins/vendedores manage documents | ALL |  | `20260428144839`:227 |
| `public.documents` | Admins/vendedores view all documents | SELECT |  | `20260428144839`:223 |
| `public.documents` | authorized provider reads folder docs | SELECT | authenticated | `20260701124414`:81 |
| `public.documents` | client reads folder docs | SELECT | authenticated | `20260701124414`:71 |
| `public.documents` | client uploads in own folder | INSERT | authenticated | `20260701124414`:61 |
| `public.documents` | Clientes anexam docs nas suas demandas | INSERT | authenticated | `20260703210437`:1 |
| `public.documents` | Clients can update rejected documents | UPDATE |  | `20260509212512`:17 |
| `public.documents` | Clients view own documents | SELECT | authenticated | `20260707013606`:92 |
| `public.documents` | Colaboradores view assigned demand documents | SELECT | authenticated | `20260519105847`:115 |
| `public.documents` | Collaborators update assigned documents | UPDATE | authenticated | `20260605164148`:45 |
| `public.documents` | Collaborators view assigned documents | SELECT | authenticated | `20260605164148`:39 |
| `public.documents` | documents admin insert any | INSERT | authenticated | `20260626051143`:151 |
| `public.documents` | documents provider via demand_share | SELECT | authenticated | `20260626051143`:137 |
| `public.documents` | Partners insert related documents | INSERT | authenticated | `20260629190818`:22 |
| `public.documents` | Partners update own documents | UPDATE |  | `20260630211354`:16 |
| `public.documents` | Partners update related documents | UPDATE | authenticated | `20260703220844`:2 |
| `public.documents` | Partners view own documents | SELECT |  | `20260630211354`:6 |
| `public.documents` | Partners view related documents | SELECT | authenticated | `20260519105209`:123 |
| `public.documents` | Prestadores anexam docs nas suas demandas | INSERT | authenticated | `20260626052438`:215 |
| `public.documents` | provider reads shared documents | SELECT | authenticated | `drizzle 0000`:55 |
| `public.documents` | Provider views delegated documents | SELECT | authenticated | `20260519105209`:147 |
| `public.documents` | Providers update assigned documents | UPDATE | authenticated | `20260605164148`:65 |
| `public.documents` | Providers view assigned documents | SELECT | authenticated | `20260605164148`:53 |
| `public.documents` | Referrers view related documents | SELECT | authenticated | `20260519105209`:135 |
| `public.documents` | Secondary providers view demand documents | SELECT |  | `20260605165827`:111 |
| `public.documents` | zenon prestador le documento compartilhado | SELECT | authenticated | `20261024160000`:75 |
| `public.employees` | Admins and vendedor manage employees | ALL | authenticated | `20260629035554`:13 |
| `public.employees` | Employees view own employee record | SELECT | authenticated | `20260511231808`:437 |
| `public.expenses` | Admin manages expenses | ALL |  | `20260428150955`:102 |
| `public.expenses` | Admin secundário gerencia despesas | ALL |  | `20260702133635`:39 |
| `public.financial_alerts` | Admins and vendors create financial alerts | INSERT | authenticated | `20260519105847`:282 |
| `public.financial_alerts` | Admins and vendors view financial alerts | SELECT | authenticated | `20260519105847`:275 |
| `public.financial_alerts` | Admins manage financial alerts | ALL |  | `20260509213159`:49 |
| `public.financial_visibility` | Somente admin: visibilidade por pessoa | ALL | authenticated | `20261103230000`:45 |
| `public.lead_history` | Internal team reads lead history | SELECT | authenticated | `20260511233653`:219 |
| `public.lead_history` | Internal team writes lead history | INSERT | authenticated | `20260511233653`:229 |
| `public.leads` | Admins total access | ALL | authenticated | `20260512221748`:65 |
| `public.leads` | Colaboradores view assigned leads | SELECT | authenticated | `20260519111242`:110 |
| `public.leads` | Partners view own leads | SELECT |  | `20260511052024`:33 |
| `public.message_templates` | Admins manage templates | ALL |  | `20260508183232`:15 |
| `public.message_templates` | Internal roles read message templates | SELECT | authenticated | `20260526141912`:16 |
| `public.notes` | notes insert scoped | INSERT | authenticated | `20260512001814`:50 |
| `public.notes` | Provider views delegated notes | SELECT | authenticated | `20260512001600`:3 |
| `public.notes` | Users see notes they own or are scoped to | SELECT | authenticated | `20260513021655`:63 |
| `public.notification_preferences` | own prefs delete | DELETE | authenticated | `20260701140044`:22 |
| `public.notification_preferences` | own prefs insert | INSERT | authenticated | `20260701140044`:20 |
| `public.notification_preferences` | own prefs select | SELECT | authenticated | `20260701140044`:19 |
| `public.notification_preferences` | own prefs update | UPDATE | authenticated | `20260701140044`:21 |
| `public.notifications` | Admin creates notifications | INSERT |  | `20260428150955`:86 |
| `public.notifications` | notifications admin insert | INSERT | authenticated | `20260512001859`:7 |
| `public.notifications` | Users can insert own notifications | INSERT | authenticated | `20260510051050`:55 |
| `public.notifications` | Users can update their own notifications | UPDATE |  | `20260508205032`:23 |
| `public.notifications` | Users can view their own notifications | SELECT |  | `20260508205032`:19 |
| `public.notifications` | Users delete own notifications | DELETE | authenticated | `20260512001859`:16 |
| `public.notifications` | Users mark own notifications | UPDATE |  | `20260428150955`:82 |
| `public.notifications` | Users see own notifications | SELECT |  | `20260428150955`:78 |
| `public.nps_responses` | Admin/vendedor view nps | SELECT |  | `20260508183232`:45 |
| `public.nps_responses` | Client submits own nps | INSERT |  | `20260508183232`:46 |
| `public.nps_responses` | Client views own nps | SELECT |  | `20260508183232`:47 |
| `public.onboarding_documents` | Onboarding docs: Admin full access | ALL | authenticated | `20260520021032`:22 |
| `public.onboarding_documents` | Onboarding docs: Client update | UPDATE | authenticated | `20260610223541`:19 |
| `public.onboarding_documents` | Onboarding docs: Client view | SELECT | authenticated | `20260610223541`:13 |
| `public.onboarding_history` | Onboarding history: Admin view | SELECT | authenticated | `20260520021157`:3 |
| `public.onboarding_history` | Onboarding history: Client view | SELECT | authenticated | `20260526111504`:4 |
| `public.partner_contracts` | Internal team manages partner contracts | ALL | authenticated | `20260610215354`:90 |
| `public.partner_contracts` | Partners create own partner contracts | INSERT | authenticated | `20260610220313`:65 |
| `public.partner_contracts` | Partners update own partner contract data | UPDATE |  | `20260629103323`:4 |
| `public.partner_contracts` | Partners view own partner contracts | SELECT | authenticated | `20260610220209`:3 |
| `public.partner_documents` | Admins manage partner_documents | ALL | authenticated | `20260703215352`:23 |
| `public.partner_documents` | Partners update signed slot of own documents | UPDATE | authenticated | `20260703215352`:36 |
| `public.partner_documents` | Partners view their own documents | SELECT | authenticated | `20260703215352`:28 |
| `public.partner_materials` | Clients view active client materials | SELECT |  | `20260702223604`:20 |
| `public.partner_materials` | Collaborators view general materials | SELECT |  | `20260702223604`:32 |
| `public.partner_materials` | Internal team manages partner materials | ALL | authenticated | `20260610215354`:23 |
| `public.partner_materials` | Partners view active partner materials | SELECT | authenticated | `20260610220313`:4 |
| `public.partner_materials` | Providers view active provider materials | SELECT |  | `20260702223604`:8 |
| `public.partner_products` | Admins manage partner_products | ALL |  | `20260428160605`:21 |
| `public.partner_products` | Partner views own products | SELECT |  | `20260428160605`:34 |
| `public.partner_products` | Vendedores view partner_products | SELECT |  | `20260428160605`:28 |
| `public.partner_support_ticket_messages` | Admins manage ticket messages | ALL | authenticated | `20260630231914`:18 |
| `public.partner_support_ticket_messages` | Partners insert own ticket messages | INSERT | authenticated | `20260630231914`:37 |
| `public.partner_support_ticket_messages` | Partners read own ticket messages | SELECT | authenticated | `20260630231914`:25 |
| `public.partner_support_tickets` | Admins manage all support tickets | ALL |  | `20260630191752`:22 |
| `public.partner_support_tickets` | Partners create own support tickets | INSERT |  | `20260630191752`:36 |
| `public.partner_support_tickets` | Partners update own support tickets | UPDATE | authenticated | `20260630231933`:1 |
| `public.partner_support_tickets` | Partners view own support tickets | SELECT |  | `20260630191752`:27 |
| `public.partners` | Admins manage partners | ALL |  | `20260428144839`:195 |
| `public.partners` | Admins total access | ALL | authenticated | `20260512221748`:69 |
| `public.partners` | Admins view all partners | SELECT | authenticated | `20260512001946`:5 |
| `public.partners` | Partners update own record | UPDATE | authenticated | `20260629190651`:61 |
| `public.partners` | Partners view own record | SELECT | authenticated | `20260629190651`:52 |
| `public.payment_audit_log` | Admins read payment audit | SELECT | authenticated | `20260702212656`:22 |
| `public.payments` | Admins and vendors manage payments | ALL | authenticated | `20260519105847`:192 |
| `public.payments` | Clients view own payments | SELECT | authenticated | `20260511231808`:323 |
| `public.payments` | Collaborators view related payments | SELECT | authenticated | `20260519105847`:200 |
| `public.product_deduction_templates` | Somente admin: deduções por produto | ALL | authenticated | `20261103220000`:86 |
| `public.product_document_files` | files delete | DELETE | authenticated | `20260701131523`:108 |
| `public.product_document_files` | files insert | INSERT | authenticated | `20260701131523`:99 |
| `public.product_document_files` | files select | SELECT | authenticated | `20260701131523`:93 |
| `public.product_document_folders` | folders delete | DELETE | authenticated | `20260701131523`:87 |
| `public.product_document_folders` | folders insert | INSERT | authenticated | `20260701131523`:58 |
| `public.product_document_folders` | folders select | SELECT | authenticated | `20260701131523`:52 |
| `public.product_document_folders` | folders update | UPDATE | authenticated | `20260701131523`:80 |
| `public.product_required_documents` | Admins have full access to product_required_documents | ALL |  | `20260507002128`:81 |
| `public.product_steps` | Admins have full access to product_steps | ALL |  | `20260507002128`:80 |
| `public.product_steps` | Internal roles read product steps | SELECT | authenticated | `20260701014314`:12 |
| `public.products` | Admins manage products | ALL |  | `20260428144839`:190 |
| `public.products` | Clients read own linked products | SELECT | authenticated | `20260630235602`:1 |
| `public.products` | Internal roles can read products | SELECT | authenticated | `20260526114747`:3 |
| `public.profiles` | Admins can update all profiles | UPDATE |  | `20260506200310`:16 |
| `public.profiles` | Admins can view all profiles | SELECT |  | `20260428144839`:176 |
| `public.profiles` | Users can insert own profile | INSERT |  | `20260428144839`:178 |
| `public.profiles` | Users can update own profile | UPDATE |  | `20260428144839`:177 |
| `public.profiles` | Users can view own profile | SELECT |  | `20260509211436`:16 |
| `public.profit_reserves` | Admins manage profit reserves | ALL | authenticated | `20260702144834`:19 |
| `public.projects` | Admin/vendedor manage projects | ALL |  | `20260428152947`:43 |
| `public.projects` | Client view own projects | SELECT |  | `20260428152947`:48 |
| `public.projects` | Partner view own projects | SELECT |  | `20260428152947`:52 |
| `public.proposal_items` | Admin/vendedor manage proposal items | ALL |  | `20260510052557`:60 |
| `public.proposal_items` | Client view own proposal items | SELECT |  | `20260510052557`:64 |
| `public.proposals` | Admin/vendedor manage proposals | ALL |  | `20260510052557`:53 |
| `public.proposals` | Client view own proposals | SELECT |  | `20260510052557`:57 |
| `public.provider_interactions` | Provider manages own interactions | ALL | authenticated | `20260518082617`:33 |
| `public.provider_schedule` | Provider manages own schedule | ALL | authenticated | `20260518082617`:64 |
| `public.referrers` | Admins manage referrers | ALL | authenticated | `20260512001946`:19 |
| `public.referrers` | Admins total access | ALL | authenticated | `20260512221748`:73 |
| `public.referrers` | Referrer views own | SELECT |  | `20260506154634`:23 |
| `public.referrers` | Referrers view own record | SELECT | authenticated | `20260512001946`:26 |
| `public.resource_pool_movements` | pool movements admin all | ALL | authenticated | `20260626051143`:77 |
| `public.resource_pools` | pools admin all | ALL | authenticated | `20260626051143`:58 |
| `public.sale_deductions` | Somente admin: deduções da venda | ALL | authenticated | `20261103220000`:90 |
| `public.sale_visibility_overrides` | Somente admin: visibilidade por venda | ALL | authenticated | `20261103230000`:49 |
| `public.sales` | Admins/vendedores manage sales | ALL |  | `20260428144839`:213 |
| `public.sales` | Admins/vendedores view all sales | SELECT |  | `20260428144839`:206 |
| `public.sales` | Collaborators view own sales | SELECT | authenticated | `20260519105847`:178 |
| `public.sales_goals` | sales_goals admin all | ALL | authenticated | `20260626051143`:36 |
| `public.service_assignments` | Admins manage assignments | ALL |  | `20260506194127`:54 |
| `public.service_assignments` | Internal team can view assignments | SELECT |  | `20260506194127`:58 |
| `public.service_provider_products` | Admins manage provider products | ALL |  | `20260520153715`:70 |
| `public.service_provider_products` | Providers view own product links | SELECT |  | `20260520153715`:75 |
| `public.service_providers` | Admins and vendors view service providers | SELECT | authenticated | `20260702210914`:33 |
| `public.service_providers` | Admins delete service providers | DELETE |  | `20260519051920`:26 |
| `public.service_providers` | Admins manage service providers writes | INSERT |  | `20260519051920`:15 |
| `public.service_providers` | Admins total access | ALL | authenticated | `20260512221748`:77 |
| `public.service_providers` | Admins update service providers | UPDATE |  | `20260519051920`:20 |
| `public.service_providers` | Providers update own record | UPDATE | authenticated | `20260701135009`:1 |
| `public.service_providers` | Providers view own provider record | SELECT | authenticated | `20260511231808`:454 |
| `public.signature_stages` | stages_admin_all | ALL | authenticated | `20260703204434`:59 |
| `public.signature_stages` | stages_party_read | SELECT | authenticated | `20260703204434`:63 |
| `public.signature_stages` | stages_party_update_file | UPDATE | authenticated | `20260703204434`:66 |
| `public.support_ticket_messages` | admin all support msgs | ALL | authenticated | `drizzle 0000`:113 |
| `public.support_ticket_messages` | requester reads msgs | SELECT | authenticated | `drizzle 0000`:115 |
| `public.support_ticket_messages` | requester sends msgs | INSERT | authenticated | `drizzle 0000`:117 |
| `public.support_tickets` | admin all support_tickets | ALL | authenticated | `drizzle 0000`:93 |
| `public.support_tickets` | requester creates tickets | INSERT | authenticated | `drizzle 0000`:97 |
| `public.support_tickets` | requester reads own tickets | SELECT | authenticated | `drizzle 0000`:95 |
| `public.system_settings` | Admins can manage system settings | ALL |  | `20260506235128`:34 |
| `public.task_checklist_items` | tci_delete | DELETE | authenticated | `20260518103022`:75 |
| `public.task_checklist_items` | tci_insert | INSERT | authenticated | `20260518103022`:70 |
| `public.task_checklist_items` | tci_select | SELECT | authenticated | `20260518103022`:68 |
| `public.task_checklist_items` | tci_update | UPDATE | authenticated | `20260518103022`:72 |
| `public.task_comments` | tc_delete_own_or_admin | DELETE | authenticated | `20260518103022`:64 |
| `public.task_comments` | tc_insert | INSERT | authenticated | `20260518103022`:60 |
| `public.task_comments` | tc_select | SELECT | authenticated | `20260518103022`:58 |
| `public.task_comments` | tc_update_own | UPDATE | authenticated | `20260518103022`:62 |
| `public.tasks` | Admins manage all tasks | ALL | authenticated | `20260707013606`:83 |
| `public.tasks` | Collaborators create tasks in assigned demands | INSERT | authenticated | `20260520020202`:113 |
| `public.tasks` | Collaborators view related tasks | SELECT | authenticated | `20260519105847`:155 |
| `public.tasks` | Partners create own tasks | INSERT | authenticated | `20260630230425`:10 |
| `public.tasks` | Partners delete own tasks | DELETE |  | `20260703201954`:3 |
| `public.tasks` | Partners update own tasks | UPDATE | authenticated | `20260630230425`:28 |
| `public.tasks` | Partners view own tasks | SELECT | authenticated | `20260630230425`:19 |
| `public.tasks` | Partners view related tasks | SELECT | authenticated | `20260519105209`:348 |
| `public.tasks` | Providers update delegated demand tasks | UPDATE |  | `20260513012136`:12 |
| `public.tasks` | Providers view delegated demand tasks | SELECT |  | `20260513012136`:4 |
| `public.tasks` | Users can view assigned tasks | SELECT |  | `20260509212834`:46 |
| `public.tasks` | Users update own assigned tasks | UPDATE | authenticated | `20260519105847`:169 |
| `public.user_permissions` | Admins can manage all permissions | ALL |  | `20260506234748`:17 |
| `public.user_permissions` | Users can view their own permissions | SELECT |  | `20260506234748`:22 |
| `public.user_roles` | Admins read all user roles | SELECT | authenticated | `20260513021655`:13 |
| `public.user_roles` | Only primary admins delete user roles | DELETE | authenticated | `20260526121312`:37 |
| `public.user_roles` | Only primary admins insert user roles | INSERT | authenticated | `20260526121312`:24 |
| `public.user_roles` | Only primary admins update user roles | UPDATE | authenticated | `20260526121312`:30 |
| `public.user_roles` | Users view own roles | SELECT | authenticated | `20260512031835`:49 |
| `storage.objects` | Admins delete expense receipts | DELETE | authenticated | `20260704093929`:15 |
| `storage.objects` | Admins manage all contracts storage | ALL | authenticated | `20260508185417`:120 |
| `storage.objects` | Admins read expense receipts | SELECT | authenticated | `20260704093929`:2 |
| `storage.objects` | Admins update expense receipts | UPDATE | authenticated | `20260704093929`:10 |
| `storage.objects` | Admins upload expense receipts | INSERT | authenticated | `20260704093929`:6 |
| `storage.objects` | Clients read own contract folder | SELECT | authenticated | `20260511231808`:510 |
| `storage.objects` | Clients read own contracts storage | SELECT | authenticated | `20260701125045`:55 |
| `storage.objects` | Clients upload signed contracts | INSERT | authenticated | `20260701125045`:45 |
| `storage.objects` | documents storage delete internal fast | DELETE | authenticated | `20260630222102`:312 |
| `storage.objects` | documents storage insert fast | INSERT | authenticated | `20260630222102`:294 |
| `storage.objects` | documents storage read fast | SELECT | authenticated | `20260630222102`:287 |
| `storage.objects` | documents storage update fast | UPDATE | authenticated | `20260630222102`:301 |
| `storage.objects` | Internal team manages all contract files | ALL | authenticated | `20260511231808`:503 |
| `storage.objects` | partner contracts storage delete internal fast | DELETE | authenticated | `20260630222102`:345 |
| `storage.objects` | partner contracts storage insert fast | INSERT | authenticated | `20260630222102`:327 |
| `storage.objects` | partner contracts storage read fast | SELECT | authenticated | `20260630222102`:320 |
| `storage.objects` | partner contracts storage update fast | UPDATE | authenticated | `20260630222102`:334 |
| `storage.objects` | partner materials storage delete internal fast | DELETE | authenticated | `20260630222102`:378 |
| `storage.objects` | partner materials storage read fast | SELECT | authenticated | `20260630222102`:353 |
| `storage.objects` | partner materials storage update internal fast | UPDATE | authenticated | `20260630222102`:367 |
| `storage.objects` | partner materials storage write internal fast | INSERT | authenticated | `20260630222102`:360 |
| `storage.objects` | Partners read own contract files | SELECT | authenticated | `20260518100003`:3 |
| `storage.objects` | product-docs delete | DELETE | authenticated | `20260701131523`:136 |
| `storage.objects` | product-docs insert | INSERT | authenticated | `20260701131937`:4 |
| `storage.objects` | product-docs read | SELECT | authenticated | `20260701131937`:14 |
| `storage.objects` | provider reads shared document files | SELECT | authenticated | `drizzle 0000`:57 |
| `storage.objects` | Providers read own contract files | SELECT | authenticated | `20260518100003`:17 |
| `storage.objects` | sig_stage_obj_delete | DELETE | authenticated | `20260703204434`:97 |
| `storage.objects` | sig_stage_obj_insert | INSERT | authenticated | `20260703204434`:90 |
| `storage.objects` | sig_stage_obj_read | SELECT | authenticated | `20260703204434`:87 |
| `storage.objects` | sig_stage_obj_update | UPDATE | authenticated | `20260703204434`:93 |
| `storage.objects` | support_attachments_delete | DELETE | authenticated | `20260630234838`:47 |
| `storage.objects` | support_attachments_insert | INSERT | authenticated | `20260630234838`:35 |
| `storage.objects` | support_attachments_select | SELECT | authenticated | `20260630234838`:23 |
| `storage.objects` | zenon documents storage read via share | SELECT | authenticated | `20261024160000`:81 |
