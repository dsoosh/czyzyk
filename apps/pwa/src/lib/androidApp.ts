/** Bridge the Android app exposes to the PWA it hosts (apps/android, web/AppBridge.kt). */
interface AndroidBridge {
  openPhoneSettings(): void;
}

/** Where Supabase sends the browser after Google sign-in started inside the Android app. */
export const ANDROID_AUTH_REDIRECT = "czyzyk://auth/callback";

/** The bridge when the PWA runs inside the Android app, otherwise null. */
export function androidBridge(): AndroidBridge | null {
  return (window as { CzyzykAndroid?: AndroidBridge }).CzyzykAndroid ?? null;
}
