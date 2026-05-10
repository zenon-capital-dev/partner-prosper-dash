
-- Function: parse @mentions in a comment and create notifications for matched users.
CREATE OR REPLACE FUNCTION public.notify_demand_comment_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mention_token TEXT;
  matched RECORD;
  link_url TEXT;
BEGIN
  link_url := '/demandas/' || NEW.client_product_id::text;

  -- Extract @tokens (letters, digits, underscore, dot, dash)
  FOR mention_token IN
    SELECT DISTINCT (regexp_matches(NEW.content, '@([A-Za-z0-9_.\-]{2,40})', 'g'))[1]
  LOOP
    -- Match against profiles by first name, full name or email prefix (case-insensitive)
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
      VALUES (
        matched.id,
        'Você foi mencionado em uma demanda',
        left(NEW.content, 240),
        'mention',
        link_url
      );
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_demand_comment_mentions ON public.demand_comments;
CREATE TRIGGER trg_notify_demand_comment_mentions
AFTER INSERT ON public.demand_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_demand_comment_mentions();

-- Allow the system / definer-trigger to insert notifications targeting any user.
-- Direct user inserts still blocked unless they target themselves.
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Add admin visibility level (admin-only) to comments enum if missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'comment_visibility' AND e.enumlabel = 'admin'
  ) THEN
    ALTER TYPE public.comment_visibility ADD VALUE 'admin';
  END IF;
END$$;
