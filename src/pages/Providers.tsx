import { useState } from "react";
import { Truck, Search, Plus, Filter, Star, Mail, Phone, MapPin, Briefcase, Wallet, History, CheckCircle2, Clock, AlertCircle, MoreHorizontal, ExternalLink, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export default function Providers() {
  const [selectedProvider, setSelectedProvider] = useState<any>(null);

  const providers = [
    {
      id: "1",
      name: "Alpha Soluções Jurídicas",
      document: "12.345.678/0001-90",
      email: "contato@alphasolucoes.com",
      phone: "(11) 3333-4444",
      whatsapp: "(11) 91234-5678",
      area: "Jurídico",
      services: ["Contratos", "Assessoria Cível", "Propriedade Intelectual"],
      status: "active",
      rating: 4.8,
      has_access: true,
      stats: {
        in_progress: 5,
        completed: 42,
        pending_payment: "R$ 4.500,00",
        total_received: "R$ 28.900,00",
        linked_clients: 8
      }
    },
    {
      id: "2",
      name: "Beta Contabilidade Externa",
      document: "98.765.432/0001-10",
      email: "parceria@betacontabil.com",
      phone: "(11) 4444-5555",
      whatsapp: "(11) 98765-4321",
      area: "Financeiro",
      services: ["BPO Financeiro", "Auditoria", "Impostos"],
      status: "active",
      rating: 4.9,
      has_access: false,
      stats: {
        in_progress: 3,
        completed: 115,
        pending_payment: "R$ 1.200,00",
        total_received: "R$ 52.000,00",
        linked_clients: 12
      }
    }
  ];

  return (
    <div className="page-shell space-y-7">
      <header className="flex items-end justify-between gap-4 flex-wrap pb-2">
        <div className="min-w-0 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <Truck className="size-3 text-primary" />
            Parceiros de Execução
          </div>
          <h1 className="font-display text-[34px] sm:text-[40px] font-bold tracking-[-0.03em] leading-[1.02] text-foreground">
            Prestadores de Serviço
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie fornecedores externos e prestadores de serviço terceirizados.</p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button className="h-9 text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/20">
              <Plus className="size-3.5 mr-2" />
              Novo Prestador
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Cadastrar Prestador de Serviço</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Nome ou Razão Social</Label>
                <Input placeholder="Ex: Alpha Soluções" />
              </div>
              <div className="space-y-2">
                <Label>CPF ou CNPJ</Label>
                <Input placeholder="00.000.000/0001-00" />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" placeholder="contato@empresa.com" />
              </div>
              <div className="space-y-2">
                <Label>Telefone / WhatsApp</Label>
                <Input placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-2">
                <Label>Área de Atuação</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a área" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="juridico">Jurídico</SelectItem>
                    <SelectItem value="financeiro">Financeiro</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="tecnologia">Tecnologia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select defaultValue="active">
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex items-center justify-between p-3 border rounded-lg bg-muted/20">
                <div className="space-y-0.5">
                  <Label>Acesso ao Sistema</Label>
                  <p className="text-xs text-muted-foreground">Permitir que este prestador acompanhe as tarefas delegadas.</p>
                </div>
                <Switch />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Dados Bancários / Pix</Label>
                <textarea 
                  placeholder="Banco, Agência, Conta ou Chave Pix"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" 
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline">Cancelar</Button>
              <Button>Salvar Prestador</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="vx-card p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-10 h-10 text-sm" placeholder="Buscar por serviço, empresa ou categoria..." />
          </div>
          <Button variant="outline" className="h-10 text-xs font-bold px-4">
            <Filter className="size-3.5 mr-2" />
            Filtros
          </Button>
        </div>
      </div>

      <div className="vx-card overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border/50 bg-muted/20">
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Prestador</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Área / Serviços</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center">Clientes</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
              <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((provider) => (
              <tr 
                key={provider.id} 
                className="border-b last:border-0 border-border/40 hover:bg-muted/30 transition-colors group cursor-pointer"
                onClick={() => setSelectedProvider(provider)}
              >
                <td className="px-6 py-4">
                  <Dialog>
                    <DialogTrigger asChild>
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          {provider.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold group-hover:text-primary transition-colors">{provider.name}</p>
                          <p className="text-[10px] text-muted-foreground">{provider.document}</p>
                        </div>
                      </div>
                    </DialogTrigger>
                    
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      {selectedProvider && (
                        <div className="space-y-6">
                          <div className="flex items-start justify-between">
                            <div className="flex gap-4">
                              <div className="size-16 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl font-bold text-slate-500">
                                {selectedProvider.name.charAt(0)}
                              </div>
                              <div>
                                <h2 className="text-2xl font-bold">{selectedProvider.name}</h2>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                                  <span className="flex items-center gap-1"><Mail className="size-3.5" /> {selectedProvider.email}</span>
                                  <span className="flex items-center gap-1"><Phone className="size-3.5" /> {selectedProvider.phone}</span>
                                </div>
                                <div className="flex gap-2 mt-3">
                                  <Badge variant="outline" className="rounded-md border-primary/20 bg-primary/5 text-primary">{selectedProvider.area}</Badge>
                                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-amber-500/20 bg-amber-500/5 text-amber-600 text-[10px] font-bold">
                                    <Star className="size-3 fill-current" /> {selectedProvider.rating}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm">Histórico de Entregas</Button>
                              <Button size="sm">Editar</Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="vx-card p-4">
                              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Em Andamento</p>
                              <div className="flex items-center gap-2">
                                <Clock className="size-4 text-primary" />
                                <span className="text-xl font-bold">{selectedProvider.stats.in_progress}</span>
                              </div>
                            </div>
                            <div className="vx-card p-4">
                              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Concluídos</p>
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="size-4 text-emerald-500" />
                                <span className="text-xl font-bold">{selectedProvider.stats.completed}</span>
                              </div>
                            </div>
                            <div className="vx-card p-4">
                              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">A Receber</p>
                              <div className="flex items-center gap-2">
                                <Wallet className="size-4 text-amber-500" />
                                <span className="text-xl font-bold">{selectedProvider.stats.pending_payment}</span>
                              </div>
                            </div>
                            <div className="vx-card p-4">
                              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Total Pago</p>
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="size-4 text-slate-400" />
                                <span className="text-xl font-bold">{selectedProvider.stats.total_received}</span>
                              </div>
                            </div>
                          </div>

                          <Tabs defaultValue="services" className="w-full">
                            <TabsList className="grid w-full grid-cols-4 h-12">
                              <TabsTrigger value="services">Serviços & Clientes</TabsTrigger>
                              <TabsTrigger value="tasks">Tarefas Delegadas</TabsTrigger>
                              <TabsTrigger value="financial">Financeiro</TabsTrigger>
                              <TabsTrigger value="info">Dados & Notas</TabsTrigger>
                            </TabsList>

                            <TabsContent value="services" className="pt-4">
                              <div className="vx-card overflow-hidden">
                                <table className="w-full text-left">
                                  <thead className="bg-muted/30">
                                    <tr>
                                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-muted-foreground">Cliente</th>
                                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-muted-foreground">Produto/Serviço</th>
                                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-muted-foreground">Status</th>
                                      <th className="px-4 py-3 text-[11px] font-bold uppercase text-muted-foreground text-right">Valor</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {[1, 2].map(i => (
                                      <tr key={i} className="border-t border-border/40 hover:bg-muted/20 transition-colors">
                                        <td className="px-4 py-3">
                                          <div className="flex items-center gap-3">
                                            <div className="size-7 rounded bg-slate-100 flex items-center justify-center font-bold text-[10px]">C{i}</div>
                                            <span className="text-sm font-bold">Cliente {i}</span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm">{selectedProvider.area}</td>
                                        <td className="px-4 py-3">
                                          <Badge variant="default" className="bg-emerald-500 text-[9px]">Em Execução</Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm font-bold">R$ 1.500,00</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </TabsContent>

                            <TabsContent value="tasks" className="pt-4">
                              <div className="space-y-3">
                                {[1, 2].map(i => (
                                  <div key={i} className="flex items-center justify-between p-4 border rounded-xl border-l-4 border-l-primary">
                                    <div className="flex items-center gap-4">
                                      <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        <Briefcase className="size-5 text-primary" />
                                      </div>
                                      <div>
                                        <h4 className="text-sm font-bold">Executar análise técnica de {selectedProvider.area}</h4>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">Vínculo: Cliente {i}</p>
                                      </div>
                                    </div>
                                    <Badge variant="outline" className="text-[10px]">Pendente</Badge>
                                  </div>
                                ))}
                              </div>
                            </TabsContent>

                            <TabsContent value="financial" className="pt-4">
                              <div className="vx-card p-6 border-dashed border-2 flex flex-col items-center justify-center text-center">
                                <Wallet className="size-12 text-muted-foreground/30 mb-4" />
                                <h4 className="text-lg font-bold">Extrato Financeiro</h4>
                                <p className="text-sm text-muted-foreground max-w-xs">Veja todos os repasses realizados e pendências com este prestador.</p>
                                <Button variant="outline" className="mt-4">Ver Relatório Completo</Button>
                              </div>
                            </TabsContent>

                            <TabsContent value="info" className="pt-4">
                              <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-4">
                                  <div>
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Área de Atuação</Label>
                                    <p className="text-sm font-medium mt-1">{selectedProvider.area}</p>
                                  </div>
                                  <div>
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Serviços Executados</Label>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {selectedProvider.services.map((s: string) => (
                                        <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  <div>
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Dados Bancários / Pix</Label>
                                    <p className="text-sm font-medium mt-1 whitespace-pre-wrap">Chave Pix: {selectedProvider.email}\nBanco Inter</p>
                                  </div>
                                  <div>
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Observações Internas</Label>
                                    <p className="text-xs text-muted-foreground mt-1 bg-muted/30 p-3 rounded-lg">Prestador altamente recomendado para casos complexos de {selectedProvider.area}.</p>
                                  </div>
                                </div>
                              </div>
                            </TabsContent>
                          </Tabs>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-bold text-primary">{provider.area}</p>
                    <div className="flex flex-wrap gap-1">
                      {provider.services.slice(0, 2).map((s) => (
                        <span key={s} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[9px] font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <Badge variant="outline" className="rounded-md font-bold text-xs">{provider.stats.linked_clients}</Badge>
                </td>
                <td className="px-6 py-4">
                  <Badge variant="default" className="bg-emerald-500 text-[10px] font-bold uppercase tracking-wider">
                    {provider.status === 'active' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-right">
                  <Button variant="ghost" size="sm" className="h-8 text-[11px] font-bold uppercase">Gerenciar</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}