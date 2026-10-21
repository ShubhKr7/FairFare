import { Link } from "react-router-dom";
import { FaUser, FaChartBar, FaRobot, FaHeartbeat } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import api from "../utils/api";
import dashboardLogoNew from "../../public/dashboardLogoNew.png";
const TopNavbar = ({ user }) => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user && user._id) {
      fetchUnreadCount();
      // Optionally poll every 30 seconds for new notifications
      const interval = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const fetchUnreadCount = async () => {
    try {
      const response = await api.get(`/activity/${user._id}/unread-count`);
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  return (
    <nav className="w-full bg-zinc-900/80 backdrop-blur-xl border border-white/5 rounded-2xl px-4 py-3 flex justify-between items-center shadow-lg shadow-black/20 relative">
      {/* --- Brand Logo (left anchor) --- */}
      <div className="flex-shrink-0">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg blur opacity-0 group-hover:opacity-25 transition duration-500 pointer-events-none"></div>
          <img
            src={dashboardLogoNew}
            alt="FairFare"
            className="relative h-9 w-auto object-contain rounded-lg"
          />
      </div>

      {/* --- Wordmark (true center) --- */}
        <span className="text-xl font-bold tracking-tight select-none">
          <span className="text-white">Fair</span>
          <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent group-hover:from-indigo-300 group-hover:to-violet-300 transition-all duration-300">
            Fare
          </span>
        </span>

      {/* --- Action Center --- */}
      <div className="flex items-center gap-3 md:gap-4">

        {/* 1. Feature Links – tablet / laptop only */}
        <div className="[@media(max-width:768px)]:hidden items-center gap-2">
          <Link to="/FairAI">
            <button
              className="p-2.5 rounded-xl bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white border border-transparent hover:border-white/5 transition-all duration-200"
              title="FairAI"
            >
              <FaRobot className="text-lg" />
            </button>
          </Link>

          <Link to="/analytics">
            <button
              className="p-2.5 rounded-xl bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white border border-transparent hover:border-white/5 transition-all duration-200"
              title="Analytics"
            >
              <FaChartBar className="text-lg" />
            </button>
          </Link>
        </div>

        {/* 2. User Actions Group */}
        <div className="flex items-center gap-2">
          <Link to={`/activity/${user?._id}`}>
            <button
              className="relative p-2.5 rounded-xl bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white border border-transparent hover:border-white/5 transition-all duration-200"
              title="Activity"
            >
              <FaHeartbeat className="text-lg" />
              {/* Unread Notification Badge */}
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-gradient-to-r from-red-500 to-rose-500 rounded-full shadow-[0_0_12px_rgba(239,68,68,0.6)]"></span>
              )}
            </button>
          </Link>

          <Link to="/profile">
            <button
              className="relative p-2.5 rounded-xl bg-transparent hover:bg-white/5 text-zinc-400 hover:text-white border border-transparent hover:border-white/5 transition-all duration-200"
              title="Edit Profile"
            >
              <FaUser className="text-lg" />
              {/* Notification Dot for Missing Gender */}
              {user && !user.gender && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
              )}
            </button>
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default TopNavbar;
