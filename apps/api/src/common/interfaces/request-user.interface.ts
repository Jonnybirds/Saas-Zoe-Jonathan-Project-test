export interface RequestUser {
  sub: string;
  tenantId: string;
  email: string;
  permissions: string[];
}
