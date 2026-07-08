import { toast } from "sonner";

// Padrão global de toasts para telas autenticadas:
// - Posição central-superior
// - Duração curta para feedback rápido
// - Sem atrasar cliques (sonner é não-bloqueante) e acessível via teclado/AT
export const TOAST_DEFAULTS = {
  position: "top-center" as const,
  duration: 1200,
};

export const notify = {
  success: (msg: string, opts?: Parameters<typeof toast.success>[1]) =>
    toast.success(msg, { ...TOAST_DEFAULTS, ...opts }),
  error: (msg: string, opts?: Parameters<typeof toast.error>[1]) =>
    toast.error(msg, { ...TOAST_DEFAULTS, ...opts }),
  info: (msg: string, opts?: Parameters<typeof toast>[1]) =>
    toast(msg, { ...TOAST_DEFAULTS, ...opts }),
};
