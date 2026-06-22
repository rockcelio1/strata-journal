import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/cadastros/")({
  beforeLoad: () => { throw redirect({ to: "/cadastros/mao-de-obra" }); },
});
