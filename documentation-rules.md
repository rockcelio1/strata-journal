# Regra permanente: manutenção do Manual do Sistema

Sempre que uma nova funcionalidade for **criada, alterada ou removida** neste
sistema, o Lovable (ou qualquer contribuidor) deve **obrigatoriamente**
atualizar, na mesma leva:

1. **Manual do sistema** (`/ajuda`)
   - Criar ou atualizar o artigo em `public.help_articles` correspondente à
     tela, botão, formulário, módulo, campo, relatório, permissão ou
     integração.
2. **Base de conhecimento**
   - Ajustar categorias, tags e artigos relacionados quando o escopo mudar.
3. **Changelog** (`/ajuda/novidades`)
   - Registrar um novo item em `public.system_changelog` com:
     - `change_type` (novo / correcao / melhoria / seguranca / integracao / visual)
     - `title`, `description`, `how_to_use`
     - `module_key`, `route_path`, `help_article_id` quando aplicável
4. **Tutorial interativo** (`public.help_tutorials` + `help_tutorial_steps`)
   - Criar/atualizar quando houver fluxo passo a passo que justifique.
   - Adicionar atributo `data-help="chave-unica"` nos elementos da tela
     referenciados pelos passos.
5. **Ajuda contextual (`<HelpContextButton />`)**
   - Incluir o botão "?" na tela, apontando para o artigo publicado.
6. **Permissões**
   - Documentar quem pode usar (target_roles do artigo e do changelog).
7. **FAQ e problemas comuns**
   - Adicionar entradas quando o suporte identificar dúvidas recorrentes.

## Checklist para toda nova feature

- [ ] Funcionalidade implementada e testada
- [ ] Permissão configurada
- [ ] Artigo do manual criado ou atualizado (`status = publicado`)
- [ ] Entrada no changelog registrada
- [ ] Tutorial interativo criado, se aplicável
- [ ] `HelpContextButton` inserido na tela nova/alterada
- [ ] Busca do manual encontra a funcionalidade (título, resumo, conteúdo, tags)

Descumprimento desta regra é considerado entrega incompleta.
