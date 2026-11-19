/* eslint-disable no-undef */
const SHELL_CACHE = "fairfare-shell-v3";
const ASSET_CACHE = "fairfare-assets-v3";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      await Promise.all(
        ["/", "/index.html", "/manifest.json"].map((path) =>
          cache.add(path).catch(() => undefined)
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("fairfare-") &&
                key !== SHELL_CACHE &&
                key !== ASSET_CACHE
            )
            .map((key) => caches.delete(key))
        )
      ),
      clients.claim(),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(SHELL_CACHE);
            await cache.put(request, response.clone());
            await cache.put("/index.html", response.clone());
          }
          return response;
        })
        .catch(async () => {
          const exact = await caches.match(request, { ignoreSearch: true });
          const fallback = await caches.match("/index.html");
          return (
            exact ||
            fallback ||
            new Response("FairFare is unavailable offline.", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
          );
        })
    );
    return;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(ASSET_CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      });
    })
  );
});

// Firebase scripts
importScripts(
  "https://www.gstatic.com/firebasejs/12.1.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging-compat.js"
);

const firebaseConfig = {
  apiKey: "AIzaSyBn0KxR0mKhKn2Xffjjf4FYtUg1aVb8WZ0",
  authDomain: "fairfare-d765b.firebaseapp.com",
  projectId: "fairfare-d765b",
  storageBucket: "fairfare-d765b.firebasestorage.app",
  messagingSenderId: "644741718814",
  appId: "1:644741718814:web:3080bf2e604500f64edf0f",
  measurementId: "G-QXY6QD2GNN",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Background notifications
messaging.onBackgroundMessage((payload) => {
  // console.log("Background message:", payload);
  // self.registration.showNotification(payload.notification.title, {
  //   body: payload.notification.body,
  //   // icon: "/icon.png", // optional
  // });

  const notificationTitle = payload.data.title;
  const notificationOptions = {
    body: payload.data.body,
    icon: "./newIconV3-512x512.png", // 👈 your app’s icon here
    // badge: payload.data.badge || "/badge-icon.png", // optional
    data: { url: payload.data.url || "https://fairfare-beta.vercel.app" }, // 👈 fallback
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  // Open FairFare app or focus if already open
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === event.notification.data.url && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
