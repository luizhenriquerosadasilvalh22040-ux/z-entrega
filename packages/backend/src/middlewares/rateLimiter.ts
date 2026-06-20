import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import logger from '../config/logger';

// Instancia o cliente redis se houver REDIS_URL para rate limiting distribuído
const redisUrl = process.env.REDIS_URL;
let redis: Redis | null = null;
if (redisUrl) {
  try {
    redis = new Redis(redisUrl);
    logger.info('🔑 Redis Rate Limiter initialized.');
  } catch (err) {
    logger.error('❌ Failed to initialize Redis Rate Limiter:', err);
  }
}

// Fallback em memória para desenvolvimento local se o Redis não estiver configurado
const memoryLimits = new Map<string, { count: number; resetTime: number }>();

export const otpRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutos
  const maxRequests = 5; // Limite de 5 requisições de OTP por IP

  if (redis) {
    try {
      const key = `rate_limit:otp:${ip}`;
      const countStr = await redis.get(key);
      const count = countStr ? parseInt(countStr, 10) : 0;

      if (count >= maxRequests) {
        const ttl = await redis.ttl(key);
        const minutesLeft = Math.ceil(ttl / 60);
        logger.warn(`⚠️ [Rate Limit Redis] Bloqueado envio de OTP para o IP ${ip}. Tentativas esgotadas.`);
        return res.status(429).json({
          status: 'fail',
          message: `Muitas solicitações de código de verificação. Tente novamente em ${minutesLeft > 0 ? minutesLeft : 1} minuto(s).`
        });
      }

      const multi = redis.multi();
      multi.incr(key);
      if (count === 0) {
        multi.expire(key, Math.ceil(windowMs / 1000));
      }
      await multi.exec();
      return next();
    } catch (err) {
      logger.error('Redis rate limit error, falling back to memory:', err);
    }
  }

  // Fallback para memória se o Redis estiver indisponível ou não configurado
  const record = memoryLimits.get(ip);
  if (!record || now > record.resetTime) {
    memoryLimits.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (record.count >= maxRequests) {
    const minutesLeft = Math.ceil((record.resetTime - now) / 60000);
    logger.warn(`⚠️ [Rate Limit Memory] Bloqueado envio de OTP para o IP ${ip}. Tentativas esgotadas.`);
    return res.status(429).json({
      status: 'fail',
      message: `Muitas solicitações de código de verificação. Tente novamente em ${minutesLeft} minuto(s).`
    });
  }

  record.count += 1;
  next();
};

export const verifyOtpRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
  const phone = req.body.phone ? req.body.phone.replace(/\D/g, '') : '';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutos
  const maxRequests = 10; // Limite de 10 tentativas de verificação por IP/Telefone

  const limitKey = `rate_limit:verify_otp:${phone || ip}`;

  if (redis) {
    try {
      const countStr = await redis.get(limitKey);
      const count = countStr ? parseInt(countStr, 10) : 0;

      if (count >= maxRequests) {
        const ttl = await redis.ttl(limitKey);
        const minutesLeft = Math.ceil(ttl / 60);
        logger.warn(`⚠️ [Rate Limit Redis] Bloqueada tentativa de verificação de OTP para ${phone || ip}. Tentativas excedidas.`);
        return res.status(429).json({
          status: 'fail',
          message: `Muitas tentativas incorretas. Tente novamente em ${minutesLeft > 0 ? minutesLeft : 1} minuto(s).`
        });
      }

      const multi = redis.multi();
      multi.incr(limitKey);
      if (count === 0) {
        multi.expire(limitKey, Math.ceil(windowMs / 1000));
      }
      await multi.exec();
      return next();
    } catch (err) {
      logger.error('Redis rate limit error, falling back to memory:', err);
    }
  }

  // Fallback para memória se o Redis estiver indisponível ou não configurado
  const recordKey = `verify_otp:${phone || ip}`;
  const record = memoryLimits.get(recordKey);
  if (!record || now > record.resetTime) {
    memoryLimits.set(recordKey, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (record.count >= maxRequests) {
    const minutesLeft = Math.ceil((record.resetTime - now) / 60000);
    logger.warn(`⚠️ [Rate Limit Memory] Bloqueada tentativa de verificação de OTP para ${phone || ip}. Tentativas excedidas.`);
    return res.status(429).json({
      status: 'fail',
      message: `Muitas tentativas incorretas. Tente novamente em ${minutesLeft} minuto(s).`
    });
  }

  record.count += 1;
  next();
};
