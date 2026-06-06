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
  UserCheck,
  Share2,
  Copy,
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
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Debounce + suggestions
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [friendSuggestions, setFriendSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsPage, setSuggestionsPage] = useState(1);
  const [hasMoreSuggestions, setHasMoreSuggestions] = useState(true);
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

  const getReferrerName = () => {
    try {
      const localUserStr = localStorage.getItem("user");
      if (localUserStr) {
        const localUser = JSON.parse(localUserStr);
        return localUser.username || "Your friend";
      }
    } catch (e) {
      console.error(e);
    }
    return "Your friend";
  };

  const getInviteMsg = () => {
    const inviteLink = `https://fair-fare-phi.vercel.app/signup/${userId}`;
    const referrerName = getReferrerName();
    return `💸 *Fair Fare Invitation* 💸\n\nHey! 🚀 *${referrerName}* has invited you to join *Fair Fare*, the ultimate app to track and split expenses seamlessly with friends! 🤝✨\n\nNo more awkward "you owe me" conversations! 😉 Let's split bills, track trips, and stay square.\n\nClick the link below to sign up and connect automatically:\n🔗 ${inviteLink}\n\nLet's start splitting smarter! 🍕✈️🎉`;
  };

  const handleShareWhatsApp = () => {
    const inviteMsg = getInviteMsg();
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const whatsappUrl = isMobile
      ? `whatsapp://send?text=${encodeURIComponent(inviteMsg)}`
      : `https://web.whatsapp.com/send?text=${encodeURIComponent(inviteMsg)}`;

    if (isMobile) {
      const w = window.open(whatsappUrl, "_blank");
      setTimeout(() => {
        if (!w || w.closed || typeof w.closed == 'undefined') {
          window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(inviteMsg)}`, "_blank");
        }
      }, 500);
    } else {
      window.open(whatsappUrl, "_blank");
    }
  };

  const handleShareTelegram = () => {
    const inviteLink = `https://fair-fare-phi.vercel.app/signup/${userId}`;
    const inviteMsg = getInviteMsg();
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(inviteMsg)}`;
    window.open(telegramUrl, "_blank");
  };

  const handleShareNative = async () => {
    const inviteLink = `https://fair-fare-phi.vercel.app/signup/${userId}`;
    const inviteMsg = getInviteMsg();

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Fair Fare",
          text: inviteMsg,
          url: inviteLink,
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Native share failed:", err);
        }
      }
    } else {
      toast.error("Native sharing is not supported on this browser.");
    }
  };

  const handleShareInstagram = () => {
    const inviteMsg = getInviteMsg();
    navigator.clipboard.writeText(inviteMsg);
    toast.success("Invitation copied to clipboard! Opening Instagram...");

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setTimeout(() => {
      if (isMobile) {
        window.open("instagram://sharesheet", "_blank");
        setTimeout(() => {
          window.open("https://instagram.com/", "_blank");
        }, 500);
      } else {
        window.open("https://instagram.com/direct/inbox/", "_blank");
      }
    }, 1000);
  };

  const handleShareSnapchat = () => {
    const inviteMsg = getInviteMsg();
    navigator.clipboard.writeText(inviteMsg);
    toast.success("Invitation copied to clipboard! Opening Snapchat...");

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setTimeout(() => {
      if (isMobile) {
        window.open("snapchat://", "_blank");
        setTimeout(() => {
          window.open("https://snapchat.com/", "_blank");
        }, 500);
      } else {
        window.open("https://snapchat.com/", "_blank");
      }
    }, 1000);
  };

  const handleCopyLink = () => {
    const inviteMsg = getInviteMsg();
    navigator.clipboard.writeText(inviteMsg);
    setCopiedLink(true);
    toast.success("Invitation copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2000);
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

              {/* Invite via Email & Socials Button */}
              <button
                onClick={() => setShowShareModal(true)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500/15 to-indigo-500/15 border border-cyan-500/30 text-cyan-300 hover:text-cyan-200 hover:bg-gradient-to-r hover:from-cyan-500/20 hover:to-indigo-500/20 transition-all text-xs sm:text-sm font-bold shadow-lg"
              >
                <UserPlus className="w-4 h-4" />
                Invite Friends to Fair Fare
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

      {/* --- UNIFIED INVITE MODAL --- */}
      {showShareModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => {
              setShowShareModal(false);
              setInviteSent(false);
            }}
          ></div>
          <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-6 sm:p-8">
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowShareModal(false);
                  setInviteSent(false);
                }}
                className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-6">
                <div className="inline-flex items-center justify-center gap-2 mb-3 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                  <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">
                    Invite Friends
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white">Invite to Fair Fare</h3>
                <p className="text-slate-400 text-xs sm:text-sm mt-1">
                  Invite your friends to split expenses and track trips.
                </p>
              </div>

              {/* SECTION 1: Invite via Email */}
              <div className="mb-6 bg-slate-950/40 border border-white/5 rounded-2xl p-4 sm:p-5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">
                  Option 1: Direct Email Invite
                </span>

                {loadingInvite ? (
                  <div className="py-8 flex flex-col items-center justify-center space-y-4">
                    <div className="relative w-20 h-20 flex items-center justify-center">
                      <div className="premium-loader-glow"></div>
                      <div className="premium-loader-ring absolute"></div>
                      <Mail className="w-6 h-6 text-cyan-400 premium-loader-icon absolute" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-xs font-bold text-white tracking-wide">Sending Magic Link</p>
                      <p className="text-[10px] text-cyan-400/80 animate-pulse font-medium">Deploying invitation email...</p>
                    </div>
                  </div>
                ) : inviteSent ? (
                  <div className="py-2 flex flex-col items-center justify-center text-center">
                    <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mb-2 text-emerald-400">
                      <Check className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-bold text-white">Invite Sent Successfully!</p>
                    <p className="text-xs text-slate-400 mt-1 mb-3">{inviteEmail}</p>
                    <button
                      onClick={() => {
                        setInviteSent(false);
                        setInviteEmail("");
                      }}
                      className="px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold rounded-lg transition-all"
                    >
                      Send Another
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative group">
                      <Mail
                        className={`absolute left-3 top-3.5 w-4 h-4 transition-colors ${inviteEmail &&
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
                        className={`w-full bg-slate-950 border rounded-xl py-3 pl-9 pr-9 text-xs text-white focus:outline-none transition-all ${inviteEmail &&
                          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)
                          ? "border-red-500/50 focus:border-red-500"
                          : "border-white/10 focus:border-cyan-500/50"
                          }`}
                      />
                      {inviteEmail && (
                        <button
                          onClick={() => setInviteEmail("")}
                          className="absolute right-3 top-3.5 p-0.5 rounded-full bg-white/5 hover:bg-white/20 text-slate-500 hover:text-white transition-all"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {inviteEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail) && (
                      <p className="text-[10px] text-red-400 ml-1">
                        Please enter a valid email address
                      </p>
                    )}
                    <button
                      onClick={handleSendInvite}
                      disabled={
                        !inviteEmail ||
                        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail) ||
                        loadingInvite
                      }
                      className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send Invite
                    </button>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="relative flex items-center mb-6">
                <div className="flex-grow border-t border-white/5"></div>
                <span className="flex-shrink-0 mx-4 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                  OR SHARE DIRECT LINK
                </span>
                <div className="flex-grow border-t border-white/5"></div>
              </div>

              {/* SECTION 2: Share via Socials */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* System Share (If supported) */}
                {navigator.share && (
                  <button
                    onClick={handleShareNative}
                    className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all text-center gap-1.5 group"
                  >
                    <div className="p-2.5 rounded-full bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition-transform">
                      <Share2 className="w-4.5 h-4.5" />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-300">Share via System</span>
                  </button>
                )}

                {/* WhatsApp */}
                <button
                  onClick={handleShareWhatsApp}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-[#25D366]/30 hover:bg-[#25D366]/5 transition-all text-center gap-1.5 group"
                >
                  <div className="w-10 h-10 rounded-full bg-[#25D366]/10 group-hover:scale-110 transition-transform flex items-center justify-center">
                    <img src="/app_logos/whatsapp.svg" alt="WhatsApp" className="w-5 h-5 object-contain" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">WhatsApp</span>
                </button>

                {/* Telegram */}
                <button
                  onClick={handleShareTelegram}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-[#229ED9]/30 hover:bg-[#229ED9]/5 transition-all text-center gap-1.5 group"
                >
                  <div className="w-10 h-10 rounded-full bg-[#229ED9]/10 group-hover:scale-110 transition-transform flex items-center justify-center">
                    <img src="/app_logos/telegram.svg" alt="Telegram" className="w-5 h-5 object-contain" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Telegram</span>
                </button>

                {/* Instagram */}
                <button
                  onClick={handleShareInstagram}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-[#E1306C]/30 hover:bg-[#E1306C]/5 transition-all text-center gap-1.5 group"
                >
                  <div className="w-10 h-10 rounded-full bg-[#E1306C]/10 group-hover:scale-110 transition-transform flex items-center justify-center">
                    <img src="/app_logos/instagram.svg" alt="Instagram" className="w-5 h-5 object-contain" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Instagram</span>
                </button>

                {/* Snapchat */}
                <button
                  onClick={handleShareSnapchat}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-[#FFFC00]/30 hover:bg-[#FFFC00]/5 transition-all text-center gap-1.5 group"
                >
                  <div className="w-10 h-10 rounded-full bg-[#FFFC00]/10 group-hover:scale-110 transition-transform flex items-center justify-center">
                    <img src="/app_logos/snapchat.png" alt="Snapchat" className="w-5 h-5 object-contain" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">Snapchat</span>
                </button>

                {/* Copy Invite Link */}
                <button
                  onClick={handleCopyLink}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all text-center gap-1.5 group"
                >
                  <div className={`p-2.5 rounded-full transition-transform group-hover:scale-110 ${copiedLink ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                    {copiedLink ? <Check className="w-4.5 h-4.5" /> : <Copy className="w-4.5 h-4.5" />}
                  </div>
                  <span className="text-[10px] font-semibold text-slate-300">{copiedLink ? "Copied!" : "Copy Link"}</span>
                </button>
              </div>

              <div className="text-center mt-3">
                <span className="text-[10px] text-slate-500">
                  Tip: Copying the link also copies the full invitation message text!
                </span>
              </div>
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
        
        .premium-loader-ring {
          border: 3px solid rgba(6, 182, 212, 0.1);
          border-top: 3px solid #06b6d4;
          border-right: 3px solid #3b82f6;
          border-radius: 50%;
          width: 56px;
          height: 56px;
          animation: premium-spin 1s cubic-bezier(0.55, 0.15, 0.45, 0.85) infinite;
          filter: drop-shadow(0 0 8px rgba(6, 182, 212, 0.5));
        }
        .premium-loader-icon {
          animation: premium-float 2s ease-in-out infinite;
        }
        .premium-loader-glow {
          position: absolute;
          width: 80px;
          height: 80px;
          background: radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%);
          animation: premium-pulse 2s infinite ease-in-out;
          pointer-events: none;
        }
        @keyframes premium-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes premium-float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-4px) scale(1.1); filter: drop-shadow(0 4px 6px rgba(6, 182, 212, 0.4)); }
        }
        @keyframes premium-pulse {
          0%, 100% { transform: scale(0.8); opacity: 0.5; }
          50% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default AddFriend;
