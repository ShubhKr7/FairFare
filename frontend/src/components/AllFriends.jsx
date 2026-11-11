import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import FriendCard from "./FriendCard";
import { FaArrowLeft } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import { FixedSizeList as List } from "react-window";
import api from "../utils/api";
import Cookies from "js-cookie";
import { motion } from "framer-motion";

const handleScrollTop = () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });
};

const AllFriendsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const API_BASE = import.meta.env.VITE_API_BASE_URL;

  const getInitials = (name) =>
    name
      ? name
          .trim()
          .split(" ")
          .map((word) => word[0]?.toUpperCase())
          .slice(0, 2)
          .join("")
      : "U";

  useEffect(() => {
    handleScrollTop();
  }, []);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setFriends(parsedUser.friends || []);
    }
  }, []);

  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  // Poll for updated balances every 2s
  useEffect(() => {
    if (!user?._id) return;

    const fetchUpdatedBalances = async () => {
      try {
        const res = await api.post(
          `${API_BASE}/user/get-updated-friend-balances`,
          {
            userId: user._id,
          }
        );

        const updatedData = res.data;
        setFriends((prevFriends) =>
          prevFriends.map((friend) => {
            const updatedFriend = updatedData.find(
              (data) =>
                data?.friendId?.toString() === friend?.friend?._id?.toString()
            );

            if (!updatedFriend) return friend;

            return {
              ...friend,
              balance: updatedFriend.balance ?? friend.balance,
              friend: {
                ...friend.friend,
                username: updatedFriend.username ?? friend.friend.username,
                profilePhotoUrl:
                  updatedFriend.profilePhotoUrl ??
                  friend.friend.profilePhotoUrl,
              },
            };
          })
        );
      } catch (err) {
        console.error("Error fetching updated friend balances:", err);
      }
    };

    const interval = setInterval(fetchUpdatedBalances, 2000);
    return () => clearInterval(interval);
  }, [user?._id]);

  useEffect(() => {
    async function getDetails() {
      const userId = Cookies.get("id");

      try {
        if (user) {
          const lastUpdatedAtUser = await api.get(
            `${API_BASE}/user/last-updated-at/${userId}`
          );
          if (
            new Date(lastUpdatedAtUser.data.lastUpdatedAt).getTime() !==
            new Date(user.updatedAt).getTime()
          ) {
            const response = await api.get(`${API_BASE}/user/${userId}`);
            if (response.status === 200) {
              setUser(response.data.user);
              localStorage.setItem("user", JSON.stringify(response.data.user));
            }
          }
        } else {
          const response = await api.get(`${API_BASE}/user/${userId}`);
          if (response.status === 200) {
            setUser(response.data.user);
            localStorage.setItem("user", JSON.stringify(response.data.user));
          }
        }
      } catch (err) {
        console.error("Error fetching user:", err);
      }
    }
    getDetails();
  }, []);

  const handleDeleteFriend = async (friendIdToDelete) => {
    try {
      const res = await api.delete(`${API_BASE}/user/remove-friend`, {
        data: {
          userId: user?._id,
          friendId: friendIdToDelete,
        },
      });

      if (res.status === 200) {
        setFriends((prev) =>
          prev.filter((f) => f.friend?._id !== friendIdToDelete)
        );

        const updatedUser = {
          ...user,
          friends: user.friends.filter(
            (f) => f.friend?._id !== friendIdToDelete
          ),
        };

        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));

        toast.success("Friend removed successfully!");
      }
    } catch (error) {
      console.error("Failed to delete friend:", error);
      // Extract error message from backend response
      const errorMessage = error.response?.data?.message || "Could not delete friend. Try again.";
      const balance = error.response?.data?.balance;

      // Show balance info if available
      if (balance !== undefined) {
        toast.error(`${errorMessage} Current balance: ₹${Math.abs(balance).toFixed(2)}`);
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const handleBack = () => {
    // Always prefer actual browser history if there is one
    if (window.history.length > 1) {
      navigate("/dash");
      return;
    }

    // If no browser history, do a replace to avoid pushing duplicate entries
    const from = location.state?.from;
    if (from) {
      navigate(from, { replace: true });
    } else {
      navigate("/dash", { replace: true });
    }
  };

  const filteredFriends = friends.filter((f) =>
    f.friend?.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedFriends = [
    ...filteredFriends
      .filter((f) => f.balance !== 0)
      .sort((a, b) => b.balance - a.balance),
    ...filteredFriends
      .filter((f) => f.balance === 0)
      .sort((a, b) =>
        (a.friend?.username || "").localeCompare(b.friend?.username || "")
      ),
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col relative font-sans selection:bg-indigo-500/30 pb-20 md:pb-0">
      {/* Background Texture (Consistent with Dashboard) */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>

      <div className="relative z-10 flex flex-col h-full max-w-2xl mx-auto w-full p-4 sm:p-6">
        {/* --- Header --- */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0.6 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex items-center justify-center mb-8"
        >
          {/* Back Button */}
          <div className="absolute left-0">
            <button
              onClick={handleBack}
              className="p-2.5 rounded-full bg-zinc-900 border border-white/10 hover:bg-zinc-800 hover:border-white/20 text-zinc-400 hover:text-white transition-all duration-300 shadow-lg shadow-black/20"
              title="Back to Dashboard"
            >
              <FaArrowLeft className="text-sm" />
            </button>
          </div>

          {/* Centered Heading */}
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Your Contacts
          </h1>
        </motion.div>

        {/* --- Search & Add --- */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0.7 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          className="flex items-center gap-3 mb-6 bg-zinc-900/50 p-1.5 rounded-2xl border border-white/5 backdrop-blur-md"
        >
          <div className="flex-1 flex items-center px-3">
            <svg
              className="w-4 h-4 text-zinc-500 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search friend..."
              className="w-full bg-transparent text-white text-sm placeholder-zinc-500 focus:outline-none"
            />
          </div>
          <Link to="/addFriend" className="relative group">
            <button
              type="button"
              className="w-9 h-9 md:w-8 md:h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-all shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95"
              title="Add New Friend"
            >
              {/* Notification Badge */}
              {user?.requests > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-zinc-900 z-10 animate-pulse">
                  {user?.requests}
                </span>
              )}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 md:h-4 md:w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          </Link>
        </motion.div>

        {/* --- Friends List --- */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
          className="min-h-[60vh] bg-zinc-900/30 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm relative"
        >
          {/* --- "You" Self Card --- */}
          <div
            className="bg-zinc-900/40 backdrop-blur-sm rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all duration-300 mb-2 overflow-hidden cursor-pointer mx-2 mt-2"
            onClick={() => navigate("/personal-expenses")}
          >
            <div className="p-3 sm:p-4 flex justify-between items-center group">
              <div className="flex items-center gap-3 w-full">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 border border-indigo-500/30 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-inner ring-2 ring-indigo-500/20">
                    {user?.profilePhotoUrl ? (
                      <img
                        src={user.profilePhotoUrl}
                        alt="Your profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-indigo-400 font-bold text-sm">
                        {getInitials(user?.username)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col flex-grow min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-zinc-100 truncate group-hover:text-indigo-200 transition-colors">
                      {user?.username}
                    </p>
                    <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-full">
                      YOU
                    </span>
                  </div>
                  <p className="text-xs font-medium text-zinc-500 truncate">
                    Personal Expenses
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 z-10">
                <div className="p-2 rounded-lg text-zinc-500 group-hover:text-indigo-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {sortedFriends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
              {friends.length === 0 ? (
                // No friends at all — guide them to the add button
                <>
                  <div className="w-20 h-20 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center mb-5">
                    <svg
                      className="w-10 h-10 text-indigo-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                      />
                    </svg>
                  </div>
                  <p className="text-white font-semibold text-lg mb-1">No friends yet</p>
                  <p className="text-zinc-400 text-sm leading-relaxed max-w-xs">
                    Tap the{" "}
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold align-middle mx-0.5">+</span>
                    {" "}button in the top right to add your first friend and start splitting expenses!
                  </p>
                </>
              ) : (
                // Has friends but search returned nothing
                <>
                  <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mb-4">
                    <svg
                      className="w-8 h-8 text-zinc-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-zinc-400 font-medium">No results for "{searchQuery}"</p>
                  <p className="text-zinc-600 text-sm mt-1">Try a different name.</p>
                </>
              )}
            </div>
          ) : (
            <div className="h-full w-full">
              <List
                height={window.innerHeight - 200} // Dynamic height calculation (adjust based on header size)
                itemCount={sortedFriends.length}
                itemSize={90} // Increased height for the new expanded card design
                width="100%"
                className="custom-scrollbar px-2"
                innerElementType="div"
              >
                {({ index, style }) => {
                  const f = sortedFriends[index];
                  return (
                    <div
                      style={{
                        ...style,
                        paddingBottom: "8px",
                        paddingTop: "8px",
                        paddingLeft: "8px",
                        paddingRight: "8px",
                      }}
                    >
                      <FriendCard
                        key={f.friend?._id || index}
                        friend={f.friend}
                        balance={f.balance}
                        index={index}
                        handleDeleteFriend={() =>
                          handleDeleteFriend(f.friend?._id)
                        }
                      />
                    </div>
                  );
                }}
              </List>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AllFriendsPage;
