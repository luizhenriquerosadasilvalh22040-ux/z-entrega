export type UserRole = 'customer' | 'merchant' | 'deliverer' | 'admin';

export type AuthenticatedUser = {
  userId: string;
  role: UserRole;
};

export type OrderAccessRecord = {
  customerId: string;
  merchantId: string;
  delivererId?: string | null;
};

export const canViewOrder = (user: AuthenticatedUser, order: OrderAccessRecord): boolean => {
  if (user.role === 'admin') return true;
  if (user.role === 'customer') return order.customerId === user.userId;
  if (user.role === 'merchant') return order.merchantId === user.userId;
  if (user.role === 'deliverer') return order.delivererId === user.userId;
  return false;
};

export const canAccessCustomerProfile = (
  user: AuthenticatedUser,
  customerId: string
): boolean => {
  if (user.role === 'admin') return true;
  if (user.role === 'customer') return user.userId === customerId;
  return false;
};

export const canManageMerchantResource = (
  user: AuthenticatedUser,
  merchantId: string
): boolean => {
  if (user.role === 'admin') return true;
  if (user.role === 'merchant') return user.userId === merchantId;
  return false;
};

export const canRunAdminOperation = (user?: AuthenticatedUser | null): boolean => {
  return user?.role === 'admin';
};

export const canManageOwnMerchantCatalog = (
  user?: AuthenticatedUser | null
): user is AuthenticatedUser & { role: 'merchant' } => {
  return user?.role === 'merchant';
};

export const canUploadMedia = (user?: AuthenticatedUser | null): boolean => {
  return user?.role === 'merchant' || user?.role === 'admin';
};
