import type { Db } from "./supabase";

export interface Child {
  id: string;
  name: string;
  group_id: string | null;
}

export async function fetchChildren(db: Db): Promise<Child[]> {
  const { data, error } = await db.from("children").select("id, name, group_id").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Child[];
}

/** Creates (id null) or updates a child; the database checks family membership. */
export async function saveChild(db: Db, child: { id: string | null; name: string; group_id: string | null }): Promise<Child> {
  const { data, error } = await db.rpc("save_child", { p_id: child.id, p_name: child.name.trim(), p_group_id: child.group_id });
  if (error) throw new Error(error.message);
  return data as Child;
}

export async function deleteChild(db: Db, id: string): Promise<void> {
  const { error } = await db.rpc("delete_child", { p_id: id });
  if (error) throw new Error(error.message);
}

/**
 * Names shown on an item: the children it is assigned to, otherwise the children
 * attending the item's group (none for whole-kindergarten items).
 */
export function childNames(children: Child[], item: { group_id: string | null; child_ids?: string[] | null }): string[] {
  const assigned = item.child_ids ?? [];
  if (assigned.length) return children.filter((c) => assigned.includes(c.id)).map((c) => c.name);
  if (!item.group_id) return [];
  return children.filter((c) => c.group_id === item.group_id).map((c) => c.name);
}
