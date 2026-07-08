import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function PublicPageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/icone-rdo.png" alt="" className="h-8 w-8" />
            <span className="font-serif text-lg">Diário de Obra</span>
          </Link>
          <nav className="text-sm flex gap-4 text-muted-foreground">
            <Link to="/privacidade" className="hover:text-foreground">Privacidade</Link>
            <Link to="/termos" className="hover:text-foreground">Termos</Link>
            <Link to="/lgpd" className="hover:text-foreground">LGPD</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="font-serif text-3xl mb-6">{title}</h1>
        <article className="prose prose-neutral max-w-none text-sm leading-relaxed space-y-4">
          {children}
        </article>
        <footer className="mt-12 pt-6 border-t border-border text-xs text-muted-foreground">
          Página mantida pelo controlador do serviço para responder perguntas de privacidade e LGPD.
          Não constitui certificação independente.
        </footer>
      </main>
    </div>
  );
}
