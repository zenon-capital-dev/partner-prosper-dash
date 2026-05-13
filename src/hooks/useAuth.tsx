import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";

type AppRole = "admin" | "admin_secondary" | "colaborador" | "parceiro" | "prestador" | "cliente" | "lead" | "indicador";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isAdminSecondary: boolean;
  isColaborador: boolean;
  isParceiro: boolean;
  isPrestador: boolean;
  isCliente: boolean;
  isLead: boolean;
  isIndicador: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = async (userId: string, attempt = 0): Promise<void> => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (error) throw error;
      const roleList = (data?.map((r: { role: AppRole }) => r.role) as AppRole[]) ?? [];
      if (import.meta.env.DEV) console.log("[auth] roles loaded:", roleList);
      setRoles(roleList);
    } catch (error) {
      console.error("[auth] error fetching roles (attempt " + attempt + "):", error);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        return fetchRoles(userId, attempt + 1);
      }
      // Final failure: keep roles empty so guards can react safely
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    let initialized = false;
    let currentUserId: string | null = null;

    const handleSession = async (sess: Session | null, event?: string) => {
      if (!mounted) return;
      
      const newUserId = sess?.user?.id ?? null;
      if (import.meta.env.DEV) console.log("[auth] session:", event || "initial");

      const userChanged = newUserId !== currentUserId;
      currentUserId = newUserId;
      
      setSession(sess);
      setUser(sess?.user ?? null);
      
      if (sess?.user) {
        if (event === "SIGNED_IN") {
          // Defer to avoid deadlocks inside onAuthStateChange callback
          setTimeout(() => { logAudit("LOGIN", "auth", sess.user.id); }, 0);
        }
        
        // Fetch roles if user changed or it's a critical auth event
        if (userChanged || event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || !initialized) {
          setLoading(true);
          await fetchRoles(sess.user.id);
        } else {
          setLoading(false);
        }
      } else {
        setRoles([]);
        setLoading(false);
      }
      
      initialized = true;
    };

    // 1. Initial session check
    supabase.auth.getSession().then(({ data: { session: sess }, error }) => {
      if (error) {
        console.error("Get session error:", error);
        if (mounted) setLoading(false);
      } else {
        handleSession(sess);
      }
    });

    // 2. Auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      handleSession(sess, event);
    });

    // 3. Safety fallback: force loading false after 10s
    const fallbackTimer = setTimeout(() => {
      if (mounted && loading) {
        console.warn("Auth loading fallback triggered");
        setLoading(false);
      }
    }, 10000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(fallbackTimer);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setRoles([]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        roles,
        loading,
        isAdmin: roles.includes("admin"),
        isAdminSecondary: roles.includes("admin_secondary"),
        isColaborador: roles.includes("colaborador"),
        isParceiro: roles.includes("parceiro"),
        isPrestador: roles.includes("prestador"),
        isCliente: roles.includes("cliente"),
        isLead: roles.includes("lead"),
        isIndicador: roles.includes("indicador"),
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
