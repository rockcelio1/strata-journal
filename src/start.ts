import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Onda 4: headers de segurança em toda resposta HTML/JSON servida pelo runtime.
// CSP em modo permissivo (compatível com Vite/HMR em dev e com o restore da sessão Supabase).
// HSTS ativo apenas quando servido via HTTPS (Cloudflare cuida do TLS).
const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(self), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-DNS-Prefetch-Control": "on",
};

const CSP_DIRECTIVES = [
  "default-src 'self'",
  // 'unsafe-inline' e 'unsafe-eval' necessários para React SSR streaming e Vite dev.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.lovable.dev https://*.lovable.app https://*.supabase.co",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https: wss: blob:",
  "child-src 'self' blob:",
  "frame-src 'self' blob: https:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "worker-src 'self' blob:",
].join("; ");

const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next();
  // TSS pode retornar { response } (novas versões) OU a Response diretamente.
  const res: Response | undefined =
    (result as any)?.response instanceof Response
      ? (result as any).response
      : (result as unknown as Response) instanceof Response
        ? (result as unknown as Response)
        : undefined;
  try {
    if (res && typeof (res.headers as any).set === "function") {
      const ct = res.headers.get("content-type") ?? "";
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
        if (!res.headers.get(k)) res.headers.set(k, v);
      }
      // CSP apenas em respostas HTML para não impactar APIs/assets.
      if (ct.includes("text/html") && !res.headers.get("Content-Security-Policy")) {
        res.headers.set("Content-Security-Policy", CSP_DIRECTIVES);
      }
    }
  } catch {
    // nunca deixar a middleware quebrar a resposta
  }
  return result;
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, securityHeadersMiddleware],
}));
