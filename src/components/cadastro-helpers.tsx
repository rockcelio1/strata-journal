import { type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2 } from "lucide-react";

export function CadastroLayout({ title, subtitle, onNew, children }: { title: string; subtitle?: string; onNew: () => void; children: ReactNode }) {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="flex items-end justify-between mb-6 gap-4">
        <div>
          <h1 className="font-serif text-3xl">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <Button onClick={onNew} className="bg-brand text-brand-foreground"><Plus className="h-4 w-4 mr-1" />Novo</Button>
      </header>
      {children}
    </div>
  );
}

export type Col<T> = { key: keyof T | string; label: string; render?: (r: T) => ReactNode };

export function CrudTable<T extends { id: string }>({ rows, columns, onEdit, onDelete }: {
  rows: T[]; columns: Col<T>[]; onEdit: (r: T) => void; onDelete: (r: T) => void;
}) {
  if (rows.length === 0) {
    return <Card className="p-12 text-center text-muted-foreground">Nada cadastrado ainda.</Card>;
  }
  return (
    <Card>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            {columns.map((c) => <th key={String(c.key)} className="p-3 font-medium">{c.label}</th>)}
            <th className="p-3 w-px"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/40">
              {columns.map((c) => (
                <td key={String(c.key)} className="p-3">{c.render ? c.render(r) : String((r as any)[c.key] ?? "—")}</td>
              ))}
              <td className="p-3 text-right whitespace-nowrap">
                <Button size="sm" variant="ghost" onClick={() => onEdit(r)}>Editar</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover registro?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(r)} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function CrudDialog({ open, onOpenChange, title, onSave, saving, canSave, children }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string; onSave: () => void; saving?: boolean; canSave?: boolean; children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-serif text-2xl">{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">{children}</div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving || canSave === false} className="bg-brand text-brand-foreground">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FieldText({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return <div><Label>{label}</Label><Input type={type} value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}

export function FieldTextarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <div><Label>{label}</Label><Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} /></div>;
}

export function FieldSwitch({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

export function FieldSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
