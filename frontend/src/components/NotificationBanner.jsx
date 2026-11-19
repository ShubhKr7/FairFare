import { useState, useEffect } from "react";
import { requestNotificationPermission } from "../../notifications";
import { guardOfflineAction } from "../utils/offlineGuard";

const NotificationBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [permission, setPermission] = useState("default");
  const [isLoading, setIsLoading] = useState(false);
  const [showInstructionsPopup, setShowInstructionsPopup] = useState(false);
  const [platform, setPlatform] = useState("desktop"); // "ios", "android", or "desktop"
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    // Detect platform: check for mobile devices first, fallback to desktop
    const ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua)) {
      setPlatform("ios");
    } else if (/Android/.test(ua)) {
      setPlatform("android");
    } else {
      setPlatform("desktop");
    }

    // Detect PWA mode
    const checkPWA = () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    setTimeout(() => setIsPWA(checkPWA()), 500);
  }, []);

  useEffect(() => {
    if ("Notification" in window) {
      const currentPermission = Notification.permission;
      setPermission(currentPermission);

      const dismissedTimestamp = localStorage.getItem("notificationBannerDismissed");
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      let shouldShow = currentPermission !== "granted";

      if (dismissedTimestamp) {
        const timeSinceDismissal = now - parseInt(dismissedTimestamp);
        if (timeSinceDismissal < twentyFourHours) {
          shouldShow = false;
        }
      }

      setShowBanner(shouldShow);
    }
  }, []);

  const handleTurnOn = async () => {
    if (!guardOfflineAction()) return;
    if (permission === "denied") {
      setShowInstructionsPopup(true);
      return;
    }

    setIsLoading(true);
    try {
      const token = await requestNotificationPermission();
      console.log(token);
      if (token) {
        setPermission("granted");
        setShowBanner(false);
      } else {
        const newPermission = Notification.permission;
        setPermission(newPermission);
        if (newPermission === "denied") {
          setShowInstructionsPopup(true);
        }
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("notificationBannerDismissed", Date.now().toString());
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Banner */}
      <div className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top duration-500">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 border-b border-white/10 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">
                  {permission === "denied"
                    ? "Notifications are blocked. Enable them to stay updated!"
                    : "Turn on notifications to get reminders and updates"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {permission === "default" ? (
                <button
                  onClick={handleTurnOn}
                  disabled={isLoading}
                  className="px-4 py-1.5 rounded-lg bg-white text-indigo-600 font-semibold text-sm hover:bg-white/90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isLoading ? "Loading..." : "Turn On"}
                </button>
              ) : (
                <button
                  onClick={handleTurnOn}
                  className="px-4 py-1.5 rounded-lg bg-white text-indigo-600 font-semibold text-sm hover:bg-white/90 transition-all active:scale-95 whitespace-nowrap"
                >
                  Enable
                </button>
              )}

              <button
                onClick={handleDismiss}
                className="p-1.5 rounded-full hover:bg-white/20 text-white transition-all"
                title="Dismiss"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions Popup */}
      {showInstructionsPopup && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setShowInstructionsPopup(false)}
        >
          <div
            className="bg-[#1a1a2e] rounded-2xl shadow-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Popup Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h2 className="text-lg font-bold text-white">Enable Notifications</h2>
              <button
                onClick={() => setShowInstructionsPopup(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-all"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Popup Body */}
            <div className="px-5 py-4 space-y-5">
              <p className="text-sm text-gray-300">
                Notifications are currently blocked by your browser. Follow the steps below to enable them:
              </p>

              {/* Platform & context specific Instructions */}
              {platform === "desktop" && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🖥️</span>
                    <h3 className="text-base font-semibold text-white">Desktop Browser</h3>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-300 pl-1">
                    <li>Click the <span className="text-white font-medium">🔒 lock icon</span> (or site info icon) in the address bar</li>
                    <li>Click <span className="text-white font-medium">Site settings</span></li>
                    <li>Find <span className="text-white font-medium">Notifications</span></li>
                    <li>Change it to <span className="text-green-400 font-medium">Allow</span></li>
                  </ol>
                </div>
              )}

              {platform === "android" && isPWA && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🤖</span>
                    <h3 className="text-base font-semibold text-white">Android (App)</h3>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-300 pl-1">
                    <li>Open your device <span className="text-white font-medium">Settings</span></li>
                    <li>Tap <span className="text-white font-medium">Apps</span> or <span className="text-white font-medium">App Management</span></li>
                    <li>Find and tap <span className="text-white font-medium">FairFare</span></li>
                    <li>Tap <span className="text-white font-medium">Notifications</span></li>
                    <li>Toggle notifications <span className="text-green-400 font-medium">On</span></li>
                  </ol>
                </div>
              )}

              {platform === "android" && !isPWA && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🤖</span>
                    <h3 className="text-base font-semibold text-white">Android (Chrome)</h3>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-300 pl-1">
                    <li>Tap the <span className="text-white font-medium">⋮ menu</span> (top-right corner)</li>
                    <li>Tap <span className="text-white font-medium">Settings</span></li>
                    <li>Tap <span className="text-white font-medium">Site settings</span></li>
                    <li>Tap <span className="text-white font-medium">Notifications</span></li>
                    <li>Find this site and set it to <span className="text-green-400 font-medium">Allow</span></li>
                  </ol>
                </div>
              )}

              {platform === "ios" && isPWA && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🍎</span>
                    <h3 className="text-base font-semibold text-white">iOS (App)</h3>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-300 pl-1">
                    <li>Open your device <span className="text-white font-medium">Settings</span></li>
                    <li>Scroll down and tap <span className="text-white font-medium">FairFare</span></li>
                    <li>Tap <span className="text-white font-medium">Notifications</span></li>
                    <li>Toggle <span className="text-white font-medium">Allow Notifications</span> <span className="text-green-400 font-medium">On</span></li>
                  </ol>
                  <p className="text-xs text-gray-500 mt-2 italic">
                    * Requires iOS 16.4+ with the app added to Home Screen.
                  </p>
                </div>
              )}

              {platform === "ios" && !isPWA && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🍎</span>
                    <h3 className="text-base font-semibold text-white">iOS (Safari)</h3>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-300 pl-1">
                    <li>Open your device <span className="text-white font-medium">Settings</span></li>
                    <li>Scroll down and tap <span className="text-white font-medium">Safari</span></li>
                    <li>Tap <span className="text-white font-medium">Notifications</span></li>
                    <li>Find this site and toggle notifications <span className="text-green-400 font-medium">On</span></li>
                  </ol>
                  <p className="text-xs text-gray-500 mt-2 italic">
                    * Requires iOS 16.4+. For best results, add the app to your Home Screen first.
                  </p>
                </div>
              )}

              {/* Tip */}
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3">
                <p className="text-xs text-indigo-300">
                  💡 After enabling, come back and refresh the page to receive notifications.
                </p>
              </div>
            </div>

            {/* Popup Footer */}
            <div className="px-5 py-4 border-t border-white/10">
              <button
                onClick={() => setShowInstructionsPopup(false)}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm hover:opacity-90 transition-all active:scale-[0.98]"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationBanner;
