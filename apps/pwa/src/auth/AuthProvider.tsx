import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ANDROID_AUTH_REDIRECT, androidBridge } from "../lib/androidApp";
import type { Db } from "../lib/supabase";
import type { Profile } from "../lib/types";

export const NO_ACCESS_MESSAGE = "Brak dostępu – to konto nie ma dostępu do Czyżyka.";

export type AuthState =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "no_access"; message: string }
  /** Signed in without a profile: the access request waits for the operator or was rejected (families-joining). */
  | { status: "waiting"; email: string; rejected: boolean }
  | { status: "error"; message: string }
  | { status: "ready"; profile: Profile };

interface AuthContextValue {
  state: AuthState;
  client: Db;
  signInWithGoogle(options?: { selectAccount?: boolean }): Promise<void>;
  signOut(): Promise<void>;
  refreshProfile(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Reads the error Supabase Auth appends to the redirect URL when sign-in fails,
 * e.g. when the before_user_created hook rejects an email outside the family.
 */
export function readAuthRedirectError(location: Pick<Location, "search" | "hash">): string | null {
  for (const raw of [location.search, location.hash]) {
    const params = new URLSearchParams(raw.replace(/^[?#]/, ""));
    if (params.has("error") || params.has("error_description")) {
      const description = params.get("error_description") ?? "";
      return description.includes("Brak dostępu") || description === "" ? NO_ACCESS_MESSAGE : description;
    }
  }
  return null;
}

function clearAuthParamsFromUrl() {
  window.history.replaceState(window.history.state, "", window.location.pathname);
}

export function AuthProvider({ client, children }: { client: Db; children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const error = readAuthRedirectError(window.location);
    return error ? { status: "no_access", message: error } : { status: "loading" };
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  const loadProfile = useCallback(
    async (session: Session | null) => {
      if (!session) {
        setState((s) => (s.status === "no_access" ? s : { status: "signed_out" }));
        return;
      }
      const { data, error } = await client
        .from("profiles")
        .select("id, email, display_name, role")
        .eq("id", session.user.id)
        .maybeSingle<Profile>();
      if (error) {
        setState({ status: "error", message: "Nie udało się sprawdzić dostępu. Spróbuj ponownie." });
        return;
      }
      if (!data) {
        // Signed in without a profile: a new account waits for approval; a removed member has no access.
        const { data: request } = await client.rpc("my_access_request");
        if (request === "pending" || request === "rejected") {
          setState({ status: "waiting", email: session.user.email ?? "", rejected: request === "rejected" });
          return;
        }
        setState({ status: "no_access", message: NO_ACCESS_MESSAGE });
        await client.auth.signOut();
        return;
      }
      setState({ status: "ready", profile: data });
    },
    [client],
  );

  useEffect(() => {
    if (readAuthRedirectError(window.location)) {
      clearAuthParamsFromUrl();
      void client.auth.signOut();
    }

    const { data } = client.auth.onAuthStateChange((event, session) => {
      // Supabase advises against awaiting client calls inside this callback.
      if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
        setTimeout(() => void loadProfile(session), 0);
      } else if (event === "SIGNED_OUT") {
        setState((s) => (s.status === "no_access" ? s : { status: "signed_out" }));
      }
    });
    return () => data.subscription.unsubscribe();
  }, [client, loadProfile]);

  const refreshProfile = useCallback(async () => {
    const { data } = await client.auth.getSession();
    await loadProfile(data.session);
  }, [client, loadProfile]);

  // A removed family member loses access, and an approved one gets it, on their next return to the app.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && (stateRef.current.status === "ready" || stateRef.current.status === "waiting")) {
        void refreshProfile();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      client,
      async signInWithGoogle(options) {
        setState({ status: "loading" });
        await client.auth.signInWithOAuth({
          provider: "google",
          options: {
            // Google blocks sign-in inside the Android WebView: the app opens it in the browser
            // and takes the czyzyk://auth/callback?code=… redirect back into the WebView.
            redirectTo: androidBridge() ? ANDROID_AUTH_REDIRECT : window.location.origin,
            queryParams: options?.selectAccount ? { prompt: "select_account" } : undefined,
          },
        });
      },
      async signOut() {
        await client.auth.signOut();
        setState({ status: "signed_out" });
      },
      refreshProfile,
    }),
    [state, client, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

/** Profile of the signed-in family member; only valid below the access gate. */
export function useProfile(): Profile {
  const { state } = useAuth();
  if (state.status !== "ready") throw new Error("useProfile used outside the access gate");
  return state.profile;
}
