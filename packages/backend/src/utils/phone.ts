/**
 * Normaliza um número de telefone para o padrão brasileiro com código de país (55)
 * Exemplo: (15) 98821-8568 -> 5515988218568
 */
export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  
  // Se for celular/fixo nacional sem o código de país 55 (geralmente 10 ou 11 dígitos)
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}
