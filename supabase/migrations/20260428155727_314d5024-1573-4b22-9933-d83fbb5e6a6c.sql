
DO $$
DECLARE
  v_year INT := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
  v_month INT := EXTRACT(MONTH FROM CURRENT_DATE)::INT;
  v_today INT := EXTRACT(DAY FROM CURRENT_DATE)::INT;
  v_partner_ids UUID[];
  v_client_ids UUID[];
  v_product_ids UUID[];
  v_pid UUID;
  v_cid UUID;
  v_prid UUID;
  v_amount NUMERIC;
  v_day INT;
  v_date DATE;
  i INT;
  v_comm_id UUID;
  v_sale_status TEXT;
  v_admin_user UUID;
BEGIN
  IF (SELECT COUNT(*) FROM public.clients) > 5 THEN RETURN; END IF;
  SELECT ARRAY(SELECT id FROM public.products LIMIT 4) INTO v_product_ids;
  IF array_length(v_product_ids, 1) IS NULL THEN RETURN; END IF;
  SELECT id INTO v_admin_user FROM auth.users LIMIT 1;

  INSERT INTO public.partners (full_name, email, phone, document, partner_type, commission_percent, active, pix_key) VALUES
    ('Ricardo Almeida',  'ricardo.almeida@vendx.io', '(11) 98123-4521', '12345678901', 'parceiro',  12, true,  'ricardo@vendx.io'),
    ('Beatriz Carvalho', 'beatriz.c@vendx.io',       '(11) 98712-3344', '98765432102', 'parceiro',  15, true,  '11987123344'),
    ('Diego Marques',    'diego.m@vendx.io',         '(21) 99988-1122', '45678912303', 'indicador', 10, true,  'diego.m@vendx.io'),
    ('Patrícia Lopes',   'patricia.l@vendx.io',      '(31) 98765-4321', '32165498704', 'parceiro',  13, true,  'patricia@vendx.io'),
    ('Felipe Rocha',     'felipe.r@vendx.io',        '(41) 99887-6543', '65432198705', 'parceiro',  11, true,  'felipe@vendx.io'),
    ('Mariana Souza',    'mariana.s@vendx.io',       '(51) 99776-5432', '78912345606', 'indicador', 10, true,  'mariana@vendx.io'),
    ('Rafael Mendes',    'rafael.m@vendx.io',        '(61) 99665-4321', '14725836907', 'parceiro',  14, true,  'rafael@vendx.io'),
    ('Camila Torres',    'camila.t@vendx.io',        '(71) 99554-3210', '25836914708', 'parceiro',  12, true,  'camila@vendx.io'),
    ('Gabriel Pinheiro', 'gabriel.p@vendx.io',       '(81) 99443-2109', '36914725809', 'indicador', 9,  true,  'gabriel@vendx.io'),
    ('Luana Ferreira',   'luana.f@vendx.io',         '(85) 99332-1098', '74185296310', 'parceiro',  13, true,  'luana@vendx.io'),
    ('Tiago Oliveira',   'tiago.o@vendx.io',         '(91) 99221-0987', '85296374111', 'parceiro',  11, false, 'tiago@vendx.io'),
    ('Vanessa Cardoso',  'vanessa.c@vendx.io',       '(48) 99110-9876', '96374185212', 'parceiro',  12, true,  'vanessa@vendx.io');

  SELECT ARRAY(SELECT id FROM public.partners ORDER BY created_at) INTO v_partner_ids;

  FOR i IN 1..40 LOOP
    v_day := 1 + ((i * 2) % v_today);
    v_date := make_date(v_year, v_month, v_day);
    v_pid := v_partner_ids[1 + (i % array_length(v_partner_ids, 1))];
    INSERT INTO public.clients (full_name, email, phone, document, company, city, state, status, partner_id, created_at, updated_at, tags, notes)
    VALUES (
      (ARRAY['João Silva','Maria Oliveira','Pedro Santos','Ana Costa','Carlos Pereira','Juliana Almeida','Lucas Ferreira','Fernanda Lima','Bruno Souza','Camila Rocha','Rodrigo Martins','Gabriela Dias','Marcelo Ribeiro','Patrícia Gomes','Eduardo Castro','Beatriz Mendes','Thiago Cunha','Larissa Barbosa','Vinícius Cardoso','Renata Pinto'])[1 + (i % 20)] || ' ' || (ARRAY['Filho','Júnior','Neto','Sobrinho','Andrade','Moraes','Vasconcelos','Macedo','Tavares','Camargo'])[1 + (i % 10)],
      'cliente' || i || '@empresa.com.br',
      '(11) 9' || lpad(((1000 + i*37) % 10000)::text, 4, '0') || '-' || lpad(((1000 + i*53) % 9000)::text, 4, '0'),
      lpad((10000000000 + i*173)::text, 11, '0'),
      (ARRAY['Construtora Aurora Ltda','Mercado Bem Querer','Tech Solutions Brasil','Auto Peças Premium','Cafeteria do Bairro','Studio Design Pro','Logística Express','Padaria Trigo Dourado','Clínica Vida & Saúde','Farmácia Popular','Restaurante Sabor & Arte','Mecânica Total','Indústria MetalMax','Distribuidora Nordeste','Boutique Elegance','Academia FitPower','Pet Shop Amigo Fiel','Escola Aprender Mais','Imobiliária Lar Doce','Transportadora Veloz'])[1 + (i % 20)],
      (ARRAY['São Paulo','Rio de Janeiro','Belo Horizonte','Curitiba','Porto Alegre','Salvador','Recife','Fortaleza','Brasília','Goiânia','Manaus','Florianópolis'])[1 + (i % 12)],
      (ARRAY['SP','RJ','MG','PR','RS','BA','PE','CE','DF','GO','AM','SC'])[1 + (i % 12)],
      (ARRAY['ativo','ativo','ativo','ativo','prospecto','prospecto','inativo']::client_status[])[1 + (i % 7)],
      v_pid,
      v_date + ((i % 12) || ' hours')::INTERVAL,
      v_date + ((i % 12) || ' hours')::INTERVAL,
      ARRAY[(ARRAY['VIP','Recorrente','Indicado','Quente','Top'])[1 + (i % 5)]]::TEXT[],
      'Cliente seed ' || i
    );
  END LOOP;

  SELECT ARRAY(SELECT id FROM public.clients ORDER BY created_at) INTO v_client_ids;

  FOR i IN 1..80 LOOP
    v_day := 1 + ((i * 7) % v_today);
    v_date := make_date(v_year, v_month, v_day);
    v_cid := v_client_ids[1 + (i % array_length(v_client_ids, 1))];
    v_prid := v_product_ids[1 + (i % array_length(v_product_ids, 1))];
    v_pid := CASE WHEN i % 4 = 0 THEN NULL ELSE v_partner_ids[1 + (i % array_length(v_partner_ids, 1))] END;
    v_amount := 1500 + ((i * 137) % 9500) + (i % 5) * 850;
    v_sale_status := (ARRAY['concluida','concluida','concluida','concluida','em_andamento','pendente','cancelada'])[1 + (i % 7)];
    INSERT INTO public.sales (client_id, product_id, partner_id, amount, sale_date, status, commission_percent, notes, created_at, updated_at)
    VALUES (v_cid, v_prid, v_pid, v_amount, v_date, v_sale_status::sale_status, 10 + (i % 5), 'Venda automática #' || i, v_date + ((i % 18) || ' hours')::INTERVAL, v_date + ((i % 18) || ' hours')::INTERVAL);
  END LOOP;

  FOR v_comm_id IN
    SELECT c.id FROM public.commissions c JOIN public.sales s ON s.id = c.sale_id
    WHERE s.status = 'concluida' ORDER BY random()
    LIMIT (SELECT GREATEST(1, (COUNT(*) * 0.7)::INT) FROM public.commissions)
  LOOP
    UPDATE public.commissions SET status = 'pago',
      paid_at = make_date(v_year, v_month, 1 + (random() * GREATEST(v_today-1,1))::INT)::TIMESTAMP + (random() * interval '12 hours'),
      payment_method = (ARRAY['PIX','Transferência','Boleto'])[1 + (random()*2.99)::INT]
    WHERE id = v_comm_id;
  END LOOP;

  IF v_admin_user IS NOT NULL THEN
    FOR i IN 1..30 LOOP
      v_day := 1 + ((i * 3) % v_today);
      v_date := make_date(v_year, v_month, v_day);
      INSERT INTO public.activities (action, description, entity_type, user_id, created_at, metadata)
      VALUES (
        (ARRAY['Novo cliente cadastrado','Contrato assinado','Comissão paga','Documento enviado','Parceiro ativado','Projeto criado','Venda fechada','Reunião agendada'])[1 + (i % 8)],
        (ARRAY['Cliente Premium adicionado ao funil','Contrato de R$ ' || (5000 + i*200) || ' concluído','Repasse para parceiro processado','CNPJ enviado para análise','Novo parceiro entrou no programa','Projeto inicia em 7 dias','Negociação fechada com sucesso','Reunião marcada com cliente'])[1 + (i % 8)],
        (ARRAY['cliente','contrato','comissao','documento','parceiro','projeto','cliente','contrato'])[1 + (i % 8)],
        v_admin_user, v_date + (((i * 47) % (24*60)) || ' minutes')::INTERVAL, jsonb_build_object('seed', true, 'day', v_day));
    END LOOP;
  END IF;
END$$;
