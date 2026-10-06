import { useEffect, useState } from "react";

/** Desktop breakpoint (Tailwind `lg`). */
export const WIDE_SCREEN = "(min-width: 1024px)";

/** Whether a media query matches, kept in sync with resizes; false where matchMedia is missing. */
export function useMediaQuery(query: string): boolean {
  const get = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return matches;
}
