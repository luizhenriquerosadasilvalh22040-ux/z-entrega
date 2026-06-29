import type { Request } from 'express';

type AuditActorType = 'customer' | 'merchant' | 'deliverer' | 'admin' | 'system';

export type AuditRequestContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type AuditLogInput = {
  actorType: AuditActorType;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  orderId?: string | null;
  merchantId?: string | null;
  metadata?: Record<string, unknown>;
  context?: AuditRequestContext;
};

export class AuditLogService {
  public static getRequestContext(req: Request): AuditRequestContext {
    const forwardedFor = req.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return {
      ipAddress: (forwardedIp?.split(',')[0] || req.ip || req.socket.remoteAddress || null)?.trim() || null,
      userAgent: req.get('user-agent') || null
    };
  }

  public static async record(tx: any, input: AuditLogInput): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        orderId: input.orderId ?? null,
        merchantId: input.merchantId ?? null,
        metadata: input.metadata ?? undefined,
        ipAddress: input.context?.ipAddress ?? null,
        userAgent: input.context?.userAgent ?? null
      }
    });
  }
}
