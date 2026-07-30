import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onedriveConcluirLogin } from "@/lib/onedrive-appuser.functions";

export const Route = createFileRoute("/oauth/onedrive/return")({
  ssr: false,
  component: RetornoOAuth,
  head: () => ({
    meta: [
      { title: "Concluindo o login da Microsoft — Diário de Obra" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function RetornoOAuth() {
  const [msg, setMsg] = useState("Concluindo a conexão com a Microsoft…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const avisar = (type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed", erro?: string) => {
      window.opener?.postMessage({ type, connectorId: "microsoft_onedrive", erro }, window.location.origin);
      window.close();
    };

    const erroMs = params.get("error_description") ?? params.get("error");
    if (erroMs) {
      setMsg(erroMs);
      avisar("appUserConnectorOAuthFailed", erroMs);
      return;
    }

    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) {
      const erro = "A Microsoft não retornou o código de autorização.";
      setMsg(erro);
      avisar("appUserConnectorOAuthFailed", erro);
      return;
    }

    void onedriveConcluirLogin({ data: { code, state } })
      .then(() => avisar("appUserConnectorOAuthComplete"))
      .catch((e: Error) => {
        setMsg(e.message);
        avisar("appUserConnectorOAuthFailed", e.message);
      });

  }, []);

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-background">
      <p className="text-sm text-muted-foreground max-w-sm text-center">{msg}</p>
    </main>
  );
}
