import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Clients() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients", search],
    queryFn: async () => {
      let q = supabase
        .from("clients")
        .select("id, full_name, email, phone, company, status, created_at, partners(full_name)")
        .order("created_at", { ascending: false });
      if (search) q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este cliente? Todas as vendas e documentos vinculados serão removidos.")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Cliente excluído");
      qc.invalidateQueries({ queryKey: ["clients"] });
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto animate-fade-in">
      <PageHeader
        title="Clientes"
        description="Gerencie sua carteira de clientes e contratos."
        actions={
          <Button onClick={() => setOpen(true)} className="gap-2 bg-gradient-primary hover:opacity-90">
            <Plus className="size-4" /> Novo Cliente
          </Button>
        }
      />

      <div className="vx-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <span className="text-xs text-muted-foreground">{clients?.length ?? 0} clientes</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 text-left font-semibold">Cliente</th>
                <th className="px-6 py-3 text-left font-semibold">Empresa</th>
                <th className="px-6 py-3 text-left font-semibold">Contato</th>
                <th className="px-6 py-3 text-left font-semibold">Parceiro</th>
                <th className="px-6 py-3 text-left font-semibold">Status</th>
                <th className="px-6 py-3 text-left font-semibold">Cadastro</th>
                <th className="px-6 py-3 text-right font-semibold w-20">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">Carregando...</td></tr>
              ) : (clients ?? []).length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-16 text-center">
                  <div className="text-muted-foreground text-sm">Nenhum cliente cadastrado</div>
                  <Button size="sm" onClick={() => setOpen(true)} className="mt-4 gap-2"><Plus className="size-4" /> Cadastrar primeiro cliente</Button>
                </td></tr>
              ) : clients?.map((c: any) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/clientes/${c.id}`)}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-primary-muted text-primary flex items-center justify-center text-xs font-semibold">
                        {c.full_name.split(" ").slice(0, 2).map((p: string) => p[0]).join("")}
                      </div>
                      <div>
                        <p className="font-medium">{c.full_name}</p>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{c.company ?? "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground text-xs">{c.phone ?? "—"}</td>
                  <td className="px-6 py-4 text-muted-foreground">{c.partners?.full_name ?? "—"}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                      c.status === "ativo" ? "bg-success-muted text-success" :
                      c.status === "prospecto" ? "bg-warning-muted text-warning" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      <span className="size-1.5 rounded-full bg-current" />
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">{formatDate(c.created_at)}</td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="size-8 rounded-md hover:bg-muted flex items-center justify-center">
                          <MoreHorizontal className="size-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/clientes/${c.id}`)}><Eye className="size-4 mr-2" /> Ver detalhes</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(c.id)} className="text-destructive"><Trash2 className="size-4 mr-2" /> Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ClientFormDialog open={open} onOpenChange={setOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["clients"] })} />
    </div>
  );
}
