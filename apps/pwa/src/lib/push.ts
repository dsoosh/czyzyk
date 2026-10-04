import type { Db } from "./supabase";

export interface PushSettings {
  digest_enabled: boolean;
  digest_time: string;
  alert_closures: boolean;
  alert_actions: boolean;
  alert_payments: boolean;
}

export const DEFAULT_PUSH_SETTINGS: PushSettings = {
  digest_enabled: true,
  digest_time: "19:00",
  alert_closures: true,
  alert_actions: true,
  alert_payments: true,
};

/** iPhone/iPad, including iPadOS that reports itself as a Mac. */
export function isIos(nav: Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints">): boolean {
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
}

/** Running from the home screen (required for Web Push on iOS). */
export function isStandalone(nav: Navigator & { standalone?: boolean }, win: Pick<Window, "matchMedia">): boolean {
  return nav.standalone === true || win.matchMedia?.("(display-mode: standalone)").matches === true;
}

export type PushSupport = "supported" | "ios-needs-install" | "unsupported";

export function pushSupport(nav: Navigator & { standalone?: boolean } = navigator, win: Window = window): PushSupport {
  if (isIos(nav) && !isStandalone(nav, win)) return "ios-needs-install";
  if (!("serviceWorker" in nav) || !("PushManager" in win) || !("Notification" in win)) return "unsupported";
  return "supported";
}

/** VAPID public key (base64url) as the byte array PushManager.subscribe expects. */
export function urlBase64ToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Calls services/api with the user's Supabase session; the API verifies it. */
export async function callApi(db: Db, apiUrl: string, path: string, method: "POST" | "PUT", body: unknown): Promise<unknown> {
  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Brak sesji.");
  const res = await fetch(`${apiUrl.replace(/\/+$/, "")}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/** Subscribes this browser and registers the subscription for the signed-in user. */
export async function enablePush(db: Db, apiUrl: string, vapidPublicKey: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("permission");
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) }));
  await callApi(db, apiUrl, "/push/subscribe", "POST", subscription.toJSON());
}

export async function disablePush(db: Db, apiUrl: string): Promise<void> {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await callApi(db, apiUrl, "/push/unsubscribe", "POST", { endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}
