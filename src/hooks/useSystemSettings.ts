import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SystemContact {
  support_whatsapp: string;        // E.164 sem +, ex: 5511999999999
  support_email: string;
  company_name: string;
}

const DEFAULTS: SystemContact = {
  support_whatsapp: "5511999999999",
  support_email: "suporte@prosper.com",
  company_name: "Prosper",
};

export function useSystemSettings() {
  const { data } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["support_whatsapp", "support_email", "company_name"]);
      const map: any = {};
      (data ?? []).forEach((row: any) => {
        const v = typeof row.value === "string" ? row.value : row.value?.value ?? row.value;
        if (v) map[row.key] = String(v);
      });
      return { ...DEFAULTS, ...map } as SystemContact;
    },
    staleTime: 5 * 60 * 1000,
  });
  return data ?? DEFAULTS;
}

export function buildWhatsAppLink(phone: string | undefined | null, message?: string) {
  const clean = (phone ?? "").replace(/\D/g, "");
  if (!clean) return "#";
  return `https://wa.me/${clean}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export function buildMailtoLink(email: string, subject?: string) {
  return `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
}
