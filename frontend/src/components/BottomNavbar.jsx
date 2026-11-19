/* eslint-disable react/prop-types */
import { NavLink, useLocation } from "react-router-dom";
import { FaRobot } from "react-icons/fa";
import { Home, Users, Compass, BarChart2, Plus, Receipt } from "lucide-react";
import { useState, useEffect } from "react";
import { guardOfflineAction } from "../utils/offlineGuard";

// 7 flex slots: Home(0) Friends(1) Trips(2) | FAB(3) | Expenses(4) Analytics(5) FairAI(6)
// pill width = 100/7 ≈ 14.286%
const SLOT_WIDTH = 100 / 7;

const NAV_ITEMS_LEFT = [
  {
    to: "/dash",
    label: "Home",
    Icon: Home,
    slotIndex: 0,
    matchPrefixes: ["/dash"],
  },
  {
    to: "/friends",
    label: "Friends",
    Icon: Users,
    slotIndex: 1,
    matchPrefixes: ["/friends", "/addFriend"],
  },
  {
    to: "/allTrips",
    label: "Trips",
    Icon: Compass,
    slotIndex: 2,
    matchPrefixes: ["/allTrips", "/addTrip", "/add-members", "/remove-members"],
  },
];

const NAV_ITEMS_RIGHT = [
  {
    to: "/allExpenses",
    label: "Expenses",
    Icon: Receipt,
    slotIndex: 4,
    matchPrefixes: ["/allExpenses"],
  },
  {
    to: "/analytics",
    label: "Analytics",
    Icon: BarChart2,
    slotIndex: 5,
    matchPrefixes: ["/analytics", "/categories", "/subcategories", "/expenses"],
  },
  {
    to: "/FairAI",
    label: "FairAI",
    Icon: null, // FaRobot
    slotIndex: 6,
    matchPrefixes: ["/FairAI"],
  },
];

const ALL_NAV_ITEMS = [...NAV_ITEMS_LEFT, ...NAV_ITEMS_RIGHT];

 
const NavItem = ({ to, label, Icon, matchPrefixes }) => {
  const location = useLocation();
  const isActive = matchPrefixes.some((p) => location.pathname.startsWith(p));
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  return (
    <NavLink
      to={to}
      onClick={(event) => {
        if (!guardOfflineAction(event)) return;
      }}
      aria-disabled={isOffline}
      className="relative flex flex-col items-center justify-center flex-1 py-2 z-10 active:scale-90 transition-transform duration-100"
    >
      {/* Icon with glow when active */}
      <span
        className={`transition-all duration-300 ${
          isActive
            ? "scale-110 text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]"
            : "text-zinc-500"
        }`}
      >
        {Icon ? (
          <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
        ) : (
          <FaRobot size={18} />
        )}
      </span>

      {/* Label — adaptive font on ultra-narrow screens */}
      <span
        className={`text-[8.5px] [@media(max-width:360px)]:text-[7px] font-semibold tracking-wide mt-0.5 transition-colors duration-300 ${
          isActive ? "text-indigo-400" : "text-zinc-500"
        }`}
      >
        {label}
      </span>

      {/* Width-animated active bar */}
      <span
        className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.9)] transition-all duration-300 ease-out ${
          isActive ? "w-5 opacity-100" : "w-0 opacity-0"
        }`}
      />
    </NavLink>
  );
};

const BottomNavbar = ({ onAddClick }) => {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [fabSeen, setFabSeen] = useState(
    () => !!localStorage.getItem("fabSeen")
  );

  // Darken bar on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleAddClick = () => {
    if (!guardOfflineAction()) return;
    if (!fabSeen) {
      setFabSeen(true);
      localStorage.setItem("fabSeen", "1");
    }
    onAddClick();
  };

  // Sliding pill
  const activeItem = ALL_NAV_ITEMS.find((item) =>
    item.matchPrefixes.some((p) => location.pathname.startsWith(p))
  );
  const pillLeft =
    activeItem != null ? `${activeItem.slotIndex * SLOT_WIDTH}%` : "-20%";

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className={`relative flex items-end border-t border-white/10 shadow-2xl shadow-black/60 transition-colors duration-300 ${
          scrolled
            ? "bg-zinc-950/98 backdrop-blur-2xl"
            : "bg-zinc-950/90 backdrop-blur-xl"
        }`}
      >
        {/* ── Sliding highlight pill ── */}
        <div
          className="absolute top-1 bottom-1 rounded-xl bg-indigo-500/15 border border-indigo-500/25 pointer-events-none"
          style={{
            width: `${SLOT_WIDTH}%`,
            left: pillLeft,
            transition: "left 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />

        {/* LEFT — 3 items */}
        {NAV_ITEMS_LEFT.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}

        {/* CENTER FAB — slot 3 */}
        <div className="flex-1 flex justify-center items-end pb-2 z-10">
          <button
            onClick={handleAddClick}
            aria-label="Quick add expense"
            className="
              relative -translate-y-4
              w-[50px] h-[50px] rounded-full
              bg-gradient-to-br from-indigo-500 to-violet-600
              shadow-xl shadow-indigo-600/50
              flex items-center justify-center
              text-white border-[3px] border-zinc-950
              hover:from-indigo-400 hover:to-violet-500
              hover:scale-110 hover:shadow-indigo-500/80
              active:scale-95 transition-all duration-200
            "
          >
            {/* Pulse ring — disappears after first tap */}
            {!fabSeen && (
              <span className="absolute inset-0 rounded-full border-2 border-indigo-400 animate-ping opacity-60 pointer-events-none" />
            )}
            <Plus size={22} strokeWidth={2.8} />
          </button>
        </div>

        {/* RIGHT — 3 items */}
        {NAV_ITEMS_RIGHT.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </div>
    </nav>
  );
};

export default BottomNavbar;
