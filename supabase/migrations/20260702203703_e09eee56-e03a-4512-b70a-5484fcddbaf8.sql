CREATE OR REPLACE FUNCTION public.log_demand_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.activity_logs (action, entity_type, entity_id, user_id, new_data)
  VALUES ('COMMENT_ADDED', 'client_product', NEW.client_product_id, COALESCE(NEW.author_id, auth.uid()),
          jsonb_build_object(
            'description', 'Comentário: ' || left(COALESCE(NEW.content,''), 140),
            'visibility', NEW.visibility
          ));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'log_demand_comment error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;