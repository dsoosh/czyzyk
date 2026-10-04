import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readPublicEnv } from "./env";

export type Db = SupabaseClient;

let client: Db | undefined;

export function getSupabase(): Db {
  if (!client) {
    const { supabaseUrl, supabaseAnonKey } = readPublicEnv();
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true },
    });
  }
  return client;
}
