export type UserRole = "admin" | "company";
export type UserStatus = "active" | "disabled";

export interface AuthUser {
  uid: string;
  email: string;
  role: UserRole;
  full_name: string;
  status: UserStatus;
}
