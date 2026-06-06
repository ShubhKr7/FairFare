import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import {
  ArrowLeft,
  Search,
  UserPlus,
  Bell,
  X,
  Mail,
  Send,
  Check,
  Trash2,
  ShieldCheck,
  Sparkles,
  UserCheck, // Imported UserCheck
} from "lucide-react";
import api from "../utils/api";
import Suggestions from "./Suggestions";
import { motion } from "framer-motion";

const AddFriend = () => {
  const navigate = useNavigate();

  const [friends, setFriends] = useState(() => {
    try {
      const saved = sessionStorage.getItem("selectedFriends");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);

  // Debounce + suggestions
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [friendSuggestions, setFriendSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsPage, setSuggestionsPage] = useState(1);
  const [hasMoreSuggestions, setHasMoreSuggestions] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [existingFriendIds, setExistingFriendIds] = useState(new Set());
  const controllerRef = useRef(null);

  const userId = Cookies.get("id");

  useEffect(() => {
    handleScrollTop();
  }, []);

  const handleScrollTop = () => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth",
    });
  };

  // 1. Fetch Request & Existing Friends
  useEffect(() => {
    const fetchLocalData = async () => {
      // 1. Fetch pending requests (Keep this API call as requests change frequently)
      if (userId) {
        try {
          const reqRes = await api.get(`/user/friend-requests/${userId}`);
          setRequests(reqRes.data || []);
        } catch (e) {
          console.error("Failed to fetch requests", e);
        }
      }

      // 2. Load Existing Friends from LocalStorage
      // Assuming the key is "user" or "userInfo" - adjust if yours is different
      const localUserStr = localStorage.getItem("user");

      if (localUserStr) {
        try {
          const localUser = JSON.parse(localUserStr);
          const friendsList = localUser.friends || [];

          // Create a Set of IDs
          const ids = new Set();

          friendsList.forEach((item) => {
            // The schema says: friends: [{ friend: ObjectId, balance: Number }]
            // We need to handle two cases for 'item.friend':

            if (typeof item.friend === "string") {
              // Case A: It's just an ID string (Unpopulated)
              ids.add(item.friend);
            } else if (item.friend && item.friend._id) {
              // Case B: It's a full object (Populated)
              ids.add(item.friend._id);
            }
          });

          setExistingFriendIds(ids);
        } catch (err) {
          console.error("Error parsing user from localStorage", err);
        }
      }
    };

    fetchLocalData();
  }, [userId]);

  const fetchFriendSuggestions = useCallback(async (pageNum = 1) => {
    if (!userId) {
      setFriendSuggestions([]);
      setHasMoreSuggestions(false);
      return;
    }

    try {
      setSuggestionsLoading(true);
      const response = await api.get(`/user/friend-suggestions/${userId}`, {
        params: { page: pageNum, limit: 4 },
      });

      const { suggestions: data = [], pagination = {} } = response.data || {};

      setFriendSuggestions((prev) => {
        if (pageNum === 1) {
          return data;
        }

        const merged = [...prev, ...data];
        const uniqueSuggestions = new Map();

        merged.forEach((item) => {
          uniqueSuggestions.set(item.user._id, item);
        });

        return Array.from(uniqueSuggestions.values());
      });

      setHasMoreSuggestions(Boolean(pagination.hasMore));
      setSuggestionsPage(pageNum);
    } catch (error) {
      console.error("Error fetching friend suggestions:", error);
      if (pageNum === 1) {
        setFriendSuggestions([]);
      }
    } finally {
      setSuggestionsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchFriendSuggestions(1);
  }, [fetchFriendSuggestions]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync selected friends to sessionStorage
  useEffect(() => {
    sessionStorage.setItem("selectedFriends", JSON.stringify(friends));
  }, [friends]);

  const respond = async (fromUserId, action) => {
    try {
      await api.post(`/user/friend-requests/respond`, {
        userId,
        fromUserId,
        action,
      });
      // Refresh requests list
      const res = await api.get(`/user/friend-requests/${userId}`);
      setRequests(res.data || []);

      toast.success(
        action === "approve"
          ? "Friend request accepted"
          : "Friend request denied"
      );
    } catch (e) {
      // console.error(e);
    }
  };

  // Debounce the search value
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(search.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch suggestions
  useEffect(() => {
    if (!debouncedQuery) {
      setSuggestions([]);
      setIsSearching(false);
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
      return;
    }

    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    const controller = new AbortController();
    controllerRef.current = controller;

    const fetchSuggestions = async () => {
      setIsSearching(true);
      try {
        const res = await api.get(
          `/user/search?username=${encodeURIComponent(debouncedQuery)}`,
          { signal: controller.signal }
        );

        const users = res.data?.users ?? res.data ?? [];

        const mapped = (users || [])
          .filter((u) => u._id !== userId)
          .slice(0, 8)
          .map((u) => ({
            _id: u._id,
            username: u.username,
            email: u.email,
            profilePhotoUrl: u.profilePhotoUrl || "/userIcon.png",
          }));

        setSuggestions(mapped);
      } catch (err) {
        if (axios.isCancel(err) || err.name === "CanceledError") {
          // ignore
        } else {
          console.error("Error fetching suggestions:", err);
        }
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    };

    fetchSuggestions();

    return () => {
      controller.abort();
      controllerRef.current = null;
    };
  }, [debouncedQuery]);

  const handleSuggestionClick = (userObj) => {
    if (!userObj?.email) {
      toast.error("Selected user has no email associated.");
      return;
    }

    // Check if ALREADY existing friend (Backend)
    if (existingFriendIds.has(userObj._id)) {
      toast("You are already friends with this person.", {
        icon: "🤝",
        style: { borderRadius: "10px", background: "#333", color: "#fff" },
      });
      return;
    }

    // Check if ALREADY in selection list (Local State)
    if (friends.some((f) => f.email === userObj.email)) {
      toast.error("This friend is already selected.");
      setSearch("");
      setSuggestions([]);
      return;
    }

    setFriends((prev) => [
      ...prev,
      {
        _id: userObj._id,
        email: userObj.email,
        name: userObj.username,
        profilePhotoUrl: userObj.profilePhotoUrl,
      },
    ]);

    setSearch("");
    setDebouncedQuery("");
    setSuggestions([]);
  };

  const handleDeleteFriend = (index) => {
    const updatedFriends = friends.filter((_, i) => i !== index);
    setFriends(updatedFriends);
  };

  const handleDone = async () => {
    if (!userId) {
      toast.error("User not loaded. Please wait a moment.");
      return;
    }

    if (friends.length === 0) {
      toast.error("Please add at least one friend before proceeding.");
      return;
    }
    try {
      setLoading(true);

      const response = await api.post(`/user/friend-requests/send`, {
        fromUserId: userId,
        toEmail: friends.map((f) => f.email),
      });

      if (response.status === 200) {
        const results = response.data.results || [];

        results.map((r) => {
          r.reason ? toast.success(`(${r.reason})`) : "";
        });

        setFriends([]);
        sessionStorage.removeItem("selectedFriends");
      } else {
        toast.error(`Failed to add friends: ${response.data.message}`);
      }
    } catch (err) {
      console.error("Error sending friend requests:", err);
      toast.error("Something went wrong!");
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async () => {
    setLoadingInvite(true);
    setInviteSent(false);
    try {
      await api.post(`/user/invite`, {
        email: inviteEmail,
        userId: userId,
      });
      setInviteSent(true);
    } catch (e) {
      if (e.status === 403) toast.error("Email already exists!");
      else toast.error("Some error occurred!");
    } finally {
      setLoadingInvite(false); // Stop the spinner
    }
  };

  const handleLoadMoreSuggestions = () => {
    if (!suggestionsLoading && hasMoreSuggestions) {
      fetchFriendSuggestions(suggestionsPage + 1);
    }
  };

  const handleSendSuggestedFriendRequest = async (suggestion) => {
    const targetUserId = suggestion?.user?._id;

    if (!userId || !targetUserId) {
      toast.error("Unable to send friend request right now.");
      return;
    }

    try {
      const response = await api.post(`/user/friend-requests/send`, {
        fromUserId: userId,
        toUserId: [targetUserId],
      });

      const result = response.data?.results?.[0];

      if (result?.status === "success") {
        toast.success(result.reason || "Friend request sent");
      } else if (result?.reason) {
        toast(result.reason, {
          icon: "🤝",
        });
      }

      setFriendSuggestions((prev) =>
        prev.filter((item) => item.user._id !== targetUserId)
      );
    } catch (error) {
      console.error("Error sending friend request:", error);
      toast.error("Failed to send friend request");
    }
  };

  return (
    <div className="relative bg-slate-950 min-h-[100dvh] flex items-start lg:items-center justify-center font-sans selection:bg-cyan-500/30 overflow-hidden p-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:p-4 lg:py-4">
      {/* --- ATMOSPHERIC BACKGROUND --- */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-600/10 rounded-full blur-[100px] animate-pulse delay-1000"></div>
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
      </div>

      {/* --- TOP NAVIGATION BAR --- */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 14 }}
        className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-50"
      >
        <button
          onClick={() => {
            sessionStorage.removeItem("selectedFriends");
            navigate(-1);
          }}
          className="group flex items-center justify-center w-12 h-12 rounded-full bg-slate-900/50 backdrop-blur-md border border-white/10 text-slate-400 hover:text-white hover:border-white/30 transition-all duration-300 shadow-xl"
          title="Back"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className={`group flex items-center justify-center w-12 h-12 rounded-full backdrop-blur-md border transition-all duration-300 shadow-xl ${open || requests.length > 0
              ? "bg-slate-800 border-cyan-500/50 text-cyan-400"
              : "bg-slate-900/50 border-white/10 text-slate-400 hover:text-white"
              }`}
          >
            <Bell
              className={`w-5 h-5 ${requests.length > 0 ? "animate-swing" : ""
                }`}
            />
            {requests.length > 0 && (
              <span className="absolute top-0 right-0 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              </span>
            )}
          </button>

          {/* Requests Dropdown */}
          {open && (
            <div className="absolute right-0 mt-3 w-80 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-down origin-top-right ring-1 ring-black/5">
              <div className="px-4 py-3 border-b border-white/5 bg-white/5 flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Incoming Requests
                </span>
                <span className="text-xs font-mono text-cyan-500">
                  {requests.length}
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                {requests.length === 0 ? (
                  <div className="py-8 text-center px-6">
                    <div className="mx-auto w-10 h-10 mb-3 bg-slate-800/50 rounded-full flex items-center justify-center">
                      <Bell className="w-4 h-4 text-slate-600" />
                    </div>
                    <p className="text-slate-400 text-sm">All caught up!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {requests.map((req) => (
                      <div
                        key={req._id || req.from?._id}
                        className="p-4 hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">
                            {req.from?.username?.[0]?.toUpperCase() || "U"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-white truncate">
                              {req.from?.username}
                            </h4>
                            <p className="text-xs text-slate-400 truncate">
                              {req.from?.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => respond(req.from?._id, "approve")}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
                          >
                            <Check className="w-3 h-3" /> Accept
                          </button>
                          <button
                            onClick={() => respond(req.from?._id, "deny")}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 border border-red-500/20 transition-all"
                          >
                            <X className="w-3 h-3" /> Ignore
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* --- MAIN INTERFACE --- */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 150, damping: 18, delay: 0.1 }}
        className="relative z-10 w-full max-w-7xl lg:h-[calc(100dvh-2rem)]"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 items-stretch lg:h-full">
          <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col min-h-0 lg:h-full">
            {/* Header */}
            <div className="px-5 sm:px-8 pt-8 pb-6 text-center">
              <div className="inline-flex items-center justify-center gap-2 mb-4 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20">
                <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                  Invite Members
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Build Your Squad
              </h2>
              <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">
                Search for friends to start splitting expenses.
              </p>
            </div>

            {/* Search Section */}
            <div className="px-5 sm:px-8 relative z-30 flex flex-col gap-3">
              <div className="relative group flex-1">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                <div className="relative flex items-center bg-slate-950 border border-white/10 rounded-xl px-4 py-3 shadow-inner focus-within:border-cyan-500/50 transition-colors">
                  <Search className="w-5 h-5 text-slate-500 mr-3 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search by username..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 min-w-0 bg-transparent text-white placeholder-slate-600 focus:outline-none text-sm"
                    autoComplete="off"
                  />
                  {isSearching && (
                    <div className="w-4 h-4 border-2 border-slate-600 border-t-cyan-500 rounded-full animate-spin shrink-0"></div>
                  )}
                </div>

                {/* Suggestions Dropdown */}
                {(suggestions.length > 0 ||
                  (isSearching && search.length > 0)) && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto custom-scrollbar ring-1 ring-black/20 z-50">
                      {suggestions.map((s) => {
                        const isAlreadyFriend = existingFriendIds.has(s._id);

                        return (
                          <div
                            key={s._id}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() =>
                              !isAlreadyFriend && handleSuggestionClick(s)
                            }
                            className={`px-4 py-3 flex items-center gap-3 transition-colors group/item ${isAlreadyFriend
                              ? "cursor-not-allowed bg-white/5 opacity-60"
                              : "cursor-pointer hover:bg-white/5"
                              }`}
                          >
                            <img
                              src={s.profilePhotoUrl}
                              alt={s.username}
                              className={`w-10 h-10 rounded-full object-cover border transition-colors ${isAlreadyFriend
                                ? "border-emerald-500/30 grayscale-[0.5]"
                                : "border-white/10 group-hover/item:border-cyan-500/50"
                                }`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-white truncate">
                                  {s.username}
                                </span>
                                {isAlreadyFriend ? (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
                                    Friend
                                  </span>
                                ) : (
                                  <ShieldCheck className="w-3 h-3 text-cyan-500 shrink-0" />
                                )}
                              </div>
                              <div className="text-xs text-slate-400 truncate">
                                {s.email}
                              </div>
                            </div>

                            <div
                              className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all shrink-0 ${isAlreadyFriend
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                : "border-white/10 group-hover/item:bg-cyan-500 group-hover/item:border-cyan-500"
                                }`}
                            >
                              {isAlreadyFriend ? (
                                <UserCheck className="w-3 h-3" />
                              ) : (
                                <UserPlus className="w-3 h-3 text-slate-400 group-hover/item:text-white" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {suggestions.length === 0 && !isSearching && (
                        <div className="p-4 text-center text-xs text-slate-500">
                          No users found
                        </div>
                      )}
                    </div>
                  )}
              </div>

              {/* NEW: Invite via Email Button */}
              <button
                onClick={() => setShowInviteModal(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all text-xs sm:text-sm font-semibold"
              >
                <Mail className="w-4 h-4" />
                Can't find them? Invite via Email
              </button>
            </div>

            {/* Selected Friends List */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 py-6 custom-scrollbar max-h-[60dvh] lg:max-h-none">
              <div className="flex items-center justify-between mb-4 gap-3">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Selected ({friends.length})
                </span>
                {friends.length > 0 && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">
                    Ready to Add
                  </span>
                )}
              </div>

              {friends.length === 0 ? (
                <div className="min-h-40 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl bg-white/5 px-4 text-center">
                  <Sparkles className="w-6 h-6 text-slate-600 mb-2 opacity-50" />
                  <p className="text-xs text-slate-500">
                    No friends selected yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {friends.map((friend, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gradient-to-r from-slate-800/50 to-slate-900/50 border border-white/5 group hover:border-white/10 transition-all"
                    >
                      <div
                        className="flex items-center gap-3 min-w-0 cursor-pointer"
                        onClick={() => navigate(`/public-profile/${friend._id}`)}
                      >
                        <div className="relative shrink-0">
                          <img
                            src={friend.profilePhotoUrl}
                            alt={friend.username}
                            className="w-10 h-10 rounded-full object-cover border border-white/10"
                          />
                          <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-0.5 border-2 border-slate-900">
                            <Check className="w-2 h-2 text-black" />
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-white truncate hover:text-cyan-400 transition-colors">
                            {friend.name ?? friend.username}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {friend.email}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteFriend(index)}
                        className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer / Action */}
            <div className="p-5 sm:p-8 pt-4 bg-slate-950/30 border-t border-white/5">
              <button
                onClick={handleDone}
                disabled={friends.length === 0 || loading}
                className={`w-full py-4 rounded-xl font-bold tracking-widest uppercase text-xs transition-all duration-300 shadow-lg ${friends.length === 0
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5"
                  : "bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-cyan-500/20 active:scale-[0.98]"
                  }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Updating List...
                  </span>
                ) : (
                  "Confirm Selection"
                )}
              </button>
            </div>
          </div>

          {userId && (
            <Suggestions
              suggestions={friendSuggestions}
              loading={suggestionsLoading}
              hasMore={hasMoreSuggestions}
              onLoadMore={handleLoadMoreSuggestions}
              onProfileClick={(suggestion) => {
                navigate(`/public-profile/${suggestion.user._id}`);
              }}
              onSendFriendRequest={handleSendSuggestedFriendRequest}
              title="Friend Suggestions"
              subtitle="Quick adds based on your network."
              className="lg:h-full"
            />
          )}
        </div>
      </motion.div>

      {/* --- EMAIL INVITE MODAL --- */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => {
              setShowInviteModal(false);
              setInviteSent(false); // Reset success state on close
            }}
          ></div>
          <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8">
              {/* --- CLOSE BUTTON --- */}
              {!loadingInvite && (
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteSent(false);
                  }}
                  className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 text-slate-500 hover:text-white transition-colors z-10"
                >
                  <X className="w-5 h-5" />
                </button>
              )}

              {loadingInvite ? (
                /* --- LOADING STATE --- */
                <div className="py-12 flex flex-col items-center justify-center space-y-4 animate-pulse">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
                    <Mail className="absolute inset-0 m-auto w-6 h-6 text-cyan-400" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-white">
                      Sending Invite
                    </h3>
                    <p className="text-slate-400 text-sm">
                      Deploying magic link...
                    </p>
                  </div>
                </div>
              ) : inviteSent ? (
                /* --- SUCCESS STATE --- */
                <div className="py-12 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mb-4 animate-bounce">
                    <Check className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Invite Sent!</h3>
                  <p className="text-slate-400 text-sm mt-2 mb-8">
                    {inviteEmail} has been invited.
                  </p>
                  <button
                    onClick={() => {
                      setInviteSent(false);
                      setInviteEmail("");
                    }}
                    className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold rounded-lg transition-all"
                  >
                    Send Another
                  </button>
                </div>
              ) : (
                /* --- INPUT STATE (DEFAULT) --- */
                <>
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-white">
                      Invite via Email
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">
                      Send a magic link to join your squad.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="relative group">
                      <Mail
                        className={`absolute left-4 top-5 w-5 h-5 transition-colors ${inviteEmail &&
                          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)
                          ? "text-red-400"
                          : "text-slate-500 group-focus-within:text-cyan-400"
                          }`}
                      />
                      <input
                        type="email"
                        placeholder="friend@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className={`w-full bg-slate-950 border rounded-xl py-4 pl-12 pr-12 text-white focus:outline-none transition-all ${inviteEmail &&
                          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)
                          ? "border-red-500/50 focus:border-red-500"
                          : "border-white/10 focus:border-cyan-500/50"
                          }`}
                      />

                      {/* --- CLEAR (X) OPTION --- */}
                      {inviteEmail && (
                        <button
                          onClick={() => setInviteEmail("")}
                          className="absolute right-4 top-5 p-0.5 rounded-full bg-white/5 hover:bg-white/20 text-slate-500 hover:text-white transition-all duration-200"
                          title="Clear input"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}

                      {/* Validation Message */}
                      {inviteEmail &&
                        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail) && (
                          <p className="text-[10px] text-red-400 mt-1.5 ml-1 font-medium animate-in fade-in slide-in-from-top-1">
                            Please enter a valid email address
                          </p>
                        )}
                    </div>

                    <button
                      onClick={handleSendInvite}
                      disabled={
                        !inviteEmail ||
                        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail) ||
                        loadingInvite
                      }
                      className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Send Invitation
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .animate-swing { animation: swing 2s infinite; transform-origin: top center; }
        @keyframes swing { 20% { transform: rotate(15deg); } 40% { transform: rotate(-10deg); } 60% { transform: rotate(5deg); } 80% { transform: rotate(-5deg); } 100% { transform: rotate(0deg); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
      `}</style>
    </div>
  );
};

export default AddFriend;
