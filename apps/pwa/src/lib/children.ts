import type { Db } from "./supabase";

export interface Child {
  id: string;
  name: string;
  group_id: string | null;
  /** Other forms of the name ("Eleonora", "Elcia") the assistant also recognises. */
  aliases: string[];
  /** Key of CHILD_COLORS, unique per child (child-colors); null for children added before colours. */
  color: ChildColor | null;
}

/** Same keys and order as public.child_colors() (migration 0026). Light shades: dark text stays readable. */
export const CHILD_COLORS = {
  lime: { label: "Limonkowy", bg: "#e3ea8c" },
  sky: { label: "Błękitny", bg: "#b8dff4" },
  rose: { label: "Różowy", bg: "#f6c3cb" },
  amber: { label: "Złoty", bg: "#f8d88a" },
  violet: { label: "Fioletowy", bg: "#d8c9f3" },
  teal: { label: "Morski", bg: "#a9e2d4" },
  orange: { label: "Pomarańczowy", bg: "#f9c49d" },
  sand: { label: "Piaskowy", bg: "#e4d7bf" },
} as const;
export type ChildColor = keyof typeof CHILD_COLORS;
export const CHILD_COLOR_KEYS = Object.keys(CHILD_COLORS) as ChildColor[];

/** The child's colour; a child without one gets a free colour by its position, so tags still differ. */
export function childColor(children: Child[], child: Child): ChildColor {
  if (child.color) return child.color;
  const taken = new Set(children.map((c) => c.color).filter(Boolean));
  const free = CHILD_COLOR_KEYS.filter((k) => !taken.has(k));
  const position = children.filter((c) => !c.color).findIndex((c) => c.id === child.id);
  return free.length ? free[Math.max(position, 0) % free.length]! : CHILD_COLOR_KEYS[0]!;
}

export async function fetchChildren(db: Db): Promise<Child[]> {
  const { data, error } = await db.from("children").select("id, name, group_id, aliases, color").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Child[];
}

/** Creates (id null) or updates a child; the database checks family membership. */
export async function saveChild(
  db: Db,
  child: { id: string | null; name: string; group_id: string | null; aliases: string[]; color?: ChildColor | null },
): Promise<Child> {
  const { data, error } = await db.rpc("save_child", {
    p_id: child.id,
    p_name: child.name.trim(),
    p_group_id: child.group_id,
    p_aliases: child.aliases,
    // Omitted: a new child gets the first free colour, an existing one keeps its colour.
    ...(child.color ? { p_color: child.color } : {}),
  });
  if (error) throw new Error(error.message);
  return data as Child;
}

/** "Eleonora, El,  Elcia" → ["Eleonora", "El", "Elcia"] (trimmed, without empty entries). */
export function parseAliases(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((a) => a.trim())
    .filter(Boolean);
}

export async function deleteChild(db: Db, id: string): Promise<void> {
  const { error } = await db.rpc("delete_child", { p_id: id });
  if (error) throw new Error(error.message);
}

/**
 * Names shown on an item: the children it is assigned to, otherwise the children
 * attending the item's group (none for whole-kindergarten items).
 */
export function childrenOf(children: Child[], item: { group_id: string | null; child_ids?: string[] | null }): Child[] {
  const assigned = item.child_ids ?? [];
  if (assigned.length) return children.filter((c) => assigned.includes(c.id));
  if (!item.group_id) return [];
  return children.filter((c) => c.group_id === item.group_id);
}

export function childNames(children: Child[], item: { group_id: string | null; child_ids?: string[] | null }): string[] {
  return childrenOf(children, item).map((c) => c.name);
}
