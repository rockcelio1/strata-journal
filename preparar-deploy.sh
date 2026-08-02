#!/bin/bash

# Script para preparar o build do ERP FACOM para Hostinger Cloud

echo "🚀 Iniciando preparação do build..."

# 1. Instalar dependências
echo "📦 Instalando dependências..."
npm install

# 2. Gerar build do TanStack Start
echo "🏗️ Gerando build de produção..."
npm run build

# 3. Criar pacote zip para facilitar o upload (opcional)
if command -v zip &> /dev/null; then
    echo "🗜️ Criando pacote deploy.zip..."
    zip -r deploy.zip .output ecosystem.config.js package.json
    echo "✅ pacote deploy.zip criado com sucesso!"
else
    echo "⚠️ Comando 'zip' não encontrado. Por favor, faça o upload da pasta .output e do arquivo ecosystem.config.js manualmente."
fi

echo ""
echo "--------------------------------------------------------"
echo "PRÓXIMOS PASSOS NA HOSTINGER CLOUD:"
echo "1. Faça o upload da pasta .output e do arquivo ecosystem.config.js"
echo "2. No terminal da Hostinger, execute: npm install pm2 -g (se não tiver)"
echo "3. Execute: pm2 start ecosystem.config.js"
echo "4. Configure as Variáveis de Ambiente no painel da Hostinger"
echo "--------------------------------------------------------"
