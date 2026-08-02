# Plano de Migração: Hostinger Cloud + Supabase Externo

Sim, é perfeitamente possível hospedar o sistema no plano **Cloud da Hostinger**. O plano Cloud permite rodar aplicações Node.js, que é exatamente o que o TanStack Start exige para o Frontend e o Backend (Server Functions).

## Estrutura Final
1.  **Hospedagem (Hostinger Cloud):** Onde ficará o "cérebro" do sistema (Frontend + API/Backend).
2.  **Banco de Dados (Supabase Externo):** Onde ficarão os dados e arquivos (PostgreSQL + Storage).
3.  **Domínio:** `sistemas.facom.com.br` apontado para a Hostinger.

## Como colocar tudo na Hostinger Cloud agora:

### Passo 1: Configurar o Node.js na Hostinger
No painel da Hostinger Cloud, você deve ativar ou selecionar a versão do Node.js (recomendado v20 ou superior).

### Passo 2: Preparar o Build para Produção
O Lovable gera uma aplicação TanStack Start. O comando de build cria um servidor otimizado.
- Comando: `npm run build`
- Resultado: Uma pasta (geralmente `.output` ou `dist`) contendo o servidor pronto para rodar.

### Passo 3: Transferência e Inicialização
1.  **Upload:** Enviar os arquivos via Gerenciador de Arquivos ou FTP.
2.  **Variáveis de Ambiente (.env):** Você precisará cadastrar no painel da Hostinger as chaves do seu novo Supabase externo:
    - `VITE_SUPABASE_URL`
    - `VITE_SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY`
    - `RDO_ENCRYPTION_KEY` (chave de segurança do sistema)
3.  **Execução:** Usar um gerenciador de processos como o `PM2` (comum em Cloud) para manter o sistema online 24h.

### Passo 4: Migração do Banco
- Criar o projeto no Supabase.com.
- Rodar o script SQL de tabelas e RLS que eu preparei.
- Configurar o Storage para fotos e anexos.

---

**Deseja que eu comece a gerar os scripts de automação de build e o manual passo-a-passo com as telas da Hostinger para você seguir?**
