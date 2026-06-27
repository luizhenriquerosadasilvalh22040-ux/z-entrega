import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 1_500_000);

const detectImageExtension = (buffer: Buffer): 'png' | 'jpg' | 'webp' | 'gif' | null => {
  if (buffer.length < 12) return null;

  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }

  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }

  const gifHeader = buffer.subarray(0, 6).toString('ascii');
  if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
    return 'gif';
  }

  return null;
};

export class UploadController {
  public static async uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { image } = req.body; // string base64
      if (!image) {
        res.status(400).json({ status: 'fail', message: 'Nenhuma imagem enviada.' });
        return;
      }

      // Espera o formato "data:image/jpeg;base64,..."
      const matches = image.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        res.status(400).json({ status: 'fail', message: 'Formato de imagem inválido. Envie um base64 válido com tipo MIME.' });
        return;
      }

      const requestedExtension = matches[1].toLowerCase();
      const base64Data = matches[2];
      
      const allowedExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
      if (!allowedExtensions.includes(requestedExtension)) {
        res.status(400).json({ status: 'fail', message: 'Apenas imagens PNG, JPG, JPEG, WEBP e GIF são permitidas.' });
        return;
      }

      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
        res.status(413).json({ status: 'fail', message: `Imagem muito grande. Limite: ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB.` });
        return;
      }

      const detectedExtension = detectImageExtension(buffer);
      if (!detectedExtension) {
        res.status(400).json({ status: 'fail', message: 'Conteúdo da imagem inválido.' });
        return;
      }
      
      // Gera nome único para o arquivo
      const fileName = `${Date.now()}-${crypto.randomUUID()}.${detectedExtension}`;
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const filePath = path.join(uploadsDir, fileName);

      fs.mkdirSync(uploadsDir, { recursive: true });
      fs.writeFileSync(filePath, buffer);

      const publicBaseUrl = process.env.UPLOADS_PUBLIC_URL || `${req.protocol}://${req.get('host')}/uploads`;
      const fileUrl = `${publicBaseUrl.replace(/\/$/, '')}/${fileName}`;

      res.status(200).json({
        status: 'success',
        data: {
          url: fileUrl
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
