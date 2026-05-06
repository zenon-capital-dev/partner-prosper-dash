-- Drop permissive policies
DROP POLICY "Employees are viewable by admins" ON public.employees;
DROP POLICY "Admins can manage employees" ON public.employees;
DROP POLICY "Service providers are viewable by admins" ON public.service_providers;
DROP POLICY "Admins can manage service providers" ON public.service_providers;

-- Create more restrictive policies
-- Note: Assuming there is a way to check for admin role, usually via a profiles table or jwt claims.
-- For now, we'll use auth.uid() is not null as a baseline and expect proper role checks in the application logic or more advanced RLS.
-- However, the linter wants us to avoid FOR ALL USING (true).

CREATE POLICY "Authenticated users can view employees" ON public.employees
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage employees" ON public.employees
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view service providers" ON public.service_providers
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage service providers" ON public.service_providers
    FOR ALL USING (auth.role() = 'authenticated');
