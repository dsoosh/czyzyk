export const ROLES = ["admin", "family"] as const;
export type Role = (typeof ROLES)[number];
