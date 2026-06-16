import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

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

      const fileExtension = matches[1];
      const base64Data = matches[2];
      
      const allowedExtensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
      if (!allowedExtensions.includes(fileExtension.toLowerCase())) {
        res.status(400).json({ status: 'fail', message: 'Apenas imagens PNG, JPG, JPEG, WEBP e GIF são permitidas.' });
        return;
      }

      const buffer = Buffer.from(base64Data, 'base64');
      
      // Gera nome único para o arquivo
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}.${fileExtension}`;
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const filePath = path.join(uploadsDir, fileName);

      fs.writeFileSync(filePath, buffer);

      const protocol = req.protocol;
      const host = req.get('host');
      const fileUrl = `${protocol}://${host}/uploads/${fileName}`;

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
