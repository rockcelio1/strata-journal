import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldWarning } from "@phosphor-icons/react";

type Variant = "destructive" | "outline" | "default";

interface Props {
  label: string;
  title: string;
  description: string;
  /** Texto que o admin precisa digitar exatamente para liberar a 2ª confirmação. */
  doubleConfirmText: string;
  isPending?: boolean;
  variant?: Variant;
  onConfirm: () => void;
}

// Botão administrativo com dupla confirmação:
//  1ª etapa: AlertDialog descrevendo a ação.
//  2ª etapa: usuário precisa digitar o texto exato (case-sensitive) para liberar.
export function AdminConfirmTwiceButton({
  label, title, description, doubleConfirmText, isPending, variant = "destructive", onConfirm,
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState("");
  const ok = typed === doubleConfirmText;

  function reset() { setStep(1); setTyped(""); }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          variant={variant === "destructive" ? "outline" : variant}
          className={variant === "destructive" ? "text-destructive border-destructive" : undefined}
          disabled={isPending}
        >
          <ShieldWarning size={16} className="mr-1" />
          {isPending ? "Processando…" : label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {step === 1 ? title : "Confirmação final — digite para liberar"}
          </AlertDialogTitle>
        </AlertDialogHeader>

        {step === 1 ? (
          <div className="text-sm text-muted-foreground space-y-2">
            <p>{description}</p>
            <p className="text-xs">
              Esta ação é privilegiada (admin/master). Você precisará confirmar
              <strong> duas vezes</strong>; tudo fica registrado no log de auditoria.
            </p>
          </div>
        ) : (
          <div className="text-sm space-y-2">
            <p className="text-muted-foreground">
              Para evitar exclusão/alteração acidental, digite exatamente:
            </p>
            <code className="block bg-muted px-2 py-1 rounded text-sm font-mono">{doubleConfirmText}</code>
            <Input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={doubleConfirmText}
              aria-label="Texto de confirmação"
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          {step === 1 ? (
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); setStep(2); }}
              className={variant === "destructive" ? "bg-destructive text-destructive-foreground" : undefined}
            >
              Continuar
            </AlertDialogAction>
          ) : (
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!ok || isPending) return;
                onConfirm();
                setOpen(false);
                reset();
              }}
              disabled={!ok || isPending}
              className={variant === "destructive" ? "bg-destructive text-destructive-foreground" : undefined}
            >
              {isPending ? "Processando…" : "Confirmar definitivamente"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
