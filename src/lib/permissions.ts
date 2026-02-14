// Permission constants for RBAC system
// These map to the permission keys in the database

export const PERMISSIONS = {
  MARKETS: {
    VIEW: 'markets.view',
    MANAGE: 'markets.manage',
  },
  STALLS: {
    VIEW: 'stalls.view',
    BOOK_SELF: 'stalls.book.self',
    BOOK_ANY: 'stalls.book.any',
    MANAGE: 'stalls.manage',
  },
  VENDORS: {
    VIEW_SELF: 'vendors.view.self',
    VIEW_ALL: 'vendors.view.all',
    LOOKUP: 'vendors.lookup',
  },
  KYC: {
    CREATE_SELF: 'kyc.create.self',
    CREATE_PENDING: 'kyc.create.pending',
    REVIEW: 'kyc.review',
    VIEW_SELF: 'kyc.view.self',
    VIEW_ALL: 'kyc.view.all',
  },
  BOOKINGS: {
    VIEW_SELF: 'bookings.view.self',
    VIEW_ALL: 'bookings.view.all',
    CREATE_SELF: 'bookings.create.self',
    CREATE_ANY: 'bookings.create.any',
    CANCEL_SELF: 'bookings.cancel.self',
    MANAGE: 'bookings.manage',
    UNDO_CHECKIN: 'bookings.undo.checkin'
  },
  INVOICES: {
    VIEW_SELF: 'invoices.view.self',
    VIEW_ALL: 'invoices.view.all',
    CREATE: 'invoices.create',
  },
  PAYMENTS: {
    PAY_SELF: 'payments.pay.self',
    COLLECT: 'payments.collect',
    MANAGE: 'payments.manage',
  },
  USERS: {
    VIEW: 'users.view',
    VIEW_SELF: 'users.view.self',
    INVITE: 'users.invite',
    MANAGE: 'users.manage',
  },
  ROLES: {
    VIEW: 'roles.view',
    CREATE: 'roles.create',
    ASSIGN: 'roles.assign',
    MANAGE: 'roles.manage',
  },
  VAT: {
    VIEW: 'vat.view',
    MANAGE: 'vat.manage',
  },
} as const;

// Helper type for permission values
type PermissionCategory = typeof PERMISSIONS[keyof typeof PERMISSIONS];
export type Permission = PermissionCategory[keyof PermissionCategory];

// Helper function to get all permissions as an array
export const getAllPermissions = (): Permission[] => {
  return Object.values(PERMISSIONS).flatMap(category =>
    Object.values(category)
  ) as Permission[];
};

// Helper function to check if a string is a valid permission
export const isValidPermission = (permission: string): permission is Permission => {
  return getAllPermissions().includes(permission as Permission);
};

export const PERMISSION_ROUTES = {
  [PERMISSIONS.USERS.VIEW_SELF]: "admin",
  [PERMISSIONS.VENDORS.VIEW_SELF]: "vendor",
};
