import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { markDone, type TrackedKind } from "./tracking";

/** Toggles an item's done mark, then refreshes the view so everyone's marks are current. */
export function useMarkDone(kind: TrackedKind, reload: () => void) {
  const { client } = useAuth();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (id: string, done: boolean) => {
    setPending(id);
    setError(null);
    try {
      await markDone(client, kind, id, done);
      reload();
    } catch {
      setError("Nie udało się zapisać. Spróbuj ponownie.");
    } finally {
      setPending(null);
    }
  };
  return { toggle, pending, error };
}
