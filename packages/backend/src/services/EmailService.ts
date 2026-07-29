import nodemailer from 'nodemailer';
import logger from '../config/logger';
import { isProduction } from '../config/runtime';

const hasSmtpConfig = (): boolean =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export class EmailService {
  public static isMock(): boolean {
    return !hasSmtpConfig();
  }

  public static assertAvailable(): void {
    if (isProduction() && !hasSmtpConfig()) {
      const error = new Error('Validação por e-mail temporariamente indisponível.');
      (error as Error & { statusCode?: number }).statusCode = 503;
      throw error;
    }
  }

  public static async sendMerchantVerificationCode(email: string, storeName: string, code: string): Promise<void> {
    if (!hasSmtpConfig()) {
      logger.info('[Email Mock] Código de verificação para %s: %s', email, code);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'Confirme o e-mail da sua loja',
      text: `Olá! O código para confirmar o e-mail da loja ${storeName} é ${code}. Ele expira em 10 minutos.`,
      html: `<p>Olá!</p><p>O código para confirmar o e-mail da loja <strong>${storeName}</strong> é:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>Ele expira em 10 minutos.</p>`
    });
  }
}
