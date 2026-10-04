// Web Push handlers, imported into the generated service worker (vite.config.ts → workbox.importScripts).
// Payload from services/cron: { title, body, url, tag }.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Czyżyk", {
      body: data.body || "",
      tag: data.tag,
      lang: "pl",
      icon: "/pwa-192.png",
      badge: "/pwa-192.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Only paths inside the app: a payload can never send the user to another site.
  let target = new URL("/", self.location.origin);
  try {
    const candidate = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin);
    if (candidate.origin === self.location.origin) target = candidate;
  } catch {
    // keep "/"
  }
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          return client.navigate(target.href).then((c) => (c || client).focus());
        }
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
