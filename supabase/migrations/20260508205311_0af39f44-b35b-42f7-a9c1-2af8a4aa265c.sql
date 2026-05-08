-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    target_role public.app_role;
BEGIN
    -- Determine role from metadata, default to 'cliente'
    -- Note: metadata is in new.raw_user_meta_data
    target_role := COALESCE((new.raw_user_meta_data->>'role')::public.app_role, 'cliente'::public.app_role);

    -- Insert into profiles
    INSERT INTO public.profiles (id, full_name, email, active)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', ''),
        new.email,
        true
    );

    -- Insert into user_roles
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, target_role);

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
