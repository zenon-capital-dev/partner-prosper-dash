import { useState } from "react";
import { UserCircle, Search, Plus, Filter, Mail, Phone, MoreHorizontal, LayoutDashboard, Users, CheckCircle2, Clock, AlertCircle, History, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export default function Collaborators() {
  const [selectedCollaborator, setSelectedCollaborator] = useState<any>(null);

  const collaborators = [
    {
      id: "1",
      name: "Ana Silva",
      email: "ana.silva@empresa.com",
      phone: "(11) 98888-7777",
      role: "Gerente de Contas",
      function: "Atendimento Premium",
      status: "active",
      has_access: true,
      stats: {
        clients: 15,
        in_progress: 10,
        pending: 3,
        completed: 2,
        tasks_open: 8,
        tasks_done: 45,
        tasks_delayed: 1
      }
    },
    {
      id: "2",
      name: "Carlos Souza",
      email: "carlos.souza@empresa.com",
      phone: "(11) 97777-6666",
      role: "Analista Financeiro",
      function: "Gestão de Custos",
      status: "active",
      has_access: true,
      stats: {
        clients: 24,
        in_progress: 18,
        pending: 4,
        completed: 2,
        tasks_open: 12,
        tasks_done: 120,
        tasks_delayed: 0
      }
    }
  ];

  return (
    <div className="page-shell space-y-7">
      <header className="flex items-end justify-between gap-4 flex-wrap pb-2">
        <div className="min-w-0 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            <UserCircle className="size-3 text-primary" />
            Equipe Interna
          </div>
          <h1 className="font-display text-[34px] sm:text-[40px] font-bold tracking-[-0.03em] leading-[1.02] text-foreground">
            Colaboradores
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie sua equipe, permissões e acessos internos.</p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button className="h-9 text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/20">
              <Plus className="size-3.5 mr-2" />
              Novo Colaborador
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Cadastrar Colaborador</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input placeholder="Ex: Ana Silva" />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" placeholder="ana@empresa.com" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Input placeholder="Ex: Gerente de Contas" />
              </div>
              <div className="space-y-2">
                <Label>Função</Label>
                <Input placeholder="Ex: Atendimento Premium" />
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
                  <p className="text-xs text-muted-foreground">Permitir que este colaborador faça login na plataforma.</p>
                </div>
                <Switch />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Observações Internas</Label>
                <textarea className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline">Cancelar</Button>
              <Button>Salvar Colaborador</Button>
            </div>
          </DialogContent>
        </Dialog>
      </header>

      <div className="vx-card p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-10 h-10 text-sm" placeholder="Buscar por nome, cargo ou departamento..." />
          </div>
          <Button variant="outline" className="h-10 text-xs font-bold px-4">
            <Filter className="size-3.5 mr-2" />
            Filtros
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {collaborators.map((collab) => (
          <Dialog key={collab.id}>
            <DialogTrigger asChild>
              <div 
                className="vx-card p-6 flex flex-col items-center text-center group hover:border-primary/30 transition-all cursor-pointer relative"
                onClick={() => setSelectedCollaborator(collab)}
              >
                <div className="absolute top-4 right-4">
                  <Badge variant={collab.status === 'active' ? 'success' : 'secondary'} className="text-[9px] uppercase tracking-wider">
                    {collab.status === 'active' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                
                <div className="relative mb-4">
                  <div className="size-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xl text-slate-500 group-hover:bg-primary group-hover:text-white transition-colors capitalize">
                    {collab.name.charAt(0)}
                  </div>
                  {collab.has_access && (
                    <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-primary border-4 border-card flex items-center justify-center shadow-sm">
                      <LayoutDashboard className="size-2.5 text-white" />
                    </div>
                  )}
                </div>
                
                <h3 className="text-lg font-bold group-hover:text-primary transition-colors">{collab.name}</h3>
                <p className="text-xs text-muted-foreground font-medium mb-1">{collab.role}</p>
                <p className="text-[10px] text-primary font-bold uppercase tracking-wider mb-4 opacity-70">{collab.function}</p>
                
                <div className="w-full pt-4 border-t border-border/50 grid grid-cols-2 gap-2">
                  <div className="text-center p-2 rounded-lg bg-muted/20 group-hover:bg-primary/5 transition-colors">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Clientes</p>
                    <p className="text-sm font-bold">{collab.stats.clients}</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-muted/20 group-hover:bg-primary/5 transition-colors">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Tarefas</p>
                    <p className="text-sm font-bold">{collab.stats.tasks_open}</p>
                  </div>
                </div>
              </div>
            </DialogTrigger>
            
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              {selectedCollaborator && (
                <div className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                        {selectedCollaborator.name.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">{selectedCollaborator.name}</h2>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1"><Mail className="size-3.5" /> {selectedCollaborator.email}</span>
                          <span className="flex items-center gap-1"><Phone className="size-3.5" /> {selectedCollaborator.phone}</span>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Badge variant="outline" className="rounded-md">{selectedCollaborator.role}</Badge>
                          <Badge variant="outline" className="rounded-md opacity-70">{selectedCollaborator.function}</Badge>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">Editar Perfil</Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="vx-card p-4 bg-primary/5 border-primary/10">
                      <div className="flex items-center justify-between mb-2">
                        <Users className="size-4 text-primary" />
                        <Badge className="bg-primary/10 text-primary border-none text-[10px]">Total</Badge>
                      </div>
                      <p className="text-2xl font-bold">{selectedCollaborator.stats.clients}</p>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Clientes Ativos</p>
                    </div>
                    <div className="vx-card p-4 bg-emerald-500/5 border-emerald-500/10">
                      <div className="flex items-center justify-between mb-2">
                        <CheckCircle2 className="size-4 text-emerald-500" />
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-none text-[10px]">Meta</Badge>
                      </div>
                      <p className="text-2xl font-bold">{selectedCollaborator.stats.tasks_done}</p>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Tarefas Concluídas</p>
                    </div>
                    <div className="vx-card p-4 bg-amber-500/5 border-amber-500/10">
                      <div className="flex items-center justify-between mb-2">
                        <Clock className="size-4 text-amber-500" />
                        <Badge className="bg-amber-500/10 text-amber-500 border-none text-[10px]">Fila</Badge>
                      </div>
                      <p className="text-2xl font-bold">{selectedCollaborator.stats.tasks_open}</p>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Tarefas Abertas</p>
                    </div>
                    <div className="vx-card p-4 bg-rose-500/5 border-rose-500/10">
                      <div className="flex items-center justify-between mb-2">
                        <AlertCircle className="size-4 text-rose-500" />
                        <Badge className="bg-rose-500/10 text-rose-500 border-none text-[10px]">Alerta</Badge>
                      </div>
                      <p className="text-2xl font-bold">{selectedCollaborator.stats.tasks_delayed}</p>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Atrasos</p>
                    </div>
                  </div>

                  <Tabs defaultValue="clients" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 h-12">
                      <TabsTrigger value="clients">Clientes</TabsTrigger>
                      <TabsTrigger value="tasks">Tarefas</TabsTrigger>
                      <TabsTrigger value="products">Produtos</TabsTrigger>
                      <TabsTrigger value="history">Histórico</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="clients" className="pt-4">
                      <div className="vx-card overflow-hidden">
                        <table className="w-full text-left">
                          <thead className="bg-muted/30">
                            <tr>
                              <th className="px-4 py-3 text-[11px] font-bold uppercase text-muted-foreground">Cliente</th>
                              <th className="px-4 py-3 text-[11px] font-bold uppercase text-muted-foreground">Status</th>
                              <th className="px-4 py-3 text-[11px] font-bold uppercase text-muted-foreground">Entrada</th>
                              <th className="px-4 py-3 text-[11px] font-bold uppercase text-muted-foreground text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[1, 2, 3].map(i => (
                              <tr key={i} className="border-t border-border/40 hover:bg-muted/20 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="size-8 rounded bg-slate-100 flex items-center justify-center font-bold text-xs">J{i}</div>
                                    <div>
                                      <p className="text-sm font-bold">João Silva {i}</p>
                                      <p className="text-[10px] text-muted-foreground tracking-tight">CPF: 000.000.000-0{i}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge variant={i % 2 === 0 ? "success" : "warning"} className="text-[9px]">
                                    {i % 2 === 0 ? "Finalizado" : "Em Andamento"}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">12/04/2026</td>
                                <td className="px-4 py-3 text-right">
                                  <Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="tasks" className="pt-4">
                      <div className="space-y-3">
                        {[1, 2].map(i => (
                          <div key={i} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/20 transition-colors border-l-4 border-l-amber-500">
                            <div className="flex items-start gap-4">
                              <div className="size-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                                <Clock className="size-5 text-amber-500" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold">Analisar documentação de cliente {i}</h4>
                                <p className="text-xs text-muted-foreground mt-1">Prazo: Amanhã às 14:00</p>
                              </div>
                            </div>
                            <Button variant="outline" size="sm" className="h-8 text-[11px] font-bold">Ver Tarefa</Button>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="products" className="pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {['Gestão Financeira', 'Regularização CPF', 'Jurídico Premium'].map((prod, i) => (
                          <div key={i} className="vx-card p-4 flex items-center gap-4">
                            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Package className="size-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-bold">{prod}</p>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Expertise Nível {i + 1}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent value="history" className="pt-4">
                      <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex gap-3 relative pb-4 border-l-2 border-border ml-3 pl-6 last:border-0 last:pb-0">
                            <div className="absolute -left-[9px] top-0 size-4 rounded-full bg-background border-2 border-primary" />
                            <div>
                              <p className="text-sm font-medium">Alterou status do cliente <span className="font-bold">João Silva</span> para "Finalizado"</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Clock className="size-3" /> Hoje às 15:{i}0
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </DialogContent>
          </Dialog>
        ))}
      </div>
    </div>
  );
}