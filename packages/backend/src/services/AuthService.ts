import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Customer, ICustomerDocument } from '../models/Customer';
import { Merchant, IMerchantDocument } from '../models/Merchant';
import { redisClient } from '../config/redis';
import { authConfig } from '../config/auth';
import { encrypt } from '../config/encryption';
import { IAddress, IOperatingHours } from '../types';
import { NotificationService } from './NotificationService';

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
    
    // Salva o refresh token no Redis com expiração
    const redisKey = `refreshToken:${refreshToken}`;
    const value = JSON.stringify(payload);
    const ttlSeconds = authConfig.refreshExpirationDays * 24 * 60 * 60;
    
    await redisClient.set(redisKey, value, 'EX', ttlSeconds);

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
  }): Promise<ICustomerDocument> {
    // Validações básicas de negócio
    if (data.name.length < 3) {
      throw new Error('Name must be at least 3 characters long');
    }

    const emailExists = await Customer.findOne({ email: data.email });
    if (emailExists) {
      throw new Error('Email already registered');
    }

    const encryptedCpf = encrypt(data.cpf);
    const cpfExists = await Customer.findOne({ cpf: encryptedCpf });
    if (cpfExists) {
      throw new Error('CPF already registered');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const customer = new Customer({
      name: data.name,
      email: data.email,
      passwordHash,
      cpf: encryptedCpf,
      phone: data.phone,
      address: data.address,
      isActive: true,
    });

    return await customer.save();
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
  }): Promise<IMerchantDocument> {
    const validCategories = ['Comida', 'Farmácia', 'Construção', 'Geral'];
    if (!validCategories.includes(data.category)) {
      throw new Error('Invalid merchant category');
    }

    const emailExists = await Merchant.findOne({ email: data.email });
    if (emailExists) {
      throw new Error('Email already registered');
    }

    const encryptedCnpj = encrypt(data.cnpj);
    const cnpjExists = await Merchant.findOne({ cnpj: encryptedCnpj });
    if (cnpjExists) {
      throw new Error('CNPJ already registered');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const merchant = new Merchant({
      name: data.name,
      email: data.email,
      passwordHash,
      cnpj: encryptedCnpj,
      phone: data.phone,
      category: data.category,
      operatingHours: data.operatingHours,
      paymentMethods: data.paymentMethods,
      address: data.address,
      isVerified: false,
      isActive: true,
    });

    return await merchant.save();
  }

  public static async loginCustomer(email: string, password: string): Promise<{ customer: ICustomerDocument } & ITokenResponse> {
    const customer = await Customer.findOne({ email });
    if (!customer || !customer.passwordHash) {
      throw new Error('Invalid email or password');
    }

    if (!customer.isActive) {
      throw new Error('Account deactivated');
    }

    const isMatch = await bcrypt.compare(password, customer.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    const tokens = await this.generateTokens({
      userId: customer._id.toString(),
      role: 'customer',
      email: customer.email || '',
      name: customer.name,
    });

    return { customer, ...tokens };
  }

  /**
   * Login do lojista
   */
  public static async loginMerchant(email: string, password: string): Promise<{ merchant: IMerchantDocument } & ITokenResponse> {
    const merchant = await Merchant.findOne({ email });
    if (!merchant) {
      throw new Error('Invalid email or password');
    }

    if (!merchant.isActive) {
      throw new Error('Account deactivated');
    }

    const isMatch = await bcrypt.compare(password, merchant.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    const tokens = await this.generateTokens({
      userId: merchant._id.toString(),
      role: 'merchant',
      email: merchant.email,
      name: merchant.name,
    });

    return { merchant, ...tokens };
  }

  /**
   * Renova o token de acesso através do refresh token
   */
  public static async refreshAccessToken(refreshToken: string): Promise<ITokenResponse> {
    const redisKey = `refreshToken:${refreshToken}`;
    const value = await redisClient.get(redisKey);
    if (!value) {
      throw new Error('Invalid or expired refresh token');
    }

    // Exclui o refresh token antigo (rotação de refresh tokens)
    await redisClient.del(redisKey);

    const payload: IUserPayload = JSON.parse(value);
    
    // Gera novos tokens
    return await this.generateTokens(payload);
  }

  public static async loginAdmin(email: string, password: string): Promise<{ admin: { name: string; email: string } } & ITokenResponse> {
    if (email === 'admin@trazpraca.com' && password === 'admin123') {
      const tokens = await this.generateTokens({
        userId: 'admin-id-12345',
        role: 'admin',
        email: 'admin@trazpraca.com',
        name: 'Administrador Geral'
      });
      return { admin: { name: 'Administrador Geral', email: 'admin@trazpraca.com' }, ...tokens };
    }
    throw new Error('Invalid email or password');
  }

  /**
   * Realiza logout removendo o refresh token do Redis
   */
  public static async logout(refreshToken: string): Promise<void> {
    const redisKey = `refreshToken:${refreshToken}`;
    await redisClient.del(redisKey);
  }

  /**
   * Solicita um código OTP de verificação via WhatsApp para o cliente
   */
  public static async requestCustomerOtp(phone: string, name?: string, address?: IAddress): Promise<{ isNewUser: boolean }> {
    let customer = await Customer.findOne({ phone });
    let isNewUser = false;

    // Código fixo '1234' para facilitar os testes, ou código randômico em produção
    const code = '1234'; 

    if (customer) {
      customer.verificationCode = code;
      await customer.save();
    } else {
      if (!name || !address) {
        throw new Error('Customer does not exist and registration details are missing');
      }
      isNewUser = true;
      customer = new Customer({
        name,
        phone,
        address,
        verificationCode: code,
        isPhoneVerified: false,
        isActive: true
      });
      await customer.save();
    }

    // Enfileira notificação de WhatsApp com o código OTP
    try {
      await NotificationService.queueNotification({
        userId: customer._id.toString(),
        userType: 'Customer',
        type: 'WhatsApp',
        target: customer.phone,
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
  public static async verifyCustomerOtp(phone: string, code: string): Promise<{ customer: ICustomerDocument } & ITokenResponse> {
    const customer = await Customer.findOne({ phone });
    if (!customer) {
      throw new Error('Cliente não encontrado');
    }

    if (!customer.verificationCode || customer.verificationCode !== code) {
      throw new Error('Código de verificação inválido');
    }

    customer.isPhoneVerified = true;
    customer.verificationCode = undefined; // Limpa o código utilizado
    await customer.save();

    const tokens = await this.generateTokens({
      userId: customer._id.toString(),
      role: 'customer',
      email: customer.email || '',
      name: customer.name,
    });

    return { customer, ...tokens };
  }
}
