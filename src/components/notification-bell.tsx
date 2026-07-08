import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect } from "react";
import { listNotificacoes, markNotificacaoLida } from "@/lib/notificacoes.functions";
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const listFn = useServerFn(listNotificacoes);
  const markFn = useServerFn(markNotificacaoLida);
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["notificacoes"],
    queryFn: () => listFn(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const unread = items.filter((n: any) => !n.lida_em).length;

  const mark = useMutation({
    mutationFn: (v: { id?: string; all?: boolean }) => markFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes"] }),
  });

  useEffect(() => {
    // nome único por mount evita "cannot add postgres_changes callbacks after subscribe()"
    // quando o mesmo canal é reaproveitado pelo Supabase (StrictMode/remount).
    const name = `notif-rt-${Math.random().toString(36).slice(2, 10)}`;
    const ch = supabase
      .channel(name)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notificacoes" },
        () => qc.invalidateQueries({ queryKey: ["notificacoes"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative inline-flex items-center justify-center min-w-[40px] min-h-[40px] rounded-md active:bg-brand-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-foreground/70">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-[16px] text-center font-medium">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-medium">Notificações</span>
          <button
            onClick={() => mark.mutate({ all: true })}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            disabled={unread === 0}
          >
            Marcar tudo como lido
          </button>
        </div>
        <div className="max-h-96 overflow-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-xs text-center text-muted-foreground">Sem notificações</p>
          ) : items.map((n: any) => {
            const inner = (
              <div className={cn(
                "px-3 py-2 border-b last:border-b-0 text-left",
                !n.lida_em && "bg-accent/50",
              )}>
                <div className="text-sm font-medium leading-tight">{n.titulo}</div>
                {n.mensagem && <div className="text-xs text-muted-foreground mt-0.5">{n.mensagem}</div>}
                <div className="text-[10px] text-muted-foreground mt-1">
                  {new Date(n.created_at).toLocaleString("pt-BR")}
                </div>
              </div>
            );
            return n.rdo_id ? (
              <Link key={n.id} to="/rdo/$rdoId" params={{ rdoId: n.rdo_id }}
                onClick={() => !n.lida_em && mark.mutate({ id: n.id })}
                className="block hover:bg-accent">
                {inner}
              </Link>
            ) : (
              <button key={n.id} onClick={() => !n.lida_em && mark.mutate({ id: n.id })}
                className="block w-full hover:bg-accent">
                {inner}
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
