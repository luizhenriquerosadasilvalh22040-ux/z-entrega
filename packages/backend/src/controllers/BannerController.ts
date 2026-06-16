import { Request, Response, NextFunction } from 'express';
import { Banner } from '../models/Banner';

export class BannerController {
  /**
   * Obtém todos os banners ativos (público)
   */
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const banners = await Banner.find({ isActive: true }).sort({ createdAt: -1 });
      res.status(200).json({
        status: 'success',
        data: { banners }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cria um novo banner (admin)
   */
  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ status: 'fail', message: 'Apenas administradores podem criar banners' });
        return;
      }

      const { imageUrl, title, linkUrl } = req.body;
      if (!imageUrl) {
        res.status(400).json({ status: 'fail', message: 'URL da imagem do banner é obrigatória' });
        return;
      }

      const banner = await Banner.create({
        imageUrl,
        title,
        linkUrl,
        isActive: true
      });

      res.status(201).json({
        status: 'success',
        data: { banner }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove um banner (admin)
   */
  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({ status: 'fail', message: 'Apenas administradores podem remover banners' });
        return;
      }

      const { id } = req.params;
      const banner = await Banner.findByIdAndDelete(id);
      
      if (!banner) {
        res.status(404).json({ status: 'fail', message: 'Banner não encontrado' });
        return;
      }

      res.status(200).json({
        status: 'success',
        message: 'Banner removido com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
}
