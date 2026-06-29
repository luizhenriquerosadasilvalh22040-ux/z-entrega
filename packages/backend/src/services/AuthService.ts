import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { formatCustomer } from './CustomerService';
import { formatMerchant } from './MerchantService';
import { redisClient } from '../config/redis';
import { authConfig } from '../config/auth';
import { encryptDeterministic } from '../config/encryption';
import { IAddress, IOperatingHours } from '../types';
import { NotificationService } from './NotificationService';
import { normalizePhone } from '../utils/phone';
import logger from '../config/logger';
import { isProduction } from '../config/runtime';


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

export class AuthService {
  private static memoryTokens = new Map<string, { payload: IUserPayload; expiresAt: number }>();

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
    cnpj: string;
    phone: string;
    category: 'Comida' | 'Farmácia' | 'Construção' | 'Geral';
    operatingHours: IOperatingHours;
    paymentMethods: string[];
    address: IAddress;
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

    const emailExists = await prisma.merchant.findUnique({ where: { email: data.email } });
    if (emailExists) {
      throw new Error('Email already registered');
    }

    const encryptedCnpj = encryptDeterministic(data.cnpj);
    const cnpjExists = await prisma.merchant.findUnique({ where: { cnpj: encryptedCnpj } });
    if (cnpjExists) {
      throw new Error('CNPJ already registered');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const merchant = await prisma.merchant.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        cnpj: encryptedCnpj,
        phone: normalizePhone(data.phone),
        category: data.category,
        openTime: data.operatingHours.open,
        closeTime: data.operatingHours.close,
        paymentMethods: data.paymentMethods,
        street: data.address.street,
        number: data.address.number,
        neighborhood: data.address.neighborhood,
        city: data.address.city,
        state: data.address.state || 'PR',
        zipCode: data.address.zipCode,
        latitude: data.address.coordinates?.lat,
        longitude: data.address.coordinates?.lng,
        termsAcceptedAt: new Date(),
        privacyAcceptedAt: new Date(),
        marketingConsent: !!data.marketingConsent,
        isVerified: false,
        isActive: true,
      }
    });

    return formatMerchant(merchant);
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
    let customer = await prisma.customer.findUnique({
      where: { phone: cleanPhone },
      include: { addresses: true }
    });
    let isNewUser = false;

    const isMock = !process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_ACCESS_TOKEN;
    if (isMock && isProduction()) {
      throw new Error('WhatsApp não configurado. Não é possível enviar código de verificação em produção.');
    }
    const testingPhone = process.env.TESTING_PHONE;
    const testingOtp = process.env.TESTING_OTP || '1234';
    const code = (isMock || (testingPhone && cleanPhone === testingPhone)) ? testingOtp : Math.floor(1000 + Math.random() * 9000).toString(); 
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    if (customer) {
      const updated = await prisma.customer.update({
        where: { id: customer.id },
        data: { 
          verificationCode: code,
          verificationCodeExpires: expires
        },
        include: { addresses: true }
      });
      customer = updated;
    } else {
      if (!name || !address) {
        throw new Error('Customer does not exist and registration details are missing');
      }
      if (!privacy?.termsAccepted || !privacy?.privacyAccepted) {
        throw new Error('Termos de uso e política de privacidade precisam ser aceitos.');
      }
      isNewUser = true;

      const created = await prisma.$transaction(async (tx) => {
        const c = await tx.customer.create({
          data: {
            name,
            phone: cleanPhone,
            verificationCode: code,
            verificationCodeExpires: expires,
            termsAcceptedAt: new Date(),
            privacyAcceptedAt: new Date(),
            marketingConsent: !!privacy.marketingConsent,
            isPhoneVerified: false,
            isActive: true
          }
        });

        await tx.customerAddress.create({
          data: {
            customerId: c.id,
            nickname: 'Principal',
            street: address.street,
            number: address.number,
            neighborhood: address.neighborhood,
            city: address.city,
            state: address.state || 'PR',
            zipCode: address.zipCode,
            complement: address.complement || '',
            referencePoint: address.referencePoint || '',
            latitude: address.coordinates?.lat,
            longitude: address.coordinates?.lng,
            isPrimary: true
          }
        });

        return await tx.customer.findUnique({
          where: { id: c.id },
          include: { addresses: true }
        });
      });
      customer = created;
    }

    try {
      await NotificationService.queueNotification({
        userId: customer!.id,
        userType: 'Customer',
        type: 'WhatsApp',
        target: customer!.phone,
        content: `Olá! Seu código de verificação Traz Pra Cá é: *${code}*.`
      });
    } catch (err) {
      console.error('Erro ao enfileirar notificação de OTP:', err);
    }

    return { isNewUser };
  }

  /**
   * Verifica o código OTP digitado pelo cliente
   */
  public static async verifyCustomerOtp(phone: string, code: string): Promise<{ customer: any } & ITokenResponse> {
    const cleanPhone = normalizePhone(phone);
    const customer = await prisma.customer.findUnique({
      where: { phone: cleanPhone },
      include: { addresses: true }
    });
    
    if (!customer) {
      throw new Error('Cliente não encontrado');
    }

    const isMock = !process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_ACCESS_TOKEN;
    const testingOtp = process.env.TESTING_OTP || '1234';
    const isValidOtp = customer.verificationCode === code || (!isProduction() && isMock && code === testingOtp);

    if (!customer.verificationCode || !isValidOtp) {
      throw new Error('Código de verificação inválido');
    }

    if (customer.verificationCodeExpires && new Date() > new Date(customer.verificationCodeExpires)) {
      throw new Error('Código de verificação expirou');
    }

    const updated = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        isPhoneVerified: true,
        verificationCode: null,
        verificationCodeExpires: null
      },
      include: { addresses: true }
    });

    const tokens = await this.generateTokens({
      userId: updated.id,
      role: 'customer',
      email: updated.email || '',
      name: updated.name,
    });

    return { customer: formatCustomer(updated), ...tokens };
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
