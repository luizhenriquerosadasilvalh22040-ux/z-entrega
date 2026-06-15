import { Request, Response, NextFunction } from 'express';
import { CustomerService } from '../services/CustomerService';

export class CustomerController {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customers = await CustomerService.listCustomers();
      res.status(200).json({ status: 'success', data: { customers } });
    } catch (error) {
      next(error);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      // Permitido apenas ao próprio cliente ou lojistas
      if (req.user?.role === 'customer' && req.user.userId !== id) {
        res.status(403).json({ status: 'fail', message: 'Forbidden access' });
        return;
      }

      const customer = await CustomerService.getCustomerById(id);
      if (!customer) {
        res.status(404).json({ status: 'fail', message: 'Customer not found' });
        return;
      }
      res.status(200).json({ status: 'success', data: { customer } });
    } catch (error) {
      next(error);
    }
  }

  public static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      // Apenas o próprio cliente pode editar seu perfil
      if (req.user?.userId !== id) {
        res.status(403).json({ status: 'fail', message: 'Forbidden access' });
        return;
      }

      const customer = await CustomerService.updateProfile(id, req.body);
      if (!customer) {
        res.status(404).json({ status: 'fail', message: 'Customer not found' });
        return;
      }
      res.status(200).json({ status: 'success', data: { customer } });
    } catch (error) {
      next(error);
    }
  }

  public static async updateAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      // Apenas o próprio cliente pode editar seu endereço
      if (req.user?.userId !== id) {
        res.status(403).json({ status: 'fail', message: 'Forbidden access' });
        return;
      }

      const customer = await CustomerService.updateAddress(id, req.body);
      if (!customer) {
        res.status(404).json({ status: 'fail', message: 'Customer not found' });
        return;
      }
      res.status(200).json({ status: 'success', data: { customer } });
    } catch (error) {
      next(error);
    }
  }

  public static async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      if (req.user?.userId !== id) {
        res.status(403).json({ status: 'fail', message: 'Forbidden access' });
        return;
      }

      const customer = await CustomerService.deactivateCustomer(id);
      if (!customer) {
        res.status(404).json({ status: 'fail', message: 'Customer not found' });
        return;
      }
      res.status(200).json({ status: 'success', data: { customer } });
    } catch (error) {
      next(error);
    }
  }

  public static async reactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      
      if (req.user?.userId !== id) {
        res.status(403).json({ status: 'fail', message: 'Forbidden access' });
        return;
      }

      const customer = await CustomerService.reactivateCustomer(id);
      if (!customer) {
        res.status(404).json({ status: 'fail', message: 'Customer not found' });
        return;
      }
      res.status(200).json({ status: 'success', data: { customer } });
    } catch (error) {
      next(error);
    }
  }

  public static async searchByCity(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { city } = req.query;
      if (!city) {
        res.status(400).json({ status: 'fail', message: 'City is required' });
        return;
      }
      const customers = await CustomerService.getByCity(city as string);
      res.status(200).json({ status: 'success', data: { customers } });
    } catch (error) {
      next(error);
    }
  }

  public static async count(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await CustomerService.countCustomers();
      res.status(200).json({ status: 'success', data: { count } });
    } catch (error) {
      next(error);
    }
  }
}
