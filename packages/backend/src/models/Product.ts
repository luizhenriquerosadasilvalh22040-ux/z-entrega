import prisma from '../config/prisma';
import { formatProduct } from '../services/ProductService';
import { QueryPromise } from './helpers';

export class Product {
  public static async findById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        optionGroups: {
          include: { options: true }
        }
      }
    });
    return formatProduct(product);
  }

  public static async findOne(query: any) {
    const product = await prisma.product.findFirst({
      where: query,
      include: {
        optionGroups: {
          include: { options: true }
        }
      }
    });
    return formatProduct(product);
  }

  public static find(query: any = {}) {
    const where: any = {};
    if (query.merchantId) where.merchantId = query.merchantId;
    if (query.isAvailable !== undefined) where.isAvailable = query.isAvailable;
    
    // Suporte ao mock de $text para busca textual de produtos
    if (query.$text && query.$text.$search) {
      const search = query.$text.$search;
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const promise = prisma.product.findMany({
      where,
      include: {
        optionGroups: {
          include: { options: true }
        }
      }
    }).then(list => list.map(p => formatProduct(p)));

    return new QueryPromise(promise);
  }
}

export type IProductDocument = any;
