import prisma from '../config/prisma';
import { QueryPromise } from './helpers';

export const formatBanner = (b: any) => {
  if (!b) return null;
  return {
    _id: b.id,
    id: b.id,
    imageUrl: b.imageUrl,
    title: b.title,
    isActive: b.isActive,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    save: async function() {
      if (this.id) {
        const updated = await prisma.banner.update({
          where: { id: this.id },
          data: {
            imageUrl: this.imageUrl,
            title: this.title,
            isActive: this.isActive
          }
        });
        Object.assign(this, formatBanner(updated));
      } else {
        const created = await prisma.banner.create({
          data: {
            imageUrl: this.imageUrl,
            title: this.title || null,
            isActive: this.isActive !== undefined ? this.isActive : true
          }
        });
        Object.assign(this, formatBanner(created));
      }
      return this;
    }
  };
};

export class Banner {
  public id?: string;
  public imageUrl: string;
  public title?: string;
  public isActive?: boolean;

  constructor(data: any) {
    this.id = data.id;
    this.imageUrl = data.imageUrl;
    this.title = data.title;
    this.isActive = data.isActive;
  }

  async save() {
    const bannerObj = formatBanner(this);
    const saved = await bannerObj!.save();
    Object.assign(this, saved);
    return this;
  }

  public static find(query: any = {}) {
    const where: any = {};
    if (query.isActive !== undefined) where.isActive = query.isActive;
    const promise = prisma.banner.findMany({ where }).then(list => list.map(b => formatBanner(b)));
    return new QueryPromise(promise);
  }

  public static async findByIdAndDelete(id: string) {
    const banner = await prisma.banner.findUnique({ where: { id } });
    if (!banner) return null;
    await prisma.banner.delete({ where: { id } });
    return formatBanner(banner);
  }

  public static async create(data: any) {
    const created = await prisma.banner.create({
      data: {
        imageUrl: data.imageUrl,
        title: data.title || null,
        isActive: data.isActive !== undefined ? data.isActive : true
      }
    });
    return formatBanner(created);
  }
}

export type IBannerDocument = any;
