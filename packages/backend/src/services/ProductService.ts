import prisma from '../config/prisma';

export const formatProduct = (product: any) => {
  if (!product) return null;
  return {
    _id: product.id,
    id: product.id,
    merchantId: product.merchantId,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    category: product.category,
    image: product.image || undefined,
    isAvailable: product.isAvailable,
    stockQuantity: product.stockQuantity,
    isPaused: product.isPaused,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    optionGroups: product.optionGroups?.map((og: any) => ({
      name: og.name,
      required: og.required,
      minSelect: og.minSelect,
      maxSelect: og.maxSelect,
      options: og.options?.map((o: any) => ({
        name: o.name,
        price: Number(o.price)
      })) || []
    })) || []
  };
};

export class ProductService {
  public static async createProduct(
    merchantId: string,
    data: { 
      name: string; 
      description: string; 
      price: number; 
      category: string; 
      image?: string;
      stockQuantity?: number;
      optionGroups?: any[];
    }
  ): Promise<any> {
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          merchantId,
          name: data.name,
          description: data.description,
          price: data.price,
          category: data.category,
          image: data.image || null,
          stockQuantity: data.stockQuantity !== undefined ? data.stockQuantity : 99,
          isAvailable: true,
          isPaused: false
        }
      });

      if (data.optionGroups && data.optionGroups.length > 0) {
        for (const og of data.optionGroups) {
          const group = await tx.productOptionGroup.create({
            data: {
              productId: p.id,
              name: og.name,
              required: og.required || false,
              minSelect: og.minSelect !== undefined ? og.minSelect : 0,
              maxSelect: og.maxSelect !== undefined ? og.maxSelect : 1
            }
          });

          if (og.options && og.options.length > 0) {
            await tx.productOption.createMany({
              data: og.options.map((o: any) => ({
                groupId: group.id,
                name: o.name,
                price: o.price || 0.00
              }))
            });
          }
        }
      }

      return await tx.product.findUnique({
        where: { id: p.id },
        include: {
          optionGroups: {
            include: { options: true }
          }
        }
      });
    });

    return formatProduct(product);
  }

  public static async updateProduct(
    id: string,
    merchantId: string,
    data: Partial<{ 
      name: string; 
      description: string; 
      price: number; 
      category: string; 
      image: string; 
      isAvailable: boolean;
      stockQuantity: number;
      optionGroups: any[];
    }>
  ): Promise<any | null> {
    const product = await prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.price !== undefined) updateData.price = data.price;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.image !== undefined) updateData.image = data.image;
      if (data.isAvailable !== undefined) updateData.isAvailable = data.isAvailable;
      if (data.stockQuantity !== undefined) updateData.stockQuantity = data.stockQuantity;

      if (data.optionGroups !== undefined) {
        await tx.productOptionGroup.deleteMany({
          where: { productId: id }
        });

        if (data.optionGroups && data.optionGroups.length > 0) {
          for (const og of data.optionGroups) {
            const group = await tx.productOptionGroup.create({
              data: {
                productId: id,
                name: og.name,
                required: og.required || false,
                minSelect: og.minSelect !== undefined ? og.minSelect : 0,
                maxSelect: og.maxSelect !== undefined ? og.maxSelect : 1
              }
            });

            if (og.options && og.options.length > 0) {
              await tx.productOption.createMany({
                data: og.options.map((o: any) => ({
                  groupId: group.id,
                  name: o.name,
                  price: o.price || 0.00
                }))
              });
            }
          }
        }
      }

      return await tx.product.update({
        where: { id, merchantId },
        data: updateData,
        include: {
          optionGroups: {
            include: { options: true }
          }
        }
      });
    });

    return formatProduct(product);
  }

  public static async deleteProduct(id: string, merchantId: string): Promise<any | null> {
    const product = await prisma.product.findFirst({
      where: { id, merchantId },
      include: {
        optionGroups: {
          include: { options: true }
        }
      }
    });

    if (!product) return null;

    await prisma.product.delete({
      where: { id }
    });

    return formatProduct(product);
  }

  public static async listMerchantProducts(merchantId: string): Promise<any[]> {
    const products = await prisma.product.findMany({
      where: { merchantId },
      include: {
        optionGroups: {
          include: { options: true }
        }
      }
    });
    return products.map(p => formatProduct(p));
  }

  public static async searchProducts(query: string): Promise<any[]> {
    const products = await prisma.product.findMany({
      where: {
        isAvailable: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } }
        ]
      },
      include: {
        optionGroups: {
          include: { options: true }
        }
      }
    });
    return products.map(p => formatProduct(p));
  }

  public static async updateProductStock(
    id: string,
    merchantId: string,
    data: { stockQuantity?: number; isPaused?: boolean }
  ): Promise<any | null> {
    const updateData: any = {};
    if (data.stockQuantity !== undefined) {
      updateData.stockQuantity = data.stockQuantity;
    }
    if (data.isPaused !== undefined) {
      updateData.isPaused = data.isPaused;
    }

    const product = await prisma.product.update({
      where: { id, merchantId },
      data: updateData,
      include: {
        optionGroups: {
          include: { options: true }
        }
      }
    });

    return formatProduct(product);
  }
}
