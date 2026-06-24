// Sincroniza rascunho do RDO entre abas do mesmo navegador (BroadcastChannel).
// Cada chave de rascunho cria um canal próprio; assinantes recebem notificação
// quando outra aba grava no IndexedDB e podem recarregar o estado.

export type DraftMessage =
  | { type: "saved"; at: number; tabId: string; fotosCount: number }
  | { type: "claim"; tabId: string }
  | { type: "ack"; tabId: string };

export function createDraftChannel(key: string) {
  const supported = typeof BroadcastChannel !== "undefined";
  const tabId = Math.random().toString(36).slice(2, 10);
  const bc = supported ? new BroadcastChannel(`rdo-draft:${key}`) : null;
  const handlers = new Set<(m: DraftMessage) => void>();
  if (bc) bc.onmessage = (e) => handlers.forEach((h) => h(e.data as DraftMessage));
  return {
    tabId,
    supported,
    post(m: DraftMessage) { bc?.postMessage(m); },
    on(h: (m: DraftMessage) => void) { handlers.add(h); return () => handlers.delete(h); },
    close() { bc?.close(); handlers.clear(); },
  };
}
