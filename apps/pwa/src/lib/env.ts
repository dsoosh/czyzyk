export interface PublicEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Public URL of services/api – put into the phone pairing link. */
  apiUrl: string | null;
  /** Public VAPID key of the worker (Web Push) – lets the browser subscribe to push. */
  vapidPublicKey: string | null;
}

/** Reads the only configuration the PWA may know: the public project URL and anon key. */
export function readPublicEnv(env: Record<string, string | undefined> = import.meta.env): PublicEnv {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
  const missing = [
    !supabaseUrl && "VITE_SUPABASE_URL",
    !supabaseAnonKey && "VITE_SUPABASE_ANON_KEY",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(`Brak konfiguracji PWA: ${missing.join(", ")}`);
  }
  return {
    supabaseUrl: supabaseUrl!,
    supabaseAnonKey: supabaseAnonKey!,
    apiUrl: withScheme(env.VITE_API_URL),
    vapidPublicKey: env.VITE_VAPID_PUBLIC_KEY || null,
  };
}

/** Railway hands over the API domain without a scheme ("api.up.railway.app"); local URLs keep theirs. */
export function withScheme(url: string | undefined): string | null {
  const trimmed = url?.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}
