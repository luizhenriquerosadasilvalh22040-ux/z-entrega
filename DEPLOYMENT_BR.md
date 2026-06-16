# Guia de Deploy - Traz Pra Cá (Hostinger VPS / Node.js)

Este guia detalha o processo de implantação e configuração do **Traz Pra Cá** em um ambiente de produção real utilizando uma VPS na **Hostinger** (com Ubuntu 22.04 LTS ou superior), conectando-se a bancos de dados e filas gerenciadas (MongoDB Atlas e Upstash Redis) e assegurando todo o tráfego sob HTTPS/SSL (porta 443).

---

## 1. Requisitos e Serviços na Nuvem

Antes de configurar o servidor Hostinger, certifique-se de possuir:
1. **Domínio próprio** apontado para o IP da sua VPS Hostinger (ex: `trazpraca.com` e `api.trazpraca.com`).
2. **Cluster MongoDB Atlas (Grátis/Pago)**: Obtenha a Connection String de produção.
3. **Instância Redis Upstash (Serverless)**: Obtenha a URL de conexão criptografada (rediss://...).
4. **Credenciais Twilio / WhatsApp Gateway** para envios reais.

---

## 2. Preparação do Servidor VPS (Hostinger)

Acesse a VPS via SSH com o usuário `root`:
```bash
ssh root@seu_ip_da_vps
```

### Instalar Node.js via NVM
```bash
# Instala o NVM (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Carrega as variáveis do NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Instala a versão recomendada (Node 20)
nvm install 20
nvm use 20
nvm alias default 20
```

### Instalar Git, Nginx e PM2
```bash
# Atualiza os pacotes da VPS
apt update && apt upgrade -y

# Instala Git e Nginx
apt install git nginx -y

# Instala o PM2 globalmente para gerenciar os processos do Node.js
npm install pm2 -g
```

---

## 3. Configuração do Código e Variáveis de Ambiente

Clone o repositório na pasta `/var/www/trazpraca`:
```bash
mkdir -p /var/www
cd /var/www
git clone <url-do-seu-repositorio> trazpraca
cd trazpraca
```

### Backend: Configuração do `.env`
Crie o arquivo `.env` dentro de `packages/backend/`:
```bash
cd packages/backend
nano .env
```
Preencha com os dados de produção:
```env
PORT=3000
NODE_ENV=production
MONGO_URI=mongodb+srv://usuario:senha@cluster0.xxxxx.mongodb.net/trazpraca?retryWrites=true&w=majority
JWT_SECRET=sua_chave_secreta_super_forte_e_longa_aqui
REDIS_URL=rediss://default:sua_senha@seu-host.upstash.io:6379

# WhatsApp Twilio Gateway
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+14155238886
```
Salve e feche o editor (`Ctrl + O`, `Enter`, `Ctrl + X`).

### Permissões para Imagens do Upload
Como o backend salvará imagens locais na pasta `/uploads` na VPS Hostinger, garanta que a pasta exista e tenha permissões adequadas de escrita:
```bash
mkdir -p uploads
chmod -R 775 uploads
```

---

## 4. Gerenciamento do Processo com PM2

Utilizaremos o PM2 para manter o backend rodando continuamente em segundo plano.

### Compilação do Backend (TypeScript)
No diretório `packages/backend`:
```bash
npm install
npm run build
```

### Configurando o arquivo PM2 `ecosystem.config.js`
Crie o arquivo `ecosystem.config.js` na raiz do backend (`packages/backend/`):
```bash
nano ecosystem.config.js
```
Cole o seguinte conteúdo:
```javascript
module.exports = {
  apps: [
    {
      name: 'trazpraca-backend',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```
Salve e inicie o serviço:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 5. Compilação e Hospedagem do Frontend (Nginx)

O frontend React/Vite será compilado em arquivos estáticos (HTML/CSS/JS) e servido diretamente pelo Nginx para performance máxima.

### Compilação do Frontend
Vá até a pasta do frontend:
```bash
cd /var/www/trazpraca/packages/frontend
nano .env.production
```
Defina a URL de produção da sua API (deve ser o subdomínio HTTPS):
```env
VITE_API_URL=https://api.trazpraca.com/api
```
Instale as dependências e compile:
```bash
npm install
npm run build
```
Isso gerará a pasta `packages/frontend/dist` com todos os arquivos estáticos.

---

## 6. Configuração do Proxy Reverso no Nginx com SSL

Vamos configurar o Nginx para escutar as portas HTTP (80) e HTTPS (443) de forma segura.

### Criar Arquivo de Configuração do Nginx
```bash
nano /etc/nginx/sites-available/trazpraca
```
Cole a seguinte configuração (substitua pelos seus domínios reais):
```nginx
# 1. Servidor de API (api.trazpraca.com) -> Repassa para o Node.js na porta 3000
server {
    listen 80;
    server_name api.trazpraca.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 2. Servidor Principal do Frontend (trazpraca.com) -> Serve arquivos estáticos do Vite
server {
    listen 80;
    server_name trazpraca.com www.trazpraca.com;

    root /var/www/trazpraca/packages/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Servir arquivos de uploads locais
    location /uploads/ {
        alias /var/www/trazpraca/packages/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```
Salve e ative a configuração:
```bash
ln -s /etc/nginx/sites-available/trazpraca /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

---

## 7. Gerando o Certificado SSL Gratuito (Let's Encrypt)

Para forçar tráfego obrigatório em HTTPS/SSL nas portas 443 de forma gratuita e profissional, usamos o **Certbot**:
```bash
# Instala o Certbot do Let's Encrypt
apt install certbot python3-certbot-nginx -y

# Solicita os certificados SSL e configura o Nginx automaticamente
certbot --nginx -d trazpraca.com -d www.trazpraca.com -d api.trazpraca.com
```
O Certbot irá perguntar se você deseja redirecionar o tráfego HTTP para HTTPS automaticamente. Selecione a opção **Redirect (2)**. 

Pronto! Seu sistema **Traz Pra Cá** agora está rodando em produção na Hostinger de forma escalável, segura e com uploads rápidos.
