import { Outlet } from "react-router-dom";
import ErrorBoundary from "./ErrorBoundary";
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
  "/personal-expenses"
];

const isPublicRoute = (pathname) => {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  // Dynamic public routes
  if (/^\/signup\/.+/.test(pathname)) return true;       // /signup/:referId
  if (/^\/public-profile\/.+/.test(pathname)) return true; // /public-profile/:userId
  if (/^\/transaction-history\/.+/.test(pathname)) return true; // /transaction-history/:id
  if (/^\/tripDetails\/.+/.test(pathname)) return true; // /tripDetails/:id
  return false;
};

const AppLayout = () => {
  usePageTracking();

  const location = useLocation();
  const showNavbar = !isPublicRoute(location.pathname);

  const [showTerms, setShowTerms] = useState(false);
  const [termsList, setTermsList] = useState([]);
  const [showQuickExpense, setShowQuickExpense] = useState(false);

  useEffect(() => {
    const checkTerms = async () => {
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
  }, [useLocation().pathname]); // Re-check on route change if you want, or just once on mount. Pathname ensures it runs if they navigate.

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
              onClose={() => setShowQuickExpense(false)}
            />
          )}
        </>
      )}
    </div>
  );
};

export default AppLayout;
