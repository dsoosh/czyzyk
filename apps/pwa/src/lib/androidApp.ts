/** Bridge the Android app exposes to the PWA it hosts (apps/android, web/AppBridge.kt). */
interface AndroidBridge {
  openPhoneSettings(): void;
  /** A WhatsApp export shared to the app: JSON {fileName, text}, handed over once. Older apps lack it. */
  takeSharedChat?(): string | null;
}

/** The chat export the Android app received via "Udostępnij", or null. */
export function takeSharedChat(): { fileName: string; text: string } | null {
  const raw = androidBridge()?.takeSharedChat?.();
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as { fileName?: unknown; text?: unknown };
    return typeof value.fileName === "string" && typeof value.text === "string" ? { fileName: value.fileName, text: value.text } : null;
  } catch {
    return null;
  }
}

/** Where Supabase sends the browser after Google sign-in started inside the Android app. */
export const ANDROID_AUTH_REDIRECT = "czyzyk://auth/callback";

/** The bridge when the PWA runs inside the Android app, otherwise null. */
export function androidBridge(): AndroidBridge | null {
  return (window as { CzyzykAndroid?: AndroidBridge }).CzyzykAndroid ?? null;
}
