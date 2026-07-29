import { apiClient } from '../../../services/apiClient';
import { compressImage } from '../../../utils/imageCompressor';

export type ImagePreset = 'product' | 'logo' | 'cover';

const presets: Record<ImagePreset, { width: number; height: number; quality: number }> = {
  product: { width: 800, height: 800, quality: 0.76 },
  logo: { width: 800, height: 800, quality: 0.78 },
  cover: { width: 1400, height: 700, quality: 0.78 }
};

export async function uploadMerchantImage(file: File, preset: ImagePreset): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem válido.');
  }

  const config = presets[preset];
  const compressed = await compressImage(file, config.width, config.height, config.quality);
  const response = await apiClient.post('/upload', { image: compressed });
  return response.data.data.url;
}

