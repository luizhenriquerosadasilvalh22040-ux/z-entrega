import prisma from '../config/prisma';
import { QueryPromise } from './helpers';

export const formatNotification = (n: any) => {
  if (!n) return null;
  return {
    _id: n.id,
    id: n.id,
    userId: n.userId,
    userType: n.userType,
    type: n.type,
    target: n.target,
    content: n.content,
    status: n.status,
    errorMessage: n.errorMessage,
    createdAt: n.createdAt,
    sentAt: n.sentAt,
    save: async function() {
      const updated = await prisma.notification.update({
        where: { id: this.id },
        data: {
          status: this.status,
          errorMessage: this.errorMessage,
          sentAt: this.sentAt
        }
      });
      Object.assign(this, formatNotification(updated));
      return this;
    }
  };
};

export class Notification {
  public static async deleteMany(query: any = {}) {
    return await prisma.notification.deleteMany({});
  }

  public static find(query: any = {}) {
    const where: any = {};
    if (query.userId) where.userId = query.userId;
    if (query.userType) where.userType = query.userType;
    if (query.status) where.status = query.status;
    const promise = prisma.notification.findMany({ where }).then(list => list.map(n => formatNotification(n)));
    return new QueryPromise(promise);
  }

  public static async findOne(query: any = {}) {
    const where: any = {};
    if (query.userId) where.userId = query.userId;
    if (query.userType) where.userType = query.userType;
    if (query.status) where.status = query.status;
    const n = await prisma.notification.findFirst({ where });
    return formatNotification(n);
  }
}

export type INotificationDocument = any;
