export function normalizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const normalized = normalizeWhatsAppPhone(phone);
  const query = new URLSearchParams();
  if (normalized) query.set('phone', normalized);
  if (message.trim()) query.set('text', message.trim());
  return `https://web.whatsapp.com/send?${query.toString()}`;
}

