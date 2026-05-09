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

  const fetchRoles = async (userId: string) => {
    console.log("Fetching roles for user:", userId);
    try {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (error) throw error;
      const roleList = (data?.map((r) => r.role) as AppRole[]) ?? [];
      console.log("Roles fetched:", roleList);
      setRoles(roleList);
    } catch (error) {
      console.error("Error fetching roles:", error);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    let rolesFetched = false;

    const initAuth = async () => {
      try {
        const { data: { session: sess }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (!mounted) return;
        
        console.log("Auth initialized. Session:", sess ? "active" : "none");
        setSession(sess);
        setUser(sess?.user ?? null);
        
        if (sess?.user && !rolesFetched) {
          rolesFetched = true;
          await fetchRoles(sess.user.id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Auth init error:", error);
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, sess) => {
      if (!mounted) return;
      console.log("Auth state change:", event, sess?.user?.id);
      
      setSession(sess);
      setUser(sess?.user ?? null);
      
      if (sess?.user) {
        if (event === "SIGNED_IN") {
          logAudit("LOGIN", "auth", sess.user.id);
        }
        
        // Prevent re-fetching roles multiple times on same session mount
        if (!rolesFetched || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          rolesFetched = true;
          setLoading(true);
          await fetchRoles(sess.user.id);
        }
      } else {
        setRoles([]);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
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
