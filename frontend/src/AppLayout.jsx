import { Navigate, Outlet } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import api from "./utils/api";
import Cookies from "js-cookie";
import TermsPopup from "./components/TermsPopup";
import BottomNavbar from "./components/BottomNavbar";
import QuickAddExpenseModal from "./components/QuickAddExpenseModal";

const handleScrollTop = () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });
};

const usePageTracking = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof window.gtag === "function") {
      window.gtag("config", "G-Z1QKE3M5CQ", {
        page_path: location.pathname,
      });
    }
    handleScrollTop();
  }, [location]);
};

// Routes where the bottom navbar should NOT appear
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/features",
  "/forgot-password",
  "/documentation",
  "/transaction-history",
  "/tripDetails",
  "/add-expense",
  "/expense/edit",
  "/personal-expenses",
  "/addTrip"
];

const isPublicRoute = (pathname) => {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  // Dynamic public routes
  if (/^\/signup\/.+/.test(pathname)) return true;       // /signup/:referId
  if (/^\/public-profile\/.+/.test(pathname)) return true; // /public-profile/:userId
  if (/^\/transaction-history\/.+/.test(pathname)) return true; // /transaction-history/:id
  if (/^\/tripDetails\/.+/.test(pathname)) return true; // /tripDetails/:id
  if (/^\/add-members\/.+/.test(pathname)) return true; // /add-members/:id
  if (/^\/remove-members\/.+/.test(pathname)) return true; // /remove-members/:id
  return false;
};

const AppLayout = () => {
  usePageTracking();

  const location = useLocation();

  const [showTerms, setShowTerms] = useState(false);
  const [termsList, setTermsList] = useState([]);
  const [showQuickExpense, setShowQuickExpense] = useState(false);
  const [autoStartVoice, setAutoStartVoice] = useState(false);
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const showNavbar = !isPublicRoute(location.pathname);

  useEffect(() => {
    const checkTerms = async () => {
      if (!navigator.onLine) return;
      const token = Cookies.get("authToken"); // or whatever your token key is
      const id = Cookies.get("id");

      // Only check if user is logged in
      if (!token || !id) return;

      try {
        const response = await api.get("/terms/check-status");
        if (response.data && response.data.mustSign) {
          setTermsList(response.data.terms);
          setShowTerms(true);
        }
      } catch (error) {
        console.error("Error checking terms status:", error);
      }
    };

    checkTerms();
  }, [location.pathname]); // Re-check on route change if you want, or just once on mount. Pathname ensures it runs if they navigate.

  // --- Voice Add Shortcut Handling ---
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("voice") === "true") {
      setAutoStartVoice(true);
      setShowQuickExpense(true);
      // Remove the query param so it doesn't trigger again on refresh
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    const syncConnectionStatus = () => {
      setIsOffline(!navigator.onLine);
    };

    if (!navigator.onLine) setIsOffline(true);

    window.addEventListener("offline", syncConnectionStatus);
    window.addEventListener("online", syncConnectionStatus);
    window.addEventListener("focus", syncConnectionStatus);
    document.addEventListener("visibilitychange", syncConnectionStatus);

    return () => {
      window.removeEventListener("offline", syncConnectionStatus);
      window.removeEventListener("online", syncConnectionStatus);
      window.removeEventListener("focus", syncConnectionStatus);
      document.removeEventListener("visibilitychange", syncConnectionStatus);
    };
  }, []);

  const handleTermsAccept = async (termId) => {
    try {
      await api.post("/terms/accept", { termId });

      // Update local state to mark this term as agreed
      setTermsList(prev => {
        const updatedList = prev.map(t =>
          t._id === termId ? { ...t, hasAgreed: true } : t
        );

        // check if all are agreed now
        const allDone = updatedList.every(t => t.hasAgreed);
        if (allDone) {
          setShowTerms(false);
        }
        return updatedList;
      });

    } catch (error) {
      console.error("Error accepting terms:", error);
      // You might want to show an error toast here
    }
  };

  const handleCloseQuickExpense = () => {
    setShowQuickExpense(false);
    setAutoStartVoice(false);
  };

  if (isOffline && location.pathname !== "/dash") {
    return (
      <>
        <div
          role="status"
          aria-live="polite"
          className="sticky top-0 z-[60] flex min-h-10 items-center justify-center gap-2 border-b border-amber-400/20 bg-amber-500 px-3 py-2 text-center text-sm font-semibold text-amber-950 shadow-lg"
        >
          <span>You are offline. Showing the latest saved dashboard. Please connect to the internet.</span>
        </div>
        <Navigate to="/dash" replace />
      </>
    );
  }

  return (
    <div
      className="min-h-screen bg-zinc-950 text-zinc-100"
    >
      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          duration: 4000, // default duration 4 seconds for all toasts
          style: {
            background: "#1e1e1e",
            color: "#fff",
            border: "1px solid #333",
          },
        }}
      />
      {isOffline && (
        <div
          role="status"
          aria-live="polite"
          className="sticky top-0 z-[60] flex min-h-10 items-center justify-center gap-2 border-b border-amber-400/20 bg-amber-500 px-3 py-2 text-center text-sm font-semibold text-amber-950 shadow-lg"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4 flex-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M5 12.55a11 11 0 0 1 14.08 0" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <path d="M12 20h.01" />
            <path d="m2 2 20 20" />
          </svg>
          <span>You are offline. Showing the latest saved dashboard. Please connect to the internet.</span>
        </div>
      )}
      <Outlet />
      <TermsPopup
        isOpen={showTerms}
        terms={termsList}
        onAccept={handleTermsAccept}
      />

      {/* Bottom navbar — only on protected routes and when terms popup is hidden */}
      {showNavbar && !showTerms && (
        <>
          <BottomNavbar onAddClick={() => setShowQuickExpense(true)} />

          {/* Global quick-add modal */}
          {showQuickExpense && (
            <QuickAddExpenseModal
              isOpen={showQuickExpense}
              onClose={handleCloseQuickExpense}
              autoStartVoice={autoStartVoice}
            />
          )}
        </>
      )}
    </div>
  );
};

export default AppLayout;
