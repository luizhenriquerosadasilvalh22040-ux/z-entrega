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
  const phone = req.body.phone ? req.body.phone.replace(/\D/g, '') : '';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutos
  const maxRequestsIp = 5; // Limite de 5 requisições de OTP por IP
  const maxRequestsPhone = 3; // Limite de 3 requisições de OTP por telefone

  if (redis) {
    try {
      const ipKey = `rate_limit:otp:ip:${ip}`;
      const phoneKey = phone ? `rate_limit:otp:phone:${phone}` : '';

      // Verifica limite por IP
      const ipCountStr = await redis.get(ipKey);
      const ipCount = ipCountStr ? parseInt(ipCountStr, 10) : 0;
      if (ipCount >= maxRequestsIp) {
        const ttl = await redis.ttl(ipKey);
        const minutesLeft = Math.ceil(ttl / 60);
        logger.warn(`⚠️ [Rate Limit Redis] Bloqueado envio de OTP para o IP ${ip}. Tentativas esgotadas.`);
        return res.status(429).json({
          status: 'fail',
          message: `Muitas solicitações de código de verificação para este IP. Tente novamente em ${minutesLeft > 0 ? minutesLeft : 1} minuto(s).`
        });
      }

      // Verifica limite por Telefone
      if (phoneKey) {
        const phoneCountStr = await redis.get(phoneKey);
        const phoneCount = phoneCountStr ? parseInt(phoneCountStr, 10) : 0;
        if (phoneCount >= maxRequestsPhone) {
          const ttl = await redis.ttl(phoneKey);
          const minutesLeft = Math.ceil(ttl / 60);
          logger.warn(`⚠️ [Rate Limit Redis] Bloqueado envio de OTP para o Telefone ${phone}. Tentativas esgotadas.`);
          return res.status(429).json({
            status: 'fail',
            message: `Muitas solicitações de código de verificação para este número de telefone. Tente novamente em ${minutesLeft > 0 ? minutesLeft : 1} minuto(s).`
          });
        }
      }

      // Incrementa ambos
      const multi = redis.multi();
      multi.incr(ipKey);
      if (ipCount === 0) {
        multi.expire(ipKey, Math.ceil(windowMs / 1000));
      }

      if (phoneKey) {
        multi.incr(phoneKey);
        const phoneCountStr = await redis.get(phoneKey);
        if (!phoneCountStr) {
          multi.expire(phoneKey, Math.ceil(windowMs / 1000));
        }
      }

      await multi.exec();
      return next();
    } catch (err) {
      logger.error('Redis rate limit error, falling back to memory:', err);
    }
  }

  // Fallback em memória para IP
  const recordIp = memoryLimits.get(`ip:${ip}`);
  if (!recordIp || now > recordIp.resetTime) {
    memoryLimits.set(`ip:${ip}`, { count: 1, resetTime: now + windowMs });
  } else if (recordIp.count >= maxRequestsIp) {
    const minutesLeft = Math.ceil((recordIp.resetTime - now) / 60000);
    logger.warn(`⚠️ [Rate Limit Memory] Bloqueado envio de OTP para o IP ${ip}. Tentativas esgotadas.`);
    return res.status(429).json({
      status: 'fail',
      message: `Muitas solicitações de código de verificação para este IP. Tente novamente em ${minutesLeft} minuto(s).`
    });
  } else {
    recordIp.count += 1;
  }

  // Fallback em memória para Telefone
  if (phone) {
    const recordPhone = memoryLimits.get(`phone:${phone}`);
    if (!recordPhone || now > recordPhone.resetTime) {
      memoryLimits.set(`phone:${phone}`, { count: 1, resetTime: now + windowMs });
    } else if (recordPhone.count >= maxRequestsPhone) {
      const minutesLeft = Math.ceil((recordPhone.resetTime - now) / 60000);
      logger.warn(`⚠️ [Rate Limit Memory] Bloqueado envio de OTP para o Telefone ${phone}. Tentativas esgotadas.`);
      return res.status(429).json({
        status: 'fail',
        message: `Muitas solicitações de código de verificação para este número de telefone. Tente novamente em ${minutesLeft} minuto(s).`
      });
    } else {
      recordPhone.count += 1;
    }
  }

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

export const resetPasswordRateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutos
  const maxRequests = 5; // Máximo de 5 tentativas por IP

  const key = `rate_limit:reset_password:${ip}`;

  if (redis) {
    try {
      const countStr = await redis.get(key);
      const count = countStr ? parseInt(countStr, 10) : 0;

      if (count >= maxRequests) {
        const ttl = await redis.ttl(key);
        const minutesLeft = Math.ceil(ttl / 60);
        logger.warn(`⚠️ [Rate Limit Redis] Bloqueada redefinição de senha para o IP ${ip}. Tentativas esgotadas.`);
        return res.status(429).json({
          status: 'fail',
          message: `Muitas tentativas de redefinição de senha. Tente novamente em ${minutesLeft > 0 ? minutesLeft : 1} minuto(s).`
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

  // Fallback para memória
  const recordKey = `reset_password:${ip}`;
  const record = memoryLimits.get(recordKey);
  if (!record || now > record.resetTime) {
    memoryLimits.set(recordKey, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (record.count >= maxRequests) {
    const minutesLeft = Math.ceil((record.resetTime - now) / 60000);
    logger.warn(`⚠️ [Rate Limit Memory] Bloqueada redefinição de senha para o IP ${ip}. Tentativas esgotadas.`);
    return res.status(429).json({
      status: 'fail',
      message: `Muitas tentativas de redefinição de senha. Tente novamente em ${minutesLeft} minuto(s).`
    });
  }

  record.count += 1;
  next();
};
