import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import FriendCard from "./FriendCard";
import axios from "axios";
import toast from "react-hot-toast";
import api from "../utils/api";

const FriendsSection = ({ user }) => {
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const API_BASE = import.meta.env.VITE_API_BASE_URL;
  const navigate = useNavigate();

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
    if (user?.friends) {
      setFriends(user.friends); // Initial load
    }
  }, [user]);

  // 🔁 POLLING: Update balances every 2 seconds
  useEffect(() => {
    const fetchUpdatedBalances = async () => {
      try {
        const res = await api.post(
          `${API_BASE}/user/get-updated-friend-balances`,
          { userId: user?._id }
        );

        const updatedData = res.data; // [{ friendId, balance }]
        // Assuming `setFriends` updates the friends list with the new balances
        setFriends((prevFriends) => {
          return prevFriends?.map((friend) => {
            // Find matching friend in updated data
            const updatedFriend = updatedData.find(
              (data) =>
                data?.friendId?.toString() === friend?.friend?._id?.toString()
            );

            if (!updatedFriend) return friend;

            // Update balance, username, and profile photo safely
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
          });
        });
      } catch (err) {
        console.error("Error fetching updated friend balances:", err);
      }
    };

    const interval = setInterval(() => {
      fetchUpdatedBalances();
    }, 2000); // Every 2 seconds

    return () => clearInterval(interval); // Cleanup
  }, [user?._id]);

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

  const filteredFriends = friends.filter((f) =>
    f.friend?.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleUpdateFriendBalance = (email, newBalance) => {
    setFriends((prev) =>
      prev.map((f) =>
        f?.friend?.email === email ? { ...f, balance: newBalance } : f
      )
    );
    const updatedUser = { ...user };
    const friendIndex = updatedUser.friends.findIndex(
      (f) => f?.friend?.email === email
    );
    if (friendIndex !== -1) {
      updatedUser.friends[friendIndex].balance = newBalance;
      localStorage.setItem("user", JSON.stringify(updatedUser));
    }
  };

  // Split and sort
  const sortedFriends = [
    // 1. Friends with non-zero balance, sorted alphabetically by name
    ...filteredFriends
      .filter((f) => f.balance !== 0)
      // 1. Friends with non-zero balance, sorted by descending balance
      .sort((a, b) => b.balance - a.balance),
    // 2. Friends with zero balance, sorted alphabetically by name
    ...filteredFriends
      .filter((f) => f.balance === 0)
      .sort((a, b) => {
        const nameA =
          a.friend && a.friend?.username
            ? a.friend?.username.toLowerCase()
            : "";
        const nameB =
          b.friend && b.friend?.username
            ? b.friend?.username.toLowerCase()
            : "";

        return nameA.localeCompare(nameB);
      }),
  ];

  return (
    <div className="flex flex-col bg-transparent">
      {/* --- Header & Actions --- */}
      <div className="flex flex-col gap-3 mb-4 md:mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
            Friends & Contacts
          </h2>

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
        </div>

        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-4 w-4 text-zinc-500"
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
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search contacts..."
            className="block w-full bg-zinc-800/50 border border-white/5 rounded-xl py-2 pl-9 pr-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
          />
        </div>
      </div>

      {/* --- Friends List Container --- */}
      {/* UX CHANGE: Restrict height to show ~4 items, then scroll */}
      <div
        className={`space-y-3 ${
          sortedFriends.length > 4
            ? "max-h-[250px] overflow-y-auto pr-2 custom-scrollbar"
            : ""
        }`}
      >
        {/* --- "You" Self Card --- */}
        <div
          className="bg-zinc-900/40 backdrop-blur-sm rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all duration-300 mb-2 overflow-hidden cursor-pointer"
          onClick={() => navigate("/personal-expenses")}
        >
          <div className="p-3 sm:p-4 flex justify-between items-center group">
            <div className="flex items-center gap-3 w-full">
              {/* Avatar */}
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
              {/* Info */}
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
            {/* Arrow indicator */}
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
          /* --- Professional Empty State --- */
          <div className="h-40 flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-xl bg-zinc-900/30 text-center p-4">
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
              <svg
                className="w-5 h-5 text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <p className="text-sm text-zinc-400 font-medium">
              No friends added yet
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              Tap the '+' button to add contacts.
            </p>
          </div>
        ) : (
          sortedFriends.map((f, index) => (
            <FriendCard
              key={f.friend?._id || index}
              friend={f.friend}
              balance={f.balance}
              index={index}
              handleDeleteFriend={() => handleDeleteFriend(f.friend?._id)}
              updateFriendBalance={handleUpdateFriendBalance}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default FriendsSection;
