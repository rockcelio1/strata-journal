import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tarja "Novo" — aparece para qualquer usuário logado durante 7 dias
 * a partir da data `since` (ISO). Depois some sozinha.
 *
 * Uso:
 *   <NewBadge since="2026-07-05" />
 *   <NewBadge since="2026-07-05" label="Novo: aprovação de RDO" />
 */
export const NEW_BADGE_DAYS = 7;

export function isNew(since: string, days = NEW_BADGE_DAYS): boolean {
  const start = new Date(since).getTime();
  if (Number.isNaN(start)) return false;
  const diff = Date.now() - start;
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

interface NewBadgeProps {
  since: string; // ISO date da implementação
  label?: string;
  className?: string;
  days?: number;
}

export function NewBadge({ since, label = "Novo", className, days }: NewBadgeProps) {
  if (!isNew(since, days)) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground shadow-sm animate-pulse",
        className,
      )}
      title={`Nova implementação (visível por ${days ?? NEW_BADGE_DAYS} dias)`}
    >
      <Sparkles className="h-3 w-3" />
      {label}
    </span>
  );
}
