
CREATE OR REPLACE FUNCTION public.populate_client_product_from_template()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    p_record RECORD;
    step_item JSONB;
    doc_item JSONB;
    task_item JSONB;
    v_pos INTEGER := 0;
BEGIN
    SELECT * INTO p_record FROM public.products WHERE id = NEW.product_id;
    IF p_record.id IS NOT NULL THEN
        NEW.status := COALESCE(NEW.status, p_record.initial_status, 'aguardando_inicio');
        IF p_record.standard_steps IS NOT NULL AND jsonb_array_length(p_record.standard_steps) > 0 THEN
            FOR step_item IN SELECT jsonb_array_elements(p_record.standard_steps) LOOP
                INSERT INTO public.client_product_steps (client_product_id, label, position, status)
                VALUES (NEW.id, step_item->>'label', v_pos, 'pendente'::step_status);
                v_pos := v_pos + 1;
            END LOOP;
        END IF;
        IF p_record.required_documents IS NOT NULL AND jsonb_array_length(p_record.required_documents) > 0 THEN
            FOR doc_item IN SELECT jsonb_array_elements(p_record.required_documents) LOOP
                INSERT INTO public.documents (client_id, client_product_id, name, status, is_required)
                VALUES (NEW.client_id, NEW.id, doc_item->>'name', 'solicitado'::document_status_new, true);
            END LOOP;
        END IF;
        IF p_record.auto_tasks_template IS NOT NULL AND jsonb_array_length(p_record.auto_tasks_template) > 0 THEN
            FOR task_item IN SELECT jsonb_array_elements(p_record.auto_tasks_template) LOOP
                INSERT INTO public.tasks (title, description, status, priority, related_type, related_id, user_id)
                VALUES (task_item->>'title', task_item->>'description', 'todo',
                        (task_item->>'priority')::public.demand_priority, 'client_product', NEW.id, auth.uid());
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
