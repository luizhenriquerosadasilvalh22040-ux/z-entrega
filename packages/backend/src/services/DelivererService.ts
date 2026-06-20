import prisma from '../config/prisma';

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
    updatedAt: d.updatedAt
  };
};

export class DelivererService {
  // Lógicas adicionais de Deliverer se necessário
}
