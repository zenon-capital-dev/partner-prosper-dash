import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, RotateCcw, Tag, Check, X } from "lucide-react";
import { useExpenseCategories } from "@/hooks/useExpenseCategories";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ManageExpenseCategoriesDialog({ open, onOpenChange }: Props) {
  const { allKnown, hiddenBuiltins, addCustom, renameCategory, removeCategory, restoreBuiltin } = useExpenseCategories();
  const [newLabel, setNewLabel] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (value: string, label: string) => { setEditing(value); setEditValue(label); };
  const cancelEdit = () => { setEditing(null); setEditValue(""); };
  const commitEdit = async () => { if (editing) { await renameCategory(editing, editValue); cancelEdit(); } };

  const handleAdd = async () => {
    if (!newLabel.trim()) return;
    await addCustom(newLabel);
    setNewLabel("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Tag className="size-4 text-indigo-600" /> Gerenciar categorias de despesa</DialogTitle>
          <DialogDescription className="text-[12.5px]">
            Adicione categorias personalizadas ou oculte as que não usa. Os lançamentos antigos continuam mostrando o rótulo correto nos detalhes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <Label className="text-[11px] uppercase tracking-wider font-semibold text-slate-600">Nova categoria</Label>
            <div className="flex gap-2 mt-1.5">
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                placeholder="Ex.: Aluguel, Energia, Frete..."
                className="h-9"
              />
              <Button onClick={handleAdd} className="gap-1 bg-indigo-600 hover:bg-indigo-700">
                <Plus className="size-4" /> Adicionar
              </Button>
            </div>
          </div>

          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-600 mb-2">Categorias existentes</p>
            <div className="max-h-[340px] overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white">
              {allKnown.map((c) => {
                const isHidden = c.builtin && hiddenBuiltins.includes(c.value);
                const isEditing = editing === c.value;
                return (
                  <div key={c.value} className={cn("flex items-center gap-2 px-3 py-2", isHidden && "bg-slate-50/60 opacity-60")}>
                    <span className="size-3 rounded-full shrink-0" style={{ background: c.color }} />
                    {isEditing ? (
                      <>
                        <Input
                          autoFocus value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                          className="h-8 flex-1"
                        />
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-emerald-700" onClick={commitEdit}><Check className="size-4" /></Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-slate-500" onClick={cancelEdit}><X className="size-4" /></Button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-slate-800 truncate">{c.label}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{c.value}{c.builtin ? " · padrão" : " · personalizada"}{isHidden ? " · oculta" : ""}</p>
                        </div>
                        {isHidden ? (
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-indigo-700 gap-1" onClick={() => restoreBuiltin(c.value)}>
                            <RotateCcw className="size-3.5" /> Restaurar
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" className="h-8 px-2 text-slate-600" onClick={() => startEdit(c.value, c.label)} title="Renomear">
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => removeCategory(c.value)} title={c.builtin ? "Ocultar" : "Remover"}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Ocultar uma categoria padrão apenas a remove das opções — as despesas já lançadas continuam com o rótulo original.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
