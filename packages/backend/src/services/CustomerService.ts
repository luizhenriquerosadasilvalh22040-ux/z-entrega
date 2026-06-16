import { Customer, ICustomerDocument } from '../models/Customer';
import { IAddress, ISavedAddress } from '../types';

export class CustomerService {
  public static async listCustomers(): Promise<ICustomerDocument[]> {
    return await Customer.find({}, { passwordHash: 0 });
  }

  public static async getCustomerById(id: string): Promise<ICustomerDocument | null> {
    return await Customer.findById(id, { passwordHash: 0 });
  }

  public static async updateProfile(id: string, data: { name?: string; phone?: string; savedAddresses?: ISavedAddress[] }): Promise<ICustomerDocument | null> {
    return await Customer.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true, select: { passwordHash: 0 } }
    );
  }

  public static async updateAddress(id: string, address: IAddress): Promise<ICustomerDocument | null> {
    return await Customer.findByIdAndUpdate(
      id,
      { $set: { address } },
      { new: true, select: { passwordHash: 0 } }
    );
  }

  public static async deactivateCustomer(id: string): Promise<ICustomerDocument | null> {
    return await Customer.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true, select: { passwordHash: 0 } }
    );
  }

  public static async reactivateCustomer(id: string): Promise<ICustomerDocument | null> {
    return await Customer.findByIdAndUpdate(
      id,
      { $set: { isActive: true } },
      { new: true, select: { passwordHash: 0 } }
    );
  }

  public static async getByCity(city: string): Promise<ICustomerDocument[]> {
    return await Customer.find({ 'address.city': { $regex: new RegExp(city, 'i') } }, { passwordHash: 0 });
  }

  public static async countCustomers(): Promise<number> {
    return await Customer.countDocuments({ isActive: true });
  }
}
