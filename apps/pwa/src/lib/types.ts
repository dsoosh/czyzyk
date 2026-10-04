export type Role = "admin" | "family";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  role: Role;
}

export interface AllowedEmail {
  email: string;
  role: Role;
  created_at: string;
}
