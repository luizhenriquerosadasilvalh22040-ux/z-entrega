import { Request, Response, NextFunction } from 'express';
import { canUploadMedia } from '../domain/accessControl';
import prisma from '../config/prisma';
import { AuditLogService } from '../services/AuditLogService';
import { UploadStorageService, type UploadImageActor } from '../services/UploadStorageService';

export class UploadController {
  public static async uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!canUploadMedia(req.user)) {
        res.status(403).json({ status: 'fail', message: 'Apenas lojistas e administradores podem enviar imagens.' });
        return;
      }

      const { image } = req.body; // string base64
      const actor: UploadImageActor = {
        actorType: req.user!.role === 'admin' ? 'admin' : 'merchant',
        actorId: req.user!.userId,
        context: AuditLogService.getRequestContext(req)
      };
      const publicBaseUrl = process.env.UPLOADS_PUBLIC_URL || `${req.protocol}://${req.get('host')}/uploads`;
      const storedImage = await UploadStorageService.storeImage(image, actor, publicBaseUrl);

      await prisma.$transaction(async (tx) => {
        await AuditLogService.record(tx, {
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: 'MEDIA_UPLOADED',
          entityType: 'Upload',
          entityId: null,
          merchantId: actor.actorType === 'merchant' ? actor.actorId : null,
          metadata: {
            key: storedImage.key,
            storageProvider: storedImage.storageProvider,
            contentType: storedImage.contentType,
            sizeBytes: storedImage.sizeBytes,
            checksum: storedImage.checksum
          },
          context: actor.context
        });
      });

      res.status(200).json({
        status: 'success',
        data: {
          url: storedImage.url,
          key: storedImage.key,
          contentType: storedImage.contentType,
          sizeBytes: storedImage.sizeBytes
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
