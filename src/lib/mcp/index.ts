import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listObras from "./tools/list-obras";
import listRdos from "./tools/list-rdos";
import getRdo from "./tools/get-rdo";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "diario-de-obra-mcp",
  title: "Diário de Obra",
  version: "0.1.0",
  instructions:
    "Ferramentas para consultar obras e Relatórios Diários de Obra (RDOs) do Diário de Obra. Use list_obras para listar obras, list_rdos para listar RDOs (opcionalmente por obra) e get_rdo para detalhes de um RDO específico.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listObras, listRdos, getRdo],
});
