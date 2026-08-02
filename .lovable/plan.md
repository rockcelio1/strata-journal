# Plano de Migração para Supabase Externo e Hostinger (Front/Back)

O objetivo é mover o banco de dados para um Supabase externo e hospedar a aplicação (Frontend + Backend SSR) na Hostinger, utilizando o domínio `sistemas.facom.com.br`.

## 1. Banco de Dados (Supabase Externo)
Você criará um projeto no Supabase e conectaremos este projeto Lovable a ele.
- **Ações:**
  - Executar as migrations no Supabase externo.
  - Conferir se o schema e as tabelas do Diário de Obra batem com o planejado.
  - Implementar o Supabase Storage para anexos e configurar permissões de leitura/gravação com RLS.
  - Validar autenticação e RLS por empresa no novo banco.

## 2. Hospedagem (Hostinger)
Para colocar o projeto (Frontend + Backend SSR) na Hostinger, seguiremos estes passos:

### Passo A: Preparação do Build
Geraremos um build otimizado para produção. O TanStack Start gera um servidor (baseado em Nitro) que pode rodar via Node.js na Hostinger.
- **Comando:** `npm run build` (gera a pasta `.output` ou `dist`).

### Passo B: Configuração na Hostinger
1. **Hospedagem Node.js:** Na Hostinger, você deve usar o plano de **Hospedagem VPS** ou o recurso de **Node.js** disponível em alguns planos de hospedagem compartilhada premium.
2. **DNS:** Apontar o domínio `sistemas.facom.com.br` para o IP da Hostinger (Registro A) ou usar os NameServers da Hostinger.
3. **Upload:** Enviar os arquivos do build via FTP ou Git para a Hostinger.
4. **Variáveis de Ambiente:** Configurar as chaves `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, e as secrets de backend (OneDrive, Email, etc.) no painel da Hostinger.

## 3. Integração e Validação
- Conectar o projeto ao Supabase externo via secrets no ambiente de produção.
- Testar o fluxo completo: Login -> RDO -> Anexos (Storage) -> Exportação PDF/Excel.

---
**Nota Importante:** Como este é um projeto TanStack Start, o "Backend" e "Frontend" rodam juntos como uma aplicação Node.js. A Hostinger servirá tanto as páginas quanto as Server Functions (API).

Você quer que eu gere agora os arquivos de configuração específicos para o deploy na Hostinger (como um `ecosystem.config.js` para o PM2 ou um script de inicialização)?
