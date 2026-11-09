import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import Cookies from "js-cookie";
const logo = "/newIconV3-192x192.png";
import { toast } from "react-hot-toast";
const userIcon = "/userIcon.png";
import Swal from "sweetalert2";
import {
  ArrowLeft,
  Share2,
  Copy,
  User,
  ShieldCheck,
  UserPlus,
  UserMinus,
  LogIn,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../utils/api";

const handleScrollTop = () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });
};
const API_BASE = import.meta.env.VITE_API_BASE_URL;

const PublicProfile = () => {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(null);
  const [isFriend, setIsFriend] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [hasError, setHasError] = React.useState(false);
  const [friendId, setFriendId] = useState(null);
  const [showPhoto, setShowPhoto] = useState(false);

  const navigate = useNavigate();
  const { userId } = useParams();
  const location = useLocation();
  const currentUserId = Cookies.get("id");
  const fromTransactions = new URLSearchParams(location.search).get("from") === "transactions";

  useEffect(() => {
    handleScrollTop();
  }, []);

  useEffect(() => {
    async function fetchUser() {
      try {
        setLoading(true);
        // Use the public endpoint — no auth required
        const res = await api.get(`${API_BASE}/user/public/${userId}`);
        setLoading(false);
        if (res.status === 200) {
          setFriendId(res?.data?.user?._id);
          setEmail(res.data.user.email);
          setUsername(res.data.user.username);
          setProfilePhotoUrl(res.data.user.profilePhotoUrl);
          setHasError(false); // reset if previously true

          if (currentUserId === userId) {
            setIsFriend(true);
          } else if (currentUserId && currentUserId !== userId) {
            res.data.user.friends.forEach((friend) => {
              if (friend?.friend?._id === currentUserId) {
                setIsFriend(true);
              }
            });

            // Check if a friend request is already pending
            try {
              const reqRes = await api.get(
                `${API_BASE}/user/friend-request-status/${currentUserId}/${res.data.user._id}`
              );
              if (reqRes.data?.pending) setRequestSent(true);
            } catch (e) {
              // ignore — just won't show "Request Sent"
            }
          }
        } else {
          setHasError(true);
        }
        setLoading(false);
      } catch (error) {
        setLoading(false);
        setHasError(true);

        console.error("Failed to fetch user:", error);
      }
    }

    if (userId) fetchUser();
  }, [userId, currentUserId]);

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!", {
      duration: 2000,
      position: "top-center",
      style: {
        background: "#333",
        color: "#fff",
      },
    });
  };

  const handleTopRightClick = async () => {
    if (!currentUserId) {
      const currentPath = window.location.pathname;
      navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }

    if (requestSent) return;

    if (!isFriend) {
      // Add Friend Confirmation
      const result = await Swal.fire({
        title: `Add ${username || "this user"} as a friend?`,
        text: "They’ll be able to share and split expenses with you.",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Yes, send request",
        cancelButtonText: "Cancel",
        background: "#0b0b0b",
        color: "#fff",
        confirmButtonColor: "#128b5fff",
        cancelButtonColor: "#555",
        customClass: {
          popup:
            "rounded-2xl shadow-lg backdrop-blur-md border border-white/10",
        },
      });

      if (!result.isConfirmed) return;

      try {
        const response = await api.post(`${API_BASE}/user/friend-requests/send`, {
          fromUserId: currentUserId,
          toEmail: [email],
        });

        if (response.status === 200) {
          setRequestSent(true);
          Swal.fire({
            title: "Request Sent!",
            text: `A friend request has been sent to ${username}.`,
            icon: "success",
            background: "#0b0b0b",
            color: "#fff",
            confirmButtonColor: "#128b5fff",
            customClass: {
              popup:
                "rounded-2xl shadow-lg backdrop-blur-md border border-white/10",
            },
          });
        }
      } catch (error) {
        Swal.fire({
          title: "Failed!",
          text: "Something went wrong while adding friend.",
          icon: "error",
          background: "#0b0b0b",
          color: "#fff",
          confirmButtonColor: "#ff4b4b",
        });
        console.error("Add friend failed:", error);
      }
    } else {
      // Remove Friend Confirmation
      const result = await Swal.fire({
        title: `Remove ${username || "this user"}?`,
        text: "You will no longer be friends or share expenses.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, remove friend",
        cancelButtonText: "Cancel",
        background: "#0b0b0b",
        color: "#fff",
        confirmButtonColor: "#ff4b4b",
        cancelButtonColor: "#555",
        customClass: {
          popup:
            "rounded-2xl shadow-lg backdrop-blur-md border border-white/10",
        },
      });

      if (!result.isConfirmed) return;

      try {
        const res = await api.post(`${API_BASE}/user/remove-friend`, {
          friendId: userId,
          userId: currentUserId,
        });
        if (res.status === 200) {
          setIsFriend(false);
          Swal.fire({
            title: "Removed!",
            text: `${username} has been removed from your friends.`,
            icon: "success",
            background: "#0b0b0b",
            color: "#fff",
            confirmButtonColor: "#00f5ff",
            customClass: {
              popup:
                "rounded-2xl shadow-lg backdrop-blur-md border border-white/10",
            },
          });
        }
      } catch (error) {
        // Extract error message from backend response
        const errorMessage = error.response?.data?.message || "Could not remove friend. Please try again.";
        const balance = error.response?.data?.balance;

        Swal.fire({
          title: "Failed!",
          text: errorMessage + (balance !== undefined ? ` Current balance: ₹${Math.abs(balance).toFixed(2)}` : ""),
          icon: "error",
          background: "#0b0b0b",
          color: "#fff",
          confirmButtonColor: "#ff4b4b",
          customClass: {
            popup:
              "rounded-2xl shadow-lg backdrop-blur-md border border-white/10",
          },
        });
        console.error("Failed to unfriend:", error);
      }
    }
  };
  
  // Stagger animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.05 },
    },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <>
      {loading ? (
        // --- LOADING STATE ---
        <motion.div
          className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-200 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="w-12 h-12 border-4 border-slate-800 border-t-indigo-500 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="text-sm font-medium text-slate-500"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Loading Profile...
          </motion.div>
        </motion.div>
      ) : hasError ? (
        // --- ERROR STATE ---
        <motion.div
          className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="bg-slate-900 border border-slate-800 p-8 rounded-2xl text-center max-w-sm w-full shadow-xl"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
          >
            <motion.div
              className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 250, damping: 15, delay: 0.3 }}
            >
              <UserMinus className="w-8 h-8 text-red-500" />
            </motion.div>
            <h1 className="text-slate-100 text-xl font-semibold mb-2">
              User Not Found
            </h1>
            <p className="text-slate-400 mb-6 text-sm">
              The profile you are looking for does not exist or is private.
            </p>
            <motion.button
              onClick={() => navigate("/dash")}
              className="w-full px-4 py-2.5 bg-slate-100 text-slate-900 font-medium rounded-lg hover:bg-slate-200 transition-colors"
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.02 }}
            >
              Return to Dashboard
            </motion.button>
          </motion.div>
        </motion.div>
      ) : (
        // --- MAIN PROFILE ---
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-slate-200">
          {/* TOP NAVIGATION */}
          <motion.div
            className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-10"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-all text-sm font-medium"
              whileTap={{ scale: 0.93 }}
              whileHover={{ x: -3 }}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </motion.button>

            <motion.button
              onClick={async () => {
                const profileLink = `https://fairfare-beta.vercel.app/public-profile/${friendId}`;
                const message = `Hey! 👋\n\nCheck out my FairFare profile:\n${profileLink}`;
                if (navigator.share) {
                  await navigator.share({
                    title: "FairFare Profile",
                    text: message,
                  });
                } else {
                  await navigator.clipboard.writeText(profileLink);
                  alert("Link copied!");
                }
              }}
              className="p-2.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all"
              whileTap={{ scale: 0.9, rotate: -15 }}
              whileHover={{ scale: 1.1 }}
            >
              <Share2 className="w-5 h-5" />
            </motion.button>
          </motion.div>

          {/* MAIN CARD */}
          <motion.div
            className="relative z-10 w-full max-w-sm mx-4 perspective-1000"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          >
            <div className="relative bg-gradient-to-b from-slate-800/40 to-slate-950/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl mb-2 overflow-hidden group hover:border-white/20 transition-colors duration-500">
              {/* Decorative Top Highlight */}
              <motion.div
                className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 0.5, scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              />

              <motion.div
                className="flex flex-col items-center pt-12 pb-10 px-8"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {/* Brand Badge */}
                <motion.div
                  className="mb-8 flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm"
                  variants={itemVariants}
                >
                  <img
                    src={logo}
                    alt="FairFare"
                    className="w-3.5 h-3.5 opacity-70"
                  />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    FairFare
                  </span>
                </motion.div>
              </motion.div>

              <motion.div
                className="px-6 pb-8"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {/* Profile Photo */}
                <motion.div
                  className="relative -mt-16 mb-4 flex justify-center"
                  variants={itemVariants}
                >
                  <motion.div
                    className="relative w-32 h-32 p-1 rounded-full bg-slate-900 border-4 border-slate-900"
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.25 }}
                    whileHover={{ scale: 1.05 }}
                  >
                    <img
                      src={profilePhotoUrl || userIcon}
                      alt="Profile"
                      onClick={() => setShowPhoto(true)}
                      className="w-full h-full rounded-full object-cover bg-slate-800 cursor-pointer hover:opacity-90 transition-opacity"
                    />
                    {/* Verified Tick */}
                    <motion.div
                      className="absolute bottom-1 right-1 bg-indigo-500 text-white p-1 rounded-full border-[3px] border-slate-900"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.55 }}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </motion.div>
                  </motion.div>
                </motion.div>

                {/* User Info */}
                <motion.div className="text-center mb-8" variants={itemVariants}>
                  <h2 className="text-xl font-bold text-white mb-1">
                    {username || "Unknown User"}
                  </h2>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Verified Member
                  </p>
                </motion.div>

                {/* Data Fields */}
                <div className="space-y-4 mb-8">
                  {/* Username Field */}
                  <motion.div className="group" variants={itemVariants}>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-1">
                      Username
                    </label>
                    <motion.button
                      onClick={() => handleCopy(username)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-950 transition-all group-hover:shadow-sm"
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-md bg-slate-900 text-slate-400">
                          <User className="w-4 h-4" />
                        </div>
                        <span className="text-sm text-slate-200 font-mono">
                          {username}
                        </span>
                      </div>
                      <Copy className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors" />
                    </motion.button>
                  </motion.div>

                  {/* Email Field */}
                  <motion.div className="group" variants={itemVariants}>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-1">
                      Email Address
                    </label>
                    <motion.button
                      onClick={() => handleCopy(email)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-950 transition-all group-hover:shadow-sm"
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className="flex items-center gap-3 overflow-hidden mr-2">
                        <div className="p-1.5 rounded-md bg-slate-900 text-slate-400">
                          <span className="text-xs font-bold">@</span>
                        </div>
                        <span className="text-sm text-slate-200 font-mono truncate">
                          {email}
                        </span>
                      </div>
                      <Copy className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors shrink-0" />
                    </motion.button>
                  </motion.div>
                </div>

                {/* Contextual banner when redirected from transaction history */}
                <AnimatePresence>
                  {fromTransactions && !isFriend && currentUserId && currentUserId !== userId && (
                    <motion.div
                      className="mb-6 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center"
                      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.4 }}
                    >
                      <p className="text-sm text-amber-300 font-medium">
                        🔗 You opened a shared transaction link
                      </p>
                      <p className="text-xs text-amber-400/70 mt-1">
                        Add <strong className="text-white">{username}</strong> as a friend to start tracking expenses together.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Primary Action Button */}
                <motion.button
                  onClick={handleTopRightClick}
                  className={`
                    w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200
                    ${
                      !currentUserId
                        ? "bg-slate-100 text-slate-900 hover:bg-white border border-transparent"
                        : currentUserId === userId
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-default"
                        : isFriend
                        ? "bg-transparent text-red-400 border border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50"
                        : requestSent
                        ? "bg-transparent text-amber-400 border border-amber-500/30 cursor-default opacity-80"
                        : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-900/20"
                    }
                  `}
                  disabled={requestSent || currentUserId === userId}
                  variants={itemVariants}
                  whileTap={!requestSent && currentUserId !== userId ? { scale: 0.96 } : {}}
                  whileHover={!requestSent && currentUserId !== userId ? { scale: 1.02 } : {}}
                >
                  {!currentUserId ? (
                    <>
                      {" "}
                      <LogIn className="w-4 h-4" /> Login to Connect{" "}
                    </>
                  ) : currentUserId === userId ? (
                    <>
                      {" "}
                      <ShieldCheck className="w-4 h-4" /> Yes, it's you!{" "}
                    </>
                  ) : isFriend ? (
                    <>
                      {" "}
                      <UserMinus className="w-4 h-4" /> Remove Connection{" "}
                    </>
                  ) : requestSent ? (
                    <>
                      {" "}
                      <Clock className="w-4 h-4" /> Request Sent{" "}
                    </>
                  ) : (
                    <>
                      {" "}
                      <UserPlus className="w-4 h-4" /> Add to Network{" "}
                    </>
                  )}
                </motion.button>
              </motion.div>
            </div>

            {/* Trust Footer */}
            <motion.div
              className="text-center opacity-30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              transition={{ delay: 0.8, duration: 0.5 }}
            >
              <p className="text-[10px] uppercase tracking-[0.3em] text-white font-light">
                Secured by FairFare
              </p>
            </motion.div>
          </motion.div>
        </div>
      )}

      {/* Photo Lightbox */}
      <AnimatePresence>
        {showPhoto && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 cursor-zoom-out"
            onClick={() => setShowPhoto(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <motion.img
              src={profilePhotoUrl || userIcon}
              alt="Enlarged Profile"
              className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PublicProfile;
