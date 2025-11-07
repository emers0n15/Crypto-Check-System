# 🚀 CryptoPulse - Projeto Unificado

Aplicação completa de rastreamento de criptomoedas em tempo real, com backend e frontend unificados em um único repositório e deploy.

## 📁 Estrutura do Projeto

```
cryto/
├── api/                    # Serverless functions para Vercel
│   ├── coins.js           # Lista de moedas
│   ├── suggestions.js     # Sugestões de autocomplete
│   └── coin/[id].js      # Detalhes de moeda
├── backend/               # Backend Express (desenvolvimento local)
│   ├── server.js          # Servidor Express com Socket.io
│   └── package.json
├── frontend/              # Frontend React + Vite
│   ├── src/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
├── package.json           # Dependências raiz
├── vercel.json            # Configuração Vercel
└── README.md
```

## 🚀 Deploy no Vercel

> 📖 **Guia Completo:** Veja o arquivo [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md) para instruções detalhadas passo a passo.

### Resumo Rápido

1. **Faça login no [Vercel](https://vercel.com)**
2. **Importe seu repositório Git**
3. **Configure variáveis de ambiente** (opcional):
   - `COINGECKO_API_KEY` - Chave da API CoinGecko
4. **Clique em "Deploy"**
5. **Aguarde o build** (2-5 minutos)

### 🔗 Onde Encontrar as URLs Após Deploy

Após o deploy bem-sucedido:

**URL Principal (Frontend + API):**
```
https://seu-projeto.vercel.app
```

**Endpoints da API:**
- Lista de moedas: `https://seu-projeto.vercel.app/api/coins`
- Sugestões: `https://seu-projeto.vercel.app/api/suggestions?q=bitcoin`
- Detalhes: `https://seu-projeto.vercel.app/api/coin/bitcoin`

> 💡 **Importante:** O frontend usa URLs relativas (`/api/*`) em produção, então **não precisa configurar** `VITE_API_BASE_URL` no Vercel. Tudo funciona automaticamente na mesma URL!

### 📍 Localização no Dashboard

1. Acesse [vercel.com/dashboard](https://vercel.com/dashboard)
2. Clique no seu projeto
3. Vá em **"Deployments"** → Clique no deploy mais recente
4. A URL estará no topo da página

## 🛠️ Desenvolvimento Local

### Instalação

```bash
# Instalar todas as dependências
npm run install:all

# Ou instalar manualmente:
npm install
cd backend && npm install
cd ../frontend && npm install
```

### Executar

```bash
# Executar backend e frontend simultaneamente (RECOMENDADO)
npm run dev

# Isso iniciará:
# - Backend na porta 3001 (http://localhost:3001)
# - Frontend na porta 5173 (http://localhost:5173)
# Ambos rodando ao mesmo tempo com logs coloridos

# Ou executar separadamente:
npm run dev:api      # Apenas Backend na porta 3001
npm run dev:frontend # Apenas Frontend na porta 5173
```

> **Nota:** O comando `npm run dev` usa `concurrently` para rodar ambos os serviços simultaneamente. Os logs aparecerão com cores diferentes (azul para backend, verde para frontend).

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz (opcional):

```env
COINGECKO_API_KEY=sua_chave_aqui
```

## 📡 Endpoints da API

### Produção (Vercel)
- `GET /api/coins` - Lista de moedas (com query `?search=termo`)
- `GET /api/suggestions?q=termo` - Sugestões de autocomplete
- `GET /api/coin/:id` - Detalhes de uma moeda

### Desenvolvimento Local
- `GET http://localhost:3001/api` - Lista de moedas
- `GET http://localhost:3001/api/suggestions?q=termo` - Sugestões
- `GET http://localhost:3001/api/coin/:id` - Detalhes
- WebSocket: `ws://localhost:3001` (Socket.io)

## 🔧 Funcionalidades

### Em Produção (Vercel)
- ✅ Rotas HTTP serverless
- ✅ Polling automático a cada 20 segundos
- ✅ Sem necessidade de WebSocket

### Em Desenvolvimento
- ✅ Socket.io para atualizações em tempo real
- ✅ WebSocket para comunicação bidirecional
- ✅ Atualizações instantâneas

## 📝 Notas Importantes

1. **Socket.io no Vercel:** WebSockets não funcionam bem em ambiente serverless. Por isso, em produção, o frontend usa polling HTTP a cada 20 segundos.

2. **Rotas da API:** O Vercel detecta automaticamente arquivos na pasta `api/` como serverless functions.

3. **Build:** O frontend é compilado e servido estaticamente, enquanto a API roda como serverless functions.

## 🐛 Troubleshooting

### Erro de CORS
- As rotas da API já incluem headers CORS configurados
- Verifique se o `vercel.json` está correto

### API não responde
- Verifique se as variáveis de ambiente estão configuradas no Vercel
- Confira os logs no dashboard do Vercel

### Frontend não carrega
- Verifique se o build foi executado corretamente
- Confirme que `outputDirectory` está como `frontend/dist`

## 📄 Licença

© 2025 Emerson Covane

