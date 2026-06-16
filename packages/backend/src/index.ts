import dotenv from 'dotenv';
// Carrega as variáveis de ambiente antes de qualquer importação de config
dotenv.config();

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { connectDatabase } from './config/database';
import logger from './config/logger';
import { errorHandler } from './middlewares/errors';

// Importa Rotas
import authRoutes from './routes/auth';
import customerRoutes from './routes/customers';
import merchantRoutes from './routes/merchants';
import orderRoutes from './routes/orders';
import productRoutes from './routes/products';
import promotionRoutes from './routes/promotions';
import adminRoutes from './routes/admin';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Em produção restringimos ao domínio correto
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const PORT = process.env.PORT || 3000;

// Middlewares Globais
app.use(helmet());
app.use(cors());
app.use(express.json());

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

// Configuração do Socket.io para Rastreamento em Tempo Real
io.on('connection', (socket) => {
  logger.info(`🔌 Socket connected: ${socket.id}`);

  // Entra na sala do pedido específico
  socket.on('joinOrderRoom', (orderId: string) => {
    socket.join(`order:${orderId}`);
    logger.info(`🔌 Socket ${socket.id} joined room: order:${orderId}`);
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
  
  server.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  logger.error('Failed to start server: %O', error);
});
