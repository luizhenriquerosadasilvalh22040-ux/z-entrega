import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { formatCustomer } from './CustomerService';
import { formatMerchant } from './MerchantService';
import { redisClient } from '../config/redis';
import { authConfig } from '../config/auth';
import { encryptDeterministic } from '../config/encryption';
import { IAddress } from '../types';
import { NotificationService } from './NotificationService';
import { normalizePhone } from '../utils/phone';
import logger from '../config/logger';
import { isProduction } from '../config/runtime';
import { WhatsAppService } from './WhatsAppService';
import { EmailService } from './EmailService';
import { createNumericOtp, hashOtp, OTP_TTL_SECONDS, verifyOtpHash } from '../domain/otpChallenge';


export interface ITokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface IUserPayload {
  userId: string;
  role: 'customer' | 'merchant' | 'admin';
  email: string;
  name: string;
}

type PendingCustomerRegistration = {
  name: string;
  address: IAddress;
  marketingConsent: boolean;
};

type CustomerOtpChallenge = {
  codeHash: string;
  expiresAt: number;
  pendingRegistration?: PendingCustomerRegistration;
};

export class AuthService {
  private static memoryTokens = new Map<string, { payload: IUserPayload; expiresAt: number }>();
  private static memoryOtpChallenges = new Map<string, CustomerOtpChallenge>();

  /**

   * Gera tokens de acesso e refresh
   */
  public static async generateTokens(payload: IUserPayload): Promise<ITokenResponse> {
    const accessToken = jwt.sign(
      { userId: payload.userId, role: payload.role },
      authConfig.jwtSecret,
      { expiresIn: authConfig.jwtExpiration as any }
    );

    const refreshToken = crypto.randomBytes(40).toString('hex');
    
    const redisKey = `refreshToken:${refreshToken}`;
    const value = JSON.stringify(payload);
    const ttlSeconds = authConfig.refreshExpirationDays * 24 * 60 * 60;
    
    try {
      await redisClient.set(redisKey, value, 'EX', ttlSeconds);
    } catch (err) {
      if (isProduction()) {
        logger.error(`❌ [Redis Error] Falha ao salvar refresh token em produção: ${err instanceof Error ? err.message : String(err)}`);
        throw new Error('Falha ao criar sessão segura. Tente novamente.');
      }
      logger.warn(`⚠️ [Redis Error] Falha ao salvar token no Redis, utilizando cache em memória local: ${err instanceof Error ? err.message : String(err)}`);
      const expiresAt = Date.now() + ttlSeconds * 1000;
      AuthService.memoryTokens.set(refreshToken, { payload, expiresAt });
    }

    return { accessToken, refreshToken };
  }

  /**
   * Registra um novo cliente
   */
  public static async registerCustomer(data: {
    name: string;
    email: string;
    password: string;
    cpf: string;
    phone: string;
    address: IAddress;
    termsAccepted: boolean;
    privacyAccepted: boolean;
    marketingConsent?: boolean;
  }): Promise<any> {
    if (data.name.length < 3) {
      throw new Error('Name must be at least 3 characters long');
    }
    if (!data.termsAccepted || !data.privacyAccepted) {
      throw new Error('Termos de uso e política de privacidade precisam ser aceitos.');
    }

    const emailExists = await prisma.customer.findUnique({ where: { email: data.email } });
    if (emailExists) {
      throw new Error('Email already registered');
    }

    const encryptedCpf = encryptDeterministic(data.cpf);
    const cpfExists = await prisma.customer.findUnique({ where: { cpf: encryptedCpf } });
    if (cpfExists) {
      throw new Error('CPF already registered');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const customer = await prisma.$transaction(async (tx) => {
      const c = await tx.customer.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash,
          cpf: encryptedCpf,
          phone: normalizePhone(data.phone),
          termsAcceptedAt: new Date(),
          privacyAcceptedAt: new Date(),
          marketingConsent: !!data.marketingConsent,
          isActive: true,
        }
      });

      await tx.customerAddress.create({
        data: {
          customerId: c.id,
          nickname: 'Principal',
          street: data.address.street,
          number: data.address.number,
          neighborhood: data.address.neighborhood,
          city: data.address.city,
          state: data.address.state || 'PR',
          zipCode: data.address.zipCode,
          complement: data.address.complement || '',
          referencePoint: data.address.referencePoint || '',
          latitude: data.address.coordinates?.lat,
          longitude: data.address.coordinates?.lng,
          isPrimary: true
        }
      });

      return await tx.customer.findUnique({
        where: { id: c.id },
        include: { addresses: true }
      });
    });

    return formatCustomer(customer);
  }

  /**
   * Registra um novo lojista
   */
  public static async registerMerchant(data: {
    name: string;
    email: string;
    password: string;
    phone: string;
    category: 'Comida' | 'Farmácia' | 'Construção' | 'Geral';
    termsAccepted: boolean;
    privacyAccepted: boolean;
    marketingConsent?: boolean;
  }): Promise<any> {
    const validCategories = ['Comida', 'Farmácia', 'Construção', 'Geral'];
    if (!validCategories.includes(data.category)) {
      throw new Error('Invalid merchant category');
    }
    if (!data.termsAccepted || !data.privacyAccepted) {
      throw new Error('Termos de uso e política de privacidade precisam ser aceitos.');
    }

    const email = data.email.trim().toLowerCase();
    const emailExists = await prisma.merchant.findUnique({ where: { email } });
    if (emailExists) {
      throw new Error('Email already registered');
    }

    EmailService.assertAvailable();
    const passwordHash = await bcrypt.hash(data.password, 10);
    const verificationCode = EmailService.isMock()
      ? (process.env.TESTING_EMAIL_OTP || '123456')
      : createNumericOtp();

    const merchant = await prisma.merchant.create({
      data: {
        name: data.name.trim(),
        email,
        passwordHash,
        phone: normalizePhone(data.phone),
        category: data.category,
        paymentMethods: [],
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
        marketingConsent: !!data.marketingConsent,
        isVerified: false,
        isEmailVerified: false,
        emailVerificationCodeHash: hashOtp('merchant-email', email, verificationCode, authConfig.jwtSecret),
        emailVerificationExpires: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
        isActive: true,
      }
    });

    await EmailService.sendMerchantVerificationCode(email, merchant.name, verificationCode);
    return formatMerchant(merchant);
  }

  public static async verifyMerchantEmail(
    emailInput: string,
    code: string
  ): Promise<{ merchant: any } & ITokenResponse> {
    const email = emailInput.trim().toLowerCase();
    const merchant = await prisma.merchant.findUnique({ where: { email } });
    if (
      !merchant ||
      !merchant.emailVerificationCodeHash ||
      !merchant.emailVerificationExpires ||
      merchant.emailVerificationExpires.getTime() < Date.now() ||
      !verifyOtpHash(
        merchant.emailVerificationCodeHash,
        'merchant-email',
        email,
        code,
        authConfig.jwtSecret
      )
    ) {
      throw new Error('Código de verificação inválido ou expirado.');
    }

    const updated = await prisma.merchant.update({
      where: { id: merchant.id },
      data: {
        isEmailVerified: true,
        emailVerificationCodeHash: null,
        emailVerificationExpires: null
      }
    });
    const tokens = await this.generateTokens({
      userId: updated.id,
      role: 'merchant',
      email: updated.email,
      name: updated.name
    });
    return { merchant: formatMerchant(updated), ...tokens };
  }

  public static async resendMerchantEmailVerification(emailInput: string): Promise<void> {
    EmailService.assertAvailable();
    const email = emailInput.trim().toLowerCase();
    const merchant = await prisma.merchant.findUnique({ where: { email } });
    if (!merchant || merchant.isEmailVerified) return;

    const code = EmailService.isMock()
      ? (process.env.TESTING_EMAIL_OTP || '123456')
      : createNumericOtp();
    await prisma.merchant.update({
      where: { id: merchant.id },
      data: {
        emailVerificationCodeHash: hashOtp('merchant-email', email, code, authConfig.jwtSecret),
        emailVerificationExpires: new Date(Date.now() + OTP_TTL_SECONDS * 1000)
      }
    });
    await EmailService.sendMerchantVerificationCode(email, merchant.name, code);
  }

  public static async loginCustomer(identifier: string, password: string): Promise<{ customer: any } & ITokenResponse> {
    const isEmail = identifier.includes('@');
    const normalizedPhone = isEmail ? '' : normalizePhone(identifier);

    const customer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email: isEmail ? identifier : undefined },
          { phone: isEmail ? undefined : normalizedPhone }
        ]
      },
      include: { addresses: true }
    });
    
    if (!customer || !customer.passwordHash) {
      const err: any = new Error('E-mail/telefone ou senha inválidos, ou conta sem senha configurada (use o login via WhatsApp).');
      err.statusCode = 401;
      throw err;
    }

    if (!customer.isActive) {
      const err: any = new Error('Conta desativada');
      err.statusCode = 403;
      throw err;
    }

    const isMatch = await bcrypt.compare(password, customer.passwordHash);
    if (!isMatch) {
      const err: any = new Error('E-mail/telefone ou senha inválidos');
      err.statusCode = 401;
      throw err;
    }

    const tokens = await this.generateTokens({
      userId: customer.id,
      role: 'customer',
      email: customer.email || '',
      name: customer.name,
    });

    return { customer: formatCustomer(customer), ...tokens };
  }

  /**
   * Login do lojista
   */
  public static async loginMerchant(email: string, password: string): Promise<{ merchant: any } & ITokenResponse> {
    const merchant = await prisma.merchant.findUnique({
      where: { email }
    });
    
    if (!merchant) {
      const err: any = new Error('E-mail ou senha inválidos');
      err.statusCode = 401;
      throw err;
    }

    if (!merchant.isActive) {
      const err: any = new Error('Conta desativada');
      err.statusCode = 403;
      throw err;
    }
    if (!merchant.isEmailVerified) {
      const err: any = new Error('Confirme o e-mail da loja antes de entrar.');
      err.statusCode = 403;
      throw err;
    }

    const isMatch = await bcrypt.compare(password, merchant.passwordHash);
    if (!isMatch) {
      const err: any = new Error('E-mail ou senha inválidos');
      err.statusCode = 401;
      throw err;
    }

    const tokens = await this.generateTokens({
      userId: merchant.id,
      role: 'merchant',
      email: merchant.email,
      name: merchant.name,
    });

    return { merchant: formatMerchant(merchant), ...tokens };
  }

  /**
   * Renova o token de acesso
   */
  public static async refreshAccessToken(refreshToken: string): Promise<ITokenResponse> {
    const redisKey = `refreshToken:${refreshToken}`;
    let value: string | null = null;

    try {
      value = await redisClient.get(redisKey);
      if (value) {
        await redisClient.del(redisKey);
      }
    } catch (err) {
      if (isProduction()) {
        logger.error(`❌ [Redis Error] Falha ao ler refresh token em produção: ${err instanceof Error ? err.message : String(err)}`);
        throw new Error('Sessão temporariamente indisponível. Faça login novamente.');
      }
      logger.warn(`⚠️ [Redis Error] Falha ao ler do Redis no refreshAccessToken, buscando no cache em memória local: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!value && !isProduction()) {
      const cached = AuthService.memoryTokens.get(refreshToken);
      if (cached) {
        if (Date.now() > cached.expiresAt) {
          AuthService.memoryTokens.delete(refreshToken);
          throw new Error('Invalid or expired refresh token');
        }
        value = JSON.stringify(cached.payload);
        AuthService.memoryTokens.delete(refreshToken);
      }
    }

    if (!value) {
      throw new Error('Invalid or expired refresh token');
    }

    const payload: IUserPayload = JSON.parse(value);
    return await this.generateTokens(payload);
  }

  public static async loginAdmin(email: string, password: string): Promise<{ admin: { name: string; email: string } } & ITokenResponse> {
    // 1. Tenta buscar o admin no banco de dados
    const admin = await prisma.systemAdmin.findUnique({
      where: { email }
    });

    if (!admin) {
      const err: any = new Error('E-mail ou senha inválidos');
      err.statusCode = 401;
      throw err;
    }

    if (!admin.isActive) {
      const err: any = new Error('Conta desativada');
      err.statusCode = 403;
      throw err;
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      const err: any = new Error('E-mail ou senha inválidos');
      err.statusCode = 401;
      throw err;
    }

    const tokens = await this.generateTokens({
      userId: admin.id,
      role: 'admin',
      email: admin.email,
      name: admin.name
    });

    return { admin: { name: admin.name, email: admin.email }, ...tokens };
  }

  public static async logout(refreshToken: string): Promise<void> {
    const redisKey = `refreshToken:${refreshToken}`;
    try {
      await redisClient.del(redisKey);
    } catch (err) {
      logger.warn(`⚠️ [Redis Error] Falha ao deletar do Redis no logout: ${err instanceof Error ? err.message : String(err)}`);
    }
    AuthService.memoryTokens.delete(refreshToken);
  }

  /**
   * Solicita um código OTP de verificação via WhatsApp para o cliente
   */
  public static async requestCustomerOtp(
    phone: string,
    name?: string,
    address?: IAddress,
    privacy?: { termsAccepted?: boolean; privacyAccepted?: boolean; marketingConsent?: boolean }
  ): Promise<{ isNewUser: boolean }> {
    const cleanPhone = normalizePhone(phone);
    const customer = await prisma.customer.findUnique({ where: { phone: cleanPhone } });
    const isNewUser = !customer;

    const isMock = !process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_ACCESS_TOKEN;
    if (isMock && isProduction()) {
      throw new Error('WhatsApp não configurado. Não é possível enviar código de verificação em produção.');
    }
    const testingPhone = process.env.TESTING_PHONE;
    const code = (isMock || (testingPhone && cleanPhone === testingPhone))
      ? (process.env.TESTING_OTP || '123456')
      : createNumericOtp();

    let pendingRegistration: PendingCustomerRegistration | undefined;
    if (!customer) {
      if (!name || !address) {
        throw new Error('Customer does not exist and registration details are missing');
      }
      if (!privacy?.termsAccepted || !privacy?.privacyAccepted) {
        throw new Error('Termos de uso e política de privacidade precisam ser aceitos.');
      }
      pendingRegistration = {
        name: name.trim(),
        address,
        marketingConsent: !!privacy.marketingConsent
      };
    }

    const challenge: CustomerOtpChallenge = {
      codeHash: hashOtp('customer-whatsapp', cleanPhone, code, authConfig.jwtSecret),
      expiresAt: Date.now() + OTP_TTL_SECONDS * 1000,
      pendingRegistration
    };
    const challengeKey = `customerOtp:${cleanPhone}`;
    try {
      await redisClient.set(challengeKey, JSON.stringify(challenge), 'EX', OTP_TTL_SECONDS);
    } catch (err) {
      if (isProduction()) {
        throw new Error('Não foi possível criar uma verificação segura. Tente novamente.');
      }
      AuthService.memoryOtpChallenges.set(challengeKey, challenge);
    }

    try {
      await WhatsAppService.sendMessage(
        cleanPhone,
        `Seu código de verificação Traz Pra Cá é: *${code}*. Ele expira em 10 minutos.`
      );
    } catch (error) {
      await redisClient.del(challengeKey).catch(() => undefined);
      AuthService.memoryOtpChallenges.delete(challengeKey);
      throw error;
    }

    return { isNewUser };
  }

  /**
   * Verifica o código OTP digitado pelo cliente
   */
  public static async verifyCustomerOtp(phone: string, code: string): Promise<{ customer: any } & ITokenResponse> {
    const cleanPhone = normalizePhone(phone);
    const challengeKey = `customerOtp:${cleanPhone}`;
    let challenge: CustomerOtpChallenge | undefined;
    try {
      const serialized = await redisClient.get(challengeKey);
      if (serialized) challenge = JSON.parse(serialized) as CustomerOtpChallenge;
    } catch (err) {
      if (isProduction()) throw new Error('Verificação temporariamente indisponível.');
      challenge = AuthService.memoryOtpChallenges.get(challengeKey);
    }

    if (!challenge || challenge.expiresAt < Date.now()) {
      throw new Error('Código de verificação expirado. Solicite um novo código.');
    }
    if (!verifyOtpHash(
      challenge.codeHash,
      'customer-whatsapp',
      cleanPhone,
      code,
      authConfig.jwtSecret
    )) {
      throw new Error('Código de verificação inválido.');
    }

    let customer = await prisma.customer.findUnique({
      where: { phone: cleanPhone },
      include: { addresses: true }
    });

    if (!customer) {
      if (!challenge.pendingRegistration) {
        throw new Error('Dados de cadastro não encontrados. Reinicie o cadastro.');
      }
      const pending = challenge.pendingRegistration;
      customer = await prisma.$transaction(async (tx) => {
        const created = await tx.customer.create({
          data: {
            name: pending.name,
            phone: cleanPhone,
            termsAcceptedAt: new Date(),
            privacyAcceptedAt: new Date(),
            marketingConsent: pending.marketingConsent,
            isPhoneVerified: true,
            isActive: true
          }
        });
        await tx.customerAddress.create({
          data: {
            customerId: created.id,
            nickname: 'Principal',
            street: pending.address.street,
            number: pending.address.number,
            neighborhood: pending.address.neighborhood,
            city: pending.address.city,
            state: pending.address.state || 'PR',
            zipCode: pending.address.zipCode,
            complement: pending.address.complement || '',
            referencePoint: pending.address.referencePoint || '',
            latitude: pending.address.coordinates?.lat,
            longitude: pending.address.coordinates?.lng,
            isPrimary: true
          }
        });
        return tx.customer.findUniqueOrThrow({
          where: { id: created.id },
          include: { addresses: true }
        });
      });
    } else {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          isPhoneVerified: true,
          verificationCode: null,
          verificationCodeExpires: null
        },
        include: { addresses: true }
      });
    }

    await redisClient.del(challengeKey).catch(() => undefined);
    AuthService.memoryOtpChallenges.delete(challengeKey);

    const tokens = await this.generateTokens({
      userId: customer.id,
      role: 'customer',
      email: customer.email || '',
      name: customer.name,
    });

    return { customer: formatCustomer(customer), ...tokens };
  }

  /**
   * Solicita um token de recuperação de senha (Merchant ou Admin)
   */
  public static async forgotPassword(email: string, role: 'merchant' | 'admin'): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    if (role === 'merchant') {
      const merchant = await prisma.merchant.findUnique({ where: { email } });
      if (!merchant) {
        throw new Error('E-mail de estabelecimento não cadastrado.');
      }

      await prisma.merchant.update({
        where: { id: merchant.id },
        data: {
          passwordResetToken: token,
          passwordResetExpires: expires
        }
      });

      try {
        const nId = await NotificationService.queueNotification({
          userId: merchant.id,
          userType: 'Merchant',
          type: 'WhatsApp',
          target: merchant.phone,
          content: `Olá, *${merchant.name}*! O seu código para redefinição de senha no Traz Pra Cá é: *${token}*. Ele é válido por 1 hora.`
        });
        await NotificationService.addJobToQueue(nId);
      } catch (err) {
        console.error('Erro ao enviar token de redefinição via WhatsApp/Bull:', err);
      }
    } else if (role === 'admin') {
      const admin = await prisma.systemAdmin.findUnique({ where: { email } });

      if (!admin) {
        throw new Error('E-mail de administrador não encontrado.');
      }

      await prisma.systemAdmin.update({
        where: { id: admin.id },
        data: {
          passwordResetToken: token,
          passwordResetExpires: expires
        }
      });

      console.log(`🔑 [Recuperação de Senha] Token para o administrador (${email}) é: ${token}`);
    }
  }

  /**
   * Redefine a senha utilizando um token válido
   */
  public static async resetPassword(token: string, newPassword: string, role: 'merchant' | 'admin'): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 10);

    if (role === 'merchant') {
      const merchant = await prisma.merchant.findFirst({
        where: {
          passwordResetToken: token,
          passwordResetExpires: { gte: new Date() }
        }
      });

      if (!merchant) {
        throw new Error('Código de redefinição inválido ou expirado.');
      }

      await prisma.merchant.update({
        where: { id: merchant.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpires: null
        }
      });
    } else if (role === 'admin') {
      const admin = await prisma.systemAdmin.findFirst({
        where: {
          passwordResetToken: token,
          passwordResetExpires: { gte: new Date() }
        }
      });

      if (!admin) {
        throw new Error('Código de redefinição inválido ou expirado.');
      }

      await prisma.systemAdmin.update({
        where: { id: admin.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpires: null
        }
      });
    }
  }
}
