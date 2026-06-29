import prisma from '../config/prisma';
import { IAddress, ISavedAddress } from '../types';

export const formatCustomer = (customer: any) => {
  if (!customer) return null;
  
  const primaryAddress = customer.addresses?.find((a: any) => a.isPrimary) || customer.addresses?.[0];
  const savedAddresses = customer.addresses?.filter((a: any) => !a.isPrimary) || [];
  
  return {
    _id: customer.id,
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    isPhoneVerified: customer.isPhoneVerified,
    hasPassword: !!customer.passwordHash,
    hasCpf: !!customer.cpf,
    isActive: customer.isActive,
    termsAcceptedAt: customer.termsAcceptedAt || undefined,
    privacyAcceptedAt: customer.privacyAcceptedAt || undefined,
    marketingConsent: !!customer.marketingConsent,
    dataDeletionRequestedAt: customer.dataDeletionRequestedAt || undefined,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    address: primaryAddress ? {
      street: primaryAddress.street,
      number: primaryAddress.number,
      neighborhood: primaryAddress.neighborhood,
      city: primaryAddress.city,
      state: primaryAddress.state,
      zipCode: primaryAddress.zipCode,
      complement: primaryAddress.complement || '',
      referencePoint: primaryAddress.referencePoint || '',
      coordinates: primaryAddress.latitude && primaryAddress.longitude ? {
        lat: Number(primaryAddress.latitude),
        lng: Number(primaryAddress.longitude)
      } : undefined
    } : {
      street: '',
      number: '',
      neighborhood: '',
      city: '',
      state: 'PR',
      zipCode: ''
    },
    savedAddresses: savedAddresses.map((sa: any) => ({
      nickname: sa.nickname,
      street: sa.street,
      number: sa.number,
      neighborhood: sa.neighborhood,
      city: sa.city,
      state: sa.state,
      zipCode: sa.zipCode,
      complement: sa.complement || '',
      referencePoint: sa.referencePoint || '',
      coordinates: sa.latitude && sa.longitude ? {
        lat: Number(sa.latitude),
        lng: Number(sa.longitude)
      } : undefined
    })),
    // Função fake para compatibilidade Mongoose .save()
    save: async function() {
      const updateData: any = {
        name: this.name,
        email: this.email,
        phone: this.phone,
        isPhoneVerified: this.isPhoneVerified,
        isActive: this.isActive
      };
      
      const updated = await prisma.customer.update({
        where: { id: this.id },
        data: updateData,
        include: { addresses: true }
      });
      
      Object.assign(this, formatCustomer(updated));
      return this;
    },
    toObject: function() {
      const { save, toObject, markModified, ...rest } = this;
      return rest;
    },
    markModified: function(path: string) {
      // no-op para compatibilidade Mongoose
    }
  };
};

export class CustomerService {
  public static async listCustomers(page = 1, limit = 20): Promise<any[]> {
    const skip = (page - 1) * limit;
    const customers = await prisma.customer.findMany({
      take: limit,
      skip: skip,
      include: { addresses: true }
    });
    return customers.map(c => formatCustomer(c));
  }

  public static async getCustomerById(id: string): Promise<any | null> {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { addresses: true }
    });
    return formatCustomer(customer);
  }

  public static async updateProfile(
    id: string, 
    data: { name?: string; phone?: string; savedAddresses?: ISavedAddress[] }
  ): Promise<any | null> {
    if (data.savedAddresses) {
      await prisma.$transaction(async (tx) => {
        // Deleta todos os endereços não-primários anteriores
        await tx.customerAddress.deleteMany({
          where: { customerId: id, isPrimary: false }
        });

        // Insere os novos endereços
        if (data.savedAddresses && data.savedAddresses.length > 0) {
          await tx.customerAddress.createMany({
            data: data.savedAddresses.map(sa => ({
              customerId: id,
              nickname: sa.nickname,
              street: sa.street,
              number: sa.number,
              neighborhood: sa.neighborhood,
              city: sa.city,
              state: sa.state || 'PR',
              zipCode: sa.zipCode,
              complement: sa.complement || '',
              referencePoint: sa.referencePoint || '',
              latitude: sa.coordinates?.lat,
              longitude: sa.coordinates?.lng,
              isPrimary: false
            }))
          });
        }
      });
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone;

    const customer = await prisma.customer.update({
      where: { id },
      data: updateData,
      include: { addresses: true }
    });

    return formatCustomer(customer);
  }

  public static async updateAddress(id: string, address: IAddress): Promise<any | null> {
    await prisma.$transaction(async (tx) => {
      const existingPrimary = await tx.customerAddress.findFirst({
        where: { customerId: id, isPrimary: true }
      });

      if (existingPrimary) {
        await tx.customerAddress.update({
          where: { id: existingPrimary.id },
          data: {
            street: address.street,
            number: address.number,
            neighborhood: address.neighborhood,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode,
            complement: address.complement || '',
            referencePoint: address.referencePoint || '',
            latitude: address.coordinates?.lat,
            longitude: address.coordinates?.lng
          }
        });
      } else {
        await tx.customerAddress.create({
          data: {
            customerId: id,
            nickname: 'Principal',
            street: address.street,
            number: address.number,
            neighborhood: address.neighborhood,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode,
            complement: address.complement || '',
            referencePoint: address.referencePoint || '',
            latitude: address.coordinates?.lat,
            longitude: address.coordinates?.lng,
            isPrimary: true
          }
        });
      }
    });

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { addresses: true }
    });

    return formatCustomer(customer);
  }

  public static async deactivateCustomer(id: string): Promise<any | null> {
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        isActive: false,
        dataDeletionRequestedAt: new Date()
      },
      include: { addresses: true }
    });
    return formatCustomer(customer);
  }

  public static async reactivateCustomer(id: string): Promise<any | null> {
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        isActive: true,
        dataDeletionRequestedAt: null
      },
      include: { addresses: true }
    });
    return formatCustomer(customer);
  }

  public static async getByCity(city: string): Promise<any[]> {
    const customers = await prisma.customer.findMany({
      where: {
        addresses: {
          some: {
            city: { contains: city, mode: 'insensitive' }
          }
        }
      },
      include: { addresses: true }
    });
    return customers.map(c => formatCustomer(c));
  }

  public static async countCustomers(): Promise<number> {
    return await prisma.customer.count({
      where: { isActive: true }
    });
  }
}
