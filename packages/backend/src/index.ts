import dotenv from 'dotenv';
// Carrega as variáveis de ambiente antes de qualquer importação de config
dotenv.config();

// Validação crítica de variáveis em produção para evitar texto claro inseguro
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET) {
    console.error('❌ CRITICAL ERROR: JWT_SECRET environment variable is missing in production!');
    process.exit(1);
  }
  if (!process.env.ENCRYPTION_KEY && !process.env.ENCRYPTION_SECRET) {
    console.error('❌ CRITICAL ERROR: ENCRYPTION_KEY or ENCRYPTION_SECRET environment variable is missing in production!');
    process.exit(1);
  }
}

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { connectDatabase } from './config/database';
import logger from './config/logger';
import { errorHandler } from './middlewares/errors';
import { OrderService } from './services/OrderService';
import { deliveryTimeoutQueue } from './queues/deliveryQueue';


// Importa Rotas
import authRoutes from './routes/auth';
import customerRoutes from './routes/customers';
import merchantRoutes from './routes/merchants';
import orderRoutes from './routes/orders';
import productRoutes from './routes/products';
import promotionRoutes from './routes/promotions';
import adminRoutes from './routes/admin';
import bannerRoutes from './routes/banners';
import uploadRoutes from './routes/upload';
import paymentRoutes from './routes/payments';
import whatsappRoutes from './routes/whatsapp';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL
      : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// Configura adaptador Redis para Socket.io se houver REDIS_URL para escalabilidade
if (process.env.REDIS_URL) {
  try {
    const pubClient = new Redis(process.env.REDIS_URL);
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('🔌 Socket.io Redis Adapter configurado com sucesso.');
  } catch (err) {
    logger.error('❌ Falha ao configurar Socket.io Redis Adapter:', err);
  }
}

const PORT = process.env.PORT || 3000;

// Middlewares Globais
app.use(helmet());

const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((o) => o.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    const isLocalhost = origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');
    const isVercelDomain = origin.endsWith('.vercel.app');
    const isAllowedCustomDomain = allowedOrigins.includes(origin);

    if (isLocalhost || isVercelDomain || isAllowedCustomDomain) {
      return callback(null, true);
    }
    
    callback(new Error('Bloqueado pelas políticas de CORS do Traz Pra Cá'));
  },
  credentials: true
}));
app.use(express.json());

// Configuração de diretório de uploads
import path from 'path';
import fs from 'fs';
const uploadsPath = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Log de requisições
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Rota de Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/merchants', merchantRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// Configuração do Socket.io para Rastreamento em Tempo Real
io.on('connection', (socket) => {
  logger.info(`🔌 Socket connected: ${socket.id}`);

  // Entra na sala do pedido específico
  socket.on('joinOrderRoom', (orderId: string) => {
    socket.join(`order:${orderId}`);
    logger.info(`🔌 Socket ${socket.id} joined room: order:${orderId}`);
  });

  // Entra na sala do lojista específico
  socket.on('joinMerchantRoom', (merchantId: string) => {
    socket.join(`merchant:${merchantId}`);
    logger.info(`🔌 Socket ${socket.id} joined room: merchant:${merchantId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// Compartilha a instância do socket.io para ser usada nos controllers/services se necessário
app.set('io', io);

// Middleware centralizado de tratamento de erros (deve ser o último)
app.use(errorHandler);

// Inicializa a aplicação
const startServer = async () => {
  await connectDatabase();
  
  // Inicializa a rotina de cancelamento automático de pedidos de PIX expirados (10 min)
  setInterval(async () => {
    try {
      await OrderService.cancelUnpaidPixOrders(io);
    } catch (err) {
      logger.error('Erro na rotina de cancelamento automático de PIX:', err);
    }
  }, 60 * 1000); // Roda a cada 60 segundos

  server.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  logger.error('Failed to start server: %O', error);
});
