import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw, Users } from "lucide-react";
import { notify } from "@/lib/toast";
import { onedriveDefinirPermissao, onedriveListarPermissoes } from "@/lib/onedrive-admin.functions";

/** Quem pode ler e quem pode gravar no OneDrive do projeto. */
export function OneDrivePermissoes() {
  const qc = useQueryClient();
  const listarFn = useServerFn(onedriveListarPermissoes);
  const definirFn = useServerFn(onedriveDefinirPermissao);

  const lista = useQuery({
    queryKey: ["onedrive", "permissoes"],
    queryFn: () => listarFn({ data: undefined as never }),
    retry: 0,
  });

  const definir = useMutation({
    mutationFn: (v: { userId: string; podeLer: boolean; podeEscrever: boolean }) => definirFn({ data: v }),
    onSuccess: async () => {
      notify.success("Permissão atualizada");
      await qc.invalidateQueries({ queryKey: ["onedrive", "permissoes"] });
      await qc.invalidateQueries({ queryKey: ["onedrive", "historico"] });
    },
    onError: (e: Error) => notify.error("Falha ao salvar permissão", { description: e.message }),
  });

  if (lista.error) return null;

  return (
    <section className="border border-border rounded-lg p-4 bg-card" data-testid="onedrive-permissoes">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <Users className="h-4 w-4" /> Quem pode usar o OneDrive
        </h3>
        <button
          onClick={() => lista.refetch()}
          className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:bg-accent"
        >
          {lista.isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Atualizar
        </button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Marque quem pode <strong>ver</strong> os arquivos e quem pode <strong>enviar/alterar</strong> arquivos no
        OneDrive vinculado ao projeto. Administradores sempre têm acesso total.
      </p>

      {lista.isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando usuários…</p>
      ) : (
        <ul className="divide-y divide-border">
          {(lista.data?.usuarios ?? []).map((u) => (
            <li key={u.id} className="py-2 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{u.nome}</div>
                <div className="text-[11px] text-muted-foreground truncate">{u.email ?? u.cargo ?? ""}</div>
              </div>
              <label className="text-xs inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={u.podeLer}
                  disabled={definir.isPending}
                  onChange={(e) =>
                    definir.mutate({
                      userId: u.id,
                      podeLer: e.target.checked,
                      podeEscrever: e.target.checked ? u.podeEscrever : false,
                    })
                  }
                />
                Ver arquivos
              </label>
              <label className="text-xs inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={u.podeEscrever}
                  disabled={definir.isPending}
                  onChange={(e) =>
                    definir.mutate({
                      userId: u.id,
                      podeLer: e.target.checked ? true : u.podeLer,
                      podeEscrever: e.target.checked,
                    })
                  }
                />
                Enviar/alterar
              </label>
            </li>
          ))}
          {(lista.data?.usuarios?.length ?? 0) === 0 && (
            <li className="py-3 text-xs text-muted-foreground">Nenhum usuário encontrado.</li>
          )}
        </ul>
      )}
    </section>
  );
}
