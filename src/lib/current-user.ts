import { supabase } from "@/integrations/supabase/client";

/**
 * Robustly resolve the current auth user, handling expired access tokens.
 * Order: getUser() → getSession() → refreshSession(). Returns null only if
 * the user is truly signed out (no refresh token available).
 */
export async function getCurrentUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return user;
  } catch {}

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) return session.user;
  } catch {}

  try {
    const { data } = await supabase.auth.refreshSession();
    if (data?.user) return data.user;
  } catch {}

  return null;
}

export async function getCurrentUserId(): Promise<string | null> {
  const u = await getCurrentUser();
  return u?.id ?? null;
}
