import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { AuditRequestContext } from './AuditLogService';

export type UploadImageActor = {
  actorType: 'merchant' | 'admin';
  actorId: string;
  context?: AuditRequestContext;
};

type StoredImage = {
  url: string;
  key: string;
  storageProvider: 'local';
  contentType: string;
  sizeBytes: number;
  checksum: string;
};

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 1_500_000);
const MAX_UPLOAD_BASE64_CHARS = Number(process.env.MAX_UPLOAD_BASE64_CHARS || 2_200_000);
const UPLOAD_STORAGE_PROVIDER = process.env.UPLOAD_STORAGE_PROVIDER || 'local';

const ALLOWED_IMAGE_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif'
} as const;

type RequestedImageExtension = keyof typeof ALLOWED_IMAGE_TYPES;
type StoredImageExtension = 'png' | 'jpg' | 'webp' | 'gif';

export const detectImageExtension = (buffer: Buffer): StoredImageExtension | null => {
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

const parseImageDataUrl = (image: string): { requestedExtension: RequestedImageExtension; buffer: Buffer } => {
  const matches = image.match(/^data:image\/([a-zA-Z]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!matches || matches.length !== 3) {
    throw Object.assign(new Error('Formato de imagem inválido. Envie um base64 válido com tipo MIME.'), { statusCode: 400 });
  }

  const requestedExtension = matches[1].toLowerCase() as RequestedImageExtension;
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_IMAGE_TYPES, requestedExtension)) {
    throw Object.assign(new Error('Apenas imagens PNG, JPG, JPEG, WEBP e GIF são permitidas.'), { statusCode: 400 });
  }

  const base64Data = matches[2];
  if (base64Data.length > MAX_UPLOAD_BASE64_CHARS) {
    throw Object.assign(new Error('Imagem muito grande.'), { statusCode: 413 });
  }

  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
    throw Object.assign(new Error(`Imagem muito grande. Limite: ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB.`), { statusCode: 413 });
  }

  return { requestedExtension, buffer };
};

const assertSupportedStorageProvider = (): void => {
  if (UPLOAD_STORAGE_PROVIDER === 'local') return;
  throw Object.assign(
    new Error(`Storage provider "${UPLOAD_STORAGE_PROVIDER}" ainda não implementado. Configure UPLOAD_STORAGE_PROVIDER=local ou integre S3/R2/Supabase Storage.`),
    { statusCode: 501 }
  );
};

const joinPublicUrl = (publicBaseUrl: string, key: string): string => {
  return `${publicBaseUrl.replace(/\/$/, '')}/${key.split(path.sep).join('/')}`;
};

export class UploadStorageService {
  public static async storeImage(image: string, actor: UploadImageActor, publicBaseUrl: string): Promise<StoredImage> {
    assertSupportedStorageProvider();

    const { requestedExtension, buffer } = parseImageDataUrl(image);
    const detectedExtension = detectImageExtension(buffer);
    if (!detectedExtension) {
      throw Object.assign(new Error('Conteúdo da imagem inválido.'), { statusCode: 400 });
    }

    const requestedContentType = ALLOWED_IMAGE_TYPES[requestedExtension];
    const detectedContentType = ALLOWED_IMAGE_TYPES[detectedExtension];
    if (requestedContentType !== detectedContentType) {
      throw Object.assign(new Error('Tipo MIME da imagem não corresponde ao conteúdo enviado.'), { statusCode: 400 });
    }

    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const safeActorType = actor.actorType === 'admin' ? 'admin' : 'merchant';
    const key = `${safeActorType}/${actor.actorId}/${Date.now()}-${crypto.randomUUID()}.${detectedExtension}`;
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, key);

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, buffer, { flag: 'wx' });

    return {
      url: joinPublicUrl(publicBaseUrl, key),
      key,
      storageProvider: 'local',
      contentType: detectedContentType,
      sizeBytes: buffer.length,
      checksum
    };
  }
}
