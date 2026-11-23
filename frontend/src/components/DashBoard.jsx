import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import TripsSection from "./TripsSection";
import FairFareCard from "./FairFareCard";
import FriendsSection from "./friendsSection";
import RecentExpenses from "./RecentExpenses";
import TopNavbar from "./TopNavbar";
import NotificationBanner from "./NotificationBanner";
import { requestNotificationPermission } from "../../notifications";
import api from "../utils/api";
import TermsPopup from "./TermsPopup";
import QuickActions from "./QuickActions";
import QuickAddExpenseModal from "./QuickAddExpenseModal";
import { motion } from "framer-motion";
import { getDashboardSnapshot, saveDashboardSnapshot } from "../utils/dashboardCache";
import { guardOfflineAction } from "../utils/offlineGuard";

const handleScrollTop = () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });
};

// Stagger container — children animate one after another
const stagger = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
};

// Each card pops in with spring overshoot + slides up
const popIn = {
  hidden: { opacity: 0, scale: 0.92, y: 20 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 22,
    },
  },
};

// Header slides down with a gentle spring
const headerDrop = {
  hidden: { opacity: 0, y: -24 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 200,
      damping: 20,
    },
  },
};

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showQuickExpense, setShowQuickExpense] = useState(false);
  const API_BASE = import.meta.env.VITE_API_BASE_URL;

  // --- LOGIC SECTION (Unchanged) ---
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    handleScrollTop();
  }, []);

  useEffect(() => {
    async function getDetails() {
      const userId = Cookies.get("id");
      if (!userId) return;

      localStorage.removeItem("tripMembers");
      localStorage.removeItem("currentGroup");
      let fcmTokens = [];

      const applyCachedUser = async () => {
        const cachedUser = await getDashboardSnapshot(userId);
        if (cachedUser) {
          setUser(cachedUser);
        }
        return cachedUser;
      };

      await applyCachedUser();

      if (!navigator.onLine) {
        return;
      }

      try {
        const response = await api.get(`${API_BASE}/user/${userId}`);
        const serverUser = response.status === 200 ? response.data?.user : null;

        if (serverUser) {
          setUser(serverUser);
          await saveDashboardSnapshot(userId, serverUser);
          fcmTokens = serverUser.fcmToken || [];
        }

        const fcmToken = await requestNotificationPermission();
        if (fcmToken && (!fcmTokens.includes(fcmToken) || fcmTokens === null)) {
          await api.post(`${API_BASE}/user/set-fcm-token`, {
            fcmToken,
            userId,
          });
        }
      } catch (err) {
        console.error("Error fetching user:", err);
        await applyCachedUser();
      }
    }
    getDetails();
  }, [API_BASE]);

  useEffect(() => {
    const handleOnline = async () => {
      const userId = Cookies.get("id");
      if (!userId) return;

      try {
        const response = await api.get(`${API_BASE}/user/${userId}`);
        const serverUser = response.status === 200 ? response.data?.user : null;
        if (serverUser) {
          setUser(serverUser);
          await saveDashboardSnapshot(userId, serverUser);
        }
      } catch (error) {
        console.error("Error refreshing dashboard after reconnect:", error);
        const cachedUser = await getDashboardSnapshot(userId);
        if (cachedUser) {
          setUser(cachedUser);
        }
      }
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [API_BASE]);

  // --- UI SECTION (Redesigned) ---
  return (
    <div className="bg-zinc-950 text-zinc-100 p-4 pb-20 md:p-8 md:pb-8 relative selection:bg-indigo-500/30 font-sans">
      {/* Notification Banner */}
      <NotificationBanner />

      {/* 1. Controlled Background Theme (Max 2 colors) */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Simple top-down spotlight - Clean, no messy blobs */}
        <div className="absolute top-0 left-0 right-0 h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-zinc-950 to-zinc-950"></div>
        {/* Subtle noise texture for industry feel */}
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Grid Layout: 7 cols for Main, 5 cols for Data/Friends */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* --- LEFT COLUMN (Primary Actions) --- */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="md:col-span-1 lg:col-span-7 flex flex-col gap-6"
          >
            {/* Header Area */}
            <motion.div variants={headerDrop} className="pl-1">
              <TopNavbar user={user} />
            </motion.div>

            {/* Main Card Wrapper - Giving it a 'Premium Device' feel */}
            <motion.div variants={popIn} className="relative group perspective-1000">
              <FairFareCard user={user} />
            </motion.div>

            {/* Quick Actions Bar */}
            <motion.div variants={popIn}>
              <QuickActions
                onQuickExpenseClick={() => {
                  if (guardOfflineAction()) setShowQuickExpense(true);
                }}
              />
            </motion.div>

            {/* Trips Section - Wrapped in a clean container */}
            <motion.div
              variants={popIn}
              className="bg-zinc-900/50 border border-white/5 rounded-2xl p-1 backdrop-blur-sm overflow-hidden"
            >
              <div className="p-4 md:p-6">
                <TripsSection user={user} />
              </div>
            </motion.div>
          </motion.div>

          {/* --- RIGHT COLUMN (Data & Social) --- */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="md:col-span-1 lg:col-span-5 flex flex-col gap-6"
          >
            {/* Recent Expenses - The 'Ledger' */}
            <motion.div
              variants={popIn}
              className="flex-1 bg-zinc-900/50 border border-white/5 rounded-2xl backdrop-blur-sm overflow-hidden flex flex-col"
            >
              <div className="p-4 md:p-6 flex-1">
                <RecentExpenses user={user} />
              </div>
            </motion.div>

            {/* Friends Section - The 'Contacts' */}
            {!isMobile && (
              <motion.div
                variants={popIn}
                className="bg-zinc-900/50 border border-white/5 rounded-2xl backdrop-blur-sm overflow-hidden"
              >
                <div className="p-4 md:p-6">
                  <FriendsSection user={user} />
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
      <TermsPopup user={user} setUser={setUser} />

      {/* Quick Add Expense Modal */}
      {showQuickExpense && (
        <QuickAddExpenseModal
          isOpen={showQuickExpense}
          onClose={() => setShowQuickExpense(false)}
          user={user}
        />
      )}
    </div>
  );
};

export default Dashboard;
