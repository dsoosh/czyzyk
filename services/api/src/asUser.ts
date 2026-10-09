import type pg from "pg";

export type Queryable = Pick<pg.PoolClient, "query">;

/**
 * Runs read-only queries as the signed-in user (families): the same role and JWT subject as
 * the PWA, so row level security decides which groups, items and "done" marks they see.
 */
export async function asUser<T>(pool: pg.Pool, userId: string, fn: (db: Queryable) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin read only");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)", [
      userId,
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    return await fn(client);
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
  }
}
