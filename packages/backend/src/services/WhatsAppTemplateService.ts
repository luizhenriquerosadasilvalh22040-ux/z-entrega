import prisma from '../config/prisma';
import logger from '../config/logger';
import { WhatsAppTemplateType } from '@prisma/client';

type TemplateVariables = Record<string, string | number | null | undefined>;
type TemplateDefinition = {
  key: WhatsAppTemplateType;
  label: string;
  description: string;
  variables: string[];
  defaultBody: string;
};

export const WHATSAPP_TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    key: WhatsAppTemplateType.CUSTOMER_OTP,
    label: 'Código de verificação do cliente',
    description: 'Enviado quando o cliente entra ou valida o WhatsApp.',
    variables: ['code'],
    defaultBody: 'Seu código de verificação do Traz Pra Cá é: *{{code}}*. Ele expira em alguns minutos.'
  },
  {
    key: WhatsAppTemplateType.ORDER_CREATED,
    label: 'Pedido criado para cliente',
    description: 'Confirma ao cliente que o pedido foi recebido.',
    variables: ['customerName', 'orderId', 'merchantName', 'total', 'paymentMethod'],
    defaultBody: 'Olá, *{{customerName}}*! Recebemos o seu pedido nº *{{orderId}}* no estabelecimento *{{merchantName}}*. Total: R$ {{total}}. Pagamento: {{paymentMethod}}.'
  },
  {
    key: WhatsAppTemplateType.STORE_ORDER_CREATED,
    label: 'Novo pedido para loja',
    description: 'Aviso ao lojista quando um pedido pode ser aceito.',
    variables: ['customerName', 'orderId', 'paymentMethod', 'total'],
    defaultBody: 'Novo pedido aguardando aceite.\n\nPedido: *{{orderId}}*\nCliente: *{{customerName}}*\nPagamento: *{{paymentMethod}}*\nTotal: R$ {{total}}\n\nAcesse o painel do lojista para aceitar ou cancelar.'
  },
  {
    key: WhatsAppTemplateType.PAYMENT_APPROVED,
    label: 'Pagamento aprovado',
    description: 'Confirma pagamento ao cliente.',
    variables: ['customerName', 'orderId', 'merchantName'],
    defaultBody: 'Olá, *{{customerName}}*! O pagamento do pedido nº *{{orderId}}* foi confirmado. Agora estamos aguardando o aceite de *{{merchantName}}*.'
  },
  {
    key: WhatsAppTemplateType.ORDER_ACCEPTED,
    label: 'Pedido aceito',
    description: 'Aviso ao cliente quando a loja aceita o pedido.',
    variables: ['customerName', 'orderId', 'merchantName', 'estimatedTime'],
    defaultBody: 'Olá, *{{customerName}}*! Seu pedido nº *{{orderId}}* foi aceito por *{{merchantName}}* e já está em preparação. Previsão: {{estimatedTime}}.'
  },
  {
    key: WhatsAppTemplateType.ORDER_CANCELLED,
    label: 'Pedido cancelado',
    description: 'Aviso ao cliente quando pedido é cancelado ou recusado.',
    variables: ['customerName', 'orderId', 'merchantName'],
    defaultBody: 'Olá, *{{customerName}}*! Seu pedido nº *{{orderId}}* em *{{merchantName}}* foi cancelado. Se houve pagamento online, o estorno será tratado pelo sistema.'
  },
  {
    key: WhatsAppTemplateType.ORDER_READY,
    label: 'Pedido pronto',
    description: 'Aviso ao cliente quando pedido está pronto ou indo para entrega.',
    variables: ['customerName', 'orderId', 'merchantName', 'delivererName'],
    defaultBody: 'Olá, *{{customerName}}*! Seu pedido nº *{{orderId}}* de *{{merchantName}}* está pronto. {{delivererName}}'
  },
  {
    key: WhatsAppTemplateType.DELIVERY_REQUEST,
    label: 'Solicitação para motoboy',
    description: 'Mensagem enviada ao motoboy com coleta, entrega e links de resposta.',
    variables: ['delivererName', 'orderId', 'merchantName', 'pickupAddress', 'deliveryAddress', 'deliveryFee', 'acceptUrl', 'rejectUrl'],
    defaultBody: 'Olá, *{{delivererName}}*! Pedido nº *{{orderId}}* pronto para coleta em *{{merchantName}}*.\n\nColeta: {{pickupAddress}}\nEntrega: {{deliveryAddress}}\nTaxa: R$ {{deliveryFee}}\n\nAceitar: {{acceptUrl}}\nRecusar: {{rejectUrl}}'
  },
  {
    key: WhatsAppTemplateType.DELIVERY_ACCEPTED,
    label: 'Entrega aceita',
    description: 'Aviso ao lojista quando um motoboy aceita a entrega.',
    variables: ['merchantName', 'orderId', 'delivererName', 'delivererPhone'],
    defaultBody: 'O motoboy *{{delivererName}}* aceitou a entrega do pedido nº *{{orderId}}*. Telefone: {{delivererPhone}}.'
  }
];

const definitionByKey = new Map(WHATSAPP_TEMPLATE_DEFINITIONS.map((definition) => [definition.key, definition]));

const interpolate = (template: string, variables: TemplateVariables): string => {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = variables[key];
    return value === null || value === undefined ? '' : String(value);
  });
};

const extractPlaceholders = (body: string): string[] => {
  const placeholders = new Set<string>();
  body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    placeholders.add(String(key));
    return '';
  });
  return [...placeholders];
};

export class WhatsAppTemplateService {
  public static async listTemplates(): Promise<any[]> {
    const templates = await prisma.whatsAppTemplate.findMany();
    const templateMap = new Map(templates.map((template) => [template.key, template]));

    return WHATSAPP_TEMPLATE_DEFINITIONS.map((definition) => {
      const saved = templateMap.get(definition.key);
      return {
        ...definition,
        id: saved?.id,
        body: saved?.body || definition.defaultBody,
        isActive: saved?.isActive ?? true,
        locale: saved?.locale || 'pt-BR',
        updatedAt: saved?.updatedAt
      };
    });
  }

  public static async upsertTemplate(input: {
    key: WhatsAppTemplateType;
    body: string;
    isActive?: boolean;
    locale?: string;
  }): Promise<any> {
    const definition = definitionByKey.get(input.key);
    if (!definition) throw new Error('Template WhatsApp inválido.');

    const body = input.body?.trim();
    if (!body || body.length < 10) throw new Error('O corpo do template deve ter pelo menos 10 caracteres.');
    if (body.length > 1500) throw new Error('O corpo do template deve ter no máximo 1500 caracteres.');

    const unknownPlaceholders = extractPlaceholders(body).filter((placeholder) => !definition.variables.includes(placeholder));
    if (unknownPlaceholders.length > 0) {
      throw new Error(`Variáveis não permitidas neste template: ${unknownPlaceholders.join(', ')}.`);
    }

    const template = await prisma.whatsAppTemplate.upsert({
      where: { key: input.key },
      update: {
        body,
        isActive: input.isActive ?? true,
        locale: input.locale || 'pt-BR'
      },
      create: {
        key: input.key,
        body,
        isActive: input.isActive ?? true,
        locale: input.locale || 'pt-BR'
      }
    });

    return {
      ...definition,
      id: template.id,
      body: template.body,
      isActive: template.isActive,
      locale: template.locale,
      updatedAt: template.updatedAt
    };
  }

  public static async render(
    key: WhatsAppTemplateType,
    variables: TemplateVariables,
    fallback?: string,
    tx?: any
  ): Promise<string> {
    try {
      const db = tx || prisma;
      const template = await db.whatsAppTemplate.findFirst({
        where: {
          key,
          isActive: true
        }
      });

      return interpolate(template?.body || fallback || definitionByKey.get(key)?.defaultBody || '', variables);
    } catch (err) {
      logger.error(`Erro ao renderizar template WhatsApp ${key}:`, err);
      return interpolate(fallback || definitionByKey.get(key)?.defaultBody || '', variables);
    }
  }
}
