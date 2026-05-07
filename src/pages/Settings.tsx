import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Building2, Palette, Shield, Bell, FileText, Settings as SettingsIcon } from "lucide-react";

export default function Settings() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  
  const [profile, setProfile] = useState<any>({});
  const [companySettings, setCompanySettings] = useState({
    name: "PROSPER",
    system_name: "PROSPER - Gestão Estratégica",
    primary_color: "#1d4ed8",
    logo_url: "",
    notifications: {
      email: true,
      browser: true
    }
  });

  const { data: prof } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
    enabled: !!user,
  });

  const { data: settings } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("*");
      const obj: any = {};
      data?.forEach(s => obj[s.key] = s.value);
      return obj;
    },
    enabled: isAdmin,
  });

  useEffect(() => { if (prof) setProfile(prof); }, [prof]);
  useEffect(() => { 
    if (settings?.company) setCompanySettings(settings.company); 
  }, [settings]);

  const saveProfile = async () => {
    setLoading(true);
    const { error } = await supabase.from("profiles").update({ full_name: profile.full_name, phone: profile.phone }).eq("id", user!.id);
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Perfil atualizado");
  };

  const saveSystemSettings = async () => {
    if (!isAdmin) return;
    setLoading(true);
    const { error } = await supabase.from("system_settings").upsert({
      key: 'company',
      value: companySettings,
      updated_by: user?.id
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Configurações do sistema atualizadas");
      qc.invalidateQueries({ queryKey: ["system-settings"] });
    }
  };

  return (
    <div className="page-shell space-y-7 animate-fade-in">
      <PageHeader title="Configurações" description="Ajuste as preferências do sistema e dados da empresa." />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex-wrap">
          <TabsTrigger value="profile" className="rounded-lg h-9 gap-2">Meu Perfil</TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="company" className="rounded-lg h-9 gap-2"><Building2 className="size-4" /> Empresa</TabsTrigger>
              <TabsTrigger value="appearance" className="rounded-lg h-9 gap-2"><Palette className="size-4" /> Aparência</TabsTrigger>
              <TabsTrigger value="security" className="rounded-lg h-9 gap-2"><Shield className="size-4" /> Segurança</TabsTrigger>
              <TabsTrigger value="notifications" className="rounded-lg h-9 gap-2"><Bell className="size-4" /> Notificações</TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Dados Pessoais</CardTitle>
              <CardDescription>Mantenha seus contatos atualizados.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Nome</Label><Input value={profile.full_name ?? ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></div>
                <div className="space-y-2"><Label>Email</Label><Input value={profile.email ?? ""} disabled /></div>
                <div className="space-y-2"><Label>Telefone</Label><Input value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
              </div>
              <Button onClick={saveProfile} disabled={loading} className="bg-gradient-primary">Salvar Alterações</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <>
            <TabsContent value="company" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Identidade da Empresa</CardTitle>
                  <CardDescription>Estes dados aparecem em relatórios e no painel do cliente.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome da Empresa</Label>
                      <Input value={companySettings.name} onChange={e => setCompanySettings({...companySettings, name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome do Sistema (White-label)</Label>
                      <Input value={companySettings.system_name} onChange={e => setCompanySettings({...companySettings, system_name: e.target.value})} />
                    </div>
                  </div>
                  <Button onClick={saveSystemSettings} disabled={loading} className="bg-gradient-primary">Atualizar Empresa</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="appearance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Cores e Branding</CardTitle>
                  <CardDescription>Personalize o visual para seus clientes e colaboradores.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Cor Principal (Botões e Destaques)</Label>
                    <div className="flex gap-3">
                      <Input type="color" className="p-1 size-10" value={companySettings.primary_color} onChange={e => setCompanySettings({...companySettings, primary_color: e.target.value})} />
                      <Input className="flex-1" value={companySettings.primary_color} onChange={e => setCompanySettings({...companySettings, primary_color: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Logotipo (URL)</Label>
                    <Input placeholder="https://..." value={companySettings.logo_url} onChange={e => setCompanySettings({...companySettings, logo_url: e.target.value})} />
                  </div>
                  <Button onClick={saveSystemSettings} disabled={loading} className="bg-gradient-primary">Salvar Visual</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Canais de Notificação</CardTitle>
                  <CardDescription>Escolha como deseja ser avisado sobre novas atividades.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label>Notificações por E-mail</Label>
                      <p className="text-xs text-muted-foreground">Novas vendas e documentos recebidos.</p>
                    </div>
                    <Switch checked={companySettings.notifications.email} onCheckedChange={val => setCompanySettings({...companySettings, notifications: {...companySettings.notifications, email: val}})} />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label>Notificações Push / Browser</Label>
                      <p className="text-xs text-muted-foreground">Alertas instantâneos de novas tarefas.</p>
                    </div>
                    <Switch checked={companySettings.notifications.browser} onCheckedChange={val => setCompanySettings({...companySettings, notifications: {...companySettings.notifications, browser: val}})} />
                  </div>
                  <Button onClick={saveSystemSettings} disabled={loading} className="bg-gradient-primary">Salvar Preferências</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
