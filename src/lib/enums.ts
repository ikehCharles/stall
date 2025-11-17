export enum MarketStatusEnum {
    DRAFT = "DRAFT",
    PUBLISHED = "PUBLISHED",
    ARCHIVED = "ARCHIVED",
}
export enum RolesEnum {
    admin = "admin",
    vendor = "vendor",
}

export enum QueryKeysEnum {
  userManagement = "users-management",
  rolesList = "roles-list",
  vendorBookings = "vendor-bookings",
  rolesManagement = "roles-management",
  permissionsList = "permissions-list",
}

export enum INTENT {
  AUTHORIZE,
  CAPTURE,
  VOID,
  REFUND
}