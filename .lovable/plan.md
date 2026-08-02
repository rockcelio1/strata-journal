# Plano de Migração: Hostinger Cloud + Supabase Externo (Instância Existente)

Sim! Você **pode e deve** usar a mesma instância do Supabase que o RDO já utiliza. Isso facilita muito, pois não precisamos migrar dados, apenas conectar a nova hospedagem (Hostinger) ao banco que já está funcionando.

## Estrutura Atualizada
1.  **Hospedagem (Hostinger Cloud):** Onde ficará a interface e a lógica do sistema (Frontend + Backend SSR).
2.  **Banco de Dados (Supabase Externo):** Sua instância atual que já contém os dados do RDO.
3.  **Domínio:** `sistemas.facom.com.br` apontado para a Hostinger.

## Passos para Hospedar na Hostinger Cloud:

### 1. Preparação dos Arquivos (Build)
Como o projeto é TanStack Start, ele gera um servidor Node.js.
- Executaremos o build para gerar a pasta de produção.
- Criaremos um arquivo `ecosystem.config.js` para o PM2 (gerenciador de processos da Hostinger) manter o app sempre ligado.

### 2. Configuração na Hostinger Cloud
1.  **Node.js:** Verifique se o Node.js v20+ está ativo no seu painel Hostinger.
2.  **Variáveis de Ambiente:** No painel da Hostinger, você deve cadastrar as mesmas credenciais do Supabase que o RDO já usa:
    - `VITE_SUPABASE_URL`
    - `VITE_SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY`
    - `RDO_ENCRYPTION_KEY`
3.  **Deploy:** Upload dos arquivos do build via Git ou FTP para a pasta do domínio `sistemas.facom.com.br`.

### 3. Ajustes de Segurança e Domínio
- **CORS/Auth:** No painel do Supabase, precisaremos adicionar `https://sistemas.facom.com.br` na lista de URLs permitidas (Redirect URLs e Site URL).
- **DNS:** No painel onde seu domínio está registrado, aponte o `sistemas` para o IP da sua Hostinger Cloud.

---

**Posso prosseguir com a geração do script de build e o arquivo de configuração do PM2 para facilitar o seu deploy na Hostinger?**
