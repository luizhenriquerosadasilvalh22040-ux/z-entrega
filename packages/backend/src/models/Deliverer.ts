import prisma from '../config/prisma';
import { QueryPromise } from './helpers';

export const formatDeliverer = (d: any) => {
  if (!d) return null;
  return {
    _id: d.id,
    id: d.id,
    name: d.name,
    email: d.email,
    passwordHash: d.passwordHash,
    phone: d.phone,
    vehicle: d.vehicleType,
    plate: d.licensePlate,
    isActive: d.isActive,
    isAvailable: d.isAvailable,
    isActiveToday: d.isActiveToday,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    save: async function() {
      const updated = await prisma.deliverer.update({
        where: { id: this.id },
        data: {
          name: this.name,
          email: this.email,
          passwordHash: this.passwordHash,
          phone: this.phone,
          vehicleType: this.vehicle,
          licensePlate: this.plate,
          isActive: this.isActive,
          isAvailable: this.isAvailable,
          isActiveToday: this.isActiveToday
        }
      });
      Object.assign(this, formatDeliverer(updated));
      return this;
    }
  };
};

export class Deliverer {
  public static async findById(id: string): Promise<any> {
    const d = await prisma.deliverer.findUnique({ where: { id } });
    return formatDeliverer(d)!;
  }

  public static async findOne(query: any): Promise<any> {
    const where: any = {};
    if (query.email) where.email = query.email;
    if (query.phone) where.phone = query.phone;
    if (query.id) where.id = query.id;
    const d = await prisma.deliverer.findFirst({ where });
    return formatDeliverer(d)!;
  }

  public static find(query: any = {}) {
    const where: any = {};
    if (query.isActiveToday !== undefined) where.isActiveToday = query.isActiveToday;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.isAvailable !== undefined) where.isAvailable = query.isAvailable;
    
    const promise = prisma.deliverer.findMany({ where }).then(list => list.map(d => formatDeliverer(d)!));
    return new QueryPromise(promise);
  }

  public static async countDocuments(query: any = {}): Promise<number> {
    const where: any = {};
    if (query.isActiveToday !== undefined) where.isActiveToday = query.isActiveToday;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.isAvailable !== undefined) where.isAvailable = query.isAvailable;
    
    return await prisma.deliverer.count({ where });
  }

  public static async create(data: any) {
    const d = await prisma.deliverer.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        phone: data.phone,
        vehicleType: data.vehicle || 'Moto',
        licensePlate: data.plate,
        isActive: data.isActive !== undefined ? data.isActive : true,
        isAvailable: data.isAvailable !== undefined ? data.isAvailable : false,
        isActiveToday: data.isActiveToday !== undefined ? data.isActiveToday : false
      }
    });
    return formatDeliverer(d);
  }

  public static async findByIdAndDelete(id: string) {
    const d = await prisma.deliverer.delete({ where: { id } });
    return formatDeliverer(d);
  }
}

export type IDelivererDocument = any;

