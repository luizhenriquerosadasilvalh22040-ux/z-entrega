import prisma from '../config/prisma';

export const formatSystemConfig = (sc: any) => {
  if (!sc) return null;
  return {
    _id: sc.id,
    id: sc.id,
    defaultSubscriptionPrice: Number(sc.defaultSubscriptionPrice),
    createdAt: sc.createdAt,
    updatedAt: sc.updatedAt,
    save: async function() {
      if (!this.id) {
        const created = await prisma.systemConfig.create({
          data: {
            defaultSubscriptionPrice: this.defaultSubscriptionPrice
          }
        });
        Object.assign(this, formatSystemConfig(created));
      } else {
        const updated = await prisma.systemConfig.update({
          where: { id: this.id },
          data: {
            defaultSubscriptionPrice: this.defaultSubscriptionPrice
          }
        });
        Object.assign(this, formatSystemConfig(updated));
      }
      return this;
    }
  };
};

export class SystemConfig {
  _id: any;
  id: any;
  defaultSubscriptionPrice!: number;
  createdAt: any;
  updatedAt: any;
  save!: () => Promise<any>;

  constructor(data: any = {}) {
    this.defaultSubscriptionPrice = data.defaultSubscriptionPrice || 150.00;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    
    // Return mock instance with save
    const self = this;
    return {
      _id: undefined,
      id: undefined,
      defaultSubscriptionPrice: self.defaultSubscriptionPrice,
      createdAt: self.createdAt,
      updatedAt: self.updatedAt,
      save: async function() {
        const created = await prisma.systemConfig.create({
          data: {
            defaultSubscriptionPrice: this.defaultSubscriptionPrice
          }
        });
        const formatted = formatSystemConfig(created);
        Object.assign(this, formatted);
        return this;
      }
    } as any;
  }

  public static async findOne(): Promise<any> {
    let config = await prisma.systemConfig.findFirst();
    if (!config) {
      config = await prisma.systemConfig.create({
        data: { defaultSubscriptionPrice: 150.00 }
      });
    }
    return formatSystemConfig(config)!;
  }

  public static async create(data: any): Promise<any> {
    const config = await prisma.systemConfig.create({
      data: {
        defaultSubscriptionPrice: data.defaultSubscriptionPrice
      }
    });
    return formatSystemConfig(config)!;
  }
}

export type ISystemConfigDocument = any;

