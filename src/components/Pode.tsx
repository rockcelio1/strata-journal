import type { ReactNode } from "react";
import { useAcessos } from "@/hooks/useAcessos";

interface PodeProps {
  /** Chave do recurso, ex.: "diario.rdos" */
  recurso: string;
  /** Ação, ex.: "ver" | "criar" | "editar" | "excluir" | "aprovar" ... */
  acao: string;
  fallback?: ReactNode;
  children: ReactNode;
}

/** Mostra o conteúdo apenas se o usuário tiver a permissão indicada. */
export function Pode({ recurso, acao, fallback = null, children }: PodeProps) {
  const { pode, isLoading } = useAcessos();
  if (isLoading) return null;
  if (!pode(recurso, acao)) return <>{fallback}</>;
  return <>{children}</>;
}

/** Mostra o conteúdo se o usuário tiver QUALQUER uma das permissões. */
export function PodeAlgum({
  pares,
  fallback = null,
  children,
}: {
  pares: Array<[string, string]>;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { podeAlgum, isLoading } = useAcessos();
  if (isLoading) return null;
  if (!podeAlgum(pares)) return <>{fallback}</>;
  return <>{children}</>;
}
