CREATE OR REPLACE FUNCTION public.notify_demand_comment_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  mention_token TEXT;
  matched RECORD;
  link_url TEXT;
BEGIN
  link_url := '/demandas/' || NEW.client_product_id::text;
  FOR mention_token IN
    SELECT DISTINCT (regexp_matches(COALESCE(NEW.content,''), '@([A-Za-z0-9_.\-]{2,40})', 'g'))[1]
  LOOP
    FOR matched IN
      SELECT p.id
      FROM public.profiles p
      WHERE p.id <> NEW.author_id
        AND (
          p.full_name ILIKE mention_token || '%'
          OR p.full_name ILIKE '% ' || mention_token || '%'
          OR split_part(p.email, '@', 1) ILIKE mention_token
        )
      LIMIT 5
    LOOP
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (matched.id, 'Você foi mencionado em uma demanda', left(NEW.content, 240), 'mention', link_url);
    END LOOP;
  END LOOP;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'notify_demand_comment_mentions error: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$function$;