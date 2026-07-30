/** Abre o login oficial da Microsoft em pop-up e espera a conclusão. */
export const CONNECTOR_ID = "microsoft_onedrive";

export function esperarConclusao(popup: Window) {
  return new Promise<void>((resolve, reject) => {
    let poll: number | undefined;
    const limpar = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        event.data?.connectorId !== CONNECTOR_ID ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      )
        return;
      limpar();
      if (type === "appUserConnectorOAuthComplete") return resolve();
      popup.close();
      reject(new Error(event.data?.erro ?? "A autorização da Microsoft falhou."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      limpar();
      reject(new Error("A janela de login foi fechada antes de concluir."));
    }, 500);
  });
}

/** Executa o fluxo completo: abre o pop-up, navega e aguarda o retorno. */
export async function rodarLoginMicrosoft(
  obterUrl: () => Promise<{ authorizationUrl: string }>,
) {
  const popup = window.open("", "onedrive-oauth", "width=620,height=740");
  if (!popup) throw new Error("O navegador bloqueou a janela. Libere pop-ups e tente de novo.");
  try {
    const { authorizationUrl } = await obterUrl();
    const conclusao = esperarConclusao(popup);
    popup.location.href = authorizationUrl;
    await conclusao;
  } catch (e) {
    popup.close();
    throw e;
  }
}
