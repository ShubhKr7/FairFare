import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import router from './App.jsx'
import './index.css'
import { RouterProvider } from 'react-router-dom'
import devToolsBlocker from './utils/devToolsBlocker'

// Initialize dev tools blocker (only runs in production)
devToolsBlocker.init();

createRoot(document.getElementById('root')).render(
  <StrictMode>
      <RouterProvider router={router} />
  </StrictMode>,
)

// main.jsx
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/firebase-messaging-sw.js", { updateViaCache: "none" })
    .then((registration) => {
      console.log("Service Worker registered with scope:", registration.scope);
      registration.update();
    })
    .catch((error) => {
      console.error("Service Worker registration failed:", error);
    });
}


