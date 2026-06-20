import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';

const formatBanner = (b: any) => {
  if (!b) return null;
  return {
    _id: b.id,
    id: b.id,
    imageUrl: b.imageUrl,
    title: b.title,
    isActive: b.isActive,
    createdAt: b.createdAt
  };
};

export class BannerController {
  /**
   * Obtém todos os banners ativos (público)
   */
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dbBanners = await prisma.banner.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      });
      const banners = dbBanners.map(b => formatBanner(b));
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

      const { imageUrl, title } = req.body;
      if (!imageUrl) {
        res.status(400).json({ status: 'fail', message: 'URL da imagem do banner é obrigatória' });
        return;
      }

      const dbBanner = await prisma.banner.create({
        data: {
          imageUrl,
          title: title || null,
          isActive: true
        }
      });

      const banner = formatBanner(dbBanner);

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
      const existing = await prisma.banner.findUnique({
        where: { id }
      });
      
      if (!existing) {
        res.status(404).json({ status: 'fail', message: 'Banner não encontrado' });
        return;
      }

      await prisma.banner.delete({
        where: { id }
      });

      res.status(200).json({
        status: 'success',
        message: 'Banner removido com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
}

