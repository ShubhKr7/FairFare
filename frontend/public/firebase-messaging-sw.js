self.addEventListener("install", (event) => {
  console.log("Service Worker installing...");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activating...");
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
self.addEventListener("notificationclick", function(event) {
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
