import { useState, useEffect, useRef } from "react";
import { FaSignOutAlt } from "react-icons/fa";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import toast from "react-hot-toast";
import { authFetch } from "../utils/authFetch";
import api from "../utils/api";
import AvatarSelector from "./AvatarSelector";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Share2,
  User,
  Camera,
  Upload,
  Lock,
  Mail,
  CreditCard,
  Crown
} from "lucide-react";

const handleScrollTop = () => {
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth",
  });
};

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const ProfileEnhanced = () => {
  const [profile, setProfile] = useState({
    username: "",
    email: "",
    upiId: "",
    gender: "",
  });
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(true);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [username, setUsername] = useState("");
  const controllerRef = useRef(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [user, setUser] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedAvatarPath, setSelectedAvatarPath] = useState(null); // public path for predefined avatars
  const [isHoveringPhoto, setIsHoveringPhoto] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const handleSignOut = async () => {
    console.log("Sign out");
    const userId = Cookies.get("id");
    try {
      const response = await axios.post(`${API_BASE}/user/remove-fcm-token`, {
        userId: userId,
      });

      if (response.status === 200) {
        Cookies.remove("id");
        Cookies.remove("last4");
        localStorage.clear();
        navigate("/");
        toast.success("Signed out successfully");
      }
    } catch (error) {
      console.error("Sign out error", error);
      toast.error("Error signing out. Please try again.");
    }
  };

  const navigate = useNavigate();
  const userId = Cookies.get("id");

  useEffect(() => {
    handleScrollTop();
  }, []);

  useEffect(() => {
    // console.log("userId",userId);

    async function getDetails() {
      if (!user && userId) {
        try {
          const response = await authFetch(`${API_BASE}/user/${userId}`);
          if (response.ok) {
            const data = await response.json();
            const fetchedUser = data.user;
            setUser(fetchedUser);
            setProfile(fetchedUser);
            if (fetchedUser.profilePhotoUrl)
              setPreview(fetchedUser.profilePhotoUrl);
            localStorage.setItem("user", JSON.stringify(fetchedUser));
          }
        } catch (err) {
          console.error("Error fetching user:", err);
        }
      }
    }

    getDetails();
  }, []);

  // Debounce the username value
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(username.trim());
    }, 300); // 300ms debounce
    return () => clearTimeout(t);
  }, [username]);

  //UseEffect to check username availability using debouncing
  useEffect(() => {
    if (!debouncedQuery) {
      setIsUsernameAvailable(true);
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
      setCheckingUsername(true);

      try {
        const url = `${API_BASE}/user/search?username=${encodeURIComponent(
          debouncedQuery
        )}`;
        const res = await api.get(url, { signal: controller.signal });
        const users = res.data?.users ?? res.data ?? [];

        // 👇 Check if current username is already taken
        const usernameTaken = users.some(
          (u) => u.username === debouncedQuery && u._id !== userId
        );
        setIsUsernameAvailable(!usernameTaken);
      } catch (err) {
        if (!axios.isCancel(err) && err.name !== "CanceledError") {
          console.error("Error fetching suggestions:", err);
        }
        setIsUsernameAvailable(true); // default to true on error
      } finally {
        setCheckingUsername(false);
      }
    };

    fetchSuggestions();

    return () => {
      controller.abort();
      controllerRef.current = null;
    };
  }, [debouncedQuery]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const sanitizedValue = name === "username" ? value.replace(/\s/g, "") : value;
    setUsername(sanitizedValue);
    setProfile({ ...profile, [name]: sanitizedValue });
  };

  const handleGenderChange = (value) => {
    setProfile({ ...profile, gender: value });
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      alert("Image must be < 5MB");
      return;
    }
    setFile(selected);
    setSelectedAvatarPath(null); // custom upload overrides predefined avatar
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result);
    reader.readAsDataURL(selected);
  };

  const handleAvatarSelect = (avatarSrc, publicPath) => {
    // Use the public path directly — no Cloudinary upload needed for predefined avatars
    setSelectedAvatarPath(publicPath);
    setFile(null); // clear any custom file upload
    setPreview(avatarSrc);
    toast.success("Avatar selected! Click 'Update Profile' to save.");
  };

  const saveProfileFields = async (userId) => {
    profile.username = profile.username.trim();
    if (!profile.username) {
      toast.error("Username cannot be empty");
      return;
    }
    const payload = {
      username: profile.username,
      upiId: profile.upiId,
      gender: profile.gender,
    };
    // If a predefined avatar was selected, include it so the backend saves it directly
    if (selectedAvatarPath) {
      payload.avatarUrl = selectedAvatarPath;
    }
    return authFetch(`${API_BASE}/user/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  };

  const uploadPhoto = async (userId) => {
    if (!file) return null;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("profilePhoto", file);
      const resp = await authFetch(`${API_BASE}/user/${userId}/photo`, {
        method: "PUT",
        body: formData,
      });
      return resp;
    } catch (err) {
      console.error("Photo upload error:", err);
      alert("Photo upload failed");
      throw err;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!profile.gender) {
      toast.error("Please select a gender");
      return;
    }

    if (profile.username && /\s/.test(profile.username)) {
      toast.error("Username cannot contain spaces");
      return;
    }

    try {
      const userId = Cookies.get("id");
      if (!userId) return;

      const response = await saveProfileFields(userId);
      const data = await response.json();
      let fetchedUser = data.user;

      // Only upload to Cloudinary if a custom file was selected (not a predefined avatar)
      if (file && !selectedAvatarPath) {
        try {
          const photoResp = await uploadPhoto(userId);
          if (photoResp?.ok) {
            const photoData = await photoResp.json();
            fetchedUser = photoData.user;
          }
        } catch (err) {
          console.error("Photo upload failed during submit:", err);
        }
      }

      if (response.ok) {
        localStorage.setItem("user", JSON.stringify(fetchedUser));
        setUser(fetchedUser);
        setProfile({
          username: fetchedUser.username || "",
          upiId: fetchedUser.upiId || "",
          email: fetchedUser.email || "",
          gender: fetchedUser.gender || "Do not disclose",
        });
        setUsername(fetchedUser.username || "");
        if (fetchedUser.profilePhotoUrl)
          setPreview(fetchedUser.profilePhotoUrl);
        toast.success("Profile updated successfully!");
        navigate("/dash");
      } else {
        console.error("Unexpected response:", response);
      }
    } catch (err) {
      console.error("Error updating profile:", err);
    }
  };

  const handleShareProfile = async () => {
    const userId = Cookies.get("id");
    const profileLink = `https://fairfare-beta.vercel.app/public-profile/${userId}`;
    const message = `Hey! 👋

Check out my FairFare profile:

🔗 Add me as a friend using this link:
${profileLink}

📧 Or use my email to add me manually:
https://fairfare-beta.vercel.app/addFriend

Username:
${user?.username}

Let's split and share smarter with FairFare! 💸`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Check out my FairFare profile!",
          text: message,
        });
      } catch (error) {
        console.error("Sharing failed:", error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(profileLink);
        alert("Link copied to clipboard!");
      } catch (err) {
        const textarea = document.createElement("textarea");
        textarea.value = profileLink;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        alert("Link copied to clipboard!");
      }
    }
  };

  return (
    <div className="relative bg-zinc-950 flex items-center justify-center min-h-screen overflow-hidden p-2 font-sans selection:bg-indigo-500/30 text-zinc-100">
      {/* --- BACKGROUND FX --- */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[20%] w-[500px] h-[500px] bg-indigo-900/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-fuchsia-900/10 rounded-full blur-[100px]"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
      </div>

      {/* --- NAVIGATION --- */}
      {/* Only show Back/Share if gender is selected AND SAVED (persisted in user object) */}
      {user?.gender ? (
        <>
          <motion.button
            onClick={() => navigate("/dash")}
            className="fixed top-6 left-6 z-50 group"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
          >
            <div className="relative p-3 rounded-full bg-zinc-900/50 backdrop-blur-md border border-white/10 shadow-xl hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all duration-300">
              <ArrowLeft className="h-5 w-5 text-zinc-400 group-hover:text-indigo-400 transition-colors" />
            </div>
          </motion.button>

          <motion.button
            onClick={handleShareProfile}
            className="fixed top-6 right-6 z-50 group"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            whileTap={{ scale: 0.9, rotate: -15 }}
            whileHover={{ scale: 1.1 }}
          >
            <div className="relative p-3 rounded-full bg-zinc-900/50 backdrop-blur-md border border-white/10 shadow-xl hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all duration-300">
              <Share2 className="h-5 w-5 text-zinc-400 group-hover:text-indigo-400 transition-colors" />
            </div>
          </motion.button>
        </>
      ) : (
        <motion.div
          className="fixed top-6 left-6 z-50"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <p className="text-red-500 font-bold text-sm bg-black/50 px-3 py-2 rounded-xl backdrop-blur-md border border-red-500/30 shadow-lg animate-pulse">
            Please select Gender & Update Profile to exit
          </p>
        </motion.div>
      )}

      {/* --- MAIN CARD --- */}
      <motion.div
        initial={{ opacity: 0, rotateX: 8 }}
        animate={{ opacity: 1, rotateX: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ perspective: 800 }}
        className="relative pt-4 md:pt-6 px-4 md:px-6 z-10 w-full max-w-2xl"
      >
        <div className="bg-zinc-900/40 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden relative">
          {/* --- BANNER --- */}
          <motion.div
            className="relative h-32 md:h-40 bg-gradient-to-br from-slate-800 via-slate-900 to-black overflow-hidden group"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>

            {/* Subtle Industrial Gradient instead of Gold */}
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/50 to-transparent"></div>

            {/* Status Badge in Corner */}
            <motion.div
              className="absolute top-4 md:top-6 right-4 md:right-8 flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 backdrop-blur-md"
              initial={{ opacity: 0, scale: 0.8, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 18 }}
            >
              <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
              <span className="text-[10px] font-bold tracking-widest text-amber-300 uppercase">
                Premium Member
              </span>
            </motion.div>
          </motion.div>

          <div className="px-6 sm:px-10 pb-8">
            {/* --- AVATAR SECTION --- */}
            <motion.div
              className="relative -mt-16 md:-mt-20 mb-8 flex flex-col items-center"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div
                className="relative group cursor-pointer"
                onMouseEnter={() => setIsHoveringPhoto(true)}
                onMouseLeave={() => setIsHoveringPhoto(false)}
              >
                {/* Glowing Ring Effect */}
                <motion.div
                  className="absolute -inset-1 rounded-full bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-700 blur-md"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 0.7, scale: 1 }}
                  transition={{ delay: 0.35, duration: 0.5 }}
                  whileHover={{ opacity: 1 }}
                />

                <motion.div
                  className="relative w-24 h-24 md:w-36 md:h-36 rounded-full p-[3px] bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-700 shadow-2xl"
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.25 }}
                  whileHover={{ scale: 1.04 }}
                >
                  <div className="w-full h-full rounded-full bg-slate-900 overflow-hidden border-4 border-slate-900 relative">
                    {preview ? (
                      <img
                        src={preview}
                        alt="Profile"
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-90 group-hover:opacity-100"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                        <User className="w-16 h-16 text-zinc-700" />
                      </div>
                    )}

                    {/* Overlay for upload */}
                    <AnimatePresence>
                      {isHoveringPhoto && (
                        <motion.div
                          className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.2 }}
                        >
                          <Camera className="w-8 h-8 text-white mb-1" />
                          <span className="text-[10px] text-white/80 font-medium tracking-wide uppercase">
                            Change
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>

                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Floating Action Button */}
                <motion.label
                  htmlFor="photo-upload"
                  className="absolute bottom-1 right-1 bg-zinc-100 text-zinc-950 rounded-full p-2.5 shadow-lg shadow-black/50 cursor-pointer hover:bg-white transition-all"
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Upload className="w-4 h-4" />
                </motion.label>
              </div>
            </motion.div>

            {/* --- DEFAULT AVATAR SELECTION --- */}
            <div className="mb-10 space-y-4">
              <AvatarSelector
                gender={profile.gender}
                setGender={(g) => handleGenderChange(g)}
                onSelectAvatar={handleAvatarSelect}
              />
            </div>

            {/* --- HEADER TEXT --- */}
            <motion.div
              className="text-center mb-10"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-2">
                {profile.username || "User Profile"}
              </h2>
              <p className="text-zinc-500 text-sm flex items-center justify-center gap-2">
                Manage your personal identity and preferences
              </p>
            </motion.div>

            {/* --- FORM --- */}
            <motion.form
              onSubmit={handleSubmit}
              className="space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              {/* Username Field */}
              <motion.div
                className="group space-y-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.45, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">
                  Display Name
                </label>
                <div className="relative transition-all duration-300 focus-within:transform focus-within:-translate-y-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-zinc-600 group-focus-within:text-zinc-100 transition-colors" />
                  </div>
                  <input
                    type="text"
                    name="username"
                    value={profile.username}
                    onChange={handleChange}
                    className={`block w-full pl-12 pr-4 py-4 bg-zinc-900/40 border ${isUsernameAvailable
                      ? "border-white/5 focus:border-indigo-500/50"
                      : "border-red-500/30"
                      } rounded-xl text-white placeholder-zinc-700 focus:bg-zinc-900/80 focus:outline-none transition-all shadow-inner`}
                    placeholder="Choose a unique handle"
                  />
                  <AnimatePresence>
                    {!isUsernameAvailable && (
                      <motion.div
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-red-400 text-xs font-medium bg-red-500/10 px-2 py-1 rounded"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                      >
                        Taken
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Email Field (Read Only) */}
              <motion.div
                className="group space-y-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1 flex justify-between">
                  <span>Digital ID</span>
                </label>
                <div className="relative opacity-60">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-zinc-600" />
                  </div>
                  <input
                    type="email"
                    value={profile.email}
                    readOnly
                    className="block w-full pl-12 pr-10 py-4 bg-zinc-900/20 border border-zinc-800 rounded-xl text-zinc-400 font-mono text-sm cursor-default focus:outline-none"
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <Lock className="h-4 w-4 text-zinc-700" />
                  </div>
                </div>
              </motion.div>

              {/* UPI Field */}
              <motion.div
                className="group space-y-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                  Payment Handle
                </label>
                <div className="relative transition-all duration-300 focus-within:transform focus-within:-translate-y-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <CreditCard className="h-5 w-5 text-zinc-600 group-focus-within:text-zinc-100 transition-colors" />
                  </div>
                  <input
                    type="text"
                    name="upiId"
                    value={profile.upiId}
                    onChange={handleChange}
                    className="block w-full pl-12 pr-4 py-4 bg-zinc-900/40 border border-white/5 rounded-xl text-white placeholder-zinc-700 focus:border-indigo-500/50 focus:bg-zinc-900/80 focus:outline-none transition-all shadow-inner"
                    placeholder="username@bank"
                  />
                </div>
              </motion.div>

              {/* Bottom Actions */}
              <motion.div
                className="pt-4 flex flex-col gap-4"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.4 }}
              >
                {!profile.gender && (
                  <p className="text-red-400 text-xs text-center font-bold uppercase tracking-wider animate-pulse">
                    ⚠️ Select Gender to Unlock Exit
                  </p>
                )}
                <motion.button
                  type="submit"
                  disabled={
                    !profile.upiId ||
                    uploading ||
                    !isUsernameAvailable ||
                    checkingUsername ||
                    !profile.gender
                  }
                  className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-widest shadow-xl transition-all duration-300 ${!profile.upiId || uploading || !profile.gender || !isUsernameAvailable || checkingUsername
                    ? "bg-zinc-800 text-zinc-600 cursor-not-allowed border border-white/5"
                    : "bg-indigo-400/70 text-zinc-950 hover:bg-white hover:shadow-zinc-500/10"
                    }`}
                  whileTap={!(!profile.upiId || uploading || !profile.gender || !isUsernameAvailable || checkingUsername) ? { scale: 0.97 } : {}}
                  whileHover={!(!profile.upiId || uploading || !profile.gender || !isUsernameAvailable || checkingUsername) ? { scale: 1.02 } : {}}
                >
                  {uploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.span
                        className="w-4 h-4 border-2 border-zinc-400 border-t-zinc-800 rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      Processing...
                    </span>
                  ) : (
                    "Update Profile"
                  )}
                </motion.button>

                <motion.button
                  type="button"
                  onClick={() => setShowSignOutConfirm(true)}
                  className="w-full py-3 rounded-xl font-semibold text-sm uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all duration-300 flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <FaSignOutAlt className="text-sm" />
                  Sign Out
                </motion.button>

                <motion.button
                  type="button"
                  onClick={() => navigate("/change-password")}
                  className="text-xs font-medium text-zinc-600 hover:text-zinc-300 transition-colors text-center"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Change Password?
                </motion.button>
              </motion.div>
            </motion.form>
          </div>
        </div>
      </motion.div>
      <AnimatePresence>
        {showSignOutConfirm && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-[90%] max-w-sm text-center shadow-2xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="text-lg font-semibold text-white mb-2">
                Confirm Sign Out
              </h3>

              <p className="text-zinc-400 text-sm mb-6">
                Are you sure you want to sign out of your account?
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSignOutConfirm(false)}
                  className="flex-1 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
                >
                  Cancel
                </button>

                <button
                  onClick={() => {
                    setShowSignOutConfirm(false);
                    handleSignOut();
                  }}
                  className="flex-1 py-2.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition"
                >
                  Sign Out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfileEnhanced;
