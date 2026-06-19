import prisma from '../config/prisma';
import { formatCustomer } from '../services/CustomerService';

export class Customer {
  public static async findById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { addresses: true }
    });
    return formatCustomer(customer);
  }

  public static async findOne(query: any) {
    const where: any = {};
    if (query.email) where.email = query.email;
    if (query.phone) where.phone = query.phone;
    if (query.cpf) where.cpf = query.cpf;
    const customer = await prisma.customer.findFirst({
      where,
      include: { addresses: true }
    });
    return formatCustomer(customer);
  }
}

export type ICustomerDocument = any;
