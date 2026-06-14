import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Building2, Palette, Shield, Bell, FileText, Users, Package,
  Tag, ListChecks, Wallet, Zap, ArrowRight, Plus, Trash2, Palette as PaletteIcon,
  Database, Download
} from "lucide-react";
import { ThemeCustomizer } from "@/components/ThemeCustomizer";
import { exportFullBackup } from "@/lib/full-backup";


type ListItem = { id: string; label: string };

export default function Settings() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [profile, setProfile] = useState<any>({});
  const [companySettings, setCompanySettings] = useState({
    name: "PROSPER",
    system_name: "PROSPER - Gestão Estratégica",
    cnpj: "",
    address: "",
    phone: "",
    email: "",
    primary_color: "#1d4ed8",
    logo_url: "",
    notifications: { email: true, browser: true, whatsapp: false },
  });
  const [customStatuses, setCustomStatuses] = useState<ListItem[]>([]);
  const [docTemplates, setDocTemplates] = useState<ListItem[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<ListItem[]>([]);

  const { data: prof } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () =>
      (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
    enabled: !!user,
  });

  const { data: settings } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("system_settings").select("*");
      const obj: any = {};
      data?.forEach((s) => (obj[s.key] = s.value));
      return obj;
    },
    enabled: isAdmin,
  });

  useEffect(() => {
    if (prof) setProfile(prof);
  }, [prof]);
  useEffect(() => {
    if (settings?.company) setCompanySettings({ ...companySettings, ...settings.company });
    if (settings?.custom_statuses) setCustomStatuses(settings.custom_statuses);
    if (settings?.doc_templates) setDocTemplates(settings.doc_templates);
    if (settings?.checklist_templates) setChecklistTemplates(settings.checklist_templates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const saveProfile = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: profile.full_name, phone: profile.phone })
      .eq("id", user!.id);
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Perfil atualizado");
  };

  const saveKey = async (key: string, value: any) => {
    if (!isAdmin) return;
    setLoading(true);
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key, value, updated_by: user?.id });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["system-settings"] });
    }
  };

  const ListEditor = ({
    items,
    setItems,
    placeholder,
    onSave,
  }: {
    items: ListItem[];
    setItems: (v: ListItem[]) => void;
    placeholder: string;
    onSave: () => void;
  }) => {
    const [draft, setDraft] = useState("");
    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder={placeholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && draft.trim()) {
                setItems([...items, { id: crypto.randomUUID(), label: draft.trim() }]);
                setDraft("");
              }
            }}
          />
          <Button
            type="button"
            onClick={() => {
              if (!draft.trim()) return;
              setItems([...items, { id: crypto.randomUUID(), label: draft.trim() }]);
              setDraft("");
            }}
          >
            <Plus className="size-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum item cadastrado</p>
          )}
          {items.map((it) => (
            <Badge key={it.id} variant="secondary" className="gap-2 py-1.5">
              {it.label}
              <button
                onClick={() => setItems(items.filter((x) => x.id !== it.id))}
                className="hover:text-destructive"
              >
                <Trash2 className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
        <Button onClick={onSave} disabled={loading} className="bg-gradient-primary">
          Salvar
        </Button>
      </div>
    );
  };

  const ShortcutCard = ({
    icon: Icon,
    title,
    description,
    href,
  }: {
    icon: any;
    title: string;
    description: string;
    href: string;
  }) => (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => navigate(href)}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <Icon className="size-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <ArrowRight className="size-4 text-muted-foreground" />
      </CardContent>
    </Card>
  );

  return (
    <div className="page-shell space-y-7 animate-fade-in">
      <PageHeader
        title="Configurações"
        description="Centralize todas as preferências e regras do sistema."
      />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex-wrap">
          <TabsTrigger value="profile" className="rounded-lg h-9 gap-2">
            Meu Perfil
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="company" className="rounded-lg h-9 gap-2">
                <Building2 className="size-4" /> Empresa
              </TabsTrigger>
              <TabsTrigger value="users" className="rounded-lg h-9 gap-2">
                <Users className="size-4" /> Usuários
              </TabsTrigger>
              <TabsTrigger value="products" className="rounded-lg h-9 gap-2">
                <Package className="size-4" /> Produtos
              </TabsTrigger>
              <TabsTrigger value="status" className="rounded-lg h-9 gap-2">
                <Tag className="size-4" /> Status
              </TabsTrigger>
              {/* <TabsTrigger value="docs" className="rounded-lg h-9 gap-2">
                <FileText className="size-4" /> Templates Doc
              </TabsTrigger> */}
              <TabsTrigger value="checklist" className="rounded-lg h-9 gap-2">
                <ListChecks className="size-4" /> Checklists
              </TabsTrigger>
              <TabsTrigger value="commissions" className="rounded-lg h-9 gap-2">
                <Wallet className="size-4" /> Comissões
              </TabsTrigger>
              <TabsTrigger value="notifications" className="rounded-lg h-9 gap-2">
                <Bell className="size-4" /> Notificações
              </TabsTrigger>
              {/* <TabsTrigger value="automations" className="rounded-lg h-9 gap-2">
                <Zap className="size-4" /> Automações(Desenvolvimento)
              </TabsTrigger> */}
              <TabsTrigger value="appearance" className="rounded-lg h-9 gap-2">
                <Palette className="size-4" /> Aparência
              </TabsTrigger>
              <TabsTrigger value="backup" className="rounded-lg h-9 gap-2">
                <Database className="size-4" /> Backup
              </TabsTrigger>
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
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={profile.full_name ?? ""}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={profile.email ?? ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={profile.phone ?? ""}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={saveProfile} disabled={loading} className="bg-gradient-primary">
                Salvar Alterações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <>
            <TabsContent value="company" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Identidade da Empresa</CardTitle>
                  <CardDescription>
                    Estes dados aparecem em relatórios, contratos e no painel do cliente.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome da Empresa</Label>
                      <Input
                        value={companySettings.name}
                        onChange={(e) =>
                          setCompanySettings({ ...companySettings, name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome do Sistema (White-label)</Label>
                      <Input
                        value={companySettings.system_name}
                        onChange={(e) =>
                          setCompanySettings({ ...companySettings, system_name: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CNPJ</Label>
                      <Input
                        value={companySettings.cnpj}
                        onChange={(e) =>
                          setCompanySettings({ ...companySettings, cnpj: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <Input
                        value={companySettings.phone}
                        onChange={(e) =>
                          setCompanySettings({ ...companySettings, phone: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Endereço</Label>
                      <Input
                        value={companySettings.address}
                        onChange={(e) =>
                          setCompanySettings({ ...companySettings, address: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>E-mail de contato</Label>
                      <Input
                        value={companySettings.email}
                        onChange={(e) =>
                          setCompanySettings({ ...companySettings, email: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() => saveKey("company", companySettings)}
                    disabled={loading}
                    className="bg-gradient-primary"
                  >
                    Atualizar Empresa
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="space-y-4">
              <ShortcutCard
                icon={Users}
                title="Usuários e Permissões"
                description="Gerencie membros da equipe, funções e níveis de acesso."
                href="/usuarios"
              />
              <ShortcutCard
                icon={Shield}
                title="Logs e Auditoria"
                description="Histórico de ações e alterações no sistema."
                href="/auditoria"
              />
            </TabsContent>

            <TabsContent value="products" className="space-y-4">
              <ShortcutCard
                icon={Package}
                title="Produtos e Categorias"
                description="Cadastre serviços, valores, etapas e categorias."
                href="/produtos"
              />
            </TabsContent>

            <TabsContent value="status" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Status Personalizados</CardTitle>
                  <CardDescription>
                    Adicione status próprios para usar em demandas e clientes.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ListEditor
                    items={customStatuses}
                    setItems={setCustomStatuses}
                    placeholder="Ex: Aguardando assinatura"
                    onSave={() => saveKey("custom_statuses", customStatuses)}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* <TabsContent value="docs" className="space-y-4">
              <Card>
...
                description="Modelos de e-mail e WhatsApp para envios automáticos."
                href="/templates"
              />
            </TabsContent> */}

            <TabsContent value="checklist" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Templates de Checklist</CardTitle>
                  <CardDescription>
                    Lista de etapas padrão para novos produtos contratados.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ListEditor
                    items={checklistTemplates}
                    setItems={setChecklistTemplates}
                    placeholder="Ex: Coletar documentos, Análise inicial..."
                    onSave={() => saveKey("checklist_templates", checklistTemplates)}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="commissions" className="space-y-4">
              <ShortcutCard
                icon={Wallet}
                title="Regras de Comissão"
                description="Configure comissões por parceiro, produto e gatilho."
                href="/comissoes"
              />
            </TabsContent>

            <TabsContent value="notifications" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Canais de Notificação</CardTitle>
                  <CardDescription>
                    Escolha como deseja ser avisado sobre novas atividades.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label>E-mail</Label>
                      <p className="text-xs text-muted-foreground">
                        Vendas, documentos e tarefas.
                      </p>
                    </div>
                    <Switch
                      checked={companySettings.notifications.email}
                      onCheckedChange={(val) =>
                        setCompanySettings({
                          ...companySettings,
                          notifications: { ...companySettings.notifications, email: val },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label>Push / Browser</Label>
                      <p className="text-xs text-muted-foreground">
                        Alertas instantâneos no navegador.
                      </p>
                    </div>
                    <Switch
                      checked={companySettings.notifications.browser}
                      onCheckedChange={(val) =>
                        setCompanySettings({
                          ...companySettings,
                          notifications: { ...companySettings.notifications, browser: val },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label>WhatsApp</Label>
                      <p className="text-xs text-muted-foreground">
                        Lembretes via mensagem.
                      </p>
                    </div>
                    <Switch
                      checked={companySettings.notifications.whatsapp}
                      onCheckedChange={(val) =>
                        setCompanySettings({
                          ...companySettings,
                          notifications: { ...companySettings.notifications, whatsapp: val },
                        })
                      }
                    />
                  </div>
                  <Button
                    onClick={() => saveKey("company", companySettings)}
                    disabled={loading}
                    className="bg-gradient-primary"
                  >
                    Salvar Preferências
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* <TabsContent value="automations" className="space-y-4">
              <ShortcutCard
                icon={Zap}
                title="Automações(Desenvolvimento) Internas"
                description="Configure gatilhos automáticos para notificações e ações."
                href="/automacoes"
              />
            </TabsContent> */}

            <TabsContent value="appearance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Cores e Branding</CardTitle>
                  <CardDescription>
                    Personalize o visual para seus clientes e colaboradores.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-6 border rounded-xl bg-muted/30 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <PaletteIcon className="size-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold">Personalização Avançada</p>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        Ajuste as cores principais, barra lateral e arredondamento de bordas em toda a plataforma com pré-visualização ao vivo.
                      </p>
                    </div>
                    <ThemeCustomizer />
                  </div>
                  
                  <div className="space-y-2 opacity-50 pointer-events-none">
                    <Label>Logotipo (URL)</Label>
                    <Input
                      placeholder="https://..."
                      value={companySettings.logo_url}
                      onChange={(e) =>
                        setCompanySettings({ ...companySettings, logo_url: e.target.value })
                      }
                    />
                  </div>
                  <Button
                    onClick={() => saveKey("company", companySettings)}
                    disabled={loading}
                    className="bg-gradient-primary"
                  >
                    Salvar Visual
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="backup" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="size-5 text-indigo-600" /> Backup completo da plataforma
                  </CardTitle>
                  <CardDescription>
                    Gera uma planilha Excel (.xlsx) com <strong>todas as informações</strong> do sistema:
                    usuários, clientes, vendas, produtos, prestadores, colaboradores, comissões,
                    pagamentos, documentos, contratos, tarefas, leads e tudo mais. Os dados são lidos
                    ao vivo do banco — toda exportação contém as informações <strong>do momento do clique</strong>.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    A geração pode demorar de 30 segundos a alguns minutos, dependendo do volume.
                    Mantenha a aba aberta até o download iniciar. Cada tabela vira uma planilha (aba)
                    do arquivo, mais uma aba <code>_resumo</code> com a contagem de registros.
                  </div>
                  <Button
                    size="lg"
                    onClick={() => exportFullBackup()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                  >
                    <Download className="size-4" /> Exportar backup completo (.xlsx)
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Recomendação: gere e arquive este backup <strong>diariamente</strong> ou antes de
                    qualquer mudança grande. Guarde em local seguro (Google Drive, Dropbox, HD externo).
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

          </>
        )}
      </Tabs>
    </div>
  );
}
